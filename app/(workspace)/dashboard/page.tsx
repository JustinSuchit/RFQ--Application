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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Workspace overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Monitor RFQ activity, pending supplier responses, approval workload,
          and quote performance across the selected organization.
        </p>
      </div>

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {dataError.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/settings/email/monitoring" className="block">
          <Card className="p-5 transition hover:border-teal-200 hover:shadow-sm">
            <p className="text-sm font-medium text-slate-500">Mailbox health</p>
            <p className={`mt-3 text-3xl font-semibold ${
              mailboxHealth === "Healthy"
                ? "text-teal-700"
                : mailboxHealth === "Failed"
                  ? "text-rose-700"
                  : "text-amber-700"
            }`}>
              {mailboxHealth}
            </p>
            <p className="mt-1 text-sm text-slate-500">Open Scan Monitoring</p>
          </Card>
        </Link>
        {dashboardMetrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-sm font-medium text-slate-500">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {metric.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{metric.helper}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Recent RFQs
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">RFQ</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentRfqs.length > 0 ? (
                  recentRfqs.map((rfq) => (
                    <tr key={rfq.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                        {rfq.rfq_number}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {customerName(rfq)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {labelize(rfq.status)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(rfq.submission_deadline)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
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
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Activity feed
          </h2>
          {activityLogs.length > 0 ? (
            <div className="mt-5 space-y-5">
              {activityLogs.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {activity.action}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
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
        </Card>
      </div>
    </div>
  );
}
