import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pageThemeStyle } from "@/lib/page-themes";

export default function QuotesPage() {
  return (
    <div style={pageThemeStyle("quotes")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="quotes"
        icon={ReceiptText}
        eyebrow="Quote comparison"
        title="Quotes"
        description="Track quote submissions, commercial totals, validity windows, and approval status before sending responses to customers."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Quote number</th>
                <th className="px-5 py-3">RFQ number</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Valid until</th>
                <th className="px-5 py-3">Approval status</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={ReceiptText}
                    title="No quotes yet"
                    description="Customer quotations generated from RFQs will appear here."
                    action={
                      <Link
                        href="/rfqs"
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] px-4 text-sm font-semibold text-[var(--page-accent)] shadow-sm transition hover:border-[var(--page-accent)]"
                      >
                        View RFQs
                      </Link>
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
