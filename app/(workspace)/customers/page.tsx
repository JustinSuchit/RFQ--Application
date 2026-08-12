import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pageThemeStyle } from "@/lib/page-themes";

export default function CustomersPage() {
  return (
    <div style={pageThemeStyle("customers")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="customers"
        icon={Building2}
        eyebrow="Buyer relationships"
        title="Customers"
        description="Review customer accounts, contacts, RFQ workload, and recent activity for the selected tenant."
      />

      <Card>
        <EmptyState
          icon={Building2}
          title="No customers yet"
          description="Customers will appear here once you create RFQs or add customer records."
          action={
            <button className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] px-4 text-sm font-semibold text-[var(--page-accent)] shadow-sm transition hover:border-[var(--page-accent)]">
              Add Customer
            </button>
          }
        />
      </Card>
    </div>
  );
}
