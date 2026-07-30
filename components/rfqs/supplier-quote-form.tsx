"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createSupplierQuoteAction,
  type SupplierQuoteState,
} from "@/app/(workspace)/rfqs/[id]/supplier-quotes/new/actions";

type RfqItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
};

type SupplierQuoteFormProps = {
  rfqId: string;
  rfqItems: RfqItem[];
  defaultCurrency: string;
};

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const initialState: SupplierQuoteState = {
  error: "",
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function SupplierQuoteForm({
  rfqId,
  rfqItems,
  defaultCurrency,
}: SupplierQuoteFormProps) {
  const [state, formAction, pending] = useActionState(
    createSupplierQuoteAction,
    initialState,
  );
  const [currency, setCurrency] = useState(defaultCurrency || "TTD");
  const [freight, setFreight] = useState(0);
  const [tax, setTax] = useState(0);
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const subtotal = useMemo(
    () =>
      rfqItems.reduce((sum, item) => {
        const unitCost = unitCosts[item.id] ?? 0;
        const discount = discounts[item.id] ?? 0;
        return sum + Math.max(item.quantity * unitCost - discount, 0);
      }, 0),
    [discounts, rfqItems, unitCosts],
  );
  const total = subtotal + freight + tax;

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="rfqId" value={rfqId} />

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Supplier</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Supplier name
            <input name="supplierName" required className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier contact name
            <input name="supplierContactName" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier email
            <input name="supplierEmail" type="email" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier phone
            <input name="supplierPhone" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier category
            <input name="supplierCategory" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier currency
            <input
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              required
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Quote details</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Quote reference
            <input name="quoteReference" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Lead time days
            <input
              name="leadTimeDays"
              type="number"
              min="0"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Valid until
            <input name="validUntil" type="date" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select name="status" defaultValue="received" className={inputClass}>
              <option value="received">Received</option>
              <option value="under_review">Under Review</option>
              <option value="selected">Selected</option>
              <option value="declined">Declined</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Freight
            <input
              name="freight"
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(event) => setFreight(Number(event.target.value || 0))}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Tax
            <input
              name="tax"
              type="number"
              min="0"
              step="0.01"
              value={tax}
              onChange={(event) => setTax(Number(event.target.value || 0))}
              className={inputClass}
            />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Notes
            <textarea
              name="notes"
              placeholder="Add supplier terms, exceptions, or review notes."
              className={textareaClass}
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Supplier quote items
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">RFQ item</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Unit cost</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Item total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rfqItems.map((item) => {
                const unitCost = unitCosts[item.id] ?? 0;
                const discount = discounts[item.id] ?? 0;
                const itemTotal = Math.max(item.quantity * unitCost - discount, 0);

                return (
                  <tr key={item.id}>
                    <td className="min-w-72 px-4 py-4 font-medium text-slate-950">
                      <input type="hidden" name="rfqItemId" value={item.id} />
                      <input
                        type="hidden"
                        name="description"
                        value={item.description}
                      />
                      <input
                        type="hidden"
                        name="quantity"
                        value={item.quantity}
                      />
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {item.unit ?? "Not set"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <input
                        name="unitCost"
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(event) =>
                          setUnitCosts((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value || 0),
                          }))
                        }
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <input
                        name="discount"
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(event) =>
                          setDiscounts((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value || 0),
                          }))
                        }
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="min-w-48 px-4 py-4">
                      <input
                        name="availability"
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="min-w-56 px-4 py-4">
                      <input
                        name="itemNotes"
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                      {formatMoney(itemTotal, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Subtotal</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(subtotal, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Freight + tax</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(freight + tax, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(total, currency)}
          </p>
        </div>
      </div>

      {state.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-slate-200 pt-6">
        <button
          type="submit"
          disabled={pending || rfqItems.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving quote..." : "Save Supplier Quote"}
        </button>
      </div>
    </form>
  );
}
