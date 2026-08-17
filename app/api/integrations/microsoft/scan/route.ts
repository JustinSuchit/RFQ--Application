import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import {
  getMicrosoftMessageAttachmentContent,
  getMicrosoftMessageAttachments,
  getMicrosoftTokenExpiry,
  getValidMicrosoftAccessToken,
  resolveMicrosoftMailFolderId,
  scanMicrosoftInbox,
  type MicrosoftConnection,
} from "@/lib/integrations/microsoft-graph";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const attachmentBucket = "rfq-email-attachments";

function safeStorageFileName(fileName: string) {
  return fileName.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "attachment";
}

export async function POST() {
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
    const { data, error } = await supabase
      .from("email_connections")
      .select(
        "id, organization_id, provider, mailbox_email, access_token, refresh_token, token_expires_at, graph_scan_folder, graph_scan_folder_id, graph_last_scan_at, graph_last_message_received_at, is_active",
      )
      .eq("organization_id", organization.id)
      .eq("provider", "microsoft_graph")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return Response.json(
        { success: false, error: "No Microsoft connection configured." },
        { status: 400 },
      );
    }

    const connection = data as MicrosoftConnection;
    const graphScanFolder = connection.graph_scan_folder?.trim() || "inbox";
    if (!graphScanFolder) {
      return Response.json(
        { success: false, error: "Microsoft scan folder missing." },
        { status: 400 },
      );
    }

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

    const folderId =
      connection.graph_scan_folder_id ||
      (await resolveMicrosoftMailFolderId(token.accessToken, graphScanFolder));

    if (!connection.graph_scan_folder_id || connection.graph_scan_folder_id !== folderId) {
      const { error: folderUpdateError } = await supabase
        .from("email_connections")
        .update({ graph_scan_folder_id: folderId })
        .eq("id", connection.id)
        .eq("organization_id", organization.id);

      if (folderUpdateError) {
        return Response.json(
          { success: false, error: folderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const scan = await scanMicrosoftInbox(
      { ...connection, graph_scan_folder: graphScanFolder },
      token.accessToken,
      folderId,
    );
    let insertedOrUpdated = 0;
    let likelyRfq = 0;
    let possibleRfq = 0;
    let skippedNotRfq = 0;

    for (const message of scan.messages) {
      if (message.classification === "not_rfq") {
        skippedNotRfq += 1;
        continue;
      }

      if (message.classification === "likely_rfq") likelyRfq += 1;
      if (message.classification === "possible_rfq") possibleRfq += 1;

      const { data: emailMessage, error: upsertError } = await supabase
        .from("email_messages")
        .upsert(
          {
            organization_id: organization.id,
            email_connection_id: connection.id,
            provider: "microsoft_graph",
            provider_message_id: message.providerMessageId,
            conversation_id: message.conversationId,
            from_email: message.fromEmail,
            from_name: message.fromName,
            subject: message.subject,
            body_preview: message.bodyPreview,
            body: message.bodyText ?? message.bodyPreview,
            body_text: message.bodyText,
            body_html: message.bodyHtml,
            received_at: message.receivedAt,
            has_attachments: message.hasAttachments,
            matched_keywords: message.matchedKeywords,
            classification: message.classification,
            classification_reason: message.classificationReason,
            is_rfq: message.classification === "likely_rfq" ? true : null,
            raw_payload: message.rawPayload,
          },
          { onConflict: "organization_id,provider_message_id" },
        )
        .select("id")
        .single();

      if (upsertError || !emailMessage) {
        return Response.json(
          { success: false, error: upsertError?.message ?? "Unable to save email message." },
          { status: 400 },
        );
      }

      if (message.hasAttachments) {
        try {
          const attachments = await getMicrosoftMessageAttachments(
            token.accessToken,
            message.providerMessageId,
          );

          for (const attachment of attachments) {
            const fileName = safeStorageFileName(attachment.fileName);
            let attachmentContent = attachment;
            const { data: existingAttachment, error: existingAttachmentError } = await supabase
              .from("email_attachments")
              .select("id, storage_path, ocr_status")
              .eq("organization_id", organization.id)
              .eq("email_message_id", emailMessage.id)
              .eq("provider_attachment_id", attachment.providerAttachmentId)
              .maybeSingle();

            if (existingAttachmentError) {
              console.warn(
                "Microsoft attachment metadata lookup failed",
                existingAttachmentError.message,
              );
              continue;
            }

            let attachmentRow = existingAttachment;
            if (!attachmentRow) {
              const { data: insertedAttachment, error: insertAttachmentError } =
                await supabase
                  .from("email_attachments")
                  .insert({
                    organization_id: organization.id,
                    email_message_id: emailMessage.id,
                    provider_attachment_id: attachment.providerAttachmentId,
                    file_name: fileName,
                    content_type: attachment.contentType,
                    size_bytes: attachment.sizeBytes,
                    storage_path: null,
                    ocr_status: "pending",
                    extraction_error: null,
                  })
                    .select("id, storage_path, ocr_status")
                  .single();

              if (insertAttachmentError) {
                console.warn(
                  "Microsoft attachment metadata save failed",
                  insertAttachmentError.message,
                );
                continue;
              }

              attachmentRow = insertedAttachment;
            }

            if (!attachmentRow) {
              console.warn("Microsoft attachment metadata save failed", {
                attachmentName: fileName,
              });
              continue;
            }

            if (existingAttachment) {
              const { error: metadataUpdateError } = await supabase
                .from("email_attachments")
                .update({
                  file_name: fileName,
                  content_type: attachment.contentType,
                  size_bytes: attachment.sizeBytes,
                })
                .eq("id", attachmentRow.id)
                .eq("organization_id", organization.id);

              if (metadataUpdateError) {
                console.warn(
                  "Microsoft attachment metadata refresh failed",
                  metadataUpdateError.message,
                );
              }
            }

            if (attachmentRow.storage_path) {
              continue;
            }

            if (
              existingAttachment &&
              !["pending", "failed"].includes(existingAttachment.ocr_status || "pending")
            ) {
              continue;
            }

            if (!attachmentContent.contentBuffer) {
              try {
                attachmentContent = await getMicrosoftMessageAttachmentContent(
                  token.accessToken,
                  message.providerMessageId,
                  attachment.providerAttachmentId,
                );
              } catch (downloadError) {
                const downloadMessage =
                  downloadError instanceof Error
                    ? downloadError.message
                    : "Microsoft attachment download failed.";
                console.warn("Microsoft attachment download failed", {
                  attachmentName: fileName,
                  contentType: attachment.contentType,
                  size: attachment.sizeBytes,
                  error: downloadMessage,
                });
                await supabase
                  .from("email_attachments")
                  .update({
                    ocr_status: "failed",
                    extraction_error: downloadMessage,
                  })
                  .eq("id", attachmentRow.id)
                  .eq("organization_id", organization.id);
                continue;
              }
            }

            if (!attachmentContent.contentBuffer) {
              console.warn("Microsoft attachment download failed", {
                attachmentName: fileName,
                contentType: attachment.contentType,
                size: attachment.sizeBytes,
                error: "Attachment contentBytes missing.",
              });
              await supabase
                .from("email_attachments")
                .update({
                  ocr_status: "failed",
                  extraction_error: "Attachment contentBytes missing.",
                })
                .eq("id", attachmentRow.id)
                .eq("organization_id", organization.id);
              continue;
            }

            const storagePath = `organizations/${organization.id}/emails/${emailMessage.id}/${attachmentRow.id}-${fileName}`;
            const { error: uploadError } = await supabase.storage
              .from(attachmentBucket)
              .upload(storagePath, attachmentContent.contentBuffer, {
                contentType: attachmentContent.contentType || "application/octet-stream",
                upsert: true,
              });

            if (uploadError) {
              console.warn("Microsoft attachment upload failed", {
                attachmentName: fileName,
                contentType: attachmentContent.contentType,
                size: attachmentContent.sizeBytes,
                error: uploadError.message,
              });
              await supabase
                .from("email_attachments")
                .update({
                  ocr_status: "failed",
                  extraction_error: uploadError.message,
                })
                .eq("id", attachmentRow.id)
                .eq("organization_id", organization.id);
              continue;
            }

            const { error: storagePathError } = await supabase
              .from("email_attachments")
              .update({
                storage_path: storagePath,
                ocr_status: "pending",
                extraction_error: null,
              })
              .eq("id", attachmentRow.id)
              .eq("organization_id", organization.id);

            if (storagePathError) {
              console.warn(
                "Microsoft attachment storage path update failed",
                storagePathError.message,
              );
            }
          }
        } catch (attachmentFetchError) {
          console.warn(
            "Microsoft attachment fetch failed",
            attachmentFetchError instanceof Error
              ? attachmentFetchError.message
              : "Unable to fetch Microsoft attachments.",
          );
        }
      }

      insertedOrUpdated += 1;
    }

    const receivedTimes = scan.messages
      .map((message) => new Date(message.receivedAt).getTime())
      .filter((value) => Number.isFinite(value));
    const latestReceivedAt = receivedTimes.length
      ? new Date(Math.max(...receivedTimes)).toISOString()
      : connection.graph_last_message_received_at;
    const { error: scanUpdateError } = await supabase
      .from("email_connections")
      .update({
        graph_last_scan_at: new Date().toISOString(),
        graph_last_message_received_at: latestReceivedAt,
      })
      .eq("id", connection.id)
      .eq("organization_id", organization.id);

    if (scanUpdateError) {
      return Response.json(
        { success: false, error: scanUpdateError.message },
        { status: 400 },
      );
    }

    const { error: activityError } = await supabase.from("activity_logs").insert({
      organization_id: organization.id,
      user_id: user.id,
      action: "Microsoft folder scanned",
      details: {
        folder: scan.folder,
        scanned: scan.scanned,
        imported: insertedOrUpdated,
        skipped_not_rfq: skippedNotRfq,
      },
    });

    if (activityError) {
      console.error("Activity log insert failed", activityError.message);
    }

    revalidatePath("/email-intake");
    revalidatePath("/settings/email");

    return Response.json({
      success: true,
      folder: scan.folder,
      scanned: scan.scanned,
      insertedOrUpdated,
      likelyRfq,
      possibleRfq,
      skippedNotRfq,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Graph folder scan failed.",
      },
      { status: 400 },
    );
  }
}
