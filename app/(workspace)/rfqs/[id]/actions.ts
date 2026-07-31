"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { extractRfqItemsFromEmailText } from "@/lib/email/rfq-item-extractor";

export type UpdateRfqStatusState = {
  error: string;
};

export type ExtractRfqItemsState = {
  error: string;
  success: string;
};

export type DeleteRfqState = {
  error: string;
};

const allowedStatuses = new Set([
  "draft",
  "new",
  "in_review",
  "supplier_pricing",
  "awaiting_approval",
  "sent",
  "approved",
  "accepted",
  "declined",
  "rejected",
  "closed",
]);

export async function updateRfqStatusAction(
  _previousState: UpdateRfqStatusState,
  formData: FormData,
): Promise<UpdateRfqStatusState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");
  const newStatus = String(formData.get("status") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  if (!allowedStatuses.has(newStatus)) {
    return { error: "Invalid RFQ status." };
  }

  const { data: existingRfq, error: existingRfqError } = await supabase
    .from("rfqs")
    .select("id, status")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (existingRfqError || !existingRfq) {
    return {
      error:
        existingRfqError?.message ??
        "RFQ was not found or you do not have access.",
    };
  }

  if (existingRfq.status === newStatus) {
    return { error: "" };
  }

  const { error: updateError } = await supabase
    .from("rfqs")
    .update({ status: newStatus })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfqId,
    user_id: user.id,
    action: "RFQ status updated",
    details: {
      old_status: existingRfq.status,
      new_status: newStatus,
    },
  });

  if (activityError) {
    return { error: activityError.message };
  }

  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
  revalidatePath("/dashboard");

  return { error: "" };
}

export async function extractRfqItemsFromNotesAction(
  _previousState: ExtractRfqItemsState,
  formData: FormData,
): Promise<ExtractRfqItemsState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required.", success: "" };
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, subject, notes")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .single();

  if (rfqError || !rfq) {
    return {
      error: rfqError?.message ?? "RFQ was not found.",
      success: "",
    };
  }

  const extractedItems = extractRfqItemsFromEmailText(
    [rfq.subject, rfq.notes].filter(Boolean).join("\n"),
  );

  console.log("Extracted RFQ items", extractedItems);

  if (extractedItems.length === 0) {
    return {
      error: "",
      success: "No requested items could be extracted from this RFQ.",
    };
  }

  const { error: itemInsertError } = await supabase.from("rfq_items").insert(
    extractedItems.map((item) => ({
      organization_id: organization.id,
      rfq_id: rfq.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      notes: null,
    })),
  );

  if (itemInsertError) {
    return { error: itemInsertError.message, success: "" };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    rfq_id: rfq.id,
    user_id: user.id,
    action: "RFQ items extracted from notes",
    details: {
      extracted_item_count: extractedItems.length,
    },
  });

  if (activityError) {
    return { error: activityError.message, success: "" };
  }

  revalidatePath(`/rfqs/${rfq.id}`);

  return {
    error: "",
    success: `Extracted ${extractedItems.length} requested item${extractedItems.length === 1 ? "" : "s"}.`,
  };
}

export async function deleteRfqAction(
  _previousState: DeleteRfqState,
  formData: FormData,
): Promise<DeleteRfqState> {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const rfqId = String(formData.get("rfqId") ?? "");

  if (!rfqId) {
    return { error: "RFQ id is required." };
  }

  // TODO: Tighten this to owner/admin/manager once centralized role permissions exist.
  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, rfq_number, source")
    .eq("id", rfqId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqError || !rfq) {
    return { error: rfqError?.message ?? "RFQ was not found." };
  }

  const { error: emailUpdateError } = await supabase
    .from("email_messages")
    .update({ rfq_id: null, is_rfq: null })
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id);

  if (emailUpdateError) {
    return { error: emailUpdateError.message };
  }

  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    user_id: user.id,
    action: "RFQ deleted",
    details: {
      rfq_id: rfq.id,
      rfq_number: rfq.rfq_number,
      source: rfq.source,
    },
  });

  if (activityError) {
    console.warn("Activity log insert failed", activityError.message);
  }

  const { error: deleteError } = await supabase
    .from("rfqs")
    .delete()
    .eq("id", rfq.id)
    .eq("organization_id", organization.id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/rfqs");
  revalidatePath("/dashboard");
  revalidatePath("/email-intake");
  redirect("/rfqs");
}
