"use client";

import { useActionState } from "react";
import {
  createManualEmailAction,
  type EmailIntakeState,
} from "@/app/(workspace)/email-intake/actions";

const initialState: EmailIntakeState = { error: "" };
const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const textareaClass =
  "mt-2 min-h-56 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ManualEmailForm() {
  const [state, formAction, pending] = useActionState(
    createManualEmailAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          From name
          <input name="fromName" className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          From email
          <input name="fromEmail" type="email" required className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Subject
          <input name="subject" required className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Received date
          <input
            name="receivedAt"
            type="datetime-local"
            required
            defaultValue={localDateTimeValue()}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-3 self-end text-sm font-semibold text-slate-700">
          <input
            name="hasAttachments"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Has attachments
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Body preview / email body
          <textarea name="body" required className={textareaClass} />
        </label>
      </div>

      {state.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-slate-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Logging email..." : "Log Email"}
        </button>
      </div>
    </form>
  );
}
