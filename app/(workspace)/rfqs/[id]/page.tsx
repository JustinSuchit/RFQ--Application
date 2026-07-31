import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AttachmentExtractedItemActions,
  DownloadMicrosoftAttachmentButton,
  ExtractAttachmentButton,
  ImportAcceptedAttachmentItemsButton,
} from "@/components/email-intake/attachment-ocr-actions";
import { DeleteRfqButton } from "@/components/rfqs/delete-rfq-button";
import { StatusControl } from "@/components/rfqs/status-control";
import { ExtractItemsButton } from "@/components/rfqs/extract-items-button";
import { requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Customer = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
} | null;

type Rfq = {
  id: string;
  rfq_number: string;
  subject: string;
  status: string;
  priority: string;
  submission_deadline: string | null;
  created_at: string;
  delivery_location: string | null;
  notes: string | null;
  customers: Customer | Customer[] | null;
};

type RfqItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  required_date: string | null;
  notes: string | null;
};

type SupplierQuote = {
  id: string;
  quote_reference: string | null;
  status: string;
  subtotal: number | null;
  freight: number | null;
  tax: number | null;
  total: number | null;
  currency: string;
  valid_until: string | null;
  lead_time_days: number | null;
  suppliers:
    | {
        supplier_name: string;
      }
    | {
        supplier_name: string;
      }[]
    | null;
};

type CustomerQuote = {
  id: string;
  quote_number: string;
  revision: number;
  status: string;
  approval_status: string;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  delivery_fee: number | null;
  total: number | null;
  valid_until: string | null;
};

type ActivityLog = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type LinkedEmail = {
  id: string;
  provider: string;
  subject: string;
  from_email: string;
};

type EmailAttachment = {
  id: string;
  email_message_id: string;
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
};

type AttachmentExtractedItem = {
  id: string;
  email_message_id: string | null;
  email_attachment_id: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confidence: number | null;
  status: string;
  rfq_item_id: string | null;
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
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatBytes(value: number | null) {
  if (!value) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function textPreview(value: string | null) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
      {children}
    </span>
  );
}

export default async function RfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const organization = await requireOrganization();
  const supabase = await createClient();

  const rfqResponse = await supabase
    .from("rfqs")
    .select(
      "id, rfq_number, subject, status, priority, submission_deadline, created_at, delivery_location, notes, customers(company_name, contact_name, email, phone, address)",
    )
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
          title="RFQ not found"
          description="This RFQ does not exist or you do not have access to it."
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

  const rfq = rfqResponse.data as Rfq;
  const customer = firstRelated(rfq.customers);
  const [
    itemsResponse,
    supplierQuotesResponse,
    customerQuotesResponse,
    activityResponse,
    linkedEmailsResponse,
  ] = await Promise.all([
    supabase
      .from("rfq_items")
      .select("id, description, quantity, unit, required_date, notes")
      .eq("organization_id", organization.id)
      .eq("rfq_id", rfq.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("supplier_quotes")
      .select(
        "id, quote_reference, status, subtotal, freight, tax, total, currency, valid_until, lead_time_days, suppliers(supplier_name)",
      )
      .eq("organization_id", organization.id)
      .eq("rfq_id", rfq.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_quotes")
      .select(
        "id, quote_number, revision, status, approval_status, subtotal, tax, discount, delivery_fee, total, valid_until",
      )
      .eq("organization_id", organization.id)
      .eq("rfq_id", rfq.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, action, details, created_at")
      .eq("organization_id", organization.id)
      .eq("rfq_id", rfq.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("email_messages")
      .select("id, provider, subject, from_email")
      .eq("organization_id", organization.id)
      .eq("rfq_id", rfq.id)
      .order("received_at", { ascending: false }),
  ]);

  const items = (itemsResponse.data ?? []) as RfqItem[];
  const supplierQuotes = (supplierQuotesResponse.data ?? []) as SupplierQuote[];
  const customerQuotes = (customerQuotesResponse.data ?? []) as CustomerQuote[];
  const activityLogs = (activityResponse.data ?? []) as ActivityLog[];
  const linkedEmails = (linkedEmailsResponse.data ?? []) as LinkedEmail[];
  const linkedEmailIds = linkedEmails.map((email) => email.id);
  const [attachmentsResponse, extractedItemsResponse] =
    linkedEmailIds.length > 0
      ? await Promise.all([
          supabase
            .from("email_attachments")
            .select(
              "id, email_message_id, provider_attachment_id, file_name, content_type, size_bytes, storage_path, ocr_status, extracted_text, extraction_method, extraction_error, extracted_at",
            )
            .eq("organization_id", organization.id)
            .in("email_message_id", linkedEmailIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("attachment_extracted_items")
            .select(
              "id, email_message_id, email_attachment_id, description, quantity, unit, notes, confidence, status, rfq_item_id",
            )
            .eq("organization_id", organization.id)
            .in("email_message_id", linkedEmailIds)
            .order("created_at", { ascending: true }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  const attachments = (attachmentsResponse.data ?? []) as EmailAttachment[];
  const extractedAttachmentItems =
    (extractedItemsResponse.data ?? []) as AttachmentExtractedItem[];
  const relatedError =
    itemsResponse.error ??
    supplierQuotesResponse.error ??
    customerQuotesResponse.error ??
    activityResponse.error ??
    linkedEmailsResponse.error ??
    attachmentsResponse.error ??
    extractedItemsResponse.error;
  const canDeleteRfq = ["owner", "admin", "manager"].includes(organization.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/rfqs"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Back to RFQs
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {rfq.rfq_number}
            </h1>
            <Badge>{labelize(rfq.status)}</Badge>
            <Badge>{labelize(rfq.priority)}</Badge>
          </div>
          <p className="mt-3 max-w-3xl text-lg font-medium text-slate-700">
            {rfq.subject}
          </p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="font-semibold text-slate-950">Deadline:</span>{" "}
              {formatDate(rfq.submission_deadline)}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Created:</span>{" "}
              {formatDate(rfq.created_at)}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Delivery:</span>{" "}
              {rfq.delivery_location ?? "Not set"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <StatusControl rfqId={rfq.id} currentStatus={rfq.status} />
          {canDeleteRfq ? <DeleteRfqButton rfqId={rfq.id} /> : null}
        </div>
      </div>

      {relatedError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {relatedError.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Customer</h2>
          {customer ? (
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-slate-500">Company name</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {customer.company_name}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Contact name</p>
                <p className="mt-1 text-slate-700">
                  {customer.contact_name ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Email</p>
                <p className="mt-1 text-slate-700">
                  {customer.email ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Phone</p>
                <p className="mt-1 text-slate-700">
                  {customer.phone ?? "Not set"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-medium text-slate-500">Address</p>
                <p className="mt-1 text-slate-700">
                  {customer.address ?? "Not set"}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              No customer is linked to this RFQ.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">RFQ notes</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {rfq.notes ?? "No notes were added for this RFQ."}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-950">
              Requested items
            </h2>
            {items.length === 0 && rfq.notes ? (
              <ExtractItemsButton rfqId={rfq.id} />
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3">Required date</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="min-w-72 px-5 py-4 font-medium text-slate-950">
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {item.unit ?? "Not set"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(item.required_date)}
                    </td>
                    <td className="min-w-64 px-5 py-4 text-slate-600">
                      {item.notes ?? "None"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No requested items found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Attachment OCR & Item Extraction
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Extract readable text from linked email attachments, review detected
            items, then import accepted rows into this RFQ.
          </p>
        </div>
        {linkedEmails.length === 0 || attachments.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-600">
            No email attachments linked to this RFQ.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {linkedEmails.map((email) => {
              const emailAttachments = attachments.filter(
                (attachment) => attachment.email_message_id === email.id,
              );
              if (emailAttachments.length === 0) return null;

              return (
                <div key={email.id} className="space-y-5 px-5 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Linked email
                      </p>
                      <Link
                        href={`/email-intake/${email.id}`}
                        className="mt-1 block font-semibold text-teal-700 hover:text-teal-800"
                      >
                        {email.subject}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {email.from_email} · {labelize(email.provider)}
                      </p>
                    </div>
                    <ImportAcceptedAttachmentItemsButton
                      emailId={email.id}
                      rfqId={rfq.id}
                      hasRfq={true}
                    />
                  </div>

                  {emailAttachments.map((attachment) => {
                    const itemsForAttachment = extractedAttachmentItems.filter(
                      (item) => item.email_attachment_id === attachment.id,
                    );
                    const method = attachment.extraction_method || "Not extracted";

                    return (
                      <div
                        key={attachment.id}
                        className="space-y-4 rounded-md border border-slate-200 p-4"
                      >
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
                            {attachment.extraction_error?.includes("No readable PDF text found") ? (
                              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                This PDF may be scanned or image-based. Upload an image version or use scanned PDF OCR when available.
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-3">
                            {!attachment.storage_path &&
                            email.provider === "microsoft_graph" &&
                            attachment.provider_attachment_id ? (
                              <>
                                <p className="max-w-sm text-sm font-medium text-amber-700">
                                  Attachment metadata is available, but the file content has not been downloaded yet.
                                </p>
                                <DownloadMicrosoftAttachmentButton
                                  attachmentId={attachment.id}
                                />
                              </>
                            ) : null}
                            {attachment.storage_path ? (
                              <ExtractAttachmentButton attachmentId={attachment.id} />
                            ) : null}
                          </div>
                        </div>

                        {attachment.extracted_text ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Extracted text preview
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {textPreview(attachment.extracted_text)}
                            </p>
                          </div>
                        ) : null}

                        {itemsForAttachment.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Detected RFQ items
                            </p>
                            <div className="overflow-x-auto rounded-md border border-slate-200">
                              <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                  <tr>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">Quantity</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3">Confidence</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Review</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {itemsForAttachment.map((item) => (
                                    <tr key={item.id}>
                                      <td className="min-w-72 px-4 py-3 font-medium text-slate-950">
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {item.quantity ?? "Not set"}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {item.unit ?? "Not set"}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {item.confidence === null
                                          ? "Not set"
                                          : `${Math.round(item.confidence * 100)}%`}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {labelize(item.status)}
                                      </td>
                                      <td className="px-4 py-3">
                                        <AttachmentExtractedItemActions
                                          emailId={email.id}
                                          itemId={item.id}
                                          status={item.status}
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
                            Text was extracted, but no RFQ item rows were detected.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Supplier quotes
            </h2>
            <Link
              href={`/rfqs/${rfq.id}/supplier-quotes/new`}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Add Supplier Quote
            </Link>
          </div>
          {supplierQuotes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Currency</th>
                    <th className="px-5 py-3 text-right">Subtotal</th>
                    <th className="px-5 py-3 text-right">Freight</th>
                    <th className="px-5 py-3 text-right">Tax</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3">Lead time</th>
                    <th className="px-5 py-3">Valid until</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {supplierQuotes.map((quote) => (
                    <tr key={quote.id}>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {firstRelated(quote.suppliers)?.supplier_name ??
                          "No supplier"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        {quote.quote_reference ?? "No reference"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {quote.currency}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote.subtotal, quote.currency)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote.freight, quote.currency)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote.tax, quote.currency)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        {formatCurrency(quote.total, quote.currency)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {quote.lead_time_days
                          ? `${quote.lead_time_days} days`
                          : "Not set"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(quote.valid_until)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {labelize(quote.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No supplier quotes yet"
              description="Add supplier pricing to compare costs and lead times."
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Customer quotes
            </h2>
            {supplierQuotes.length > 0 ? (
              <Link
                href={`/rfqs/${rfq.id}/customer-quotes/new`}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                Generate Customer Quote
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400"
              >
                Generate Customer Quote
              </button>
            )}
          </div>
          {supplierQuotes.length === 0 ? (
            <p className="border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
              Add supplier pricing before generating a customer quote.
            </p>
          ) : null}
          {customerQuotes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Quote</th>
                    <th className="px-5 py-3">Revision</th>
                    <th className="px-5 py-3 text-right">Subtotal</th>
                    <th className="px-5 py-3 text-right">Tax</th>
                    <th className="px-5 py-3 text-right">Discount</th>
                    <th className="px-5 py-3 text-right">Delivery fee</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Approval</th>
                    <th className="px-5 py-3">Valid until</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {customerQuotes.map((quote) => {
                    const quoteHref = `/rfqs/${rfq.id}/customer-quotes/${quote.id}`;

                    return (
                    <tr key={quote.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold text-slate-950">
                        <Link
                          href={quoteHref}
                          className="block text-teal-700 hover:text-teal-800"
                        >
                          {quote.quote_number}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <Link href={quoteHref} className="block">
                          {quote.revision}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        <Link href={quoteHref} className="block">
                          {formatCurrency(quote.subtotal, organization.currency)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        <Link href={quoteHref} className="block">
                          {formatCurrency(quote.tax, organization.currency)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        <Link href={quoteHref} className="block">
                          {formatCurrency(quote.discount, organization.currency)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        <Link href={quoteHref} className="block">
                          {formatCurrency(
                            quote.delivery_fee,
                            organization.currency,
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-950">
                        <Link href={quoteHref} className="block">
                          {formatCurrency(quote.total, organization.currency)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <Link href={quoteHref} className="block">
                          {labelize(quote.status)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <Link href={quoteHref} className="block">
                          {labelize(quote.approval_status)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <Link href={quoteHref} className="block">
                          {formatDate(quote.valid_until)}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={quoteHref}
                          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                        >
                          View Quote
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No customer quotes yet"
              description="Generate a customer quote once supplier pricing is available."
            />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-950">Activity</h2>
        {activityLogs.length > 0 ? (
          <div className="mt-5 space-y-5">
            {activityLogs.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {activity.action}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {activity.details
                      ? JSON.stringify(activity.details)
                      : "No details recorded"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {formatDate(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No activity yet.</p>
        )}
      </Card>
    </div>
  );
}
