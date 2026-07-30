import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SupplierQuoteForm } from "@/components/rfqs/supplier-quote-form";
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
};

type RfqItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
};

export default async function NewSupplierQuotePage({ params }: PageProps) {
  const { id } = await params;
  await requireUser();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, rfq_number, subject")
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

  const { data: items, error: itemsError } = await supabase
    .from("rfq_items")
    .select("id, description, quantity, unit")
    .eq("organization_id", organization.id)
    .eq("rfq_id", rfq.id)
    .order("created_at", { ascending: true });

  const rfqItems = (items ?? []) as RfqItem[];
  const currentRfq = rfq as Rfq;

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
            Supplier pricing
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Add Supplier Quote
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Enter supplier pricing for {currentRfq.rfq_number}:{" "}
            {currentRfq.subject}
          </p>
        </div>
      </div>

      {itemsError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {itemsError.message}
        </div>
      ) : null}

      {rfqItems.length > 0 ? (
        <Card className="p-6">
          <SupplierQuoteForm
            rfqId={currentRfq.id}
            rfqItems={rfqItems}
            defaultCurrency={organization.currency || "TTD"}
          />
        </Card>
      ) : (
        <Card className="p-6">
          <EmptyState
            title="No RFQ items found"
            description="Add requested items to this RFQ before entering supplier pricing."
            action={
              <Link
                href={`/rfqs/${currentRfq.id}`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Back to RFQ
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}
