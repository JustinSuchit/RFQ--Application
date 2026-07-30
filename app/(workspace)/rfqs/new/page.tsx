import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RfqCreateForm } from "@/components/rfqs/rfq-create-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";

export default async function NewRfqPage() {
  await requireUser();
  await requireOrganization();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Request intake</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Create RFQ
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Capture the core request details, commercial context, and item
            requirements before sending the RFQ for pricing.
          </p>
        </div>
        <Link
          href="/rfqs"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          Back to RFQs
        </Link>
      </div>

      <Card className="p-6">
        <RfqCreateForm />
      </Card>
    </div>
  );
}
