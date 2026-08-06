import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerQuoteForm } from "@/components/rfqs/customer-quote-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Rfq = {
  id: string;
  rfq_number: string;
  subject: string;
  customers:
    | {
        company_name: string;
      }
    | {
        company_name: string;
      }[]
    | null;
};

type RfqItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
};

type SupplierQuote = {
  id: string;
  quote_reference: string | null;
  currency: string;
  suppliers:
    | {
        supplier_name: string;
      }
    | {
        supplier_name: string;
      }[]
    | null;
};

type SupplierQuoteItem = {
  id: string;
  supplier_quote_id: string;
  rfq_item_id: string | null;
  unit_cost: number;
  supplier_quotes: SupplierQuote | SupplierQuote[] | null;
};

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function defaultValidUntil(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function NewCustomerQuotePage({ params }: PageProps) {
  const { id } = await params;
  await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, rfq_number, subject, customers(company_name)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (rfqError) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Unable to load RFQ"
          description={rfqError.message}
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

  if (!rfq) {
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

  const currentRfq = rfq as Rfq;
  const customer = firstRelated(currentRfq.customers);
  const [
    itemsResponse,
    supplierQuotesResponse,
    supplierQuoteItemsResponse,
    settingsResponse,
  ] =
    await Promise.all([
      supabase
        .from("rfq_items")
        .select("id, description, quantity, unit")
        .eq("organization_id", organization.id)
        .eq("rfq_id", currentRfq.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("supplier_quotes")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("rfq_id", currentRfq.id)
        .limit(1),
      supabase
        .from("supplier_quote_items")
        .select(
          "id, supplier_quote_id, rfq_item_id, unit_cost, supplier_quotes(id, quote_reference, currency, suppliers(supplier_name))",
        )
        .eq("organization_id", organization.id),
      supabase
        .from("organization_settings")
        .select("default_quote_validity_days, default_markup_percentage, quote_pdf_default_validity_days, quote_pdf_footer_text, quote_pdf_terms, quote_pdf_show_notes, quote_pdf_template")
        .eq("organization_id", organization.id)
        .maybeSingle(),
    ]);

  const dataError =
    itemsResponse.error ??
    supplierQuotesResponse.error ??
    supplierQuoteItemsResponse.error ??
    settingsResponse.error;
  const rfqItems = (itemsResponse.data ?? []) as RfqItem[];
  const supplierQuoteItems = (
    supplierQuoteItemsResponse.data ?? []
  ) as SupplierQuoteItem[];

  const quoteItems = rfqItems.map((item) => ({
    ...item,
    options: supplierQuoteItems
      .filter((supplierItem) => supplierItem.rfq_item_id === item.id)
      .map((supplierItem) => {
        const supplierQuote = firstRelated(supplierItem.supplier_quotes);
        const supplier = firstRelated(supplierQuote?.suppliers ?? null);
        const labelParts = [
          supplier?.supplier_name ?? "Supplier",
          supplierQuote?.quote_reference,
        ].filter(Boolean);

        return {
          id: supplierItem.id,
          supplierQuoteId: supplierItem.supplier_quote_id,
          label: labelParts.join(" - "),
          unitCost: Number(supplierItem.unit_cost ?? 0),
          currency: supplierQuote?.currency ?? organization.currency,
        };
      }),
  }));
  const hasSupplierQuotes = (supplierQuotesResponse.data?.length ?? 0) > 0;
  const hasPriceOptions = quoteItems.every((item) => item.options.length > 0);
  const defaultValidityDays = Number(
    settingsResponse.data?.quote_pdf_default_validity_days ??
      settingsResponse.data?.default_quote_validity_days ??
      30,
  );
  const defaultMarkupPercentage = Number(
    settingsResponse.data?.default_markup_percentage ?? 25,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href={`/rfqs/${currentRfq.id}`}
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Back to RFQ
          </Link>
          <p className="mt-4 text-sm font-medium text-teal-700">
            Customer quote
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Generate Customer Quote
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Create a customer quote for {currentRfq.rfq_number}
            {customer?.company_name ? ` for ${customer.company_name}` : ""}.
          </p>
        </div>
      </div>

      {dataError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {dataError.message}
        </div>
      ) : null}

      {!hasSupplierQuotes ? (
        <Card className="p-6">
          <EmptyState
            title="Supplier pricing is required before generating a customer quote."
            action={
              <Link
                href={`/rfqs/${currentRfq.id}/supplier-quotes/new`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Add Supplier Quote
              </Link>
            }
          />
        </Card>
      ) : !hasPriceOptions ? (
        <Card className="p-6">
          <EmptyState
            title="Supplier pricing is incomplete"
            description="Each requested item needs supplier pricing before a customer quote can be generated."
          />
        </Card>
      ) : (
        <Card className="p-6">
          <CustomerQuoteForm
            rfqId={currentRfq.id}
            items={quoteItems}
            currency={organization.currency || "TTD"}
            taxRate={Number(organization.tax_rate ?? 0)}
            defaultValidUntil={defaultValidUntil(defaultValidityDays)}
            defaultMarkupPercentage={defaultMarkupPercentage}
            defaultPdfFooterNote={settingsResponse.data?.quote_pdf_footer_text ?? ""}
            defaultPdfTerms={settingsResponse.data?.quote_pdf_terms ?? ""}
            defaultPdfShowNotes={Boolean(settingsResponse.data?.quote_pdf_show_notes)}
            defaultPdfTemplate={settingsResponse.data?.quote_pdf_template ?? "professional"}
          />
        </Card>
      )}
    </div>
  );
}
