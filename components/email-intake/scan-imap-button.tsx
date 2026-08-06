"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

type RequestState = "idle" | "loading" | "success" | "error";

type ScanResult = {
  success?: boolean;
  error?: string;
  details?: string;
  scanned?: number;
  insertedOrUpdated?: number;
  skippedNotRfq?: number;
  duplicates?: number;
};

function scanMessage(result: ScanResult) {
  return `IMAP scan completed: ${result.scanned ?? 0} scanned, ${
    result.insertedOrUpdated ?? 0
  } imported, ${result.skippedNotRfq ?? 0} skipped, ${
    result.duplicates ?? 0
  } duplicate${(result.duplicates ?? 0) === 1 ? "" : "s"}.`;
}

function errorMessage(result: ScanResult) {
  const message = result.details
    ? `${result.error || "IMAP scan failed"}: ${result.details}`
    : result.error || "IMAP scan failed.";

  if (/already running/i.test(message)) {
    return "An IMAP scan is already running.";
  }

  return message;
}

export function ScanImapButton() {
  const router = useRouter();
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function scanInbox() {
    if (state === "loading") return;

    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/email-intake/imap-scan", {
        method: "POST",
      });
      const result = (await response.json()) as ScanResult;

      if (!response.ok || !result.success) {
        throw new Error(errorMessage(result));
      }

      setState("success");
      setMessage(scanMessage(result));
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to scan IMAP inbox.",
      );
    }
  }

  return (
    <div className="flex max-w-full flex-col gap-2 sm:items-end">
      <button
        type="button"
        disabled={state === "loading"}
        onClick={scanInbox}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <RefreshCw
          className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {state === "loading" ? "Scanning Inbox..." : "Scan IMAP Inbox"}
      </button>
      {message ? (
        <p
          className={
            state === "error"
              ? "max-w-xs text-sm font-medium text-rose-700"
              : "max-w-xs text-sm font-medium text-teal-700"
          }
        >
          {message}
          {state === "success" ? (
            <>
              {" "}
              <Link href="/email-intake" className="underline">
                View Email Intake
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
