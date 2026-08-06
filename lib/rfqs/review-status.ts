export const reviewStatuses = [
  "new",
  "needs_review",
  "missing_items",
  "awaiting_pricing",
  "awaiting_approval",
  "ready_to_send",
  "overdue",
  "completed",
] as const;

export const reviewPriorities = ["low", "normal", "high", "urgent"] as const;

export type ReviewStatus = (typeof reviewStatuses)[number];
export type ReviewPriority = (typeof reviewPriorities)[number];

export type ReviewStatusInput = {
  currentReviewStatus?: string | null;
  rfqStatus?: string | null;
  reviewDueAt?: string | null;
  submissionDeadline?: string | null;
  itemCount: number;
  customerQuoteCount: number;
  latestCustomerQuoteStatus?: string | null;
  latestCustomerQuoteApprovalStatus?: string | null;
};

const completedRfqStatuses = new Set([
  "approved",
  "accepted",
  "declined",
  "rejected",
  "closed",
  "cancelled",
  "won",
  "lost",
]);

const manualStatuses = new Set<ReviewStatus>([
  "needs_review",
  "awaiting_pricing",
  "awaiting_approval",
  "ready_to_send",
]);

function isPastDue(value: string | null | undefined) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

export function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  return reviewStatuses.includes(value as ReviewStatus) ? (value as ReviewStatus) : "new";
}

export function normalizeReviewPriority(value: string | null | undefined): ReviewPriority {
  return reviewPriorities.includes(value as ReviewPriority) ? (value as ReviewPriority) : "normal";
}

export function deriveReviewState(input: ReviewStatusInput): {
  reviewStatus: ReviewStatus;
  nextAction: string;
} {
  const current = normalizeReviewStatus(input.currentReviewStatus);
  const rfqStatus = String(input.rfqStatus ?? "");
  const quoteStatus = String(input.latestCustomerQuoteStatus ?? "");
  const approvalStatus = String(input.latestCustomerQuoteApprovalStatus ?? "");

  if (completedRfqStatuses.has(rfqStatus)) {
    return { reviewStatus: "completed", nextAction: "Follow up with customer" };
  }

  if (isPastDue(input.reviewDueAt ?? input.submissionDeadline)) {
    return { reviewStatus: "overdue", nextAction: "Follow up with customer" };
  }

  if (input.itemCount === 0) {
    return { reviewStatus: "missing_items", nextAction: "Extract requested items" };
  }

  if (approvalStatus === "pending" || rfqStatus === "awaiting_approval") {
    return { reviewStatus: "awaiting_approval", nextAction: "Submit quote for approval" };
  }

  if (
    input.customerQuoteCount > 0 &&
    ["approved", "not_required"].includes(approvalStatus) &&
    !["sent", "accepted", "declined"].includes(quoteStatus)
  ) {
    return { reviewStatus: "ready_to_send", nextAction: "Send approved quote" };
  }

  if (input.customerQuoteCount === 0 || quoteStatus === "draft") {
    return { reviewStatus: "awaiting_pricing", nextAction: "Add pricing" };
  }

  if (current === "new") {
    return { reviewStatus: "new", nextAction: "Review original email" };
  }

  if (manualStatuses.has(current)) {
    return {
      reviewStatus: current,
      nextAction:
        current === "needs_review"
          ? "Review original email"
          : current === "awaiting_approval"
            ? "Submit quote for approval"
            : current === "ready_to_send"
              ? "Send approved quote"
              : "Add pricing",
    };
  }

  return { reviewStatus: current, nextAction: "Review original email" };
}

export function labelizeReviewValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
