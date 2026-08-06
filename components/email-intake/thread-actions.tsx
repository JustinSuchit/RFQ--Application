"use client";

import { useActionState } from "react";
import {
  linkEmailThreadToRfqAction,
  type EmailIntakeState,
} from "@/app/(workspace)/email-intake/actions";

type RfqOption = {
  id: string;
  rfq_number: string;
  subject: string;
};

const initialState: EmailIntakeState = { error: "" };

export function LinkThreadToRfqForm({
  emailId,
  rfqs,
}: {
  emailId: string;
  rfqs: RfqOption[];
}) {
  const [state, formAction, pending] = useActionState(
    linkEmailThreadToRfqAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="emailId" value={emailId} />
      <select
        name="rfqId"
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        defaultValue=""
      >
        <option value="">Choose RFQ</option>
        {rfqs.map((rfq) => (
          <option key={rfq.id} value={rfq.id}>
            {rfq.rfq_number} - {rfq.subject}
          </option>
        ))}
      </select>
      <button
        disabled={pending || rfqs.length === 0}
        className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
      >
        {pending ? "Linking..." : "Link whole thread"}
      </button>
      {state.error ? <p className="text-sm font-medium text-rose-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-teal-700">{state.success}</p> : null}
    </form>
  );
}
