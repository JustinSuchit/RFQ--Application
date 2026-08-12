import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RfqCreateForm } from "@/components/rfqs/rfq-create-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";

export default async function NewRfqPage() {
  await requireUser();
  await requireOrganization();

  return (
    <div style={pageThemeStyle("rfqs")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="rfqs"
        icon={FilePlus2}
        eyebrow="Request intake"
        title="Create RFQ"
        description="Capture the core request details, commercial context, and item requirements before sending the RFQ for pricing."
        action={
        <Link
          href="/rfqs"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
        >
          Back to RFQs
        </Link>
        }
      />

      <Card className="p-6">
        <RfqCreateForm />
      </Card>
    </div>
  );
}
