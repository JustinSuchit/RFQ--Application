import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrganization } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
import { formatTaxRate } from "@/lib/quotes/calculations";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

type ApprovalRequest = {
  id: string;
  customer_quote_id: string | null;
  approval_rule_id: string | null;
  requested_by: string | null;
  status: string;
  requested_at: string;
};

type CustomerQuoteRow = {
  id: string;
  quote_number: string;
  subtotal: number | null;
  discount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  tax: number | null;
  delivery_fee: number | null;
  total: number | null;
  rfq_id: string;
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
};

type ApprovalRuleRow = {
  id: string;
  name: string;
};

const filters = ["pending", "approved", "rejected", "all"];

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

function formatCurrency(value: number | null, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatUser(value: string | null) {
  return value ? value.slice(0, 8) : "Not set";
}

function quoteTaxAmount(quote: CustomerQuoteRow | undefined | null) {
  return Number(quote?.tax_amount ?? quote?.tax ?? 0);
}

function quoteTaxRateLabel(quote: CustomerQuoteRow | undefined | null) {
  const taxRate = Number(quote?.tax_rate ?? 0);
  if (taxRate === 0 && quoteTaxAmount(quote) > 0) return "Not set";
  return formatTaxRate(taxRate);
}

export default async function ApprovalsPage({ searchParams }: PageProps) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const activeFilter = filters.includes(resolvedSearchParams?.status ?? "")
    ? String(resolvedSearchParams?.status)
    : "pending";

  let approvalRequestQuery = supabase
    .from("approval_requests")
    .select(
      "id, customer_quote_id, approval_rule_id, requested_by, status, requested_at",
    )
    .eq("organization_id", organization.id)
    .order("requested_at", { ascending: false });

  if (activeFilter !== "all") {
    approvalRequestQuery = approvalRequestQuery.eq("status", activeFilter);
  }

  const approvalRequestsResponse = await approvalRequestQuery;
  const approvalRequests =
    (approvalRequestsResponse.data ?? []) as ApprovalRequest[];
  const quoteIds = Array.from(
    new Set(
      approvalRequests
        .map((request) => request.customer_quote_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const ruleIds = Array.from(
    new Set(
      approvalRequests
        .map((request) => request.approval_rule_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [quotesResponse, rulesResponse] = await Promise.all([
    quoteIds.length > 0
      ? supabase
          .from("customer_quotes")
          .select(
            "id, quote_number, subtotal, discount, tax_rate, tax_amount, tax, delivery_fee, total, rfq_id, rfqs(id, rfq_number, customers(company_name))",
          )
          .eq("organization_id", organization.id)
          .in("id", quoteIds)
      : Promise.resolve({ data: [], error: null }),
    ruleIds.length > 0
      ? supabase
          .from("approval_rules")
          .select("id, name")
          .eq("organization_id", organization.id)
          .in("id", ruleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const quotesById = new Map(
    ((quotesResponse.data ?? []) as CustomerQuoteRow[]).map((quote) => [
      quote.id,
      quote,
    ]),
  );
  const rulesById = new Map(
    ((rulesResponse.data ?? []) as ApprovalRuleRow[]).map((rule) => [
      rule.id,
      rule,
    ]),
  );
  const dataError =
    approvalRequestsResponse.error ?? quotesResponse.error ?? rulesResponse.error;

  return (
    <div style={pageThemeStyle("approvals")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="approvals"
        icon={ShieldCheck}
        eyebrow="Quote governance"
        title="Approvals"
        description="Review customer quotes that require approval before they can be sent."
      />

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {dataError.message}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              Approval requests
            </h2>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Link
                  key={filter}
                  href={`/approvals?status=${filter}`}
                  className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold transition ${
                    activeFilter === filter
                      ? "border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-[var(--page-accent-hover)] hover:text-slate-950"
                  }`}
                >
                  {labelize(filter)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {approvalRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Quote number</th>
                  <th className="px-5 py-3">RFQ number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                  <th className="px-5 py-3 text-right">Discount</th>
                  <th className="px-5 py-3 text-right">Tax</th>
                  <th className="px-5 py-3 text-right">Delivery</th>
                  <th className="px-5 py-3 text-right">Quote total</th>
                  <th className="px-5 py-3">Approval rule</th>
                  <th className="px-5 py-3">Requested by</th>
                  <th className="px-5 py-3">Requested date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {approvalRequests.map((request) => {
                  const quote = request.customer_quote_id
                    ? quotesById.get(request.customer_quote_id)
                    : null;
                  const rfq = firstRelated(quote?.rfqs ?? null);
                  const customer = firstRelated(rfq?.customers ?? null);

                  return (
                    <tr key={request.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                        {quote?.quote_number ?? "Quote removed"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {rfq?.rfq_number ?? "RFQ removed"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {customer?.company_name ?? "No customer"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote?.subtotal ?? null, organization.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote?.discount ?? null, organization.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quoteTaxAmount(quote), organization.currency)}
                        <span className="mt-1 block text-xs font-medium text-slate-500">
                          {quoteTaxRateLabel(quote)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote?.delivery_fee ?? null, organization.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote?.total ?? null, organization.currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {request.approval_rule_id
                          ? rulesById.get(request.approval_rule_id)?.name ??
                            "Rule removed"
                          : "Rule removed"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatUser(request.requested_by)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(request.requested_at)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={
                            request.status === "pending"
                              ? "rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
                              : request.status === "approved"
                                ? "rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200"
                                : "rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
                          }
                        >
                          {labelize(request.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {quote && rfq ? (
                          <Link
                            href={`/rfqs/${rfq.id}/customer-quotes/${quote.id}`}
                            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                          >
                            View Quote
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No approval requests found"
            description="Pending quote approvals will appear here when approval rules are triggered."
          />
        )}
      </Card>
    </div>
  );
}
