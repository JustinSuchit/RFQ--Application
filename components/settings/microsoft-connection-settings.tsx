"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";

export type MicrosoftConnection = {
  id: string;
  provider: string;
  mailbox_email: string | null;
  graph_scan_folder: string | null;
  graph_scan_folder_id: string | null;
  graph_last_scan_at: string | null;
  graph_last_message_received_at: string | null;
  is_active: boolean | null;
};

type Props = {
  connection: MicrosoftConnection | null;
  canManage: boolean;
};

type RequestState = "idle" | "loading" | "success" | "error";
type ScanSummary = {
  folder: string;
  scanned: number;
  insertedOrUpdated: number;
  likelyRfq: number;
  possibleRfq: number;
  skippedNotRfq: number;
};

export function MicrosoftConnectionSettings({ connection, canManage }: Props) {
  const [scanState, setScanState] = useState<RequestState>("idle");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [scanFolder, setScanFolder] = useState(
    connection?.graph_scan_folder || "inbox",
  );
  const connected = Boolean(connection?.is_active);

  async function saveFolder() {
    setSaveState("loading");
    setFolderMessage("");

    try {
      const response = await fetch("/api/integrations/microsoft/folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph_scan_folder: scanFolder }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        graph_scan_folder?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to save Microsoft scan folder.");
      }

      setScanFolder(result.graph_scan_folder || scanFolder);
      setSaveState("success");
      setFolderMessage(`Microsoft scan folder saved: ${result.graph_scan_folder || scanFolder}`);
    } catch (error) {
      setSaveState("error");
      setFolderMessage(
        error instanceof Error
          ? error.message
          : "Unable to save Microsoft scan folder.",
      );
    }
  }

  async function scanMicrosoftFolder() {
    setScanState("loading");
    setMessage("");
    setSummary(null);

    try {
      const response = await fetch("/api/integrations/microsoft/scan", {
        method: "POST",
      });
      const result = (await response.json()) as Partial<ScanSummary> & {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        const errorMessage = result.error || "Unable to scan Microsoft folder.";
        if (errorMessage.includes("was not found")) {
          throw new Error(
            `Outlook folder ${scanFolder || "inbox"} was not found. Check the folder name in Outlook.`,
          );
        }
        throw new Error(errorMessage);
      }

      const nextSummary = {
        folder: result.folder || scanFolder || "inbox",
        scanned: result.scanned ?? 0,
        insertedOrUpdated: result.insertedOrUpdated ?? 0,
        likelyRfq: result.likelyRfq ?? 0,
        possibleRfq: result.possibleRfq ?? 0,
        skippedNotRfq: result.skippedNotRfq ?? 0,
      };

      setSummary(nextSummary);
      setScanState("success");
      setMessage(
        `Scanned folder ${nextSummary.folder}. Imported ${nextSummary.insertedOrUpdated} RFQ-related emails. Skipped ${nextSummary.skippedNotRfq} non-RFQ emails.`,
      );
    } catch (error) {
      setScanState("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to scan Microsoft folder.",
      );
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Microsoft 365 / Outlook
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Connect a Microsoft 365 mailbox with delegated Microsoft Graph
            access so RFQ-related inbox emails can be imported.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-950">
            Status: {connected ? "connected" : "not connected"}
          </p>
          {connection?.mailbox_email ? (
            <p className="mt-1 text-slate-600">
              Mailbox: {connection.mailbox_email}
            </p>
          ) : null}
          <p className="mt-1 text-slate-600">
            Folder: {scanFolder || "inbox"}
          </p>
        </div>
      </div>

      {!canManage ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Only organization owners and admins can connect Microsoft 365.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="text-sm font-semibold text-slate-700">
          Microsoft scan folder
          <input
            value={scanFolder}
            onChange={(event) => setScanFolder(event.target.value)}
            disabled={!connected || !canManage || saveState === "loading"}
            placeholder="RFQs"
            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
            Enter the Outlook folder name that contains RFQ emails. Example: RFQs. Use inbox for the main inbox.
          </span>
        </label>
        {canManage ? (
          <button
            type="button"
            disabled={!connected || saveState === "loading"}
            onClick={saveFolder}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {saveState === "loading" ? "Saving..." : "Save Microsoft Folder"}
          </button>
        ) : null}
      </div>

      {folderMessage ? (
        <p
          className={
            saveState === "error"
              ? "mt-3 text-sm font-medium text-rose-600"
              : "mt-3 text-sm font-medium text-teal-700"
          }
        >
          {folderMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Link
              href="/api/integrations/microsoft/connect"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Connect Microsoft 365
            </Link>
          ) : null}
          <button
            type="button"
            disabled={!connected || scanState === "loading"}
            onClick={scanMicrosoftFolder}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {scanState === "loading" ? "Scanning..." : "Scan Microsoft Folder"}
          </button>
        </div>

        {message ? (
          <p
            className={
              scanState === "error"
                ? "text-sm font-medium text-rose-600"
                : "text-sm font-medium text-teal-700"
            }
          >
            {message}
          </p>
        ) : null}
      </div>

      {summary ? (
        <dl className="mt-5 grid gap-3 rounded-md border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900 sm:grid-cols-6">
          <div>
            <dt className="text-teal-700">Folder</dt>
            <dd className="font-semibold">{summary.folder}</dd>
          </div>
          <div>
            <dt className="text-teal-700">Scanned</dt>
            <dd className="font-semibold">{summary.scanned}</dd>
          </div>
          <div>
            <dt className="text-teal-700">Likely RFQs</dt>
            <dd className="font-semibold">{summary.likelyRfq}</dd>
          </div>
          <div>
            <dt className="text-teal-700">Possible RFQs</dt>
            <dd className="font-semibold">{summary.possibleRfq}</dd>
          </div>
          <div>
            <dt className="text-teal-700">Skipped</dt>
            <dd className="font-semibold">{summary.skippedNotRfq}</dd>
          </div>
          <div>
            <dt className="text-teal-700">Imported</dt>
            <dd className="font-semibold">{summary.insertedOrUpdated}</dd>
          </div>
        </dl>
      ) : null}
    </Card>
  );
}
