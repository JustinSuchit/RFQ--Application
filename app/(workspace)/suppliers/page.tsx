import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pageThemeStyle } from "@/lib/page-themes";

export default function SuppliersPage() {
  return (
    <div style={pageThemeStyle("suppliers")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="suppliers"
        icon={Users}
        eyebrow="Supply network"
        title="Suppliers"
        description="Maintain the supplier directory and understand response performance before inviting vendors to an RFQ."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Supplier name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Contact email</th>
                <th className="px-5 py-3">Currency</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Average response time</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={Users}
                    title="No suppliers yet"
                    description="Add suppliers to compare pricing, lead times, and availability."
                    action={
                      <button className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] px-4 text-sm font-semibold text-[var(--page-accent)] shadow-sm transition hover:border-[var(--page-accent)]">
                        Add Supplier
                      </button>
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
