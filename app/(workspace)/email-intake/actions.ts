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
  generateNextRfqNumber,
  isUniqueViolation,
} from "@/lib/rfqs/numbering";
import { createClient } from "@/lib/supabase/server";

export type EmailIntakeState = {
  error: string;
  success?: string;
};

const initialState: EmailIntakeState = { error: "" };

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
      received_at: new Date(receivedAt).toISOString(),
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

  // TODO: Tighten this to owner/admin/manager/procurement once centralized role permissions exist.
  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, rfq_id, subject")
    .eq("id", emailId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email intake record was not found." };
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("email_attachments")
    .select("id, storage_path")
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (attachmentsError) return { error: attachmentsError.message };

  const storagePaths = (attachments ?? [])
    .map((attachment) => attachment.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage
      .from(attachmentBucket)
      .remove(storagePaths);

    if (storageError) {
      console.warn("Email attachment storage cleanup failed", storageError.message);
    }
  }

  const { error: extractedItemsError } = await supabase
    .from("attachment_extracted_items")
    .delete()
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (extractedItemsError) return { error: extractedItemsError.message };

  const { error: attachmentDeleteError } = await supabase
    .from("email_attachments")
    .delete()
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId);

  if (attachmentDeleteError) return { error: attachmentDeleteError.message };

  const { error: deleteError } = await supabase
    .from("email_messages")
    .delete()
    .eq("id", emailId)
    .eq("organization_id", organization.id);

  if (deleteError) return { error: deleteError.message };

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

export async function createRfqFromEmailAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const id = text(formData, "id");

  if (!id) return { error: "Email id is required." };

  const { data: email, error: emailError } = await supabase
    .from("email_messages")
    .select("id, from_name, from_email, subject, body_preview, body, rfq_id")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();

  if (emailError || !email) {
    return { error: emailError?.message ?? "Email was not found." };
  }

  if (email.rfq_id) {
    redirect(`/rfqs/${email.rfq_id}`);
  }

  const { data: existingCustomers, error: customerLookupError } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("email", email.from_email)
    .limit(1);

  if (customerLookupError) return { error: customerLookupError.message };

  let customerId = existingCustomers?.[0]?.id as string | undefined;

  if (!customerId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: organization.id,
        company_name: email.from_name || email.from_email,
        contact_name: email.from_name,
        email: email.from_email,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      return { error: customerError?.message ?? "Unable to create customer." };
    }

    customerId = customer.id;
  }

  let rfq: { id: string } | null = null;
  let rfqNumber = "";
  let lastInsertError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const numberResult = await generateNextRfqNumber({
      supabase,
      organizationId: organization.id,
      offset: attempt,
    });

    if (numberResult.error) return { error: numberResult.error };

    rfqNumber = numberResult.rfqNumber;
    const { data: insertedRfq, error: rfqError } = await supabase
      .from("rfqs")
      .insert({
        organization_id: organization.id,
        customer_id: customerId,
        rfq_number: rfqNumber,
        subject: email.subject,
        source: "manual_email",
        priority: "normal",
        status: "draft",
        notes: email.body,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!rfqError && insertedRfq) {
      rfq = insertedRfq;
      break;
    }

    lastInsertError = rfqError;
    if (!isUniqueViolation(rfqError)) break;
  }

  if (!rfq) {
    return {
      error: isUniqueViolation(lastInsertError)
        ? "Could not generate a unique RFQ number. Please try again."
        : lastInsertError?.message ?? "Unable to create RFQ.",
    };
  }

  const { data: linkedEmail, error: linkEmailError } = await supabase
    .from("email_messages")
    .update({
      classification: "likely_rfq",
      is_rfq: true,
      rfq_id: rfq.id,
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("rfq_id", null)
    .select("id")
    .maybeSingle();

  if (linkEmailError) {
    await supabase
      .from("rfqs")
      .delete()
      .eq("id", rfq.id)
      .eq("organization_id", organization.id);
    return { error: linkEmailError.message };
  }

  if (!linkedEmail) {
    const { data: alreadyLinkedEmail } = await supabase
      .from("email_messages")
      .select("rfq_id")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .maybeSingle();

    await supabase
      .from("rfqs")
      .delete()
      .eq("id", rfq.id)
      .eq("organization_id", organization.id);

    if (alreadyLinkedEmail?.rfq_id) {
      redirect(`/rfqs/${alreadyLinkedEmail.rfq_id}`);
    }

    return { error: "This email is already linked to an RFQ." };
  }

  let extractedItems: ExtractedRfqItem[] = [];

  try {
    extractedItems = extractRfqItemsFromEmailText(
      [email.subject, email.body_preview, email.body].filter(Boolean).join("\n"),
    );
  } catch {
    extractedItems = [];
  }

  console.log("Extracted RFQ items", extractedItems);

  if (extractedItems.length > 0) {
    const { error: itemInsertError } = await supabase.from("rfq_items").insert(
      extractedItems.map((item) => ({
        organization_id: organization.id,
        rfq_id: rfq.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes ?? null,
      })),
    );

    if (itemInsertError) {
      return { error: itemInsertError.message };
    }
  } else {
    console.log("No requested items could be extracted from this email.", {
      email_message_id: id,
      rfq_id: rfq.id,
    });
  }

  await logActivity(supabase, organization.id, user.id, "RFQ created from email", {
    email_message_id: id,
    rfq_id: rfq.id,
    rfq_number: rfqNumber,
    extracted_item_count: extractedItems.length,
    attachment_item_count: 0,
  });
  revalidatePath("/email-intake");
  revalidatePath("/rfqs");
  redirect(`/rfqs/${rfq.id}`);
}

export async function updateAttachmentExtractedItemStatusAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
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

  if (item.rfq_item_id || item.status === "imported") {
    return { error: "This item has already been imported." };
  }

  const { data: rfqItem, error: rfqItemError } = await supabase
    .from("rfq_items")
    .insert({
      organization_id: organization.id,
      rfq_id: rfq.id,
      description: item.description,
      quantity: item.quantity ?? 1,
      unit: item.unit,
      notes: item.notes || "Imported from attachment OCR",
      required_date: null,
    })
    .select("id")
    .single();

  if (rfqItemError || !rfqItem) {
    return {
      error: `RFQ item insert failed: ${
        rfqItemError?.message ?? "Unable to import extracted item."
      }`,
    };
  }

  const { data: importedItem, error: updateError } = await supabase
    .from("attachment_extracted_items")
    .update({
      status: "imported",
      rfq_item_id: rfqItem.id,
    })
    .eq("id", itemId)
    .eq("organization_id", organization.id)
    .eq("email_message_id", emailId)
    .is("rfq_item_id", null)
    .select("id")
    .maybeSingle();

  if (updateError) return { error: updateError.message };

  if (!importedItem) {
    await supabase
      .from("rfq_items")
      .delete()
      .eq("id", rfqItem.id)
      .eq("organization_id", organization.id);
    return { error: "This item has already been imported." };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfq.id,
    user_id: user.id,
    action: "Attachment item imported to RFQ",
    details: {
      rfq_id: rfq.id,
      imported_item_count: 1,
      attachment_extracted_item_ids: [item.id],
    },
  });

  if (activityError) {
    console.warn("Activity log insert failed", activityError.message);
  }

  revalidatePath(`/email-intake/${emailId}`);
  revalidatePath(`/rfqs/${rfq.id}`);
  return { error: "", success: "Item imported into RFQ." };
}

export async function importAcceptedAttachmentItemsAction(
  _previousState: EmailIntakeState,
  formData: FormData,
): Promise<EmailIntakeState> {
  const user = await requireUser();
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
    .select("id, description, quantity, unit, notes")
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

  for (const item of items) {
    const { data: rfqItem, error: itemError } = await supabase
      .from("rfq_items")
      .insert({
        organization_id: organization.id,
        rfq_id: targetRfqId,
        description: item.description,
        quantity: item.quantity ?? 1,
        unit: item.unit,
        notes: item.notes || "Imported from attachment OCR",
        required_date: null,
      })
      .select("id")
      .single();

    if (itemError || !rfqItem) {
      return { error: itemError?.message ?? "Unable to import attachment item." };
    }

    const { error: updateError } = await supabase
      .from("attachment_extracted_items")
      .update({
        status: "imported",
        rfq_item_id: rfqItem.id,
      })
      .eq("id", item.id)
      .eq("organization_id", organization.id)
      .is("rfq_item_id", null)
      .select("id")
      .maybeSingle();

    if (updateError) return { error: updateError.message };
    const { data: importedItem } = await supabase
      .from("attachment_extracted_items")
      .select("id")
      .eq("id", item.id)
      .eq("organization_id", organization.id)
      .eq("rfq_item_id", rfqItem.id)
      .maybeSingle();

    if (!importedItem) {
      await supabase
        .from("rfq_items")
        .delete()
        .eq("id", rfqItem.id)
        .eq("organization_id", organization.id);
      continue;
    }

    importedCount += 1;
  }

  if (importedCount === 0) {
    return { error: "No new accepted items to import." };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: targetRfqId,
    user_id: user.id,
    action: "Attachment items imported to RFQ",
    details: {
      rfq_id: targetRfqId,
      imported_item_count: importedCount,
      attachment_extracted_item_ids: items.map((item) => item.id),
    },
  });

  if (activityError) {
    console.warn("Activity log insert failed", activityError.message);
  }

  revalidatePath(`/email-intake/${revalidateEmailId}`);
  revalidatePath(`/rfqs/${targetRfqId}`);
  return {
    error: "",
    success: `Imported ${importedCount} attachment items into this RFQ.`,
  };
}
