import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, MailCheck, Plus, ShieldCheck } from "lucide-react";
import { KpiStrip, PanelHeader } from "@/components/dashboard/kpi-strip";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireOrganization } from "@/lib/auth/session";
import { formatCurrency, formatDate, shortRfqNumber } from "@/lib/formatters";
import { pageThemeStyle } from "@/lib/page-themes";
import { createClient } from "@/lib/supabase/server";

type RecentRfqRow = {
  id: string;
  rfq_number: string;
  subject: string;
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

type AttentionRfqRow = Pick<
  RecentRfqRow,
  "id" | "rfq_number" | "status" | "submission_deadline" | "customers"
>;

type PendingApprovalRow = {
  id: string;
  customer_quote_id: string | null;
  customer_quotes:
    | {
        id: string;
        quote_number: string;
        rfqs:
          | {
              id: string;
              rfq_number: string;
              customers:
                | {
                    company_name: string;
                  }
                | {
                    company_name: string;
                  }[]
                | null;
            }
          | {
              id: string;
              rfq_number: string;
              customers:
                | {
                    company_name: string;
                  }
                | {
                    company_name: string;
                  }[]
                | null;
            }[]
          | null;
      }
    | {
        id: string;
        quote_number: string;
        rfqs:
          | {
              id: string;
              rfq_number: string;
              customers:
                | {
                    company_name: string;
                  }
                | {
                    company_name: string;
                  }[]
                | null;
            }
          | {
              id: string;
              rfq_number: string;
              customers:
                | {
                    company_name: string;
                  }
                | {
                    company_name: string;
                  }[]
                | null;
            }[]
          | null;
      }[]
    | null;
};

function customerName(row: { customers: RecentRfqRow["customers"] }) {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  return customer?.company_name ?? "No customer";
}

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const today = todayIsoDate();

  const [
    totalRfqs,
    openRfqs,
    supplierPricingRfqs,
    pendingApprovalQuotes,
    monthlyQuotes,
    imapConnectionResponse,
    recentScanRunsResponse,
    recentRfqsResponse,
    overdueRfqsResponse,
    missingDeadlineRfqs,
    pendingApprovalResponse,
    expiringQuotesResponse,
  ] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .not("status", "in", "(accepted,declined,closed,cancelled)"),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("review_status", "awaiting_pricing"),
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
        "id, rfq_number, subject, status, submission_deadline, estimated_value, customers(company_name)",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("rfqs")
      .select("id, rfq_number, status, submission_deadline, customers(company_name)")
      .eq("organization_id", organization.id)
      .not("status", "in", "(accepted,declined,closed,cancelled)")
      .lt("submission_deadline", today)
      .order("submission_deadline", { ascending: true })
      .limit(3),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .not("status", "in", "(accepted,declined,closed,cancelled)")
      .is("submission_deadline", null),
    supabase
      .from("approval_requests")
      .select(
        "id, customer_quote_id, customer_quotes(id, quote_number, rfqs(id, rfq_number, customers(company_name)))",
      )
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(3),
    supabase
      .from("customer_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .not("status", "in", "(accepted,declined,rejected,closed,cancelled)")
      .gte("valid_until", today)
      .lte("valid_until", daysFromToday(7)),
  ]);

  const quoteValueThisMonth =
    monthlyQuotes.data?.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0) ?? 0;
  const recentRfqs = (recentRfqsResponse.data ?? []) as RecentRfqRow[];
  const overdueRfqs = (overdueRfqsResponse.data ?? []) as AttentionRfqRow[];
  const approvals = (pendingApprovalResponse.data ?? []) as PendingApprovalRow[];
  const dataError =
    totalRfqs.error ??
    openRfqs.error ??
    supplierPricingRfqs.error ??
    pendingApprovalQuotes.error ??
    monthlyQuotes.error ??
    imapConnectionResponse.error ??
    recentScanRunsResponse.error ??
    recentRfqsResponse.error ??
    overdueRfqsResponse.error ??
    missingDeadlineRfqs.error ??
    pendingApprovalResponse.error ??
    expiringQuotesResponse.error;

  const recentScanRuns = recentScanRunsResponse.data ?? [];
  const lastScanFailed = imapConnectionResponse.data?.last_scan_status === "failed";
  const repeatedFailures = recentScanRuns.filter((run) => run.status === "failed").length >= 3;
  const noNextScan =
    imapConnectionResponse.data?.auto_scan_enabled && !imapConnectionResponse.data?.next_scan_at;
  const mailboxHealth = lastScanFailed || repeatedFailures ? "Failed" : noNextScan ? "Warning" : "Healthy";

  const kpis = [
    { label: "Total RFQs", value: String(totalRfqs.count ?? 0), href: "/rfqs", indicator: "neutral" as const },
    { label: "Open", value: String(openRfqs.count ?? 0), href: "/rfqs", helper: "In progress", indicator: "teal" as const },
    {
      label: "Supplier Responses",
      value: String(supplierPricingRfqs.count ?? 0),
      href: "/review-queue?status=awaiting_pricing",
      helper: "Awaiting pricing",
      indicator: "blue" as const,
    },
    {
      label: "Approvals",
      value: String(pendingApprovalQuotes.count ?? 0),
      href: "/approvals?status=pending",
      helper: "Pending review",
      indicator: "amber" as const,
    },
    {
      label: "Quote Value",
      value: formatCurrency(quoteValueThisMonth, organization.currency),
      href: "/quotes",
      helper: "This month",
      indicator: "teal" as const,
    },
  ];

  const attentionItems = [
    ...overdueRfqs.map((rfq) => ({
      key: `overdue-${rfq.id}`,
      label: `${shortRfqNumber(rfq.rfq_number)} is past its deadline`,
      detail: customerName(rfq),
      href: `/rfqs/${rfq.id}`,
      action: "Open",
    })),
    ...(Number(missingDeadlineRfqs.count ?? 0) > 0
      ? [
          {
            key: "missing-deadlines",
            label: `${missingDeadlineRfqs.count ?? 0} active RFQs are missing deadlines`,
            detail: "Set due dates for better follow-up",
            href: "/rfqs",
            action: "View",
          },
        ]
      : []),
    ...approvals.map((approval) => {
      const quote = firstRelated(approval.customer_quotes);
      const rfq = firstRelated(quote?.rfqs);
      return {
        key: `approval-${approval.id}`,
        label: `${rfq ? shortRfqNumber(rfq.rfq_number) : "A quote"} is awaiting approval`,
        detail: quote?.quote_number ?? "Pending approval request",
        href: quote && rfq ? `/rfqs/${rfq.id}/customer-quotes/${quote.id}` : "/approvals?status=pending",
        action: "Review",
      };
    }),
  ].slice(0, 5);

  const tasks = [
    { label: "Approvals", value: pendingApprovalQuotes.count ?? 0, href: "/approvals?status=pending", icon: ShieldCheck, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Supplier responses", value: supplierPricingRfqs.count ?? 0, href: "/review-queue?status=awaiting_pricing", icon: MailCheck, tone: "text-blue-700 bg-blue-50" },
    { label: "Overdue RFQs", value: overdueRfqsResponse.count ?? overdueRfqs.length, href: "/rfqs", icon: AlertTriangle, tone: Number(overdueRfqsResponse.count ?? overdueRfqs.length) > 0 ? "text-rose-700 bg-rose-50" : "text-slate-500 bg-slate-100" },
    { label: "Quotes expiring", value: expiringQuotesResponse.count ?? 0, href: "/quotes", icon: Clock3, tone: "text-violet-700 bg-violet-50" },
  ];

  return (
    <div style={pageThemeStyle("dashboard")} className="page-accent-scope mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {organization.name} procurement workspace
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/settings/email/monitoring"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                mailboxHealth === "Healthy"
                  ? "bg-emerald-500"
                  : mailboxHealth === "Failed"
                    ? "bg-rose-500"
                    : "bg-amber-500"
              }`}
            />
            Email intake {mailboxHealth.toLowerCase()}
          </Link>
          <Link
            href="/rfqs/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--primary)] px-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New RFQ
          </Link>
        </div>
      </div>

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Unable to load dashboard data. Try refreshing the page.
        </div>
      ) : null}

      <KpiStrip items={kpis} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="overflow-hidden shadow-none">
          <PanelHeader title="Needs Attention" />
          {attentionItems.length > 0 ? (
            <div className="divide-y divide-slate-100 p-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-amber-100 bg-amber-50/60 px-3 py-3 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                    {item.action}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-950">You&apos;re all caught up.</p>
              <p className="mt-1 text-sm text-slate-500">No RFQs or approvals need immediate action.</p>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden shadow-none">
          <PanelHeader title="My Tasks" />
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const Icon = task.icon;

              return (
              <Link
                key={task.label}
                href={task.href}
                className="flex items-center justify-between px-4 py-3 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-md ${task.tone}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {task.label}
                </span>
                <span className="text-sm font-semibold text-slate-950">{task.value}</span>
              </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-none">
        <PanelHeader
          title="Recent RFQs"
          action={
            <Link href="/rfqs" className="text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]">
              View all
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2.5">RFQ</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5 text-right">Value</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentRfqs.length > 0 ? (
                recentRfqs.map((rfq) => (
                  <tr key={rfq.id} className="h-12 transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/rfqs/${rfq.id}`}
                        title={rfq.rfq_number}
                        className="font-semibold text-slate-950 hover:text-[var(--primary)]"
                      >
                        {shortRfqNumber(rfq.rfq_number)}
                      </Link>
                      <p className="max-w-[260px] truncate text-xs text-slate-500">{rfq.subject}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{customerName(rfq)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={rfq.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(rfq.submission_deadline)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                      {formatCurrency(rfq.estimated_value, organization.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/rfqs/${rfq.id}`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No RFQs yet"
                      description="Create your first RFQ to start tracking customer requests and supplier pricing."
                      action={
                        <Link
                          href="/rfqs/new"
                          className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
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

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Technical scan history remains available in Email Scan Monitoring.
      </div>
    </div>
  );
}
