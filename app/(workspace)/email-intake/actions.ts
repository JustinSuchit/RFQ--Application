"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { classifyEmailForRfq } from "@/lib/email-intake/classifier";
import { createClient } from "@/lib/supabase/server";

export type EmailIntakeState = {
  error: string;
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

function currentYearRange() {
  const year = new Date().getFullYear();
  return {
    year,
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year + 1}-01-01T00:00:00.000Z`,
  };
}

async function nextRfqNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
) {
  const { data: settings } = await supabase
    .from("organization_settings")
    .select("rfq_prefix, rfq_number_padding")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { year, start, end } = currentYearRange();
  const { count, error } = await supabase
    .from("rfqs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) {
    return { error: error.message, rfqNumber: "" };
  }

  const prefix = String(settings?.rfq_prefix || "RFQ");
  const padding = Number(settings?.rfq_number_padding || 6);
  return {
    error: "",
    rfqNumber: `${prefix}-${year}-${String((count ?? 0) + 1).padStart(
      padding,
      "0",
    )}`,
  };
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
    .select("id, from_name, from_email, subject, body, rfq_id")
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

  const { rfqNumber, error: rfqNumberError } = await nextRfqNumber(
    supabase,
    organization.id,
  );

  if (rfqNumberError) return { error: rfqNumberError };

  const { data: rfq, error: rfqError } = await supabase
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

  if (rfqError || !rfq) {
    return { error: rfqError?.message ?? "Unable to create RFQ." };
  }

  const { error: updateError } = await supabase
    .from("email_messages")
    .update({
      classification: "likely_rfq",
      is_rfq: true,
      rfq_id: rfq.id,
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (updateError) return { error: updateError.message };

  await logActivity(supabase, organization.id, user.id, "RFQ created from email", {
    email_message_id: id,
    rfq_id: rfq.id,
    rfq_number: rfqNumber,
  });
  revalidatePath("/email-intake");
  revalidatePath("/rfqs");
  redirect(`/rfqs/${rfq.id}`);
}
