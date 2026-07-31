"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createCustomerQuoteAction,
  type CustomerQuoteState,
} from "@/app/(workspace)/rfqs/[id]/customer-quotes/new/actions";

type SupplierPriceOption = {
  id: string;
  supplierQuoteId: string;
  label: string;
  unitCost: number;
  currency: string;
};

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  options: SupplierPriceOption[];
};

type CustomerQuoteFormProps = {
  rfqId: string;
  items: QuoteItem[];
  currency: string;
  taxRate: number;
  defaultValidUntil: string;
  defaultMarkupPercentage: number;
};

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const initialState: CustomerQuoteState = {
  error: "",
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CustomerQuoteForm({
  rfqId,
  items,
  currency,
  taxRate,
  defaultValidUntil,
  defaultMarkupPercentage,
}: CustomerQuoteFormProps) {
  const [state, formAction, pending] = useActionState(
    createCustomerQuoteAction,
    initialState,
  );
  const [markupPercentage, setMarkupPercentage] = useState(defaultMarkupPercentage);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [manualTax, setManualTax] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, item.options[0]?.id ?? ""]),
      ),
  );
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  const [itemTaxes, setItemTaxes] = useState<Record<string, number>>({});

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const selectedOption = item.options.find(
          (option) => option.id === selectedOptions[item.id],
        );
        const unitCost = selectedOption?.unitCost ?? 0;
        const unitPrice = unitCost + unitCost * (markupPercentage / 100);
        return sum + item.quantity * unitPrice;
      }, 0),
    [items, markupPercentage, selectedOptions],
  );
  const tax = manualTax ?? subtotal * taxRate;
  const total = Math.max(subtotal - discount + deliveryFee + tax, 0);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="rfqId" value={rfqId} />

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Quote details</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Quote validity date
            <input
              name="validUntil"
              type="date"
              defaultValue={defaultValidUntil}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select name="status" defaultValue="draft" className={inputClass}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Markup percentage
            <input
              name="markupPercentage"
              type="number"
              min="0"
              step="0.01"
              value={markupPercentage}
              onChange={(event) =>
                setMarkupPercentage(Number(event.target.value || 0))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Discount
            <input
              name="discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value || 0))}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Delivery fee
            <input
              name="deliveryFee"
              type="number"
              min="0"
              step="0.01"
              value={deliveryFee}
              onChange={(event) =>
                setDeliveryFee(Number(event.target.value || 0))
              }
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
              onChange={(event) => setManualTax(Number(event.target.value || 0))}
              className={inputClass}
            />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Notes
            <textarea name="notes" className={textareaClass} />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Terms and conditions
            <textarea name="terms" className={textareaClass} />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Quote items</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Requested item</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Supplier price</th>
                <th className="px-4 py-3">Base cost</th>
                <th className="px-4 py-3">Markup</th>
                <th className="px-4 py-3">Unit selling price</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const selectedOption = item.options.find(
                  (option) => option.id === selectedOptions[item.id],
                );
                const unitCost = selectedOption?.unitCost ?? 0;
                const markupAmount = unitCost * (markupPercentage / 100);
                const unitSellingPrice = unitCost + markupAmount;
                const lineSubtotal = item.quantity * unitSellingPrice;
                const itemDiscount = itemDiscounts[item.id] ?? 0;
                const itemTax = itemTaxes[item.id] ?? 0;
                const lineTotal = Math.max(lineSubtotal - itemDiscount + itemTax, 0);

                return (
                  <tr key={item.id}>
                    <td className="min-w-72 px-4 py-4 font-medium text-slate-950">
                      <input type="hidden" name="rfqItemId" value={item.id} />
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {item.unit ?? "Not set"}
                    </td>
                    <td className="min-w-64 px-4 py-4">
                      <select
                        name="selectedSupplierQuoteItemId"
                        value={selectedOptions[item.id] ?? ""}
                        onChange={(event) =>
                          setSelectedOptions((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        required
                        className={inputClass.replace("mt-2 ", "")}
                      >
                        {item.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {formatMoney(unitCost, selectedOption?.currency ?? currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {formatMoney(markupAmount, selectedOption?.currency ?? currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950">
                      {formatMoney(
                        unitSellingPrice,
                        selectedOption?.currency ?? currency,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <input
                        name="itemDiscount"
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(event) =>
                          setItemDiscounts((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value || 0),
                          }))
                        }
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <input
                        name="itemTax"
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(event) =>
                          setItemTaxes((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value || 0),
                          }))
                        }
                        className={inputClass.replace("mt-2 ", "")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-950">
                      <input type="hidden" name="itemNotes" value="" />
                      {formatMoney(lineTotal, selectedOption?.currency ?? currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Subtotal</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(subtotal, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Discount</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(discount, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Tax + delivery</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(tax + deliveryFee, currency)}
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
          disabled={pending || items.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Generating quote..." : "Generate Customer Quote"}
        </button>
      </div>
    </form>
  );
}
