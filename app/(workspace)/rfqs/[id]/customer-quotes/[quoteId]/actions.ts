"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  canApproveQuote,
  requireOrganization,
  requireUser,
} from "@/lib/auth/session";

export type UpdateCustomerQuoteStatusState = {
  error: string;
};

export type ApprovalDecisionState = {
  error: string;
};

const allowedStatuses = new Set(["sent", "accepted", "declined"]);

export async function updateCustomerQuoteStatusAction(
  _previousState: UpdateCustomerQuoteStatusState,
  formData: FormData,
): Promise<UpdateCustomerQuoteStatusState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  const newStatus = String(formData.get("status") ?? "");

  if (!rfqId || !quoteId) {
    return { error: "Quote and RFQ are required." };
  }

  if (!allowedStatuses.has(newStatus)) {
    return { error: "Invalid customer quote status." };
  }

  const { data: existingQuote, error: quoteError } = await supabase
    .from("customer_quotes")
    .select("id, quote_number, status, approval_status")
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (quoteError || !existingQuote) {
    return {
      error:
        quoteError?.message ??
        "Customer quote was not found or you do not have access.",
    };
  }

  if (
    newStatus === "sent" &&
    ["pending", "rejected"].includes(existingQuote.approval_status)
  ) {
    return {
      error:
        existingQuote.approval_status === "pending"
          ? "This quote requires approval before it can be sent."
          : "This quote was rejected. Create a revision or adjust the quote before sending.",
    };
  }

  if (existingQuote.status === newStatus) {
    return { error: "" };
  }

  const { error: updateError } = await supabase
    .from("customer_quotes")
    .update({ status: newStatus })
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) {
    return { error: updateError.message };
  }

  if (newStatus === "accepted" || newStatus === "declined") {
    const { error: rfqUpdateError } = await supabase
      .from("rfqs")
      .update({ status: newStatus })
      .eq("id", rfqId)
      .eq("organization_id", organization.id);

    if (rfqUpdateError) {
      return { error: rfqUpdateError.message };
    }
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "Customer quote status updated",
    details: {
      quote_number: existingQuote.quote_number,
      old_status: existingQuote.status,
      new_status: newStatus,
    },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath(`/rfqs/${rfqId}/customer-quotes/${quoteId}`);
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");

  return { error: "" };
}

export async function approveCustomerQuoteAction(
  _previousState: ApprovalDecisionState,
  formData: FormData,
): Promise<ApprovalDecisionState> {
  const user = await requireUser();
  const organization = await requireOrganization();

  if (!canApproveQuote(organization.role)) {
    return { error: "You do not have permission to approve quotes." };
  }

  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");

  if (!rfqId || !quoteId) {
    return { error: "Quote and RFQ are required." };
  }

  const { data: quote, error: quoteError } = await supabase
    .from("customer_quotes")
    .select("id, quote_number, total, approval_status")
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (quoteError || !quote) {
    return {
      error:
        quoteError?.message ??
        "Customer quote was not found or you do not have access.",
    };
  }

  if (quote.approval_status !== "pending") {
    return { error: "Only pending quotes can be approved." };
  }

  const approvedAt = new Date().toISOString();
  const { error: requestUpdateError } = await supabase
    .from("approval_requests")
    .update({
      status: "approved",
      resolved_at: approvedAt,
      approver_user_id: user.id,
    })
    .eq("organization_id", organization.id)
    .eq("customer_quote_id", quoteId)
    .eq("status", "pending");

  if (requestUpdateError) {
    return { error: requestUpdateError.message };
  }

  const { error: quoteUpdateError } = await supabase
    .from("customer_quotes")
    .update({
      approval_status: "approved",
      status: "approved",
      approved_by: user.id,
    })
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id);

  if (quoteUpdateError) {
    return { error: quoteUpdateError.message };
  }

  const { error: rfqUpdateError } = await supabase
    .from("rfqs")
    .update({ status: "approved" })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (rfqUpdateError) {
    return { error: rfqUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "Customer quote approved",
    details: {
      quote_number: quote.quote_number,
      total: quote.total,
      approved_by: user.id,
      approved_at: approvedAt,
    },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath(`/rfqs/${rfqId}/customer-quotes/${quoteId}`);
  revalidatePath("/approvals");
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");

  return { error: "" };
}

export async function rejectCustomerQuoteAction(
  _previousState: ApprovalDecisionState,
  formData: FormData,
): Promise<ApprovalDecisionState> {
  const user = await requireUser();
  const organization = await requireOrganization();

  if (!canApproveQuote(organization.role)) {
    return { error: "You do not have permission to reject quotes." };
  }

  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  const comments = String(formData.get("comments") ?? "").trim() || null;

  if (!rfqId || !quoteId) {
    return { error: "Quote and RFQ are required." };
  }

  const { data: quote, error: quoteError } = await supabase
    .from("customer_quotes")
    .select("id, quote_number, total, approval_status")
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (quoteError || !quote) {
    return {
      error:
        quoteError?.message ??
        "Customer quote was not found or you do not have access.",
    };
  }

  if (quote.approval_status !== "pending") {
    return { error: "Only pending quotes can be rejected." };
  }

  const rejectedAt = new Date().toISOString();
  const { error: requestUpdateError } = await supabase
    .from("approval_requests")
    .update({
      status: "rejected",
      resolved_at: rejectedAt,
      approver_user_id: user.id,
      comments,
    })
    .eq("organization_id", organization.id)
    .eq("customer_quote_id", quoteId)
    .eq("status", "pending");

  if (requestUpdateError) {
    return { error: requestUpdateError.message };
  }

  const { error: quoteUpdateError } = await supabase
    .from("customer_quotes")
    .update({
      approval_status: "rejected",
      status: "rejected",
    })
    .eq("id", quoteId)
    .eq("rfq_id", rfqId)
    .eq("organization_id", organization.id);

  if (quoteUpdateError) {
    return { error: quoteUpdateError.message };
  }

  const { error: rfqUpdateError } = await supabase
    .from("rfqs")
    .update({ status: "in_review" })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (rfqUpdateError) {
    return { error: rfqUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "Customer quote rejected",
    details: {
      quote_number: quote.quote_number,
      total: quote.total,
      rejected_by: user.id,
      rejected_at: rejectedAt,
      comments,
    },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath(`/rfqs/${rfqId}/customer-quotes/${quoteId}`);
  revalidatePath("/approvals");
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");

  return { error: "" };
}
