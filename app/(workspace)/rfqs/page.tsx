import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteRfqButton } from "@/components/rfqs/delete-rfq-button";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/session";
import {
  getRfqStatusFilter,
  labelizeRfqStatus,
  RFQ_STATUS_FILTERS,
  RFQ_STATUS_FILTER_VALUES,
} from "@/lib/rfqs/status";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

const sortOptions = [
  { label: "Newest first", value: "created_desc" },
  { label: "Oldest first", value: "created_asc" },
  { label: "Deadline soonest", value: "deadline_asc" },
  { label: "Priority", value: "priority_asc" },
  { label: "RFQ number", value: "rfq_number_asc" },
] as const;

const sortValues = new Set(sortOptions.map((option) => option.value));

type SortValue = (typeof sortOptions)[number]["value"];

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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSortValue(value: string | undefined): value is SortValue {
  return Boolean(value && sortValues.has(value as SortValue));
}

function queryString(
  params: Record<string, string | string[] | undefined>,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === "page") return;
    const firstValue = firstParam(value);
    if (firstValue) next.set(key, firstValue);
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!value || (key === "status" && value === "all")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  });

  next.set("page", "1");

  const serialized = next.toString();
  return serialized ? `/rfqs?${serialized}` : "/rfqs";
}

function applySort<T extends { order: (...args: [string, { ascending: boolean; nullsFirst?: boolean }]) => T }>(
  query: T,
  sort: SortValue,
) {
  if (sort === "created_asc") {
    return query.order("created_at", { ascending: true });
  }

  if (sort === "deadline_asc") {
    return query.order("submission_deadline", {
      ascending: true,
      nullsFirst: false,
    });
  }

  if (sort === "priority_asc") {
    return query.order("priority", { ascending: true });
  }

  if (sort === "rfq_number_asc") {
    return query.order("rfq_number", { ascending: true });
  }

  return query.order("created_at", { ascending: false });
}

export default async function RfqsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedStatus = firstParam(params.status);
  const activeFilter = getRfqStatusFilter(
    RFQ_STATUS_FILTER_VALUES.has(String(requestedStatus ?? ""))
      ? requestedStatus
      : "all",
  );
  const requestedSort = firstParam(params.sort);
  const activeSort: SortValue = isSortValue(requestedSort)
    ? requestedSort
    : "created_desc";
  const organization = await requireOrganization();
  const supabase = await createClient();

  let rfqQuery = supabase
    .from("rfqs")
    .select(
      "id, rfq_number, subject, status, priority, submission_deadline, estimated_value, created_at, customers(company_name)",
    )
    .eq("organization_id", organization.id);

  if (activeFilter.dbValues.length === 1) {
    rfqQuery = rfqQuery.eq("status", activeFilter.dbValues[0]);
  } else if (activeFilter.dbValues.length > 1) {
    rfqQuery = rfqQuery.in("status", [...activeFilter.dbValues]);
  }

  const [rfqResponse, statusResponse] = await Promise.all([
    applySort(rfqQuery, activeSort),
    supabase
      .from("rfqs")
      .select("status")
      .eq("organization_id", organization.id),
  ]);

  const rfqs = (rfqResponse.data ?? []) as RfqRow[];
  const statusRows = (statusResponse.data ?? []) as Pick<RfqRow, "status">[];
  const knownStatuses = new Set<string>(
    RFQ_STATUS_FILTERS.flatMap((filter) => filter.dbValues),
  );
  const unknownStatuses = Array.from(
    new Set(
      statusRows
        .map((row) => row.status)
        .filter((status) => status && !knownStatuses.has(status)),
    ),
  );

  if (unknownStatuses.length > 0) {
    console.info("[rfq-status-filters] unmapped statuses", {
      organizationId: organization.id,
      statuses: unknownStatuses,
    });
  }

  const counts = new Map<string, number>();
  RFQ_STATUS_FILTERS.forEach((filter) => {
    const dbValues: string[] = [...filter.dbValues];
    const count =
      filter.value === "all"
        ? statusRows.length
        : statusRows.filter((row) => dbValues.includes(row.status)).length;
    counts.set(filter.value, count);
  });
  const canDeleteRfq = ["owner", "admin", "manager"].includes(organization.role);
  const selectedSortLabel =
    sortOptions.find((option) => option.value === activeSort)?.label ?? "Newest first";

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

      {rfqResponse.error || statusResponse.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {rfqResponse.error?.message ??
            statusResponse.error?.message ??
            "Unable to load RFQs."}
        </div>
      ) : null}

      <Card className="p-2">
        <nav aria-label="RFQ status filters" className="flex gap-2 overflow-x-auto">
          {RFQ_STATUS_FILTERS.map((filter) => {
            const active = filter.value === activeFilter.value;

            return (
              <Link
                key={filter.value}
                href={queryString(params, { status: filter.value })}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-100 ${
                  active
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {filter.label}{" "}
                <span className={active ? "text-teal-50" : "text-slate-400"}>
                  {counts.get(filter.value) ?? 0}
                </span>
              </Link>
            );
          })}
        </nav>
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-600">
            Showing {activeFilter.label.toLowerCase()} RFQs, sorted by{" "}
            <span className="font-semibold text-slate-950">{selectedSortLabel}</span>.
          </p>
          <form action="/rfqs" className="flex flex-wrap items-end gap-2">
            {activeFilter.value !== "all" ? (
              <input type="hidden" name="status" value={activeFilter.value} />
            ) : null}
            {Object.entries(params).map(([key, value]) => {
              if (["status", "sort", "page"].includes(key)) return null;
              const firstValue = firstParam(value);
              return firstValue ? (
                <input key={key} type="hidden" name={key} value={firstValue} />
              ) : null;
            })}
            <label className="text-sm font-semibold text-slate-700">
              Sort
              <select
                name="sort"
                defaultValue={activeSort}
                className="mt-2 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Apply
            </button>
          </form>
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
                      {labelizeRfqStatus(rfq.status)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {labelizeRfqStatus(rfq.priority)}
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
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/rfqs/${rfq.id}`}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                        >
                          View
                        </Link>
                        {canDeleteRfq ? (
                          <DeleteRfqButton rfqId={rfq.id} compact />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title={
                        activeFilter.value === "all"
                          ? "No RFQs found"
                          : `No RFQs found in ${activeFilter.label}.`
                      }
                      description={
                        activeFilter.value === "all"
                          ? "RFQs created by your team will appear here."
                          : "Try another status filter or return to the full RFQ list."
                      }
                      action={
                        <div className="flex flex-wrap justify-center gap-2">
                          {activeFilter.value !== "all" ? (
                            <>
                              <Link
                                href={queryString(params, { status: "all" })}
                                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                              >
                                Clear filter
                              </Link>
                              <Link
                                href="/rfqs"
                                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                              >
                                View all RFQs
                              </Link>
                            </>
                          ) : null}
                          <Link
                            href="/rfqs/new"
                            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          >
                            Create RFQ
                          </Link>
                        </div>
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
