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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Sender</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Classification</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Attachments</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {emails.length ? (
                emails.map((email) => (
                  <tr key={email.id} className="transition hover:bg-slate-50">
                    <td className="min-w-56 px-5 py-4">
                      <p className="font-semibold text-slate-950">
                        {email.from_name || email.from_email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {email.from_email}
                      </p>
                    </td>
                    <td className="min-w-80 px-5 py-4">
                      <Link
                        href={`/email-intake/${email.id}`}
                        className="font-semibold text-slate-950 hover:text-teal-700"
                      >
                        {email.subject}
                      </Link>
                      <p className="mt-1 max-w-xl truncate text-slate-600">
                        {email.body_preview ?? "No body preview"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {email.rfq_id ? "RFQ created" : labelize(email.classification)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {labelize(email.provider)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(email.received_at)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {email.has_attachments ? "Yes" : "No"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/email-intake/${email.id}`}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                        >
                          View
                        </Link>
                        <DeleteEmailIntakeButton
                          emailId={email.id}
                          linkedRfq={Boolean(email.rfq_id)}
                          redirectTo="list"
                        />
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
