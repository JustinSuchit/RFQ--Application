"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { classifyEmailForRfq } from "@/lib/email-intake/classifier";
import {
  extractRfqItemsFromEmailText,
  type ExtractedRfqItem,
} from "@/lib/email/rfq-item-extractor";
import {
  fallbackThreadKey,
  normalizeEmailSubject,
  threadPositionFromDate,
} from "@/lib/email/threading";
import { createClient } from "@/lib/supabase/server";

export type EmailIntakeState = {
  error: string;
  success?: string;
  redirectTo?: string;
};

type CreateRfqFromEmailResult = {
  ok: boolean;
  rfq_id: string | null;
  rfq_number: string | null;
  created: boolean;
  error_message: string | null;
};

type AcceptExtractedItemResult = {
  ok: boolean;
  rfq_item_id: string | null;
  created: boolean;
  error_message: string | null;
};

const initialState: EmailIntakeState = { error: "" };
const deleteEmailRoles = new Set(["owner", "admin", "manager", "procurement"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function preview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 280);
}

const attachmentBucket = "rfq-email-attachments";

function safeStorageFileName(fileName: string) {
  return fileName.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "attachment";
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  const { error } = await supabase.from("activity_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    action,
    details: details ?? null,
  });

  if (error) {
    console.error("Activity log insert failed", error.message);
  }
}

async function acceptExtractedItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  extractedItemId: string,
  rfqId: string,
) {
  const { data, error } = await supabase.rpc("accept_extracted_item", {
    p_extracted_item_id: extractedItemId,
    p_rfq_id: rfqId,
  });

  if (error) {
    return {
      error: "Unable to add this extracted item. Please try again.",
      result: null,
    };
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | AcceptExtractedItemResult
    | null;

  if (!result) {
    return {
      error: "Unable to add this extracted item. Please try again.",
      result: null,
    };
  }

  if (!result.ok) {
    return {
      error: result.error_message || "Unable to add this extracted item.",
      result,
    };
  }

  return { error: "", result };
}

export async function createManualEmailAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const fromName = optionalText(formData, "fromName");
  const fromEmail = text(formData, "fromEmail");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const receivedAt = text(formData, "receivedAt");
  const hasAttachments = formData.get("hasAttachments") === "on";

  if (!fromEmail) return { error: "From email is required." };
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Email body is required." };
  if (!receivedAt) return { error: "Received date is required." };

  const classification = classifyEmailForRfq(subject, body);
  const providerMessageId = `manual-${Date.now()}`;
  const normalizedSubject = normalizeEmailSubject(subject);
  const threadKey = fallbackThreadKey({
    organizationId: organization.id,
    subject,
    fromEmail,
    body,
  });
  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      organization_id: organization.id,
      provider: "manual",
      provider_message_id: providerMessageId,
      from_name: fromName,
      from_email: fromEmail,
      subject,
      body_preview: preview(body),
      body,
      body_text: body,
      body_html: null,
      received_at: new Date(receivedAt).toISOString(),
      normalized_subject: normalizedSubject,
      thread_key: threadKey,
      thread_position: threadPositionFromDate(receivedAt),
      has_attachments: hasAttachments,
      classification,
      is_rfq: classification === "likely_rfq" ? true : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Unable to log email." };
  }

  await logActivity(supabase, organization.id, user.id, "Manual email logged", {
    email_message_id: data.id,
    classification,
  });
  revalidatePath("/email-intake");
  redirect(`/email-intake/${data.id}`);
}

export async function uploadEmailAttachmentAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const organization = await requireOrganization();
  const emailId = text(formData, "emailId");
  const file = formData.get("attachment");

  if (!emailId) return { error: "Email id is required." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an attachment to upload." };
  }

  const supabase = await createClient();
  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id")
    .eq("id", emailId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email was not found." };
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from("email_attachments")
    .insert({
      organization_id: organization.id,
      email_message_id: emailId,
      provider_attachment_id: `manual-${crypto.randomUUID()}`,
      file_name: safeStorageFileName(file.name),
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      ocr_status: "pending",
    })
    .select("id, file_name")
    .single();

  if (attachmentError || !attachment) {
    return { error: attachmentError?.message ?? "Unable to save attachment metadata." };
  }

  const storagePath = `organizations/${organization.id}/emails/${emailId}/${attachment.id}-${attachment.file_name}`;
  const { error: uploadError } = await supabase.storage
    .from(attachmentBucket)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
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
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("email_attachments")
    .update({ storage_path: storagePath })
    .eq("id", attachment.id)
    .eq("organization_id", organization.id);

  if (updateError) return { error: updateError.message };

  await supabase
    .from("email_messages")
    .update({ has_attachments: true })
    .eq("id", emailId)
    .eq("organization_id", organization.id);

  revalidatePath(`/email-intake/${emailId}`);
  return { error: "", success: "Attachment uploaded." };
}

export async function deleteEmailIntakeRecordAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const emailId = text(formData, "emailId");
  const redirectTo = text(formData, "redirectTo");

  if (!emailId) return { error: "Email id is required." };
  if (!deleteEmailRoles.has(organization.role)) {
    return { error: "You do not have permission to delete email intake records." };
  }

  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, rfq_id, subject")
    .eq("id", emailId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (emailError || !email) {
    return {
      error:
        emailError?.message ??
        "Email record not found or you do not have access to this email.",
    };
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("email_attachments")
    .select("id, storage_path")
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (attachmentsError) {
    return { error: `Email delete failed: ${attachmentsError.message}` };
  }

  const storagePaths = (attachments ?? [])
    .map((attachment) => attachment.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage
      .from(attachmentBucket)
      .remove(storagePaths);

    if (storageError) {
      console.warn("Attachment cleanup failed", storageError.message);
    }
  }

  const { error: extractedItemsError } = await supabase
    .from("attachment_extracted_items")
    .delete()
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (extractedItemsError) {
    return { error: `Email delete failed: ${extractedItemsError.message}` };
  }

  const { error: attachmentDeleteError } = await supabase
    .from("email_attachments")
    .delete()
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (attachmentDeleteError) {
    return { error: `Email delete failed: ${attachmentDeleteError.message}` };
  }

  const { error: deleteError } = await supabase
    .from("email_messages")
    .delete()
    .eq("id", emailId)
    .eq("organization_id", organization.id);

  if (deleteError) return { error: `Email delete failed: ${deleteError.message}` };

  await logActivity(supabase, organization.id, user.id, "Email intake record deleted", {
    email_message_id: emailId,
    linked_rfq_id: email.rfq_id,
    subject: email.subject,
  });

  revalidatePath("/email-intake");
  if (email.rfq_id) revalidatePath(`/rfqs/${email.rfq_id}`);

  if (redirectTo === "detail") {
    redirect("/email-intake");
  }

  return { error: "", success: "Email intake record deleted." };
}

export async function markEmailClassificationAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const organization = await requireOrganization();
  const id = text(formData, "id");
  const intent = text(formData, "intent");

  if (!id) return { ...initialState, error: "Email id is required." };
  if (!["rfq", "not_rfq"].includes(intent)) {
    return { ...initialState, error: "Invalid classification action." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("email_messages")
    .update({
      classification: intent === "rfq" ? "likely_rfq" : "not_rfq",
      is_rfq: intent === "rfq",
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) return { ...initialState, error: error.message };

  revalidatePath("/email-intake");
  revalidatePath(`/email-intake/${id}`);
  return { error: "" };
}

export async function linkEmailThreadToRfqAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const emailId = text(formData, "emailId");
  const rfqId = text(formData, "rfqId");

  if (!emailId) return { error: "Email id is required." };
  if (!rfqId) return { error: "Choose an RFQ to link." };

  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, thread_key")
    .eq("id", emailId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email was not found." };
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqError || !rfq) {
    return { error: rfqError?.message ?? "RFQ was not found." };
  }

  let update = supabase
    .from("email_messages")
    .update({
      rfq_id: rfqId,
      classification: "likely_rfq",
      is_rfq: true,
    })
    .eq("organization_id", organization.id);

  update = email.thread_key ? update.eq("thread_key", email.thread_key) : update.eq("id", emailId);
  const { error: updateError } = await update;

  if (updateError) return { error: updateError.message };

  await supabase
    .from("rfqs")
    .update({
      review_status: "needs_review",
      next_action: "Review new email reply",
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  await logActivity(supabase, organization.id, user.id, "Thread linked to RFQ", {
    email_message_id: emailId,
    thread_key: email.thread_key,
    rfq_id: rfqId,
  });

  revalidatePath(`/email-intake/${emailId}`);
  revalidatePath(`/rfqs/${rfqId}`);
  return { error: "", success: "Email thread linked to RFQ." };
}

export async function createRfqFromEmailAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const id = text(formData, "id");

  if (!id) return { error: "Email id is required." };

  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, from_name, from_email, subject, body_preview, body, body_text, body_html, rfq_id, thread_key")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email was not found." };
  }

  const { data, error: rpcError } = await supabase.rpc("create_rfq_from_email", {
    p_email_message_id: id,
  });

  if (rpcError) {
    console.error("create_rfq_from_email RPC failed", {
      email_message_id: id,
      organization_id: organization.id,
      message: rpcError.message,
      code: rpcError.code,
    });
    return { error: "Unable to create an RFQ from this email. Please try again." };
  }

  const rpcData = data as CreateRfqFromEmailResult | CreateRfqFromEmailResult[] | null;
  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  if (!result) {
    console.error("create_rfq_from_email RPC returned no result", {
      email_message_id: id,
      organization_id: organization.id,
    });
    return { error: "Unable to create an RFQ from this email. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error_message || "Unable to create an RFQ from this email." };
  }

  if (!result.rfq_id) {
    console.error("create_rfq_from_email RPC returned success without rfq_id", {
      email_message_id: id,
      organization_id: organization.id,
      created: result.created,
    });
    return { error: "The RFQ was created, but its destination could not be determined." };
  }

  let extractedItems: ExtractedRfqItem[] = [];

  if (result.created) {
    try {
      extractedItems = extractRfqItemsFromEmailText(
        [email.subject, email.body_preview, email.body_text, email.body].filter(Boolean).join("\n"),
      );
    } catch {
      extractedItems = [];
    }

    console.log("Extracted RFQ items", extractedItems);

    if (extractedItems.length > 0) {
      const { error: itemInsertError } = await supabase.from("rfq_items").insert(
        extractedItems.map((item) => ({
          organization_id: organization.id,
          rfq_id: result.rfq_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes ?? null,
        })),
      );

      if (itemInsertError) {
        console.warn("RFQ item extraction insert failed after email RFQ creation", {
          email_message_id: id,
          rfq_id: result.rfq_id,
          message: itemInsertError.message,
        });
      }
    } else {
      console.log("No requested items could be extracted from this email.", {
        email_message_id: id,
        rfq_id: result.rfq_id,
      });
    }

    const reviewStatus = extractedItems.length > 0 ? "awaiting_pricing" : "missing_items";
    const { error: reviewUpdateError } = await supabase
      .from("rfqs")
      .update({
        review_status: reviewStatus,
        next_action: extractedItems.length > 0 ? "Add pricing" : "Extract requested items",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", result.rfq_id)
      .eq("organization_id", organization.id);

    if (reviewUpdateError) {
      console.warn("RFQ review status update failed after email RFQ creation", {
        email_message_id: id,
        rfq_id: result.rfq_id,
        message: reviewUpdateError.message,
      });
    }
  }

  revalidatePath("/email-intake");
  revalidatePath(`/email-intake/${id}`);
  revalidatePath("/rfqs");
  revalidatePath(`/rfqs/${result.rfq_id}`);

  return {
    error: "",
    success: result.created
      ? "RFQ created successfully."
      : "An RFQ has already been created from this email.",
    redirectTo: `/rfqs/${result.rfq_id}`,
  };
}

export async function updateAttachmentExtractedItemStatusAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  await requireUser();
  const organization = await requireOrganization();
  const emailId = text(formData, "emailId");
  const itemId = text(formData, "itemId");
  const status = text(formData, "status");

  if (!emailId) return { error: "Email id is required." };
  if (!itemId) return { error: "Extracted item id is required." };
  if (!["accepted", "rejected"].includes(status)) {
    return { error: "Invalid extracted item status." };
  }

  const supabase = await createClient();
  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, rfq_id")
    .eq("id", emailId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email was not found." };
  }

  if (!email.rfq_id) {
    return { error: "Create an RFQ from this email before extracting attachment items." };
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id")
    .eq("id", email.rfq_id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqError || !rfq) {
    return { error: rfqError?.message ?? "Linked RFQ not found." };
  }

  const { data: item, error: itemLoadError } = await supabase
    .from("attachment_extracted_items")
    .select("id, description, quantity, unit, notes, status, rfq_item_id")
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId)
    .maybeSingle();

  if (itemLoadError || !item) {
    return { error: itemLoadError?.message ?? "Extracted item not found." };
  }

  if (status === "rejected") {
    if (item.rfq_item_id || item.status === "imported") {
      return { error: "This item has already been imported." };
    }

    const { error } = await supabase
      .from("attachment_extracted_items")
      .update({ status })
      .eq("id", itemId)
      .eq("organization_id", organization.id)
      .eq("email_message_id", emailId)
      .in("status", ["pending", "accepted", "rejected"]);

    if (error) return { error: error.message };

    revalidatePath(`/email-intake/${emailId}`);
    revalidatePath(`/rfqs/${rfq.id}`);
    return { error: "", success: "Item rejected." };
  }

  const { error, result } = await acceptExtractedItem(supabase, item.id, rfq.id);

  revalidatePath(`/email-intake/${emailId}`);
  revalidatePath(`/rfqs/${rfq.id}`);
  if (error || !result) return { error };

  return {
    error: "",
    success: result.created
      ? "Item added to Requested Items."
      : "This extracted item has already been added.",
  };
}

export async function importAcceptedAttachmentItemsAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  await requireUser();
  const organization = await requireOrganization();
  const emailId = text(formData, "emailId");
  const rfqId = text(formData, "rfqId");

  if (!emailId && !rfqId) return { error: "Email id or RFQ id is required." };

  const supabase = await createClient();

  let targetRfqId = rfqId;
  if (targetRfqId) {
    const { data: rfq, error: rfqError } = await supabase
      .from("rfqs")
      .select("id")
      .eq("id", targetRfqId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (rfqError || !rfq) {
      return { error: rfqError?.message ?? "RFQ was not found." };
    }
  }

  let linkedEmailIds: string[] = [];
  let revalidateEmailId = emailId;

  let emailQuery = supabase
    .from("email_messages")
    .select("id, rfq_id")
    .eq("organization_id", organization.id)
    .not("rfq_id", "is", null);

  if (emailId) {
    emailQuery = emailQuery.eq("id", emailId);
  }

  if (targetRfqId) {
    emailQuery = emailQuery.eq("rfq_id", targetRfqId);
  }

  const { data: linkedEmails, error: emailError } = await emailQuery;

  if (emailError) {
    return { error: emailError.message };
  }

  if (!linkedEmails?.length) {
    return { error: "Create an RFQ from this email before importing attachment items." };
  }

  const firstEmail = linkedEmails[0];
  if (!targetRfqId) {
    targetRfqId = firstEmail.rfq_id;
  }

  if (!targetRfqId) {
    return { error: "Create an RFQ from this email before importing attachment items." };
  }

  linkedEmailIds = linkedEmails.map((email) => email.id);
  revalidateEmailId = revalidateEmailId || firstEmail.id;

  const { data: items, error: itemsError } = await supabase
    .from("attachment_extracted_items")
    .select("id")
    .eq("organization_id", organization.id)
    .in("email_message_id", linkedEmailIds)
    .eq("status", "accepted")
    .is("rfq_item_id", null);

  if (itemsError) return { error: itemsError.message };
  if (!items?.length) {
    const { count: importedCount, error: importedCountError } = await supabase
      .from("attachment_extracted_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .in("email_message_id", linkedEmailIds)
      .eq("status", "imported")
      .not("rfq_item_id", "is", null);

    if (importedCountError) return { error: importedCountError.message };
    if ((importedCount ?? 0) > 0) {
      return { error: "", success: "All accepted attachment items have already been imported." };
    }

    return { error: "No accepted attachment items are ready to import." };
  }

  let importedCount = 0;
  let alreadyAddedCount = 0;

  for (const item of items) {
    const { error, result } = await acceptExtractedItem(
      supabase,
      item.id,
      targetRfqId,
    );

    if (error || !result) {
      revalidatePath(`/email-intake/${revalidateEmailId}`);
      revalidatePath(`/rfqs/${targetRfqId}`);
      return { error };
    }

    if (result.created) {
      importedCount += 1;
    } else {
      alreadyAddedCount += 1;
    }
  }

  revalidatePath(`/email-intake/${revalidateEmailId}`);
  revalidatePath(`/rfqs/${targetRfqId}`);

  if (importedCount === 0 && alreadyAddedCount > 0) {
    return {
      error: "",
      success: "All accepted attachment items have already been imported.",
    };
  }

  return {
    error: "",
    success:
      alreadyAddedCount > 0
        ? `Imported ${importedCount} attachment items into this RFQ. ${alreadyAddedCount} were already added.`
        : `Imported ${importedCount} attachment items into this RFQ.`,
  };
}
