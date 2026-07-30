import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Quote comparison</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Quotes
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Track quote submissions, commercial totals, validity windows, and
          approval status before sending responses to customers.
        </p>
      </div>

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
                    title="No quotes yet"
                    description="Customer quotations generated from RFQs will appear here."
                    action={
                      <Link
                        href="/rfqs"
                        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
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
