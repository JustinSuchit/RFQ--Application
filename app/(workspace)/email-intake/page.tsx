import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteEmailIntakeButton } from "@/components/email-intake/delete-email-button";
import { requireOrganization } from "@/lib/auth/session";
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

export default async function EmailIntakePage() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, provider, from_name, from_email, subject, body_preview, received_at, has_attachments, classification, is_rfq, rfq_id",
    )
    .eq("organization_id", organization.id)
    .in("classification", ["likely_rfq", "possible_rfq"])
    .order("received_at", { ascending: false });
  const emails = (data ?? []) as EmailMessage[];
  const canDeleteEmail = deleteEmailRoles.has(organization.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">
            Manual email intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Email Intake
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Review RFQ-related emails from manual, IMAP, and Microsoft 365
            intake, then convert requests into tracked RFQs.
          </p>
        </div>
        <Link
          href="/email-intake/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Log Email
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
          className="w-full max-w-full overflow-auto outline-none focus:ring-2 focus:ring-inset focus:ring-teal-200 lg:max-h-[calc(100vh-240px)]"
        >
          <table className="w-full min-w-full table-fixed divide-y divide-slate-200 text-sm max-lg:min-w-[1080px]">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "36%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "7%" }} />
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
                  Received
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 px-5 py-3">
                  Attachments
                </th>
                <th className="sticky right-0 top-0 z-30 border-l border-slate-200 bg-slate-50 px-5 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {emails.length ? (
                emails.map((email) => (
                  <tr key={email.id} className="group transition hover:bg-slate-50">
                    <td className="sticky left-0 z-10 overflow-hidden border-r border-slate-100 bg-white px-4 py-4 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-slate-50">
                      <p className="truncate font-semibold text-slate-950">
                        {email.from_name || email.from_email}
                      </p>
                      <p className="truncate text-xs text-slate-500" title={email.from_email}>
                        {email.from_email}
                      </p>
                    </td>
                    <td className="overflow-hidden px-4 py-4">
                      <Link
                        href={`/email-intake/${email.id}`}
                        title={email.subject}
                        className="block truncate font-semibold text-slate-950 hover:text-teal-700"
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
                      {formatDate(email.received_at)}
                    </td>
                    <td className="truncate px-4 py-4 text-slate-600">
                      {email.has_attachments ? "Yes" : "No"}
                    </td>
                    <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-3 py-4 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-slate-50">
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
                            className="rounded-md border border-teal-200 bg-white px-2.5 py-2 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:text-teal-800"
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
                  <td colSpan={7}>
                    <EmptyState
                      title="No manually logged emails yet"
                      description="Emails logged by your team will appear here for RFQ review."
                      action={
                        <Link
                          href="/email-intake/new"
                          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
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
