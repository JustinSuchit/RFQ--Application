import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteEmailIntakeButton } from "@/components/email-intake/delete-email-button";
import { EmailClassificationActions } from "@/components/email-intake/email-actions";
import { LinkThreadToRfqForm } from "@/components/email-intake/thread-actions";
import { requireOrganization } from "@/lib/auth/session";
import { extractRfqItemsFromEmailText } from "@/lib/email/rfq-item-extractor";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EmailMessage = {
  id: string;
  provider: string;
  provider_message_id: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_preview: string | null;
  body: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  has_attachments: boolean;
  classification: string;
  is_rfq: boolean | null;
  rfq_id: string | null;
  thread_key: string | null;
  parent_email_id: string | null;
  normalized_subject: string | null;
};

type EmailAttachment = {
  id: string;
  provider_attachment_id: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  ocr_status: string | null;
  extracted_text: string | null;
  extraction_method: string | null;
  extraction_error: string | null;
  extracted_at: string | null;
  raw_extraction: Record<string, unknown> | null;
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

function formatBytes(value: number | null) {
  if (!value) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function extractionPages(raw: Record<string, unknown> | null) {
  const pages = raw?.pages;
  return typeof pages === "number" && Number.isFinite(pages) ? pages : null;
}

function htmlToSafeText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function emailBody(email: EmailMessage) {
  return (
    email.body_text ||
    (email.body_html ? htmlToSafeText(email.body_html) : "") ||
    email.body ||
    email.body_preview ||
    "No email body was logged."
  );
}

function ollamaAssistLabel(raw: Record<string, unknown> | null) {
  const ollama = raw?.ollama;
  if (!ollama || typeof ollama !== "object") return null;

  const data = ollama as {
    enabled?: unknown;
    used?: unknown;
    unavailable?: unknown;
    metadata?: { returnedItems?: unknown };
  };

  if (data.unavailable === true) return "Ollama assist: unavailable";
  if (data.used === true) {
    const returnedItems = data.metadata?.returnedItems;
    return `Ollama assist: ${typeof returnedItems === "number" ? returnedItems : 0} candidates`;
  }
  if (data.enabled === true) return "Ollama assist: skipped";

  return null;
}

const deleteEmailRoles = new Set(["owner", "admin", "manager", "procurement"]);

export default async function EmailIntakeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, provider, provider_message_id, from_name, from_email, subject, body_preview, body, body_text, body_html, received_at, has_attachments, classification, is_rfq, rfq_id, thread_key, parent_email_id, normalized_subject",
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
  const canDeleteEmail = deleteEmailRoles.has(organization.role);
  const detectedItems = extractRfqItemsFromEmailText(
    [email.subject, email.body_preview, email.body_text, email.body].filter(Boolean).join("\n"),
  );
  const attachmentsResponse = await supabase
    .from("email_attachments")
    .select(
      "id, provider_attachment_id, file_name, content_type, size_bytes, storage_path, ocr_status, extracted_text, extraction_method, extraction_error, extracted_at, raw_extraction",
    )
    .eq("organization_id", organization.id)
    .eq("email_message_id", email.id)
    .order("created_at", { ascending: true });
  const attachments = (attachmentsResponse.data ?? []) as EmailAttachment[];
  const [threadResponse, rfqsResponse] = await Promise.all([
    email.thread_key
      ? supabase
          .from("email_messages")
          .select("id, provider, provider_message_id, from_name, from_email, subject, body_preview, body, body_text, body_html, received_at, has_attachments, classification, is_rfq, rfq_id, thread_key, parent_email_id, normalized_subject")
          .eq("organization_id", organization.id)
          .eq("thread_key", email.thread_key)
          .order("received_at", { ascending: true })
      : Promise.resolve({ data: [email], error: null }),
    supabase
      .from("rfqs")
      .select("id, rfq_number, subject")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const threadEmails = (threadResponse.data ?? [email]) as EmailMessage[];

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
              <span className="font-semibold text-slate-950">Source:</span>{" "}
              {labelize(email.provider)}
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
            rfqId={email.rfq_id}
          />
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-semibold text-slate-950">
            Thread linking
          </p>
          <LinkThreadToRfqForm
            emailId={email.id}
            rfqs={(rfqsResponse.data ?? []) as Array<{ id: string; rfq_number: string; subject: string }>}
          />
        </div>

        {email.rfq_id ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/rfqs/${email.rfq_id}`}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Open created RFQ
            </Link>
            {canDeleteEmail ? (
              <DeleteEmailIntakeButton
                emailId={email.id}
                linkedRfq={true}
                redirectTo="detail"
              />
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            {canDeleteEmail ? (
              <DeleteEmailIntakeButton
                emailId={email.id}
                linkedRfq={false}
                redirectTo="detail"
              />
            ) : null}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Email conversation
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Messages are shown oldest to newest. Replies linked to an RFQ are preserved as revisions or follow-ups for review.
          </p>
        </div>
        {threadResponse.error ? (
          <div className="px-5 py-4 text-sm text-rose-700">{threadResponse.error.message}</div>
        ) : null}
        <div className="divide-y divide-slate-200">
          {threadEmails.map((message, index) => (
            <article key={message.id} className="px-5 py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-teal-700">
                    {index === 0 ? "Original request" : message.rfq_id ? "Revision / follow-up" : "Follow-up"}
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-950">{message.subject}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
                  </p>
                </div>
                <div className="text-sm text-slate-600 sm:text-right">
                  <p>{formatDate(message.received_at)}</p>
                  <p>{labelize(message.classification)}</p>
                  {message.rfq_id ? (
                    <Link href={`/rfqs/${message.rfq_id}`} className="font-semibold text-teal-700 hover:text-teal-800">
                      Open linked RFQ
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {emailBody(message)}
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Detected Requested Items
          </h2>
        </div>
        {detectedItems.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {detectedItems.map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td className="min-w-72 px-5 py-4 font-medium text-slate-950">
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {item.unit ?? "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-slate-600">
            No requested items detected automatically.
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Attachments
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Attachment extraction is available after this email has been
            converted into an RFQ.
          </p>
        </div>

        {attachmentsResponse.error ? (
          <div className="px-5 py-4 text-sm font-medium text-rose-700">
            {attachmentsResponse.error.message}
          </div>
        ) : null}

        <div className="border-b border-slate-200 px-5 py-4">
          {email.rfq_id ? (
            <Link
              href={`/rfqs/${email.rfq_id}`}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Open RFQ to extract attachment items
            </Link>
          ) : (
            <p className="text-sm font-medium text-amber-700">
              Create an RFQ from this email before extracting attachment items.
            </p>
          )}
        </div>

        {attachments.length ? (
          <div className="divide-y divide-slate-200">
            {attachments.map((attachment) => {
              const method = attachment.extraction_method || "Not extracted";
              const pagesProcessed = extractionPages(attachment.raw_extraction);
              const ollamaLabel = ollamaAssistLabel(attachment.raw_extraction);
              return (
                <div key={attachment.id} className="space-y-4 px-5 py-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {attachment.file_name || "Attachment"}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2.5 py-1">
                          {attachment.content_type || "Unknown type"}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1">
                          {formatBytes(attachment.size_bytes)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1">
                          OCR: {attachment.ocr_status || "pending"}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1">
                          Method: {labelize(method)}
                        </span>
                        {pagesProcessed ? (
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">
                            Pages processed: {pagesProcessed}
                          </span>
                        ) : null}
                        {ollamaLabel ? (
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">
                            {ollamaLabel}
                          </span>
                        ) : null}
                      </div>
                      {attachment.extraction_method === "image_ocr" ? (
                        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                          Image and handwriting OCR may be inaccurate. Review detected items before importing.
                        </p>
                      ) : null}
                      {attachment.extraction_error ? (
                        <p className="mt-3 text-sm font-medium text-rose-600">
                          {attachment.extraction_error}
                        </p>
                      ) : null}
                      {attachment.extraction_error?.includes("No readable PDF text found") ||
                      attachment.extraction_error?.includes("scanned or image-based") ? (
                        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                          This PDF may be scanned or image-based. Upload an image version or use scanned PDF OCR when available.
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600">
                      {attachment.storage_path
                        ? "File content is stored privately."
                        : "Attachment metadata is available, but the file content has not been downloaded yet."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-slate-600">
            No attachments have been saved for this email yet.
          </div>
        )}

      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950">Email body</h2>
        <div className="mt-4 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {emailBody(email)}
        </div>
      </Card>
    </div>
  );
}
