import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  getMicrosoftMessageAttachmentContent,
  getMicrosoftTokenExpiry,
  getValidMicrosoftAccessToken,
  type MicrosoftConnection,
} from "@/lib/integrations/microsoft-graph";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const attachmentBucket = "rfq-email-attachments";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

function safeStorageFileName(fileName: string) {
  return fileName.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "attachment";
}

export async function POST(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  let failureUpdate:
    | {
        supabase: Awaited<ReturnType<typeof createClient>>;
        organizationId: string;
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
    failureUpdate = { supabase, organizationId: organization.id };
    const { data: attachment, error: attachmentError } = await supabase
      .from("email_attachments")
      .select("id, email_message_id, provider_attachment_id, file_name, content_type, size_bytes")
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
        { success: false, error: "Attachment not found." },
        { status: 404 },
      );
    }

    if (!attachment.provider_attachment_id) {
      return Response.json(
        { success: false, error: "Attachment does not have a Microsoft attachment id." },
        { status: 400 },
      );
    }

    const { data: email, error: emailError } = await supabase
      .from("email_messages")
      .select("id, provider, provider_message_id")
      .eq("id", attachment.email_message_id)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (emailError) {
      return Response.json(
        { success: false, error: emailError.message },
        { status: 400 },
      );
    }

    if (!email) {
      return Response.json(
        { success: false, error: "Email message not found." },
        { status: 404 },
      );
    }

    if (email.provider !== "microsoft_graph") {
      return Response.json(
        { success: false, error: "This attachment is not from Microsoft Graph." },
        { status: 400 },
      );
    }

    const { data: emailWithRfq, error: emailRfqError } = await supabase
      .from("email_messages")
      .select("id, rfq_id")
      .eq("id", email.id)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (emailRfqError || !emailWithRfq) {
      return Response.json(
        { success: false, error: emailRfqError?.message ?? "Email message not found." },
        { status: 404 },
      );
    }

    if (!emailWithRfq.rfq_id) {
      return Response.json(
        {
          success: false,
          error: "Create an RFQ from this email before extracting attachment items.",
        },
        { status: 400 },
      );
    }

    const { data: connectionData, error: connectionError } = await supabase
      .from("email_connections")
      .select(
        "id, organization_id, provider, mailbox_email, access_token, refresh_token, token_expires_at, is_active",
      )
      .eq("organization_id", organization.id)
      .eq("provider", "microsoft_graph")
      .eq("is_active", true)
      .maybeSingle();

    if (connectionError) {
      return Response.json(
        { success: false, error: connectionError.message },
        { status: 400 },
      );
    }

    if (!connectionData) {
      return Response.json(
        { success: false, error: "No Microsoft connection configured." },
        { status: 400 },
      );
    }

    const connection = connectionData as MicrosoftConnection;
    const token = await getValidMicrosoftAccessToken(connection);

    if (token.refreshed) {
      // TODO: Encrypt Microsoft tokens before public production release.
      const { error: tokenUpdateError } = await supabase
        .from("email_connections")
        .update({
          access_token: token.refreshed.access_token,
          refresh_token: token.refreshed.refresh_token ?? connection.refresh_token,
          token_expires_at: getMicrosoftTokenExpiry(token.refreshed.expires_in),
        })
        .eq("id", connection.id)
        .eq("organization_id", organization.id);

      if (tokenUpdateError) {
        return Response.json(
          { success: false, error: tokenUpdateError.message },
          { status: 400 },
        );
      }
    }

    const downloaded = await getMicrosoftMessageAttachmentContent(
      token.accessToken,
      email.provider_message_id,
      attachment.provider_attachment_id,
    );
    if (!downloaded.contentBuffer) {
      await supabase
        .from("email_attachments")
        .update({
          ocr_status: "failed",
          extraction_error: "Attachment contentBytes missing.",
        })
        .eq("id", attachment.id)
        .eq("organization_id", organization.id);

      return Response.json(
        {
          success: false,
          error: "Attachment contentBytes missing",
        },
        { status: 400 },
      );
    }

    const fileName = safeStorageFileName(downloaded.fileName || attachment.file_name || "attachment");
    const storagePath = `organizations/${organization.id}/emails/${email.id}/${attachment.id}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(attachmentBucket)
      .upload(storagePath, downloaded.contentBuffer, {
        contentType: downloaded.contentType || attachment.content_type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      await supabase
        .from("email_attachments")
        .update({
          ocr_status: "failed",
          extraction_error: uploadError.message,
        })
        .eq("id", attachment.id)
        .eq("organization_id", organization.id);

      return Response.json(
        {
          success: false,
          error: "Supabase storage upload failed",
          details: uploadError.message,
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("email_attachments")
      .update({
        file_name: fileName,
        content_type: downloaded.contentType || attachment.content_type,
        size_bytes: downloaded.sizeBytes ?? attachment.size_bytes,
        storage_path: storagePath,
        ocr_status: "pending",
        extraction_error: null,
      })
      .eq("id", attachment.id)
      .eq("organization_id", organization.id);

    if (updateError) {
      return Response.json(
        { success: false, error: updateError.message },
        { status: 400 },
      );
    }

    revalidatePath(`/email-intake/${email.id}`);
    revalidatePath(`/rfqs/${emailWithRfq.rfq_id}`);

    return Response.json({
      success: true,
      storagePathSaved: true,
      ocrStatus: "pending",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Microsoft attachment download failed.";
    if (failureUpdate) {
      await failureUpdate.supabase
        .from("email_attachments")
        .update({
          ocr_status: "failed",
          extraction_error: message,
        })
        .eq("id", attachmentId)
        .eq("organization_id", failureUpdate.organizationId);
    }

    return Response.json(
      {
        success: false,
        error: "Microsoft attachment download failed",
        details: message,
      },
      { status: 400 },
    );
  }
}
