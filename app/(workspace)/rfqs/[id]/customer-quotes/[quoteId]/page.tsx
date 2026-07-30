import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CustomerQuoteApprovalActions,
  CustomerQuoteStatusActions,
  PrintButton,
} from "@/components/rfqs/quote-actions";
import {
  canApproveQuote,
  requireOrganization,
  requireUser,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
    quoteId: string;
  }>;
};

type Customer = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
} | null;

type Rfq = {
  id: string;
  rfq_number: string;
  subject: string;
  customers: Customer | Customer[] | null;
};

type CustomerQuote = {
  id: string;
  quote_number: string;
  revision: number;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  delivery_fee: number | null;
  total: number | null;
  status: string;
  approval_status: string;
  valid_until: string | null;
  created_at: string;
  notes?: string | null;
};

type CustomerQuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  discount: number | null;
  tax: number | null;
  total_price: number | null;
  notes: string | null;
};

type ApprovalRequest = {
  id: string;
  approval_rule_id: string | null;
  requested_by: string | null;
  approver_user_id: string | null;
  status: string;
  comments: string | null;
  requested_at: string;
  resolved_at: string | null;
  approval_rules:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
      {children}
    </span>
  );
}

function formatUser(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return value.slice(0, 8);
}

export default async function CustomerQuoteDetailPage({ params }: PageProps) {
  const { id, quoteId } = await params;
  await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const rfqResponse = await supabase
    .from("rfqs")
    .select("id, rfq_number, subject, customers(company_name, contact_name, email, phone)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqResponse.error) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Unable to load RFQ"
          description={rfqResponse.error.message}
          action={
            <Link
              href="/rfqs"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to RFQs
            </Link>
          }
        />
      </Card>
    );
  }

  if (!rfqResponse.data) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Quote not found"
          description="This quote does not exist or you do not have access to it."
          action={
            <Link
              href="/rfqs"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to RFQs
            </Link>
          }
        />
      </Card>
    );
  }

  const [quoteResponse, itemsResponse, approvalRequestsResponse] =
    await Promise.all([
    supabase
      .from("customer_quotes")
      .select(
        "id, quote_number, revision, subtotal, tax, discount, delivery_fee, total, status, approval_status, valid_until, created_at, notes",
      )
      .eq("id", quoteId)
      .eq("rfq_id", id)
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("customer_quote_items")
      .select("id, description, quantity, unit_price, discount, tax, total_price, notes")
      .eq("organization_id", organization.id)
      .eq("customer_quote_id", quoteId)
      .order("created_at", { ascending: true }),
    supabase
      .from("approval_requests")
      .select(
        "id, approval_rule_id, requested_by, approver_user_id, status, comments, requested_at, resolved_at, approval_rules(name)",
      )
      .eq("organization_id", organization.id)
      .eq("customer_quote_id", quoteId)
      .order("requested_at", { ascending: false }),
  ]);

  if (quoteResponse.error) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Unable to load customer quote"
          description={quoteResponse.error.message}
          action={
            <Link
              href={`/rfqs/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to RFQ
            </Link>
          }
        />
      </Card>
    );
  }

  if (!quoteResponse.data) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Customer quote not found"
          description="This customer quote does not exist or you do not have access to it."
          action={
            <Link
              href={`/rfqs/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to RFQ
            </Link>
          }
        />
      </Card>
    );
  }

  const rfq = rfqResponse.data as Rfq;
  const customer = firstRelated(rfq.customers);
  const quote = quoteResponse.data as CustomerQuote;
  const quoteItems = (itemsResponse.data ?? []) as CustomerQuoteItem[];
  const approvalRequests =
    (approvalRequestsResponse.data ?? []) as ApprovalRequest[];
  const currency = organization.currency || "TTD";
  const canApprove = canApproveQuote(organization.role);
  const showApprovalActions =
    quote.approval_status === "pending" && canApprove;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/rfqs/${rfq.id}`}
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Back to RFQ
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {quote.quote_number}
            </h1>
            <Badge>{labelize(quote.status)}</Badge>
            <Badge>{labelize(quote.approval_status)}</Badge>
          </div>
          <p className="mt-3 max-w-3xl text-lg font-medium text-slate-700">
            {rfq.subject}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <PrintButton />
            <Link
              href={`/rfqs/${rfq.id}`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Back to RFQ
            </Link>
          </div>
          <CustomerQuoteStatusActions
            rfqId={rfq.id}
            quoteId={quote.id}
            approvalStatus={quote.approval_status}
          />
        </div>
      </div>

      {itemsResponse.error || approvalRequestsResponse.error ? (
        <div className="no-print rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {itemsResponse.error?.message ?? approvalRequestsResponse.error?.message}
        </div>
      ) : null}

      <Card className="no-print p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">
              Approval workflow
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Approval
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Current approval status:{" "}
              <span className="font-semibold text-slate-950">
                {labelize(quote.approval_status)}
              </span>
            </p>
          </div>
          {showApprovalActions ? (
            <CustomerQuoteApprovalActions
              rfqId={rfq.id}
              quoteId={quote.id}
            />
          ) : null}
        </div>

        {approvalRequests.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Approval request status</th>
                  <th className="px-5 py-3">Approval rule name</th>
                  <th className="px-5 py-3">Requested by</th>
                  <th className="px-5 py-3">Requested date</th>
                  <th className="px-5 py-3">Resolved date</th>
                  <th className="px-5 py-3">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {approvalRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950">
                      {labelize(request.status)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {firstRelated(request.approval_rules)?.name ??
                        "Rule removed"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatUser(request.requested_by)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(request.requested_at)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(request.resolved_at)}
                    </td>
                    <td className="min-w-64 px-5 py-4 text-slate-600">
                      {request.comments ?? "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No approval requests exist for this quote.
          </p>
        )}
      </Card>

      <Card className="print-document overflow-hidden bg-white">
        <div className="border-b border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              {organization.logo_url ? (
                <div
                  aria-label="Organization logo"
                  className="h-16 w-16 rounded-md border border-slate-200 bg-cover bg-center"
                  style={{ backgroundImage: `url(${organization.logo_url})` }}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                  Logo
                </div>
              )}
              <div>
                <p className="text-xl font-semibold text-slate-950">
                  {organization.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {[organization.country, currency].filter(Boolean).join(" / ")}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase text-teal-700">
                Quote
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {quote.quote_number}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                RFQ {rfq.rfq_number}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-b border-slate-200 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h3 className="text-sm font-semibold uppercase text-slate-500">
              Customer
            </h3>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">
                {customer?.company_name ?? "No customer linked"}
              </p>
              <p>{customer?.contact_name ?? "Contact not set"}</p>
              <p>{customer?.email ?? "Email not set"}</p>
              <p>{customer?.phone ?? "Phone not set"}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-500">Revision</p>
              <p className="mt-1 font-semibold text-slate-950">
                {quote.revision}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Status</p>
              <p className="mt-1 font-semibold text-slate-950">
                {labelize(quote.status)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Approval</p>
              <p className="mt-1 font-semibold text-slate-950">
                {labelize(quote.approval_status)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Created</p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatDate(quote.created_at)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Valid until</p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatDate(quote.valid_until)}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Currency</p>
              <p className="mt-1 font-semibold text-slate-950">{currency}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Unit price</th>
                <th className="px-6 py-3 text-right">Discount</th>
                <th className="px-6 py-3 text-right">Tax</th>
                <th className="px-6 py-3 text-right">Total price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {quoteItems.length > 0 ? (
                quoteItems.map((item) => (
                  <tr key={item.id}>
                    <td className="min-w-72 px-6 py-4 font-medium text-slate-950">
                      {item.description}
                      {item.notes ? (
                        <p className="mt-1 text-xs font-normal text-slate-500">
                          {item.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(item.unit_price, currency)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(item.discount, currency)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(item.tax, currency)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(item.total_price, currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No quote items found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 border-t border-slate-200 p-6 sm:grid-cols-[1fr_22rem] sm:p-8">
          <div className="space-y-5 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold text-slate-950">Notes</h3>
              <p className="mt-2 leading-6">
                {quote.notes ?? "No notes added."}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-950">
                Terms and conditions
              </h3>
              <p className="mt-2 leading-6">
                No terms and conditions added.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-950">Prepared by</h3>
              <p className="mt-2 leading-6">Authorized representative</p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(quote.subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Discount</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(quote.discount, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Delivery fee</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(quote.delivery_fee, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Tax</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(quote.tax, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-lg">
                <span className="font-semibold text-slate-950">Grand total</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(quote.total, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
