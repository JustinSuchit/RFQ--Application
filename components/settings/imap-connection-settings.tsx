"use client";

import { PlugZap, RefreshCw, Save } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  saveImapConnectionAction,
  type ImapConnectionActionState,
} from "@/app/(workspace)/settings/email/actions";
import { Card } from "@/components/ui/card";

export type ImapConnection = {
  id: string;
  provider: string;
  mailbox_email: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean | null;
  imap_username: string | null;
  scan_folder: string | null;
  only_unread: boolean | null;
  is_active: boolean | null;
  last_uid: number | null;
  last_scan_at: string | null;
};

type Props = {
  connection: ImapConnection | null;
  canManage: boolean;
};

type Preset = "custom" | "outlook" | "gmail" | "cpanel";
type RequestState = "idle" | "loading" | "success" | "error";
type ScanSummary = {
  scanned: number;
  insertedOrUpdated: number;
  likelyRfq: number;
  possibleRfq: number;
  skippedNotRfq: number;
  highestUid: number | null;
};
type ImapFailureResult = {
  success?: boolean;
  error?: string;
  details?: string;
  diagnostics?: ImapDiagnostics;
};
type ImapDiagnostics = {
  code?: string;
  command?: string;
  response?: string;
  responseText?: string;
  serverResponse?: string;
  authenticationFailed?: boolean;
};

const initialState: ImapConnectionActionState = { error: "", success: "" };
const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500";
const checkboxClass =
  "h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60";

function presetFromConnection(connection: ImapConnection | null): Preset {
  if (!connection?.imap_host) return "custom";
  if (connection.imap_host === "outlook.office365.com") return "outlook";
  if (connection.imap_host === "imap.gmail.com") return "gmail";
  if (connection.imap_host === "mail.yourdomain.com") return "cpanel";
  return "custom";
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function helperForPreset(preset: Preset) {
  if (preset === "outlook") {
    return "Use your full Outlook email as the username. If normal password login fails, use an app password if available.";
  }

  if (preset === "gmail") {
    return "Gmail usually requires two-step verification and an app password.";
  }

  if (preset === "cpanel") {
    return "Use your full mailbox email and the mail server provided by your hosting account.";
  }

  return "Enter the host, port, username, and mailbox folder supplied by your email provider.";
}

function errorMessageFromResult(
  result: ImapFailureResult,
  fallback: string,
) {
  if (result.details) {
    return `${result.error || fallback}: ${result.details}`;
  }

  return result.error || fallback;
}

function DiagnosticsList({ diagnostics }: { diagnostics: ImapDiagnostics | null }) {
  if (!diagnostics) return null;

  const rows = [
    ["Code", diagnostics.code],
    ["Command", diagnostics.command],
    ["Response", diagnostics.response],
    ["Response text", diagnostics.responseText],
    ["Server response", diagnostics.serverResponse],
    [
      "Authentication failed",
      diagnostics.authenticationFailed ? "true" : undefined,
    ],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (!rows.length) return null;

  return (
    <dl className="mt-3 grid gap-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:grid-cols-[140px_1fr]">
          <dt className="font-semibold text-rose-800">{label}</dt>
          <dd className="break-words font-mono text-rose-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ImapConnectionSettings({ connection, canManage }: Props) {
  const [state, formAction, pending] = useActionState(
    saveImapConnectionAction,
    initialState,
  );
  const passwordRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<Preset>(presetFromConnection(connection));
  const [mailboxEmail, setMailboxEmail] = useState(
    connection?.mailbox_email ?? "",
  );
  const [imapHost, setImapHost] = useState(connection?.imap_host ?? "");
  const [imapPort, setImapPort] = useState(
    String(connection?.imap_port ?? 993),
  );
  const [imapSecure, setImapSecure] = useState(
    connection?.imap_secure ?? true,
  );
  const [imapUsername, setImapUsername] = useState(
    connection?.imap_username ?? "",
  );
  const [scanFolder, setScanFolder] = useState(connection?.scan_folder ?? "INBOX");
  const [onlyUnread, setOnlyUnread] = useState(connection?.only_unread ?? false);
  const [isActive, setIsActive] = useState(connection?.is_active ?? true);
  const [testState, setTestState] = useState<RequestState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [testDiagnostics, setTestDiagnostics] =
    useState<ImapDiagnostics | null>(null);
  const [scanState, setScanState] = useState<RequestState>("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [scanDiagnostics, setScanDiagnostics] =
    useState<ImapDiagnostics | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);

  const status = useMemo(() => {
    if (!connection) return "Not configured";
    return connection.is_active ? "Active" : "Inactive";
  }, [connection]);
  const canRunImapActions = Boolean(connection && connection.is_active);

  useEffect(() => {
    if (state.success && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [state.success]);

  function applyPreset(nextPreset: Preset) {
    setPreset(nextPreset);

    if (nextPreset === "custom") return;

    const nextHost =
      nextPreset === "outlook"
        ? "outlook.office365.com"
        : nextPreset === "gmail"
          ? "imap.gmail.com"
          : "mail.yourdomain.com";

    setImapHost(nextHost);
    setImapPort("993");
    setImapSecure(true);
    setImapUsername(mailboxEmail);
    setScanFolder("INBOX");
  }

  async function runTestConnection() {
    setTestState("loading");
    setTestMessage("");
    setTestDiagnostics(null);

    try {
      const response = await fetch("/api/email-intake/imap-test", {
        method: "POST",
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        details?: string;
        diagnostics?: ImapDiagnostics;
        mailbox?: string;
        exists?: number;
        unseen?: number;
      };

      if (!response.ok || !result.success) {
        setTestDiagnostics(result.diagnostics ?? null);
        throw new Error(
          errorMessageFromResult(result, "Unable to test IMAP connection."),
        );
      }

      setTestState("success");
      setTestMessage(
        `Connected to ${result.mailbox}. Messages: ${result.exists ?? 0}. Unread: ${result.unseen ?? 0}.`,
      );
    } catch (error) {
      setTestState("error");
      setTestMessage(
        error instanceof Error ? error.message : "Unable to test IMAP connection.",
      );
    }
  }

  async function runScanInbox() {
    setScanState("loading");
    setScanMessage("");
    setScanDiagnostics(null);
    setScanSummary(null);

    try {
      const response = await fetch("/api/email-intake/imap-scan", {
        method: "POST",
      });
      const result = (await response.json()) as Partial<ScanSummary> & {
        success?: boolean;
        error?: string;
        details?: string;
        diagnostics?: ImapDiagnostics;
      };

      if (!response.ok || !result.success) {
        setScanDiagnostics(result.diagnostics ?? null);
        throw new Error(
          errorMessageFromResult(result, "Unable to scan IMAP inbox."),
        );
      }

      const summary = {
        scanned: result.scanned ?? 0,
        insertedOrUpdated: result.insertedOrUpdated ?? 0,
        likelyRfq: result.likelyRfq ?? 0,
        possibleRfq: result.possibleRfq ?? 0,
        skippedNotRfq: result.skippedNotRfq ?? 0,
        highestUid: result.highestUid ?? null,
      };

      setScanState("success");
      setScanSummary(summary);
      setScanMessage(
        `Scan complete. Imported ${summary.insertedOrUpdated} RFQ-related emails. Skipped ${summary.skippedNotRfq} non-RFQ emails.`,
      );
    } catch (error) {
      setScanState("error");
      setScanMessage(
        error instanceof Error ? error.message : "Unable to scan IMAP inbox.",
      );
    }
  }

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              IMAP Mailbox Connection
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Connect a mailbox using IMAP so the system can scan incoming
              RFQ-related emails.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              You can test this with a personal Outlook, Gmail app password, or
              cPanel email inbox. For production, OAuth or encrypted
              credentials should be used.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-950">Status: {status}</p>
            {connection?.last_scan_at ? (
              <p className="mt-1 text-slate-600">
                Last scan: {formatDateTime(connection.last_scan_at)}
              </p>
            ) : null}
            {connection?.last_uid ? (
              <p className="mt-1 text-slate-600">Last UID: {connection.last_uid}</p>
            ) : null}
          </div>
        </div>

        {!canManage ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Only organization owners and admins can update email connection
            settings.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Mailbox email
            <input
              name="mailboxEmail"
              type="email"
              value={mailboxEmail}
              onChange={(event) => {
                setMailboxEmail(event.target.value);
                if (preset !== "custom") setImapUsername(event.target.value);
              }}
              disabled={!canManage}
              required
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Provider preset
            <select
              value={preset}
              onChange={(event) => applyPreset(event.target.value as Preset)}
              disabled={!canManage}
              className={inputClass}
            >
              <option value="custom">Custom</option>
              <option value="outlook">Outlook / Hotmail</option>
              <option value="gmail">Gmail</option>
              <option value="cpanel">cPanel / Hosting Email</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            IMAP host
            <input
              name="imapHost"
              value={imapHost}
              onChange={(event) => setImapHost(event.target.value)}
              disabled={!canManage}
              required
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            IMAP port
            <input
              name="imapPort"
              type="number"
              min="1"
              value={imapPort}
              onChange={(event) => setImapPort(event.target.value)}
              disabled={!canManage}
              required
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Username
            <input
              name="imapUsername"
              value={imapUsername}
              onChange={(event) => setImapUsername(event.target.value)}
              disabled={!canManage}
              required
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Password or app password
            <input
              ref={passwordRef}
              name="imapPassword"
              type="password"
              autoComplete="new-password"
              placeholder={
                connection
                  ? "Leave blank to keep existing password"
                  : "Password or app password"
              }
              disabled={!canManage}
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Scan folder
            <input
              name="scanFolder"
              value={scanFolder}
              onChange={(event) => setScanFolder(event.target.value)}
              disabled={!canManage}
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 self-end rounded-md border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                name="imapSecure"
                type="checkbox"
                checked={imapSecure}
                onChange={(event) => setImapSecure(event.target.checked)}
                disabled={!canManage}
                className={checkboxClass}
              />
              Use SSL/TLS
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                name="onlyUnread"
                type="checkbox"
                checked={onlyUnread}
                onChange={(event) => setOnlyUnread(event.target.checked)}
                disabled={!canManage}
                className={checkboxClass}
              />
              Only import unread emails
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={!canManage}
                className={checkboxClass}
              />
              Active
            </label>
          </div>
        </div>

        <div className="rounded-md border border-teal-100 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900">
          {helperForPreset(preset)}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          For local development, you can use a personal test inbox. Avoid using
          your main personal inbox. For production, mailbox credentials must be
          encrypted or replaced with OAuth.
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {pending ? "Saving..." : "Save IMAP Connection"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canRunImapActions || testState === "loading"}
              onClick={runTestConnection}
              title={
                canRunImapActions
                  ? "Test the saved IMAP connection."
                  : "Save and activate an IMAP connection first."
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <PlugZap className="h-4 w-4" aria-hidden="true" />
              {testState === "loading" ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              disabled={!canRunImapActions || scanState === "loading"}
              onClick={runScanInbox}
              title={
                canRunImapActions
                  ? "Scan the saved mailbox for RFQ emails."
                  : "Save and activate an IMAP connection first."
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {scanState === "loading" ? "Scanning..." : "Scan Inbox"}
            </button>
          </div>

          <div className="text-sm">
            {state.error ? (
              <p className="font-medium text-rose-600">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="font-medium text-teal-700">{state.success}</p>
            ) : null}
            {!canRunImapActions ? (
              <p className="mt-1 text-slate-500">
                Save and activate an IMAP connection to test or scan.
              </p>
            ) : null}
          </div>
        </div>

        {testMessage || scanMessage || scanSummary ? (
          <div className="grid gap-3 border-t border-slate-200 pt-5 md:grid-cols-2">
            {testMessage ? (
              <div
                className={
                  testState === "error"
                    ? "rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                    : "rounded-md border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800"
                }
              >
                <p>{testMessage}</p>
                <DiagnosticsList diagnostics={testDiagnostics} />
              </div>
            ) : null}

            {scanMessage || scanSummary ? (
              <div
                className={
                  scanState === "error"
                    ? "rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                    : "rounded-md border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900"
                }
              >
                <p className="font-medium">{scanMessage}</p>
                <DiagnosticsList diagnostics={scanDiagnostics} />
                {scanSummary ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-teal-700">Scanned</dt>
                      <dd className="font-semibold">{scanSummary.scanned}</dd>
                    </div>
                    <div>
                      <dt className="text-teal-700">Imported likely RFQs</dt>
                      <dd className="font-semibold">{scanSummary.likelyRfq}</dd>
                    </div>
                    <div>
                      <dt className="text-teal-700">Imported possible RFQs</dt>
                      <dd className="font-semibold">{scanSummary.possibleRfq}</dd>
                    </div>
                    <div>
                      <dt className="text-teal-700">Skipped non-RFQ emails</dt>
                      <dd className="font-semibold">{scanSummary.skippedNotRfq}</dd>
                    </div>
                    <div>
                      <dt className="text-teal-700">Updated</dt>
                      <dd className="font-semibold">
                        {scanSummary.insertedOrUpdated}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-teal-700">Highest UID</dt>
                      <dd className="font-semibold">
                        {scanSummary.highestUid ?? "None"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Card>
  );
}
