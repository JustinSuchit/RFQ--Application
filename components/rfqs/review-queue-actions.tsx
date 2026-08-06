"use client";

import { useActionState } from "react";
import {
  assignRfqAction,
  markReviewedAction,
  updateReviewFieldsAction,
  type ReviewQueueState,
} from "@/app/(workspace)/review-queue/actions";

type Member = {
  user_id: string;
  role: string;
};

type ReviewQueueActionsProps = {
  rfqId: string;
  assignedTo: string | null;
  reviewStatus: string;
  priority: string;
  reviewDueAt: string | null;
  nextAction: string | null;
  members: Member[];
  canManage: boolean;
  compact?: boolean;
};

const initialState: ReviewQueueState = { error: "" };

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function shortUser(value: string | null) {
  if (!value) return "Unassigned";
  return value.slice(0, 8);
}

export function ReviewQueueActions({
  rfqId,
  assignedTo,
  reviewStatus,
  priority,
  reviewDueAt,
  nextAction,
  members,
  canManage,
  compact = false,
}: ReviewQueueActionsProps) {
  const [assignState, assignAction, assignPending] = useActionState(assignRfqAction, initialState);
  const [fieldState, fieldAction, fieldPending] = useActionState(updateReviewFieldsAction, initialState);
  const [reviewState, reviewAction, reviewPending] = useActionState(markReviewedAction, initialState);

  if (!canManage) {
    return <span className="text-xs text-slate-500">Read only</span>;
  }

  return (
    <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-[1fr_1fr_auto]"}>
      <form action={assignAction} className="flex gap-2">
        <input type="hidden" name="rfqId" value={rfqId} />
        <select name="assignedTo" defaultValue={assignedTo ?? ""} className={selectClass}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {shortUser(member.user_id)} ({member.role})
            </option>
          ))}
        </select>
        <button
          disabled={assignPending}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
        >
          Assign
        </button>
      </form>
      <form action={fieldAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="rfqId" value={rfqId} />
        <select name="reviewStatus" defaultValue={reviewStatus} className={selectClass}>
          {["new", "needs_review", "missing_items", "awaiting_pricing", "awaiting_approval", "ready_to_send", "overdue", "completed"].map((status) => (
            <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select name="priority" defaultValue={priority} className={selectClass}>
          {["low", "normal", "high", "urgent"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input
          name="reviewDueAt"
          type="datetime-local"
          defaultValue={reviewDueAt ? reviewDueAt.slice(0, 16) : ""}
          className={selectClass}
        />
        <input
          name="nextAction"
          defaultValue={nextAction ?? ""}
          placeholder="Next action"
          className={`${selectClass} min-w-44`}
        />
        <button
          disabled={fieldPending}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
        >
          Save
        </button>
      </form>
      <form action={reviewAction}>
        <input type="hidden" name="rfqId" value={rfqId} />
        <button
          disabled={reviewPending}
          className="h-9 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          Mark reviewed
        </button>
      </form>
      {assignState.error || fieldState.error || reviewState.error ? (
        <p className="text-xs font-medium text-rose-600">
          {assignState.error || fieldState.error || reviewState.error}
        </p>
      ) : null}
    </div>
  );
}
