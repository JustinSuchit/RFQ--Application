import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmailClassificationActions } from "@/components/email-intake/email-actions";
import { requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EmailMessage = {
  id: string;
  provider_message_id: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_preview: string | null;
  body: string | null;
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

export default async function EmailIntakeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, provider_message_id, from_name, from_email, subject, body_preview, body, received_at, has_attachments, classification, is_rfq, rfq_id",
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Unable to load email"
          description={error.message}
          action={
            <Link
              href="/email-intake"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to Email Intake
            </Link>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Email not found"
          description="This email does not exist or you do not have access to it."
          action={
            <Link
              href="/email-intake"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to Email Intake
            </Link>
          }
        />
      </Card>
    );
  }

  const email = data as EmailMessage;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/email-intake"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          Back to Email Intake
        </Link>
        <p className="mt-4 text-sm font-medium text-teal-700">
          Manual email
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {email.subject}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Review the message classification and create an RFQ when the request
          should enter the RFQ workflow.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-950">From:</span>{" "}
              {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Received:</span>{" "}
              {formatDate(email.received_at)}
            </p>
            <p>
              <span className="font-semibold text-slate-950">
                Provider message id:
              </span>{" "}
              {email.provider_message_id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {email.rfq_id ? "RFQ created" : labelize(email.classification)}
            </span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              Attachments: {email.has_attachments ? "Yes" : "No"}
            </span>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <EmailClassificationActions
            emailId={email.id}
            hasRfq={Boolean(email.rfq_id)}
          />
        </div>

        {email.rfq_id ? (
          <div className="mt-4">
            <Link
              href={`/rfqs/${email.rfq_id}`}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Open created RFQ
            </Link>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950">Email body</h2>
        <div className="mt-4 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {email.body || email.body_preview || "No email body was logged."}
        </div>
      </Card>
    </div>
  );
}
