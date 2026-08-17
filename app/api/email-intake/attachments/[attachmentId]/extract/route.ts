import { revalidatePath } from "next/cache";
import { extractTextFromAttachment } from "@/lib/attachments/extract-text";
import { extractRfqItemsWithOllama } from "@/lib/attachments/ollama-rfq-extractor";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  type ExtractedRfqItem,
  extractRfqItemsFromEmailText,
  isSupplierQuoteTableText,
} from "@/lib/email/rfq-item-extractor";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const attachmentBucket = "rfq-email-attachments";
const maxImageOcrBytes = 10 * 1024 * 1024;
const maxLocalPdfExtractionBytes = 15 * 1024 * 1024;
const largePdfMessage =
  "PDF is too large for local extraction. Please split the file or process it with the production OCR service.";

function itemKey(item: Pick<ExtractedRfqItem, "description" | "quantity" | "unit">) {
  return `${item.description.trim().toLowerCase()}|${Number(item.quantity ?? 0)}|${String(
    item.unit ?? "",
  )
    .trim()
    .toLowerCase()}`;
}

function mergeExtractedItems(primary: ExtractedRfqItem[], secondary: ExtractedRfqItem[]) {
  const merged: ExtractedRfqItem[] = [];
  const keys = new Set<string>();

  for (const item of [...primary, ...secondary]) {
    const key = itemKey(item);
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(item);
  }

  return merged;
}

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

type BeginAttachmentExtractionResult = {
  ok: boolean;
  claimed: boolean;
  ocr_run_id: string | null;
  ocr_attempts: number;
  error_message: string | null;
};

type ReplaceAttachmentExtractedItemsResult = {
  ok: boolean;
  inserted_count: number;
  preserved_count: number;
  error_message: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function normalizeBeginAttachmentExtractionResult(
  data: unknown,
): BeginAttachmentExtractionResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  const result = row as Partial<BeginAttachmentExtractionResult>;
  return {
    ok: Boolean(result.ok),
    claimed: Boolean(result.claimed),
    ocr_run_id:
      typeof result.ocr_run_id === "string" ? result.ocr_run_id : null,
    ocr_attempts:
      typeof result.ocr_attempts === "number" ? result.ocr_attempts : 0,
    error_message:
      typeof result.error_message === "string" ? result.error_message : null,
  };
}

function normalizeReplaceAttachmentExtractedItemsResult(
  data: unknown,
): ReplaceAttachmentExtractedItemsResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  const result = row as Partial<ReplaceAttachmentExtractedItemsResult>;
  return {
    ok: Boolean(result.ok),
    inserted_count:
      typeof result.inserted_count === "number" ? result.inserted_count : 0,
    preserved_count:
      typeof result.preserved_count === "number" ? result.preserved_count : 0,
    error_message:
      typeof result.error_message === "string" ? result.error_message : null,
  };
}

function claimStatusCode(message: string | null) {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("not found")) return 404;
  if (normalized.includes("completed") || normalized.includes("skipped")) return 409;
  if (normalized.includes("processing")) return 409;
  if (normalized.includes("permission") || normalized.includes("authorized")) return 403;
  return 400;
}

async function finalizeAttachmentRun({
  supabase,
  attachmentId,
  organizationId,
  ocrRunId,
  values,
}: {
  supabase: SupabaseClient;
  attachmentId: string;
  organizationId: string;
  ocrRunId: string;
  values: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("email_attachments")
    .update(values)
    .eq("id", attachmentId)
    .eq("organization_id", organizationId)
    .eq("ocr_status", "processing")
    .eq("ocr_run_id", ocrRunId)
    .select("id")
    .maybeSingle();

  return { updated: Boolean(data), error };
}

export async function POST(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  let claimedRun:
    | {
        supabase: SupabaseClient;
        organizationId: string;
        ocrRunId: string;
      }
    | null = null;

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
    const isPdf =
      normalizedContentType === "application/pdf" || lowerFileName.endsWith(".pdf");

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

    const { data: claimData, error: claimError } = await supabase.rpc(
      "begin_attachment_extraction",
      {
        p_attachment_id: attachmentId,
      },
    );

    if (claimError) {
      return Response.json(
        {
          success: false,
          error: "Unable to begin attachment extraction.",
          details: claimError.message,
        },
        { status: 400 },
      );
    }

    const claim = normalizeBeginAttachmentExtractionResult(claimData);
    if (!claim) {
      return Response.json(
        {
          success: false,
          error: "Unable to begin attachment extraction.",
          details: "The extraction claim response was invalid.",
        },
        { status: 400 },
      );
    }

    if (!claim.ok || !claim.claimed || !claim.ocr_run_id) {
      return Response.json(
        {
          success: false,
          claimed: false,
          error: claim.error_message || "Attachment extraction is not available.",
          attempts: claim.ocr_attempts,
        },
        { status: claimStatusCode(claim.error_message) },
      );
    }

    const claimedOcrRunId = claim.ocr_run_id;
    const claimedAttachmentId = attachment.id;
    claimedRun = {
      supabase,
      organizationId: organization.id,
      ocrRunId: claimedOcrRunId,
    };

    async function failClaimedRun(message: string, values?: Record<string, unknown>) {
      return finalizeAttachmentRun({
        supabase,
        attachmentId: claimedAttachmentId,
        organizationId: organization.id,
        ocrRunId: claimedOcrRunId,
        values: {
          ...(values ?? {}),
          ocr_status: "failed",
          extraction_error: message,
          ocr_run_id: null,
        },
      });
    }

    if (isPdf && (attachment.size_bytes ?? 0) > maxLocalPdfExtractionBytes) {
      const finalized = await failClaimedRun(largePdfMessage, {
        extraction_method: "pdf_text",
        raw_extraction: {
          sizeBytes: attachment.size_bytes,
          maxLocalPdfExtractionBytes,
        },
      });
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: largePdfMessage,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    if (isImage && (attachment.size_bytes ?? 0) > maxImageOcrBytes) {
      const details = "Image is too large for OCR. Please upload a smaller file.";
      const finalized = await failClaimedRun(details, {
        extraction_method: "image_ocr",
      });
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: details,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(attachmentBucket)
      .download(attachment.storage_path);

    if (downloadError || !file) {
      const details = downloadError?.message ?? "Unable to download attachment from storage.";
      const finalized = await failClaimedRun(details);
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: "Attachment download failed",
          details,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    if (isPdf && fileBuffer.byteLength > maxLocalPdfExtractionBytes) {
      const finalized = await failClaimedRun(largePdfMessage, {
        extraction_method: "pdf_text",
        raw_extraction: {
          sizeBytes: fileBuffer.byteLength,
          maxLocalPdfExtractionBytes,
        },
      });
      claimedRun = null;

      if (finalized.error) {
        return Response.json(
          { success: false, error: finalized.error.message },
          { status: 400 },
        );
      }

      return Response.json(
        {
          success: false,
          error: largePdfMessage,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    if (isImage && fileBuffer.byteLength > maxImageOcrBytes) {
      const details = "Image is too large for OCR. Please upload a smaller file.";
      const finalized = await failClaimedRun(details, {
        extraction_method: "image_ocr",
        raw_extraction: {
          sizeBytes: fileBuffer.byteLength,
          maxImageOcrBytes,
        },
      });
      claimedRun = null;

      if (finalized.error) {
        return Response.json(
          { success: false, error: finalized.error.message },
          { status: 400 },
        );
      }

      return Response.json(
        {
          success: false,
          error: details,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    const extraction = await extractTextFromAttachment({
      fileBuffer,
      fileName: attachment.file_name || "attachment",
      contentType: attachment.content_type,
    });

    let extractedItemCount = 0;
    let supplierQuoteTableDetected = false;
    let ollamaAssist:
      | Awaited<ReturnType<typeof extractRfqItemsWithOllama>>
      | null = null;
    let items: ExtractedRfqItem[] = [];
    if (extraction.text) {
      try {
        supplierQuoteTableDetected = isSupplierQuoteTableText(extraction.text);
        items = extractRfqItemsFromEmailText(extraction.text);
        ollamaAssist = await extractRfqItemsWithOllama({
          text: extraction.text,
          existingItemCount: items.length,
        });
        items = mergeExtractedItems(items, ollamaAssist.items);
      } catch (error) {
        const details =
          error instanceof Error ? error.message : "Unable to detect RFQ items.";
        const finalized = await failClaimedRun("RFQ item extraction failed", {
          extracted_text: extraction.text,
          extraction_method: extraction.method,
          raw_extraction: {
            ...extraction.raw,
            itemExtractionError: details,
          },
        });
        claimedRun = null;

        return Response.json(
          {
            success: false,
            error: "RFQ item extraction failed",
            details,
            staleRun: !finalized.updated,
          },
          { status: 400 },
        );
      }
    }

    const rawExtraction = ollamaAssist?.enabled
      ? {
          ...extraction.raw,
          ollama: {
            enabled: ollamaAssist.enabled,
            used: ollamaAssist.used,
            unavailable: ollamaAssist.unavailable,
            error: ollamaAssist.error,
            metadata: ollamaAssist.metadata,
          },
        }
      : extraction.raw;

    const extractedAt = new Date().toISOString();
    if (extraction.status === "failed" || extraction.status === "skipped") {
      const finalValues =
        extraction.status === "skipped"
          ? {
              ocr_status: "skipped",
              extracted_text: null,
              extraction_method: extraction.method,
              extraction_error: extraction.error,
              extracted_at: extractedAt,
              raw_extraction: rawExtraction,
              ocr_run_id: null,
            }
          : {
              ocr_status: "failed",
              extracted_text: extraction.text || null,
              extraction_method: extraction.method,
              extraction_error:
                extraction.error || "Attachment text extraction failed.",
              extracted_at: extractedAt,
              raw_extraction: rawExtraction,
              ocr_run_id: null,
            };
      const updateResult = await finalizeAttachmentRun({
        supabase,
        attachmentId: attachment.id,
        organizationId: organization.id,
        ocrRunId: claimedOcrRunId,
        values: finalValues,
      });
      claimedRun = null;

      if (updateResult.error) {
        return Response.json(
          { success: false, error: updateResult.error.message },
          { status: 400 },
        );
      }

      if (!updateResult.updated) {
        return Response.json(
          {
            success: false,
            error: "This extraction attempt was superseded by a newer run.",
          },
          { status: 409 },
        );
      }

      const imageOcrFailed = extraction.method === "image_ocr";
      const noReadablePdfText =
        isPdf && extraction.error?.startsWith("This PDF may be scanned");

      return Response.json(
        {
          success: false,
          error:
            extraction.status === "skipped"
              ? extraction.error || "Unsupported attachment type"
              : noReadablePdfText
                ? "No readable PDF text found"
                : imageOcrFailed
                  ? extraction.error?.startsWith("No readable text found")
                    ? "No readable text found in image"
                    : "Image OCR failed"
                  : isPdf
                    ? "PDF text extraction failed"
                    : "Attachment text extraction failed",
          details:
            extraction.status === "skipped"
              ? extraction.error
              : noReadablePdfText
                ? extraction.error
                : extraction.error ?? "Attachment text extraction failed.",
          extractedTextPreview: extraction.text.slice(0, 1000),
          extractedItemCount,
          method: extraction.method,
          status: extraction.status,
        },
        { status: 400 },
      );
    }

    const candidateItems = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes ?? null,
      confidence:
        item.confidence ?? (extraction.method === "image_ocr" ? 0.6 : 0.75),
    }));
    const { data: replacementData, error: replacementError } = await supabase.rpc(
      "replace_attachment_extracted_items",
      {
        p_email_attachment_id: attachment.id,
        p_ocr_run_id: claimedOcrRunId,
        p_items: candidateItems,
      },
    );

    if (replacementError) {
      const details = replacementError.message;
      const finalized = await failClaimedRun("Attachment item replacement failed", {
        extracted_text: extraction.text,
        extraction_method: extraction.method,
        extracted_at: extractedAt,
        raw_extraction: {
          ...rawExtraction,
          itemReplacementError: details,
        },
      });
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: "Attachment item replacement failed",
          details,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    const replacement = normalizeReplaceAttachmentExtractedItemsResult(replacementData);
    if (!replacement || !replacement.ok) {
      const details =
        replacement?.error_message ||
        "Attachment item replacement did not complete successfully.";
      const finalized = await failClaimedRun("Attachment item replacement failed", {
        extracted_text: extraction.text,
        extraction_method: extraction.method,
        extracted_at: extractedAt,
        raw_extraction: {
          ...rawExtraction,
          itemReplacementError: details,
        },
      });
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: "Attachment item replacement failed",
          details,
          staleRun: !finalized.updated,
        },
        { status: 400 },
      );
    }

    extractedItemCount = replacement.inserted_count;

    const updateResult = await finalizeAttachmentRun({
      supabase,
      attachmentId: attachment.id,
      organizationId: organization.id,
      ocrRunId: claimedOcrRunId,
      values: {
        ocr_status: "completed",
        extracted_text: extraction.text,
        extraction_method: extraction.method,
        extraction_error: null,
        extracted_at: extractedAt,
        raw_extraction: rawExtraction,
        ocr_run_id: null,
      },
    });

    if (updateResult.error) {
      await failClaimedRun("Attachment extraction finalization failed", {
        extracted_text: extraction.text,
        extraction_method: extraction.method,
        extracted_at: extractedAt,
        raw_extraction: {
          ...rawExtraction,
          finalizationError: updateResult.error.message,
        },
      });
      claimedRun = null;

      return Response.json(
        { success: false, error: updateResult.error.message },
        { status: 400 },
      );
    }

    if (!updateResult.updated) {
      claimedRun = null;

      return Response.json(
        {
          success: false,
          error: "This extraction attempt was superseded by a newer run.",
        },
        { status: 409 },
      );
    }

    claimedRun = null;

    revalidatePath(`/email-intake/${attachment.email_message_id}`);
    revalidatePath(`/rfqs/${email.rfq_id}`);

    return Response.json({
      success: true,
      extractedTextPreview: extraction.text.slice(0, 1000),
      extractedItemCount,
      insertedCount: replacement.inserted_count,
      preservedCount: replacement.preserved_count,
      warning:
        extraction.text && replacement.inserted_count + replacement.preserved_count === 0
          ? supplierQuoteTableDetected
            ? "Text was extracted, but no clean item table rows were detected."
            : "Text was extracted, but no RFQ item rows were detected."
          : undefined,
      ollama: ollamaAssist?.enabled
        ? {
            used: ollamaAssist.used,
            unavailable: ollamaAssist.unavailable,
            error: ollamaAssist.error,
            returnedItems: ollamaAssist.metadata.returnedItems,
          }
        : undefined,
      method: extraction.method,
      status: extraction.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attachment text extraction failed.";
    if (claimedRun) {
      await finalizeAttachmentRun({
        supabase: claimedRun.supabase,
        attachmentId,
        organizationId: claimedRun.organizationId,
        ocrRunId: claimedRun.ocrRunId,
        values: {
          ocr_status: "failed",
          extraction_error: message,
          ocr_run_id: null,
        },
      });
    }

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
