import { revalidatePath } from "next/cache";
import { extractTextFromAttachment } from "@/lib/attachments/extract-text";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  extractRfqItemsFromEmailText,
  isSupplierQuoteTableText,
} from "@/lib/email/rfq-item-extractor";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const attachmentBucket = "rfq-email-attachments";
const maxImageOcrBytes = 10 * 1024 * 1024;

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "Not authenticated. Please log in again." },
        { status: 401 },
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return Response.json(
        { success: false, error: "No active organization found." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: attachment, error: attachmentError } = await supabase
      .from("email_attachments")
      .select(
        "id, organization_id, email_message_id, file_name, content_type, size_bytes, storage_path",
      )
      .eq("id", attachmentId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (attachmentError) {
      return Response.json(
        { success: false, error: attachmentError.message },
        { status: 400 },
      );
    }

    if (!attachment) {
      return Response.json(
        { success: false, error: "Attachment was not found." },
        { status: 404 },
      );
    }

    if (!attachment.storage_path) {
      return Response.json(
        {
          success: false,
          error: "Attachment file content has not been downloaded yet.",
        },
        { status: 400 },
      );
    }

    const normalizedContentType = (attachment.content_type || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const lowerFileName = (attachment.file_name || "").toLowerCase();
    const isImage =
      ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp"].includes(
        normalizedContentType,
      ) ||
      [".png", ".jpg", ".jpeg", ".webp", ".bmp"].some((extension) =>
        lowerFileName.endsWith(extension),
      );

    if (isImage && (attachment.size_bytes ?? 0) > maxImageOcrBytes) {
      await supabase
        .from("email_attachments")
        .update({
          ocr_status: "failed",
          extraction_method: "image_ocr",
          extraction_error: "Image is too large for OCR. Please upload a smaller file.",
          extracted_at: new Date().toISOString(),
        })
        .eq("id", attachment.id)
        .eq("organization_id", organization.id);

      return Response.json(
        {
          success: false,
          error: "Image is too large for OCR. Please upload a smaller file.",
        },
        { status: 400 },
      );
    }

    const { data: email, error: emailError } = await supabase
      .from("email_messages")
      .select("id, rfq_id")
      .eq("id", attachment.email_message_id)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (emailError || !email) {
      return Response.json(
        { success: false, error: emailError?.message ?? "Email message not found." },
        { status: 404 },
      );
    }

    if (!email.rfq_id) {
      return Response.json(
        {
          success: false,
          error: "Create an RFQ from this email before extracting attachment items.",
        },
        { status: 400 },
      );
    }

    await supabase
      .from("email_attachments")
      .update({ ocr_status: "processing", extraction_error: null })
      .eq("id", attachment.id)
      .eq("organization_id", organization.id);

    const { data: file, error: downloadError } = await supabase.storage
      .from(attachmentBucket)
      .download(attachment.storage_path);

    if (downloadError || !file) {
      const details = downloadError?.message ?? "Unable to download attachment from storage.";
      await supabase
        .from("email_attachments")
        .update({
          ocr_status: "failed",
          extraction_error: details,
          extracted_at: new Date().toISOString(),
        })
        .eq("id", attachment.id)
        .eq("organization_id", organization.id);

      return Response.json(
        {
          success: false,
          error: "Attachment download failed",
          details,
        },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractTextFromAttachment({
      fileBuffer,
      fileName: attachment.file_name || "attachment",
      contentType: attachment.content_type,
    });

    const extractedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("email_attachments")
      .update({
        ocr_status: extraction.status,
        extracted_text: extraction.text || null,
        extraction_method: extraction.method,
        extraction_error: extraction.error,
        extracted_at: extractedAt,
        raw_extraction: extraction.raw,
      })
      .eq("id", attachment.id)
      .eq("organization_id", organization.id);

    if (updateError) {
      return Response.json(
        { success: false, error: updateError.message },
        { status: 400 },
      );
    }

    let extractedItemCount = 0;
    let supplierQuoteTableDetected = false;
    if (extraction.text) {
      let items;
      try {
        supplierQuoteTableDetected = isSupplierQuoteTableText(extraction.text);
        items = extractRfqItemsFromEmailText(extraction.text);
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: "RFQ item extraction failed",
            details:
              error instanceof Error ? error.message : "Unable to detect RFQ items.",
          },
          { status: 400 },
        );
      }

      await supabase
        .from("attachment_extracted_items")
        .delete()
        .eq("organization_id", organization.id)
        .eq("email_attachment_id", attachment.id)
        .in("status", ["pending", "rejected"]);

      if (items.length) {
        const { error: itemError } = await supabase
          .from("attachment_extracted_items")
          .insert(
            items.map((item) => ({
              organization_id: organization.id,
              email_message_id: attachment.email_message_id,
              email_attachment_id: attachment.id,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes ?? null,
              confidence:
                item.confidence ?? (extraction.method === "image_ocr" ? 0.6 : 0.75),
              status: "pending",
            })),
          );

        if (itemError) {
          return Response.json(
            { success: false, error: itemError.message },
            { status: 400 },
          );
        }
      }

      extractedItemCount = items.length;
    }

    revalidatePath(`/email-intake/${attachment.email_message_id}`);
    revalidatePath(`/rfqs/${email.rfq_id}`);

    if (extraction.status === "failed") {
      const isPdf =
        attachment.content_type === "application/pdf" ||
        (attachment.file_name || "").toLowerCase().endsWith(".pdf");
      const imageOcrFailed = extraction.method === "image_ocr";
      const noReadablePdfText =
        isPdf && extraction.error?.startsWith("No readable PDF text found");

      return Response.json(
        {
          success: false,
          error: noReadablePdfText
            ? "No readable PDF text found"
            : imageOcrFailed
              ? extraction.error?.startsWith("No readable text found")
                ? "No readable text found in image"
                : "Image OCR failed"
            : isPdf
              ? "PDF text extraction failed"
              : "Attachment text extraction failed",
          details: noReadablePdfText
            ? "This may be a scanned or image-based PDF."
            : extraction.error ?? "Attachment text extraction failed.",
          extractedTextPreview: extraction.text.slice(0, 1000),
          extractedItemCount,
          method: extraction.method,
          status: extraction.status,
        },
        { status: 400 },
      );
    }

    return Response.json({
      success: true,
      extractedTextPreview: extraction.text.slice(0, 1000),
      extractedItemCount,
      warning:
        extraction.text && extractedItemCount === 0
          ? supplierQuoteTableDetected
            ? "Text was extracted, but no clean item table rows were detected."
            : "Text was extracted, but no RFQ item rows were detected."
          : undefined,
      method: extraction.method,
      status: extraction.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attachment text extraction failed.";
    const supabase = await createClient();
    await supabase
      .from("email_attachments")
      .update({
        ocr_status: "failed",
        extraction_error: message,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", attachmentId);

    return Response.json(
      {
        success: false,
        error: "Attachment text extraction failed",
        details: message,
      },
      { status: 400 },
    );
  }
}
