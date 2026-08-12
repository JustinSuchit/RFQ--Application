import Link from "next/link";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScanMonitoringActions } from "@/components/settings/scan-monitoring-actions";
import { requireOrganization } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
import { createClient } from "@/lib/supabase/server";

type ConnectionRow = {
  id: string;
  provider: string;
  mailbox_email: string | null;
  imap_host: string | null;
  scan_folder: string | null;
  is_active: boolean | null;
  auto_scan_enabled: boolean | null;
  scan_interval_minutes: number | null;
  last_scan_at: string | null;
  next_scan_at: string | null;
  last_scan_status: string | null;
  last_scan_error: string | null;
  scan_in_progress: boolean | null;
  scan_started_at: string | null;
  last_processed_uid: number | null;
  last_uid_validity: number | null;
};

type ScanRun = {
  id: string;
  trigger: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  scanned_count: number;
  imported_count: number;
  duplicate_count: number;
  skipped_not_rfq_count: number;
  attachment_count: number;
  error_message: string | null;
  highest_uid: number | null;
};

function labelize(value: string | null | undefined) {
  return String(value || "not_set")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function duration(startedAt: string, completedAt: string | null) {
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(startedAt).getTime());
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusClass(value: string | null | undefined) {
  if (value === "success" || value === "completed") return "bg-teal-50 text-teal-700 ring-teal-200";
  if (value === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "running") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

function health(connection: ConnectionRow | null, runs: ScanRun[]) {
  const warnings: string[] = [];
  const failures = runs.slice(0, 5).filter((run) => run.status === "failed").length;
  const lastSuccess = runs.find((run) => run.status === "success");

  if (!connection) return { label: "Failed", tone: "failed", warnings: ["No active IMAP connection configured."] };
  if (connection.auto_scan_enabled && !connection.next_scan_at) warnings.push("Auto scan is enabled but next scan is not scheduled.");
  if (connection.scan_in_progress && connection.scan_started_at) {
    const ageMinutes = (Date.now() - new Date(connection.scan_started_at).getTime()) / 60_000;
    if (ageMinutes > 15) warnings.push("Scan has been in progress for over 15 minutes.");
  }
  if (lastSuccess) {
    const ageHours = (Date.now() - new Date(lastSuccess.completed_at ?? lastSuccess.started_at).getTime()) / 3_600_000;
    if (ageHours > 2) warnings.push("Last successful scan was over 2 hours ago.");
  } else if (runs.length > 0) {
    warnings.push("No successful scan run has been recorded.");
  }
  if (failures >= 3) warnings.push("Repeated IMAP scan failures detected.");
  if (connection.last_scan_error?.toLowerCase().includes("auth")) warnings.push("Last scan indicates an authentication failure.");
  if (connection.last_scan_error?.toLowerCase().includes("folder")) warnings.push("Last scan indicates the folder may be missing.");

  if (connection.last_scan_status === "failed") return { label: "Failed", tone: "failed", warnings };
  if (warnings.length > 0) return { label: "Warning", tone: "warning", warnings };
  return { label: "Healthy", tone: "healthy", warnings };
}

export default async function ScanMonitoringPage() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const [connectionResponse, runsResponse] = await Promise.all([
    supabase
      .from("email_connections")
      .select(
        "id, provider, mailbox_email, imap_host, scan_folder, is_active, auto_scan_enabled, scan_interval_minutes, last_scan_at, next_scan_at, last_scan_status, last_scan_error, scan_in_progress, scan_started_at, last_processed_uid, last_uid_validity",
      )
      .eq("organization_id", organization.id)
      .in("provider", ["imap", "custom_imap"])
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("email_scan_runs")
      .select("id, trigger, started_at, completed_at, status, scanned_count, imported_count, duplicate_count, skipped_not_rfq_count, attachment_count, error_message, highest_uid")
      .eq("organization_id", organization.id)
      .order("started_at", { ascending: false })
      .limit(25),
  ]);

  const connection = (connectionResponse.data ?? null) as ConnectionRow | null;
  const runs = (runsResponse.data ?? []) as ScanRun[];
  const status = health(connection, runs);
  const canClearLock = ["owner", "admin"].includes(organization.role);
  const error = connectionResponse.error ?? runsResponse.error;

  return (
    <div style={pageThemeStyle("integrations")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="integrations"
        icon={Activity}
        eyebrow="Mailbox operations"
        title="Scan Monitoring"
        description="Monitor IMAP scan health, scheduled runs, recent results, and safe operational controls."
      >
        <Link href="/settings/email" className="text-sm font-semibold text-[var(--page-accent)] hover:opacity-80">
          Back to Email Settings
        </Link>
      </PageHeader>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error.message}
        </div>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(status.tone === "healthy" ? "success" : status.tone === "failed" ? "failed" : "partial")}`}>
              {status.label}
            </span>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">
              {connection?.mailbox_email ?? "No active mailbox"}
            </h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
              <p><span className="font-semibold text-slate-950">Provider:</span> {labelize(connection?.provider)}</p>
              <p><span className="font-semibold text-slate-950">Host:</span> {connection?.imap_host ?? "Not set"}</p>
              <p><span className="font-semibold text-slate-950">Folder:</span> {connection?.scan_folder ?? "Not set"}</p>
              <p><span className="font-semibold text-slate-950">Active:</span> {connection?.is_active ? "Yes" : "No"}</p>
              <p><span className="font-semibold text-slate-950">Auto scan:</span> {connection?.auto_scan_enabled ? "Enabled" : "Disabled"}</p>
              <p><span className="font-semibold text-slate-950">Interval:</span> {connection?.scan_interval_minutes ?? 60} min</p>
              <p><span className="font-semibold text-slate-950">Last scan:</span> {formatDateTime(connection?.last_scan_at ?? null)}</p>
              <p><span className="font-semibold text-slate-950">Next scan:</span> {formatDateTime(connection?.next_scan_at ?? null)}</p>
              <p><span className="font-semibold text-slate-950">Last status:</span> {labelize(connection?.last_scan_status)}</p>
              <p><span className="font-semibold text-slate-950">In progress:</span> {connection?.scan_in_progress ? "Yes" : "No"}</p>
              <p><span className="font-semibold text-slate-950">Started:</span> {formatDateTime(connection?.scan_started_at ?? null)}</p>
              <p><span className="font-semibold text-slate-950">Last UID:</span> {connection?.last_processed_uid ?? "Not set"}</p>
              <p><span className="font-semibold text-slate-950">UIDVALIDITY:</span> {connection?.last_uid_validity ?? "Not set"}</p>
            </div>
            {connection?.last_scan_error ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {connection.last_scan_error}
              </p>
            ) : null}
          </div>
          <ScanMonitoringActions canClearLock={canClearLock} />
        </div>
        {status.warnings.length > 0 ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">Warnings</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {status.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Recent scan runs</h2>
        </div>
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  {["Result", "Trigger", "Started", "Duration", "Scanned", "Imported", "Duplicates", "Skipped", "Attachments", "Highest UID", "Error"].map((header) => (
                    <th key={header} className="px-4 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusClass(run.status)}`}>
                        {labelize(run.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{labelize(run.trigger)}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDateTime(run.started_at)}</td>
                    <td className="px-4 py-4 text-slate-600">{duration(run.started_at, run.completed_at)}</td>
                    <td className="px-4 py-4 text-slate-600">{run.scanned_count}</td>
                    <td className="px-4 py-4 text-slate-600">{run.imported_count}</td>
                    <td className="px-4 py-4 text-slate-600">{run.duplicate_count}</td>
                    <td className="px-4 py-4 text-slate-600">{run.skipped_not_rfq_count}</td>
                    <td className="px-4 py-4 text-slate-600">{run.attachment_count}</td>
                    <td className="px-4 py-4 text-slate-600">{run.highest_uid ?? "Not set"}</td>
                    <td className="max-w-xs truncate px-4 py-4 text-slate-600" title={run.error_message ?? ""}>{run.error_message ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No scan runs recorded" description="Run a manual scan or wait for the scheduled scan to populate monitoring history." />
        )}
      </Card>
    </div>
  );
}
