import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { rfqStatusTabs } from "@/lib/data/workspace-config";
import { requireOrganization } from "@/lib/auth/session";

type RfqRow = {
  id: string;
  rfq_number: string;
  subject: string;
  status: string;
  priority: string;
  submission_deadline: string | null;
  estimated_value: number | null;
  created_at: string;
  customers:
    | {
        company_name: string;
      }
    | {
        company_name: string;
      }[]
    | null;
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

function formatCurrency(value: number | null, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function customerName(row: RfqRow) {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  return customer?.company_name ?? "No customer";
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function RfqsPage() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rfqs")
    .select(
      "id, rfq_number, subject, status, priority, submission_deadline, estimated_value, created_at, customers(company_name)",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  const rfqs = (data ?? []) as RfqRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">
            Request management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            RFQs
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Manage requests from intake through supplier pricing, approval, and
            customer response.
          </p>
        </div>
        <Link
          href="/rfqs/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Create RFQ
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error.message}
        </div>
      ) : null}

      <Card className="p-2">
        <div className="flex gap-2 overflow-x-auto">
          {rfqStatusTabs.map((tab) => (
            <button
              key={tab}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                tab === "All"
                  ? "bg-teal-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">RFQ number</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Submission deadline</th>
                <th className="px-5 py-3 text-right">Estimated value</th>
                <th className="px-5 py-3">Created date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rfqs.length > 0 ? (
                rfqs.map((rfq) => (
                  <tr
                    key={rfq.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                      <Link href={`/rfqs/${rfq.id}`} className="hover:text-teal-700">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {customerName(rfq)}
                    </td>
                    <td className="min-w-64 px-5 py-4 text-slate-700">
                      {rfq.subject}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {labelize(rfq.status)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {labelize(rfq.priority)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(rfq.submission_deadline)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(rfq.estimated_value, organization.currency)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(rfq.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        href={`/rfqs/${rfq.id}`}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No RFQs found"
                      description="RFQs created by your team will appear here."
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
    </div>
  );
}
