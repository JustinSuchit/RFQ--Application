"use client";

import { useActionState } from "react";
import {
  deleteEmailIntakeRecordAction,
  type EmailIntakeState,
} from "@/app/(workspace)/email-intake/actions";

const initialState: EmailIntakeState = { error: "" };

export function DeleteEmailIntakeButton({
  emailId,
  linkedRfq,
  redirectTo,
  compact = false,
}: {
  emailId: string;
  linkedRfq: boolean;
  redirectTo: "list" | "detail";
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    deleteEmailIntakeRecordAction,
    initialState,
  );

  const confirmation = linkedRfq
    ? "This email is linked to an RFQ. Deleting the email intake record will keep the RFQ but remove the source email history. Continue?"
    : "Delete this email intake record?";

  return (
    <form action={action} className="inline-flex flex-col items-end gap-2">
      <input type="hidden" name="emailId" value={emailId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm(confirmation)) {
            event.preventDefault();
          }
        }}
        className={
          compact
            ? "rounded-md border border-rose-200 bg-white px-2.5 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            : "rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {state.error ? (
        <p className="max-w-xs text-right text-xs font-medium text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="max-w-xs text-right text-xs font-medium text-teal-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
