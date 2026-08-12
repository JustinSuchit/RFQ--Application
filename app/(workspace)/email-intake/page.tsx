import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteEmailIntakeButton } from "@/components/email-intake/delete-email-button";
import { requireOrganization } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
import { createClient } from "@/lib/supabase/server";

type EmailMessage = {
  id: string;
  provider: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_preview: string | null;
  received_at: string;
  has_attachments: boolean;
  classification: string;
  is_rfq: boolean | null;
  rfq_id: string | null;
  thread_key: string | null;
  normalized_subject: string | null;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compactPreview(value: string | null) {
  const preview = (value ?? "No body preview").replace(/\s+/g, " ").trim();
  return preview.length > 100 ? `${preview.slice(0, 100)}...` : preview;
}

const deleteEmailRoles = new Set(["owner", "admin", "manager", "procurement"]);

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function EmailIntakePage({ searchParams }: PageProps) {
  const organization = await requireOrganization();
  const params = (await searchParams) ?? {};
  const mode = param(params, "mode") || "conversations";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, provider, from_name, from_email, subject, body_preview, received_at, has_attachments, classification, is_rfq, rfq_id, thread_key, normalized_subject",
    )
    .eq("organization_id", organization.id)
    .in("classification", ["likely_rfq", "possible_rfq"])
    .order("received_at", { ascending: false });
  const emails = (data ?? []) as EmailMessage[];
  const conversationRows = Array.from(
    emails
      .reduce((map, email) => {
        const key = email.thread_key || email.id;
        const current = map.get(key);
        if (!current) {
          map.set(key, {
            ...email,
            messageCount: 1,
            latestSender: email.from_name || email.from_email,
            latestReceivedAt: email.received_at,
          });
          return map;
        }

        current.messageCount += 1;
        if (new Date(email.received_at).getTime() > new Date(current.latestReceivedAt).getTime()) {
          current.latestSender = email.from_name || email.from_email;
          current.latestReceivedAt = email.received_at;
          current.id = email.id;
          current.subject = email.subject;
          current.body_preview = email.body_preview;
          current.classification = email.classification;
          current.rfq_id = email.rfq_id ?? current.rfq_id;
        }
        return map;
      }, new Map<string, EmailMessage & { messageCount: number; latestSender: string; latestReceivedAt: string }>())
      .values(),
  );
  const rows = mode === "individual" ? emails.map((email) => ({ ...email, messageCount: 1, latestSender: email.from_name || email.from_email, latestReceivedAt: email.received_at })) : conversationRows;
  const canDeleteEmail = deleteEmailRoles.has(organization.role);

  return (
    <div style={pageThemeStyle("emailIntake")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="emailIntake"
        icon={Inbox}
        eyebrow="Manual email intake"
        title="Email Intake"
        description="Review RFQ-related emails from manual, IMAP, and Microsoft 365 intake, then convert requests into tracked RFQs."
        action={
        <Link
          href="/email-intake/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log Email
        </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/email-intake?mode=conversations"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "individual" ? "border border-slate-200 bg-white text-slate-700 hover:bg-[var(--page-accent-hover)]" : "border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]"}`}
        >
          Conversations
        </Link>
        <Link
          href="/email-intake?mode=individual"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "individual" ? "border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]" : "border border-slate-200 bg-white text-slate-700 hover:bg-[var(--page-accent-hover)]"}`}
        >
          Individual messages
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error.message}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div
          tabIndex={0}
          aria-label="Email intake table"
          className="w-full max-w-full overflow-auto outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--page-accent-border)] lg:max-h-[calc(100vh-240px)]"
        >
          <table className="w-full min-w-full table-fixed divide-y divide-slate-200 text-sm max-lg:min-w-[1080px]">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 top-0 z-30 border-r border-slate-200 bg-slate-50 px-5 py-3 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                  Sender
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Subject
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Classification
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Source
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Latest
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Attachments
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Thread
                </th>
                <th className="sticky right-0 top-0 z-30 border-l border-slate-200 bg-slate-50 px-5 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.length ? (
                rows.map((email) => (
                  <tr key={email.id} className="group transition hover:bg-[var(--page-accent-hover)]">
                    <td className="sticky left-0 z-10 overflow-hidden border-r border-slate-100 bg-white px-4 py-4 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-[var(--page-accent-hover)]">
                      <p className="truncate font-semibold text-slate-950">
                        {email.latestSender}
                      </p>
                      <p className="truncate text-xs text-slate-500" title={email.from_email}>
                        {email.from_email}
                      </p>
                    </td>
                    <td className="overflow-hidden px-4 py-4">
                      <Link
                        href={`/email-intake/${email.id}`}
                        title={email.subject}
                        className="block truncate font-semibold text-slate-950 hover:text-[var(--page-accent)]"
                      >
                        {email.subject}
                      </Link>
                      <p
                        title={(email.body_preview ?? "").replace(/\s+/g, " ").trim()}
                        className="mt-1 truncate text-slate-600"
                      >
                        {compactPreview(email.body_preview)}
                      </p>
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      {email.rfq_id ? "RFQ created" : labelize(email.classification)}
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      {labelize(email.provider)}
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      {formatDate(email.latestReceivedAt)}
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      {email.has_attachments ? "Yes" : "No"}
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {email.messageCount}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-3 py-4 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-[var(--page-accent-hover)]">
                      <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/email-intake/${email.id}`}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                        >
                          View
                        </Link>
                        {email.rfq_id ? (
                          <Link
                            href={`/rfqs/${email.rfq_id}`}
                            className="rounded-md border border-[var(--page-accent-border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--page-accent)] shadow-sm transition hover:border-[var(--page-accent)]"
                          >
                            Open RFQ
                          </Link>
                        ) : null}
                        {canDeleteEmail ? (
                          <DeleteEmailIntakeButton
                            emailId={email.id}
                            linkedRfq={Boolean(email.rfq_id)}
                            redirectTo="list"
                            compact
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={Inbox}
                      title="No manually logged emails yet"
                      description="Emails logged by your team will appear here for RFQ review."
                      action={
                        <Link
                          href="/email-intake/new"
                          className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
                        >
                          Log Email
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
