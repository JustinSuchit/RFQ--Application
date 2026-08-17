"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createRfqFromEmailAction,
  markEmailClassificationAction,
  type EmailIntakeState,
} from "@/app/(workspace)/email-intake/actions";

const initialState: EmailIntakeState = { error: "" };

function Message({ error, success }: { error: string; success?: string }) {
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;
  if (success) return <p className="text-sm font-medium text-teal-700">{success}</p>;
  return null;
}

export function EmailClassificationActions({
  emailId,
  hasRfq,
  rfqId,
}: {
  emailId: string;
  hasRfq: boolean;
  rfqId?: string | null;
}) {
  const router = useRouter();
  const [markState, markAction, markPending] = useActionState(
    markEmailClassificationAction,
    initialState,
  );
  const [rfqState, rfqAction, rfqPending] = useActionState(
    createRfqFromEmailAction,
    initialState,
  );

  useEffect(() => {
    if (rfqState.redirectTo) {
      router.push(rfqState.redirectTo);
    }
  }, [rfqState.redirectTo, router]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form action={markAction}>
        <input type="hidden" name="id" value={emailId} />
        <button
          name="intent"
          value="rfq"
          disabled={markPending}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark as RFQ
        </button>
      </form>
      <form action={markAction}>
        <input type="hidden" name="id" value={emailId} />
        <button
          name="intent"
          value="not_rfq"
          disabled={markPending}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark as Not RFQ
        </button>
      </form>
      {hasRfq && rfqId ? (
        <Link
          href={`/rfqs/${rfqId}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          View RFQ
        </Link>
      ) : (
        <form action={rfqAction}>
          <input type="hidden" name="id" value={emailId} />
          <button
            disabled={rfqPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rfqPending ? "Creating RFQ..." : "Create RFQ"}
          </button>
        </form>
      )}
      <Message error={markState.error || rfqState.error} success={markState.success || rfqState.success} />
    </div>
  );
}
