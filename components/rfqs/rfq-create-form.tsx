"use client";

import { useActionState, useState } from "react";
import { createRfqAction, type CreateRfqState } from "@/app/(workspace)/rfqs/new/actions";

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const textareaClass =
  "mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

type ItemRow = {
  id: number;
};

const initialState: CreateRfqState = {
  error: "",
};

export function RfqCreateForm() {
  const [state, formAction, pending] = useActionState(
    createRfqAction,
    initialState,
  );
  const [items, setItems] = useState<ItemRow[]>([{ id: 1 }]);

  return (
    <form className="space-y-8" action={formAction}>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Customer</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Customer company name
            <input name="customerCompanyName" required className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Contact name
            <input name="contactName" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Contact email
            <input
              name="contactEmail"
              type="email"
              required
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Contact phone
            <input name="contactPhone" className={inputClass} />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-950">RFQ details</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            RFQ subject
            <input name="subject" required className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Source
            <input name="source" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Priority
            <select
              name="priority"
              defaultValue="normal"
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Submission deadline
            <input
              name="submissionDeadline"
              type="date"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Delivery location
            <input name="deliveryLocation" className={inputClass} />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Notes
            <textarea
              name="notes"
              placeholder="Add scope notes, commercial requirements, or supplier instructions."
              className={textareaClass}
            />
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">RFQ items</h2>
          <button
            type="button"
            onClick={() =>
              setItems((currentItems) => [
                ...currentItems,
                { id: Date.now() },
              ])
            }
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Add item
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Required date</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="min-w-72 px-4 py-4">
                    <input
                      name="itemDescription"
                      required={item.id === items[0].id}
                      className={inputClass.replace("mt-2 ", "")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <input
                      name="itemQuantity"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      defaultValue="1"
                      className={inputClass.replace("mt-2 ", "")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <input
                      name="itemUnit"
                      className={inputClass.replace("mt-2 ", "")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <input
                      name="itemRequiredDate"
                      type="date"
                      className={inputClass.replace("mt-2 ", "")}
                    />
                  </td>
                  <td className="min-w-64 px-4 py-4">
                    <input
                      name="itemNotes"
                      className={inputClass.replace("mt-2 ", "")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {state.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save as Draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="create"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create RFQ"}
        </button>
      </div>
    </form>
  );
}
