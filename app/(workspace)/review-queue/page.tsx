import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ReviewQueueTable,
  type ReviewQueueTableRow,
} from "@/components/review-queue/review-queue-table";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import {
  deriveReviewState,
  labelizeReviewValue,
  normalizeReviewPriority,
  normalizeReviewStatus,
} from "@/lib/rfqs/review-status";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RfqRow = {
  id: string;
  rfq_number: string;
  subject: string;
  status: string;
  priority: string | null;
  review_status: string | null;
  next_action: string | null;
  review_due_at: string | null;
  assigned_to: string | null;
  submission_deadline: string | null;
  created_at: string;
  last_activity_at: string | null;
  customers:
    | { id: string; company_name: string; email: string | null }
    | { id: string; company_name: string; email: string | null }[]
    | null;
};

type MemberRow = {
  user_id: string;
  role: string;
};

type QuoteRow = {
  rfq_id: string;
  status: string;
  approval_status: string;
  created_at: string;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function shortUser(value: string | null) {
  if (!value) return "Unassigned";
  return value.slice(0, 8);
}

const manageRoles = new Set(["owner", "admin", "manager", "procurement"]);
const queueStatuses = [
  "new",
  "needs_review",
  "missing_items",
  "awaiting_pricing",
  "awaiting_approval",
  "ready_to_send",
  "overdue",
];

export default async function ReviewQueuePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const params = (await searchParams) ?? {};
  const scope = param(params, "scope") || "all";
  const statusFilter = param(params, "status");
  const priorityFilter = param(params, "priority");
  const customerFilter = param(params, "customer");
  const assignedFilter = param(params, "assigned");
  const dueFilter = param(params, "due");
  const search = param(params, "search").trim();
  const canManage = manageRoles.has(organization.role);

  const [membersResponse, customersResponse, itemSearchResponse] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organization.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organization.id)
      .order("company_name", { ascending: true }),
    search
      ? supabase
          .from("rfq_items")
          .select("rfq_id")
          .eq("organization_id", organization.id)
          .ilike("description", `%${search}%`)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const itemRfqIds = new Set((itemSearchResponse.data ?? []).map((item) => item.rfq_id as string));
  let rfqQuery = supabase
    .from("rfqs")
    .select(
      "id, rfq_number, subject, status, priority, review_status, next_action, review_due_at, assigned_to, submission_deadline, created_at, last_activity_at, customers(id, company_name, email)",
    )
    .eq("organization_id", organization.id)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (scope === "mine") rfqQuery = rfqQuery.eq("assigned_to", user.id);
  if (scope === "unassigned") rfqQuery = rfqQuery.is("assigned_to", null);
  if (statusFilter) rfqQuery = rfqQuery.eq("review_status", statusFilter);
  if (priorityFilter) rfqQuery = rfqQuery.eq("priority", priorityFilter);
  if (customerFilter) rfqQuery = rfqQuery.eq("customer_id", customerFilter);
  if (assignedFilter) rfqQuery = rfqQuery.eq("assigned_to", assignedFilter);
  if (dueFilter === "overdue") rfqQuery = rfqQuery.lt("review_due_at", new Date().toISOString());
  if (dueFilter === "none") rfqQuery = rfqQuery.is("review_due_at", null);

  const rfqsResponse = await rfqQuery;
  const rawRfqs = (rfqsResponse.data ?? []) as RfqRow[];
  const rfqIds = rawRfqs.map((rfq) => rfq.id);
  const [itemsResponse, quotesResponse] = rfqIds.length
    ? await Promise.all([
        supabase
          .from("rfq_items")
          .select("rfq_id")
          .eq("organization_id", organization.id)
          .in("rfq_id", rfqIds),
        supabase
          .from("customer_quotes")
          .select("rfq_id, status, approval_status, created_at")
          .eq("organization_id", organization.id)
          .in("rfq_id", rfqIds)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const itemCounts = new Map<string, number>();
  for (const item of itemsResponse.data ?? []) {
    const rfqId = item.rfq_id as string;
    itemCounts.set(rfqId, (itemCounts.get(rfqId) ?? 0) + 1);
  }

  const quotesByRfq = new Map<string, QuoteRow[]>();
  for (const quote of (quotesResponse.data ?? []) as QuoteRow[]) {
    quotesByRfq.set(quote.rfq_id, [...(quotesByRfq.get(quote.rfq_id) ?? []), quote]);
  }

  const rows = rawRfqs
    .map((rfq) => {
      const quotes = quotesByRfq.get(rfq.id) ?? [];
      const latestQuote = quotes[0];
      const derived = deriveReviewState({
        currentReviewStatus: rfq.review_status,
        rfqStatus: rfq.status,
        reviewDueAt: rfq.review_due_at,
        submissionDeadline: rfq.submission_deadline,
        itemCount: itemCounts.get(rfq.id) ?? 0,
        customerQuoteCount: quotes.length,
        latestCustomerQuoteStatus: latestQuote?.status,
        latestCustomerQuoteApprovalStatus: latestQuote?.approval_status,
      });
      return {
        ...rfq,
        effectiveReviewStatus: normalizeReviewStatus(rfq.review_status) === "new" ? derived.reviewStatus : normalizeReviewStatus(rfq.review_status),
        effectiveNextAction: rfq.next_action || derived.nextAction,
        effectivePriority: normalizeReviewPriority(rfq.priority),
      };
    })
    .filter((rfq) => {
      if (!search) return true;
      const customer = firstRelated(rfq.customers);
      const haystack = [
        rfq.rfq_number,
        rfq.subject,
        customer?.company_name,
        customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase()) || itemRfqIds.has(rfq.id);
    });

  const summary = queueStatuses.map((status) => ({
    status,
    count: rows.filter((rfq) => rfq.effectiveReviewStatus === status).length,
  }));
  const members = (membersResponse.data ?? []) as MemberRow[];
  const dataError =
    membersResponse.error ??
    customersResponse.error ??
    itemSearchResponse.error ??
    rfqsResponse.error ??
    itemsResponse.error ??
    quotesResponse.error;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">RFQ operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Review Queue
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Prioritize RFQs by assignment, review status, due date, customer, and requested-item search.
        </p>
      </div>

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {dataError.message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {summary.map((item) => (
          <Card key={item.status} className="p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">{labelizeReviewValue(item.status)}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{item.count}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <select name="scope" defaultValue={scope} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="all">All RFQs</option>
            <option value="mine">My RFQs</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select name="status" defaultValue={statusFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Any status</option>
            {queueStatuses.map((status) => (
              <option key={status} value={status}>{labelizeReviewValue(status)}</option>
            ))}
          </select>
          <select name="priority" defaultValue={priorityFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Any priority</option>
            {["low", "normal", "high", "urgent"].map((priority) => (
              <option key={priority} value={priority}>{labelizeReviewValue(priority)}</option>
            ))}
          </select>
          <select name="customer" defaultValue={customerFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Any customer</option>
            {(customersResponse.data ?? []).map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.company_name}</option>
            ))}
          </select>
          <select name="assigned" defaultValue={assignedFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Any assignee</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>{shortUser(member.user_id)} ({member.role})</option>
            ))}
          </select>
          <select name="due" defaultValue={dueFilter} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="none">No due date</option>
          </select>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search RFQ, customer, item..."
            className="h-10 rounded-md border border-slate-200 px-3 text-sm xl:col-span-2"
          />
          <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white xl:col-start-8">
            Filter
          </button>
        </form>
      </Card>

      {rows.length ? (
        <ReviewQueueTable
          key={JSON.stringify({ scope, statusFilter, priorityFilter, customerFilter, assignedFilter, dueFilter, search })}
          rows={rows as ReviewQueueTableRow[]}
          members={members}
          canManage={canManage}
        />
      ) : (
        <Card>
          <EmptyState title="No RFQs match this queue" description="Adjust filters or create an RFQ from Email Intake." />
        </Card>
      )}
    </div>
  );
}
