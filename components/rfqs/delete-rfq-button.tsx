"use client";

import { useActionState } from "react";
import {
  deleteRfqAction,
  type DeleteRfqState,
} from "@/app/(workspace)/rfqs/[id]/actions";

const initialState: DeleteRfqState = { error: "" };

export function DeleteRfqButton({
  rfqId,
  compact = false,
}: {
  rfqId: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(deleteRfqAction, initialState);

  return (
    <form action={action} className={compact ? "inline-flex flex-col items-end gap-2" : "flex flex-col items-start gap-2"}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <button
        disabled={pending}
        onClick={(event) => {
          if (
            !window.confirm(
              "Are you sure you want to delete this RFQ? This will remove related quote/workflow data and cannot be undone.",
            )
          ) {
            event.preventDefault();
          }
        }}
        className={
          compact
            ? "rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Deleting..." : compact ? "Delete" : "Delete RFQ"}
      </button>
      {state.error ? (
        <p className={compact ? "max-w-xs text-right text-xs font-medium text-rose-600" : "text-sm font-medium text-rose-600"}>{state.error}</p>
      ) : null}
    </form>
  );
}
