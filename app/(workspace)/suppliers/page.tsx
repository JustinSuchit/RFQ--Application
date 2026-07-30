import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Supply network</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Suppliers
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Maintain the supplier directory and understand response performance
          before inviting vendors to an RFQ.
        </p>
      </div>

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
                    title="No suppliers yet"
                    description="Add suppliers to compare pricing, lead times, and availability."
                    action={
                      <button className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
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
