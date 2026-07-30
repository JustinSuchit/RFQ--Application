"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export type UpdateRfqStatusState = {
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
