import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">
          Buyer relationships
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Customers
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Review customer accounts, contacts, RFQ workload, and recent activity
          for the selected tenant.
        </p>
      </div>

      <Card>
        <EmptyState
          title="No customers yet"
          description="Customers will appear here once you create RFQs or add customer records."
          action={
            <button className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Add Customer
            </button>
          }
        />
      </Card>
    </div>
  );
}
