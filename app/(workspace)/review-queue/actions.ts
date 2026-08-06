"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import {
  normalizeReviewPriority,
  normalizeReviewStatus,
  reviewPriorities,
  reviewStatuses,
} from "@/lib/rfqs/review-status";
import { createClient } from "@/lib/supabase/server";

export type ReviewQueueState = {
  error: string;
  success?: string;
};

const manageRoles = new Set(["owner", "admin", "manager", "procurement"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function assertCanManage() {
  const user = await requireUser();
  const organization = await requireOrganization();
  if (!manageRoles.has(organization.role)) {
    return { user, organization, error: "You do not have permission to update the review queue." };
  }
  return { user, organization, error: "" };
}

async function loadRfq(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, rfqId: string) {
  const { data, error } = await supabase
    .from("rfqs")
    .select("id, rfq_number, review_status, priority, assigned_to")
    .eq("id", rfqId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function logReviewActivity({
  supabase,
  organizationId,
  userId,
  rfqId,
  action,
  details,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  userId: string;
  rfqId: string;
  action: string;
  details: Record<string, unknown>;
}) {
  const { error } = await supabase.from("activity_logs").insert({
    organization_id: organizationId,
    rfq_id: rfqId,
    user_id: userId,
    action,
    details,
  });

  if (error) {
    console.warn("Review queue activity log failed", error.message);
  }
}

export async function assignRfqAction(
  _previousState: ReviewQueueState,
  formData: FormData,
): Promise<ReviewQueueState> {
  const { user, organization, error } = await assertCanManage();
  if (error) return { error };
  const rfqId = text(formData, "rfqId");
  const assignedTo = text(formData, "assignedTo") || null;
  const supabase = await createClient();

  if (!rfqId) return { error: "RFQ id is required." };

  if (assignedTo) {
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization.id)
      .eq("user_id", assignedTo)
      .eq("status", "active")
      .maybeSingle();
    if (memberError || !member) {
      return { error: memberError?.message ?? "Assigned user is not an active organization member." };
    }
  }

  const rfq = await loadRfq(supabase, organization.id, rfqId);
  if (!rfq) return { error: "RFQ was not found." };

  const { error: updateError } = await supabase
    .from("rfqs")
    .update({
      assigned_to: assignedTo,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) return { error: updateError.message };

  await logReviewActivity({
    supabase,
    organizationId: organization.id,
    userId: user.id,
    rfqId,
    action: "RFQ assigned",
    details: { old_assigned_to: rfq.assigned_to, new_assigned_to: assignedTo },
  });
  revalidatePath("/review-queue");
  revalidatePath(`/rfqs/${rfqId}`);
  return { error: "", success: "RFQ assignment updated." };
}

export async function updateReviewFieldsAction(
  _previousState: ReviewQueueState,
  formData: FormData,
): Promise<ReviewQueueState> {
  const { user, organization, error } = await assertCanManage();
  if (error) return { error };
  const rfqId = text(formData, "rfqId");
  const reviewStatus = normalizeReviewStatus(text(formData, "reviewStatus"));
  const priority = normalizeReviewPriority(text(formData, "priority"));
  const reviewDueAt = text(formData, "reviewDueAt");
  const nextAction = text(formData, "nextAction") || null;
  const supabase = await createClient();

  if (!rfqId) return { error: "RFQ id is required." };
  if (!reviewStatuses.includes(reviewStatus)) return { error: "Invalid review status." };
  if (!reviewPriorities.includes(priority)) return { error: "Invalid priority." };

  const rfq = await loadRfq(supabase, organization.id, rfqId);
  if (!rfq) return { error: "RFQ was not found." };

  const { error: updateError } = await supabase
    .from("rfqs")
    .update({
      review_status: reviewStatus,
      priority,
      review_due_at: reviewDueAt ? new Date(reviewDueAt).toISOString() : null,
      next_action: nextAction,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) return { error: updateError.message };

  await logReviewActivity({
    supabase,
    organizationId: organization.id,
    userId: user.id,
    rfqId,
    action: "Review status changed",
    details: {
      old_review_status: rfq.review_status,
      new_review_status: reviewStatus,
      old_priority: rfq.priority,
      new_priority: priority,
    },
  });
  revalidatePath("/review-queue");
  revalidatePath(`/rfqs/${rfqId}`);
  return { error: "", success: "RFQ review fields updated." };
}

export async function markReviewedAction(
  _previousState: ReviewQueueState,
  formData: FormData,
): Promise<ReviewQueueState> {
  const { user, organization, error } = await assertCanManage();
  if (error) return { error };
  const rfqId = text(formData, "rfqId");
  if (!rfqId) return { error: "RFQ id is required." };
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("rfqs")
    .update({
      review_status: "awaiting_pricing",
      next_action: "Add pricing",
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("organization_id", organization.id);

  if (updateError) return { error: updateError.message };

  await logReviewActivity({
    supabase,
    organizationId: organization.id,
    userId: user.id,
    rfqId,
    action: "Marked reviewed",
    details: { next_action: "Add pricing" },
  });
  revalidatePath("/review-queue");
  revalidatePath(`/rfqs/${rfqId}`);
  return { error: "", success: "RFQ marked reviewed." };
}
