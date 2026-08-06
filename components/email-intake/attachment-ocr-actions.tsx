"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  importAcceptedAttachmentItemsAction,
  updateAttachmentExtractedItemStatusAction,
  uploadEmailAttachmentAction,
  type EmailIntakeState,
} from "@/app/(workspace)/email-intake/actions";

const initialState: EmailIntakeState = { error: "" };

function Message({ state }: { state: EmailIntakeState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={
        state.error
          ? "text-sm font-medium text-rose-600"
          : "text-sm font-medium text-teal-700"
      }
    >
      {state.error || state.success}
    </p>
  );
}

export function ExtractAttachmentButton({
  attachmentId,
}: {
  attachmentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function extract() {
    setPending(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `/api/email-intake/attachments/${attachmentId}/extract`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        extractedItemCount?: number;
        warning?: string;
        status?: string;
        ollama?: {
          used?: boolean;
          unavailable?: boolean;
          error?: string | null;
          returnedItems?: number;
        };
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.details
            ? `${result.error || "Attachment extraction failed"}: ${result.details}`
            : result.error || "Attachment extraction failed.",
        );
      }

      const ollamaMessage = result.ollama
        ? result.ollama.unavailable
          ? ` Ollama assist unavailable: ${result.ollama.error || "local model did not respond"}.`
          : result.ollama.used
            ? ` Ollama assist returned ${result.ollama.returnedItems ?? 0} item candidates.`
            : " Ollama assist skipped because parser already found items."
        : "";

      setMessage(
        `${result.warning || `Extraction ${result.status || "completed"}. Found ${
          result.extractedItemCount ?? 0
        } possible items.`}${ollamaMessage}`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Attachment extraction failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={extract}
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Extracting..." : "Extract Text"}
      </button>
      {message ? (
        <p
          className={
            isError
              ? "text-xs font-medium text-rose-600"
              : "text-xs font-medium text-teal-700"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function DownloadMicrosoftAttachmentButton({
  attachmentId,
}: {
  attachmentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function download() {
    setPending(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `/api/email-intake/attachments/${attachmentId}/download-microsoft`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.details
            ? `${result.error || "Microsoft attachment download failed"}: ${result.details}`
            : result.error || "Microsoft attachment download failed.",
        );
      }

      setMessage("Attachment content downloaded. OCR is ready.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Microsoft attachment download failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={download}
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Downloading..." : "Download Attachment Content"}
      </button>
      {message ? (
        <p
          className={
            isError
              ? "text-xs font-medium text-rose-600"
              : "text-xs font-medium text-teal-700"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function UploadEmailAttachmentForm({ emailId }: { emailId: string }) {
  const [state, action, pending] = useActionState(
    uploadEmailAttachmentAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="emailId" value={emailId} />
      <label className="text-sm font-semibold text-slate-700">
        Upload Attachment Manually
        <input
          type="file"
          name="attachment"
          disabled={pending}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:text-xs file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      <button
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload"}
      </button>
      <div className="sm:col-span-2">
        <Message state={state} />
      </div>
    </form>
  );
}

export function AttachmentExtractedItemActions({
  emailId,
  itemId,
  status,
}: {
  emailId: string;
  itemId: string;
  status: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    updateAttachmentExtractedItemStatusAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (status === "imported") {
    return (
      <p className="text-xs font-semibold text-teal-700">Imported to RFQ</p>
    );
  }

  if (status === "accepted") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-amber-700">
          Accepted, ready to import
        </p>
        <Message state={state} />
      </div>
    );
  }

  if (status === "rejected") {
    return <p className="text-xs font-semibold text-rose-700">Rejected</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="emailId" value={emailId} />
        <input type="hidden" name="itemId" value={itemId} />
        <button
          name="status"
          value="accepted"
          disabled={pending || status === "imported"}
          className="inline-flex h-8 items-center rounded-md border border-teal-200 px-2.5 text-xs font-semibold text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Accept
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="emailId" value={emailId} />
        <input type="hidden" name="itemId" value={itemId} />
        <button
          name="status"
          value="rejected"
          disabled={pending || status === "imported"}
          className="inline-flex h-8 items-center rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Reject
        </button>
      </form>
      <Message state={state} />
    </div>
  );
}

export function ImportAcceptedAttachmentItemsButton({
  emailId,
  rfqId,
  hasRfq,
}: {
  emailId: string;
  rfqId?: string;
  hasRfq: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    importAcceptedAttachmentItemsAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="emailId" value={emailId} />
      {rfqId ? <input type="hidden" name="rfqId" value={rfqId} /> : null}
      <button
        disabled={pending || !hasRfq}
        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Importing..." : "Import Accepted Items to RFQ"}
      </button>
      {!hasRfq ? (
        <p className="text-sm font-medium text-amber-700">
          Create an RFQ from this email before importing attachment items.
        </p>
      ) : null}
      <Message state={state} />
    </form>
  );
}
