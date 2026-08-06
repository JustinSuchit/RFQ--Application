import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type RecentRfqRow = {
  id: string;
  rfq_number: string;
  status: string;
  submission_deadline: string | null;
  estimated_value: number | null;
  customers:
    | {
        company_name: string;
      }
    | {
        company_name: string;
      }[]
    | null;
};

type ActivityRow = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: string) {
  if (["accepted", "approved", "healthy"].includes(status)) {
    return "bg-teal-50 text-teal-700 ring-teal-100";
  }

  if (["awaiting_approval", "warning"].includes(status)) {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  if (["declined", "rejected", "failed"].includes(status)) {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }

  if (["in_review", "supplier_pricing", "sent"].includes(status)) {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(status)}`}
    >
      {labelize(status)}
    </span>
  );
}

function MetricBlock({
  label,
  value,
  helper,
  accent = "border-slate-300",
  primary = false,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-[#dfe4ea] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${accent} border-t-2`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={
          primary
            ? "mt-2 text-[30px] font-semibold leading-none tracking-tight text-slate-950"
            : "mt-2 text-2xl font-semibold leading-none tracking-tight text-slate-950"
        }
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function customerName(row: RecentRfqRow) {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  return customer?.company_name ?? "No customer";
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function DashboardPage() {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const [
    totalRfqs,
    openRfqs,
    supplierPricingRfqs,
    pendingApprovalQuotes,
    monthlyQuotes,
    imapConnectionResponse,
    recentScanRunsResponse,
    recentRfqsResponse,
    activityResponse,
  ] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .not("status", "in", "(approved,accepted,declined,rejected,closed,cancelled)"),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "supplier_pricing"),
    supabase
      .from("customer_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("approval_status", "pending"),
    supabase
      .from("customer_quotes")
      .select("total")
      .eq("organization_id", organization.id)
      .gte("created_at", startOfMonthIso()),
    supabase
      .from("email_connections")
      .select("last_scan_status, last_scan_at, auto_scan_enabled, next_scan_at")
      .eq("organization_id", organization.id)
      .in("provider", ["imap", "custom_imap"])
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("email_scan_runs")
      .select("status, completed_at, started_at")
      .eq("organization_id", organization.id)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("rfqs")
      .select(
        "id, rfq_number, status, submission_deadline, estimated_value, customers(company_name)",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("activity_logs")
      .select("id, action, details, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const quoteValueThisMonth =
    monthlyQuotes.data?.reduce(
      (sum, quote) => sum + Number(quote.total ?? 0),
      0,
    ) ?? 0;

  const dashboardMetrics = [
    {
      label: "Total RFQs",
      value: String(totalRfqs.count ?? 0),
      helper: "All workspace records",
    },
    {
      label: "Open RFQs",
      value: String(openRfqs.count ?? 0),
      helper: "Currently in progress",
    },
    {
      label: "Awaiting supplier quotes",
      value: String(supplierPricingRfqs.count ?? 0),
      helper: "Pricing due soon",
    },
    {
      label: "Awaiting approval",
      value: String(pendingApprovalQuotes.count ?? 0),
      helper: "Ready for buyer review",
    },
    {
      label: "Quote value this month",
      value: formatCurrency(quoteValueThisMonth, organization.currency),
      helper: "Submitted quotes",
    },
    { label: "Win rate", value: "0%", helper: "Conversion trend" },
  ];
  const recentRfqs = (recentRfqsResponse.data ?? []) as RecentRfqRow[];
  const activityLogs = (activityResponse.data ?? []) as ActivityRow[];
  const dataError =
    totalRfqs.error ??
    openRfqs.error ??
    supplierPricingRfqs.error ??
    pendingApprovalQuotes.error ??
    monthlyQuotes.error ??
    imapConnectionResponse.error ??
    recentScanRunsResponse.error ??
    recentRfqsResponse.error ??
    activityResponse.error;
  const recentScanRuns = recentScanRunsResponse.data ?? [];
  const lastScanFailed = imapConnectionResponse.data?.last_scan_status === "failed";
  const repeatedFailures = recentScanRuns.filter((run) => run.status === "failed").length >= 3;
  const noNextScan =
    imapConnectionResponse.data?.auto_scan_enabled && !imapConnectionResponse.data?.next_scan_at;
  const mailboxHealth = lastScanFailed || repeatedFailures ? "Failed" : noNextScan ? "Warning" : "Healthy";
  const mailboxStatusColor =
    mailboxHealth === "Healthy"
      ? "bg-teal-500"
      : mailboxHealth === "Failed"
        ? "bg-rose-500"
        : "bg-amber-500";
  const lastScanAt = imapConnectionResponse.data?.last_scan_at;

  return (
    <div className="space-y-5">
      <div className="border-b border-[#dfe4ea] pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Workspace overview
        </p>
        <h1 className="mt-1 text-[29px] font-semibold leading-tight tracking-tight text-slate-950">
          Dashboard
        </h1>
        <p className="mt-2 max-w-[760px] text-[15px] leading-6 text-slate-600">
          Monitor RFQ activity, pending supplier responses, approval workload,
          and quote performance across the selected organization.
        </p>
      </div>

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {dataError.message}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <Link href="/settings/email/monitoring" className="block xl:col-span-2">
            <div className="h-full rounded-md border border-[#dfe4ea] bg-slate-50 px-4 py-3.5 transition hover:border-teal-200 hover:bg-white">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${mailboxStatusColor}`} />
                <p className="text-xs font-medium text-slate-500">Mailbox health</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {mailboxHealth}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {lastScanAt ? `Last scan ${formatDate(lastScanAt)}` : "Open Scan Monitoring"}
              </p>
            </div>
          </Link>
          <div className="xl:col-span-3">
            <MetricBlock {...dashboardMetrics[0]} primary accent="border-teal-500" />
          </div>
          <div className="xl:col-span-3">
            <MetricBlock {...dashboardMetrics[1]} primary accent="border-slate-700" />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <MetricBlock {...dashboardMetrics[4]} primary accent="border-slate-500" />
          </div>
          <div className="xl:col-span-4">
            <MetricBlock {...dashboardMetrics[2]} accent="border-sky-500" />
          </div>
          <div className="xl:col-span-4">
            <MetricBlock {...dashboardMetrics[3]} accent="border-amber-500" />
          </div>
          <div className="xl:col-span-4">
            <MetricBlock {...dashboardMetrics[5]} accent="border-teal-500" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.75fr)]">
          <div className="min-w-0 border-b border-[#dfe4ea] xl:border-b-0 xl:border-r">
            <div className="flex min-h-14 items-center justify-between border-b border-[#dfe4ea] px-4 py-3">
              <h2 className="text-[18px] font-semibold text-slate-950">
                Recent RFQs
              </h2>
              <Link href="/rfqs" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#dfe4ea] text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">RFQ</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Deadline</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentRfqs.length > 0 ? (
                  recentRfqs.map((rfq) => (
                    <tr key={rfq.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                        <Link href={`/rfqs/${rfq.id}`} className="hover:text-teal-700">
                          {rfq.rfq_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {customerName(rfq)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <StatusBadge status={rfq.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.submission_deadline)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                        {formatCurrency(
                          Number(rfq.estimated_value ?? 0),
                          organization.currency,
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No RFQs yet"
                        description="Create your first RFQ to start tracking customer requests and supplier pricing."
                        action={
                          <Link
                            href="/rfqs/new"
                            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          >
                            Create RFQ
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="min-w-0 p-4">
            <h2 className="text-[18px] font-semibold text-slate-950">
              Activity feed
            </h2>
            {activityLogs.length > 0 ? (
              <div className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-200">
                {activityLogs.map((activity) => (
                  <div key={activity.id} className="relative flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-teal-500 ring-1 ring-teal-100" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-5 text-slate-950">
                        {activity.action}
                      </p>
                      <p className="mt-0.5 text-sm leading-5 text-slate-600">
                        {String(activity.details?.subject ?? "Workspace updated")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No activity yet" className="min-h-80" />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
