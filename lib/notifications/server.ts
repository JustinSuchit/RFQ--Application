import type { SupabaseClient } from "@supabase/supabase-js";
import { canApproveQuote, type CurrentOrganization } from "@/lib/auth/session";
import type { NotificationDraft, NotificationRow } from "@/lib/notifications/types";

type SupabaseClientLike = SupabaseClient;

type EnsureArgs = {
  supabase: SupabaseClientLike;
  organization: CurrentOrganization;
  userId: string;
};

type ListArgs = EnsureArgs & {
  limit?: number;
  unreadOnly?: boolean;
};

type PendingExtractedItem = {
  id: string;
  email_message_id: string | null;
  created_at: string | null;
  email_messages:
    | {
        id: string;
        rfq_id: string | null;
        subject: string | null;
        rfqs:
          | {
              id: string;
              rfq_number: string | null;
            }
          | {
              id: string;
              rfq_number: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        rfq_id: string | null;
        subject: string | null;
        rfqs:
          | {
              id: string;
              rfq_number: string | null;
            }
          | {
              id: string;
              rfq_number: string | null;
            }[]
          | null;
      }[]
    | null;
};

const inactiveRfqStatuses = new Set([
  "approved",
  "accepted",
  "declined",
  "rejected",
  "closed",
  "cancelled",
]);

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function shortRfqNumber(value: string | null | undefined) {
  if (!value) return "RFQ";
  const match = value.match(/(\d{4,})$/);
  return match ? `#${match[1]}` : value;
}

function customerName(value: unknown) {
  const customer = firstRelated(value as { company_name?: string } | { company_name?: string }[] | null);
  return customer?.company_name ?? null;
}

function daysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function eventTime(value: string | null | undefined) {
  return value ?? new Date().toISOString();
}

async function upsertNotifications(
  supabase: SupabaseClientLike,
  organizationId: string,
  userId: string,
  drafts: NotificationDraft[],
) {
  if (drafts.length === 0) return;

  const rows = drafts.map((draft) => ({
    organization_id: organizationId,
    user_id: userId,
    type: draft.type,
    title: draft.title,
    message: draft.message ?? null,
    entity_type: draft.entityType ?? null,
    entity_id: draft.entityId ?? null,
    href: draft.href,
    priority: draft.priority,
    dedupe_key: draft.dedupeKey,
    created_at: draft.createdAt ?? new Date().toISOString(),
  }));

  await supabase
    .from("notifications")
    .upsert(rows, {
      onConflict: "organization_id,user_id,dedupe_key",
      ignoreDuplicates: true,
    });
}

export async function ensureWorkflowNotifications({
  supabase,
  organization,
  userId,
}: EnsureArgs) {
  const drafts: NotificationDraft[] = [];
  const today = daysFromToday(0);
  const tomorrow = daysFromToday(1);
  const recentWindow = daysAgo(30);

  if (canApproveQuote(organization.role)) {
    const { data } = await supabase
      .from("approval_requests")
      .select(
        "id, customer_quote_id, approver_user_id, requested_at, customer_quotes(id, quote_number, rfq_id, rfqs(id, rfq_number, customers(company_name)))",
      )
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(50);

    for (const request of data ?? []) {
      if (request.approver_user_id && request.approver_user_id !== userId) continue;
      const quote = firstRelated(request.customer_quotes);
      const rfq = firstRelated(quote?.rfqs);
      const number = shortRfqNumber(rfq?.rfq_number);
      const customer = customerName(rfq?.customers);

      drafts.push({
        type: "approval",
        title: "RFQ requires approval",
        message: [number, customer].filter(Boolean).join(" · "),
        entityType: "approval_request",
        entityId: request.id,
        href: quote && rfq ? `/rfqs/${rfq.id}/customer-quotes/${quote.id}` : "/approvals?status=pending",
        priority: "warning",
        dedupeKey: `approval:pending:${request.id}`,
        createdAt: eventTime(request.requested_at),
      });
    }
  }

  const { data: approvalDecisions } = await supabase
    .from("approval_requests")
    .select(
      "id, status, requested_by, resolved_at, customer_quote_id, customer_quotes(id, quote_number, rfq_id, rfqs(id, rfq_number, customers(company_name)))",
    )
    .eq("organization_id", organization.id)
    .in("status", ["approved", "rejected"])
    .gte("resolved_at", recentWindow)
    .order("resolved_at", { ascending: false })
    .limit(50);

  for (const request of approvalDecisions ?? []) {
    if (request.requested_by && request.requested_by !== userId && !canApproveQuote(organization.role)) continue;
    const quote = firstRelated(request.customer_quotes);
    const rfq = firstRelated(quote?.rfqs);
    const approved = request.status === "approved";
    const number = shortRfqNumber(rfq?.rfq_number);

    drafts.push({
      type: "approval",
      title: approved ? "RFQ approved" : "RFQ approval rejected",
      message: [number, quote?.quote_number].filter(Boolean).join(" · "),
      entityType: "approval_request",
      entityId: request.id,
      href: quote && rfq ? `/rfqs/${rfq.id}/customer-quotes/${quote.id}` : "/approvals",
      priority: approved ? "success" : "critical",
      dedupeKey: `approval:${request.status}:${request.id}`,
      createdAt: eventTime(request.resolved_at),
    });
  }

  const { data: supplierQuotes } = await supabase
    .from("supplier_quotes")
    .select("id, rfq_id, created_at, suppliers(supplier_name), rfqs(id, rfq_number, customers(company_name))")
    .eq("organization_id", organization.id)
    .gte("created_at", recentWindow)
    .order("created_at", { ascending: false })
    .limit(50);

  for (const quote of supplierQuotes ?? []) {
    const rfq = firstRelated(quote.rfqs);
    const supplier = firstRelated(quote.suppliers);
    const number = shortRfqNumber(rfq?.rfq_number);

    drafts.push({
      type: "supplier_response",
      title: "Supplier response received",
      message: [number, supplier?.supplier_name].filter(Boolean).join(" · "),
      entityType: "supplier_quote",
      entityId: quote.id,
      href: quote.rfq_id ? `/rfqs/${quote.rfq_id}` : "/rfqs",
      priority: "info",
      dedupeKey: `supplier_quote:received:${quote.id}`,
      createdAt: eventTime(quote.created_at),
    });
  }

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select("id, rfq_number, status, submission_deadline, customers(company_name)")
    .eq("organization_id", organization.id)
    .not("submission_deadline", "is", null)
    .order("submission_deadline", { ascending: true })
    .limit(100);

  for (const rfq of rfqs ?? []) {
    if (inactiveRfqStatuses.has(rfq.status)) continue;
    const number = shortRfqNumber(rfq.rfq_number);
    const customer = customerName(rfq.customers);

    if (rfq.submission_deadline < today) {
      drafts.push({
        type: "rfq_overdue",
        title: `${number} is overdue`,
        message: customer ?? "Submission deadline has passed",
        entityType: "rfq",
        entityId: rfq.id,
        href: `/rfqs/${rfq.id}`,
        priority: "critical",
        dedupeKey: `rfq:overdue:${rfq.id}:${rfq.submission_deadline}`,
        createdAt: new Date(`${rfq.submission_deadline}T12:00:00.000Z`).toISOString(),
      });
    } else if (rfq.submission_deadline <= tomorrow) {
      drafts.push({
        type: "rfq_deadline",
        title: `${number} deadline approaching`,
        message: customer ?? "Due within 24 hours",
        entityType: "rfq",
        entityId: rfq.id,
        href: `/rfqs/${rfq.id}`,
        priority: "warning",
        dedupeKey: `rfq:deadline:${rfq.id}:${rfq.submission_deadline}`,
        createdAt: new Date(`${rfq.submission_deadline}T12:00:00.000Z`).toISOString(),
      });
    }
  }

  const { data: customerQuotes } = await supabase
    .from("customer_quotes")
    .select("id, quote_number, rfq_id, status, valid_until, updated_at, rfqs(id, rfq_number, customers(company_name))")
    .eq("organization_id", organization.id)
    .or(`updated_at.gte.${recentWindow},valid_until.lte.${daysFromToday(7)}`)
    .order("updated_at", { ascending: false })
    .limit(100);

  for (const quote of customerQuotes ?? []) {
    const rfq = firstRelated(quote.rfqs);
    const number = shortRfqNumber(rfq?.rfq_number);

    if (quote.status === "accepted" || quote.status === "declined") {
      drafts.push({
        type: "quote",
        title: quote.status === "accepted" ? "RFQ accepted" : "Quote declined",
        message: [number, quote.quote_number].filter(Boolean).join(" · "),
        entityType: "customer_quote",
        entityId: quote.id,
        href: quote.rfq_id ? `/rfqs/${quote.rfq_id}/customer-quotes/${quote.id}` : "/quotes",
        priority: quote.status === "accepted" ? "success" : "critical",
        dedupeKey: `customer_quote:${quote.status}:${quote.id}`,
        createdAt: eventTime(quote.updated_at),
      });
    }

    if (
      quote.valid_until &&
      quote.valid_until >= today &&
      quote.valid_until <= daysFromToday(7) &&
      !["accepted", "declined", "rejected", "closed", "cancelled"].includes(quote.status)
    ) {
      drafts.push({
        type: "quote",
        title: "Quote expiring soon",
        message: [quote.quote_number, number].filter(Boolean).join(" · "),
        entityType: "customer_quote",
        entityId: quote.id,
        href: quote.rfq_id ? `/rfqs/${quote.rfq_id}/customer-quotes/${quote.id}` : "/quotes",
        priority: "warning",
        dedupeKey: `customer_quote:expiring:${quote.id}:${quote.valid_until}`,
        createdAt: new Date(`${quote.valid_until}T12:00:00.000Z`).toISOString(),
      });
    }
  }

  const { data: emails } = await supabase
    .from("email_messages")
    .select("id, rfq_id, subject, created_at, rfqs(id, rfq_number, customers(company_name))")
    .eq("organization_id", organization.id)
    .not("rfq_id", "is", null)
    .gte("created_at", recentWindow)
    .order("created_at", { ascending: false })
    .limit(50);

  for (const email of emails ?? []) {
    const rfq = firstRelated(email.rfqs);

    drafts.push({
      type: "email_intake",
      title: "RFQ created from email",
      message: [shortRfqNumber(rfq?.rfq_number), customerName(rfq?.customers) ?? email.subject].filter(Boolean).join(" · "),
      entityType: "email_message",
      entityId: email.id,
      href: email.rfq_id ? `/rfqs/${email.rfq_id}` : `/email-intake/${email.id}`,
      priority: "success",
      dedupeKey: `email:rfq_created:${email.id}:${email.rfq_id}`,
      createdAt: eventTime(email.created_at),
    });
  }

  const { data: failedAttachments } = await supabase
    .from("email_attachments")
    .select("id, email_message_id, extraction_error, extracted_at, created_at, email_messages(id, rfq_id, subject, rfqs(id, rfq_number))")
    .eq("organization_id", organization.id)
    .eq("ocr_status", "failed")
    .gte("created_at", recentWindow)
    .order("created_at", { ascending: false })
    .limit(50);

  for (const attachment of failedAttachments ?? []) {
    const email = firstRelated(attachment.email_messages);
    const rfq = firstRelated(email?.rfqs);

    drafts.push({
      type: "extraction",
      title: "Attachment extraction failed",
      message: shortRfqNumber(rfq?.rfq_number) || attachment.extraction_error || "Email intake needs review",
      entityType: "email_attachment",
      entityId: attachment.id,
      href: email?.id ? `/email-intake/${email.id}` : "/email-intake",
      priority: "critical",
      dedupeKey: `attachment:failed:${attachment.id}`,
      createdAt: eventTime(attachment.extracted_at ?? attachment.created_at),
    });
  }

  const { data: extractedItems } = await supabase
    .from("attachment_extracted_items")
    .select("id, email_message_id, created_at, email_messages(id, rfq_id, subject, rfqs(id, rfq_number))")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .gte("created_at", recentWindow)
    .order("created_at", { ascending: false })
    .limit(100);

  const pendingItemsByEmail = new Map<string, { count: number; item: PendingExtractedItem }>();
  for (const item of (extractedItems ?? []) as PendingExtractedItem[]) {
    if (!item.email_message_id) continue;
    const current = pendingItemsByEmail.get(item.email_message_id);
    pendingItemsByEmail.set(item.email_message_id, {
      count: (current?.count ?? 0) + 1,
      item: current?.item ?? item,
    });
  }

  for (const [emailId, group] of pendingItemsByEmail) {
    const email = firstRelated(group.item.email_messages);
    const rfq = firstRelated(email?.rfqs);

    drafts.push({
      type: "extraction",
      title: "Items ready for review",
      message: [shortRfqNumber(rfq?.rfq_number), `${group.count} items extracted`].filter(Boolean).join(" · "),
      entityType: "email_message",
      entityId: emailId,
      href: `/email-intake/${emailId}`,
      priority: "info",
      dedupeKey: `extracted_items:pending:${emailId}`,
      createdAt: eventTime(group.item.created_at),
    });
  }

  const { data: failedConnections } = await supabase
    .from("email_connections")
    .select("id, mailbox_email, provider, last_scan_status, last_scan_at, last_scan_error")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .eq("last_scan_status", "failed")
    .limit(10);

  for (const connection of failedConnections ?? []) {
    drafts.push({
      type: "system",
      title: "Email intake requires attention",
      message: connection.mailbox_email ?? connection.last_scan_error ?? "Mailbox scan failed",
      entityType: "email_connection",
      entityId: connection.id,
      href: "/settings/email/monitoring",
      priority: "critical",
      dedupeKey: `email_connection:failed:${connection.id}:${connection.last_scan_at ?? "unknown"}`,
      createdAt: eventTime(connection.last_scan_at),
    });
  }

  await upsertNotifications(supabase, organization.id, userId, drafts);
}

export async function listNotifications({
  supabase,
  organization,
  userId,
  limit = 20,
  unreadOnly = false,
}: ListArgs): Promise<{ notifications: NotificationRow[]; unreadCount: number; error: string | null }> {
  await ensureWorkflowNotifications({ supabase, organization, userId });

  const unreadQuery = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .is("read_at", null);

  let query = supabase
    .from("notifications")
    .select("id, organization_id, user_id, type, title, message, entity_type, entity_id, href, priority, dedupe_key, read_at, created_at")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  return {
    notifications: (data ?? []) as NotificationRow[],
    unreadCount: unreadQuery.count ?? 0,
    error: error?.message ?? unreadQuery.error?.message ?? null,
  };
}

export async function markNotificationRead({
  supabase,
  organization,
  userId,
  notificationId,
}: EnsureArgs & { notificationId: string }) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("organization_id", organization.id)
    .eq("user_id", userId);

  return error?.message ?? null;
}

export async function markAllNotificationsRead({
  supabase,
  organization,
  userId,
}: EnsureArgs) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .is("read_at", null);

  return error?.message ?? null;
}
