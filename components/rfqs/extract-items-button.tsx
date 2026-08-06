"use client";

import { useActionState } from "react";
import {
  extractRfqItemsFromNotesAction,
  type ExtractRfqItemsState,
} from "@/app/(workspace)/rfqs/[id]/actions";

const initialState: ExtractRfqItemsState = {
  error: "",
  success: "",
};

export function ExtractItemsButton({ rfqId }: { rfqId: string }) {
  const [state, formAction, pending] = useActionState(
    extractRfqItemsFromNotesAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="rfqId" value={rfqId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Extracting..." : "Extract Items from Notes"}
      </button>
      {state.error ? (
        <p className="text-sm font-medium text-rose-600">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm font-medium text-teal-700">{state.success}</p>
      ) : null}
      {process.env.NODE_ENV !== "production" && state.diagnostics ? (
        <p className="text-xs leading-5 text-slate-500">
          Source: {state.diagnostics.sourceUsed.replace(/_/g, " ")} · Parser:{" "}
          {state.diagnostics.parser.replace(/_/g, " ")} · Rows found:{" "}
          {state.diagnostics.finalCandidateCount}
        </p>
      ) : null}
    </form>
  );
}
