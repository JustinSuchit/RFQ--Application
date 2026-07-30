"use client";

import { useActionState } from "react";
import {
  approveCustomerQuoteAction,
  rejectCustomerQuoteAction,
  updateCustomerQuoteStatusAction,
  type ApprovalDecisionState,
  type UpdateCustomerQuoteStatusState,
} from "@/app/(workspace)/rfqs/[id]/customer-quotes/[quoteId]/actions";

const initialState: UpdateCustomerQuoteStatusState = {
  error: "",
};

type CustomerQuoteActionsProps = {
  rfqId: string;
  quoteId: string;
  approvalStatus: string;
};

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
    >
      Download PDF
    </button>
  );
}

export function CustomerQuoteStatusActions({
  rfqId,
  quoteId,
  approvalStatus,
}: CustomerQuoteActionsProps) {
  const [state, formAction, isPending] = useActionState(
    updateCustomerQuoteStatusAction,
    initialState,
  );

  const sentBlockedMessage =
    approvalStatus === "pending"
      ? "This quote requires approval before it can be sent."
      : approvalStatus === "rejected"
        ? "This quote was rejected. Create a revision or adjust the quote before sending."
        : "";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="flex flex-wrap gap-2">
        {sentBlockedMessage ? null : (
          <button
            type="submit"
            name="status"
            value="sent"
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Updating..." : "Mark as Sent"}
          </button>
        )}
        {[
          ["accepted", "Mark as Accepted"],
          ["declined", "Mark as Declined"],
        ].map(([status, label]) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Updating..." : label}
          </button>
        ))}
      </div>
      {sentBlockedMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {sentBlockedMessage}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

const approvalInitialState: ApprovalDecisionState = {
  error: "",
};

export function CustomerQuoteApprovalActions({
  rfqId,
  quoteId,
}: Pick<CustomerQuoteActionsProps, "rfqId" | "quoteId">) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveCustomerQuoteAction,
    approvalInitialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectCustomerQuoteAction,
    approvalInitialState,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <input type="hidden" name="rfqId" value={rfqId} />
          <input type="hidden" name="quoteId" value={quoteId} />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approvePending ? "Approving..." : "Approve Quote"}
          </button>
        </form>
        <form
          action={rejectAction}
          onSubmit={(event) => {
            const comments = window.prompt("Optional rejection comments") ?? "";
            const input = event.currentTarget.elements.namedItem("comments");

            if (input instanceof HTMLInputElement) {
              input.value = comments;
            }
          }}
        >
          <input type="hidden" name="rfqId" value={rfqId} />
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="comments" />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rejectPending ? "Rejecting..." : "Reject Quote"}
          </button>
        </form>
      </div>
      {approveState.error || rejectState.error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {approveState.error || rejectState.error}
        </p>
      ) : null}
    </div>
  );
}
