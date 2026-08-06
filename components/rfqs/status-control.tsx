"use client";

import { useActionState } from "react";
import {
  updateRfqStatusAction,
  type UpdateRfqStatusState,
} from "@/app/(workspace)/rfqs/[id]/actions";
import { labelizeRfqStatus, RFQ_STATUSES } from "@/lib/rfqs/status";

type StatusControlProps = {
  rfqId: string;
  currentStatus: string;
};

const initialState: UpdateRfqStatusState = {
  error: "",
};

export function StatusControl({ rfqId, currentStatus }: StatusControlProps) {
  const [state, formAction, pending] = useActionState(
    updateRfqStatusAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="rfqId" value={rfqId} />
      <label className="block text-sm font-semibold text-slate-700">
        Update status
        <div className="mt-2 flex gap-2">
          <select
            name="status"
            defaultValue={currentStatus}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            {RFQ_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelizeRfqStatus(status)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Updating..." : "Update"}
          </button>
        </div>
      </label>
      {state.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
