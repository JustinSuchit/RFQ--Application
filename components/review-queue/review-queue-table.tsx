"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  markReviewedAction,
  updateReviewFieldsAction,
  type ReviewQueueState,
} from "@/app/(workspace)/review-queue/actions";
import { labelizeReviewValue } from "@/lib/rfqs/review-status";

export type ReviewQueueTableRow = {
  id: string;
  rfq_number: string;
  subject: string;
  status: string;
  priority: string | null;
  review_status: string | null;
  next_action: string | null;
  review_due_at: string | null;
  assigned_to: string | null;
  submission_deadline: string | null;
  created_at: string;
  last_activity_at: string | null;
  customers:
    | { id: string; company_name: string; email: string | null }
    | { id: string; company_name: string; email: string | null }[]
    | null;
  effectiveReviewStatus: string;
  effectiveNextAction: string;
  effectivePriority: string;
};

type Member = {
  user_id: string;
  role: string;
};

type ReviewQueueTableProps = {
  rows: ReviewQueueTableRow[];
  members: Member[];
  canManage: boolean;
};

const initialState: ReviewQueueState = { error: "" };
const inputClass =
  "h-9 rounded-md border border-[#dfe4ea] bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function shortUser(value: string | null) {
  if (!value) return "Unassigned";
  return value.slice(0, 8);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(value: string) {
  if (value === "overdue") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "ready_to_send") return "bg-teal-50 text-teal-700 ring-teal-200";
  if (value === "missing_items") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function ReviewQueueTable({
  rows,
  members,
  canManage,
}: ReviewQueueTableProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const visibleSelectedId = rows.some((row) => row.id === selectedId)
    ? selectedId
    : "";
  const selected = useMemo(
    () => rows.find((row) => row.id === visibleSelectedId) ?? null,
    [rows, visibleSelectedId],
  );
  const [fieldState, fieldAction, fieldPending] = useActionState(
    updateReviewFieldsAction,
    initialState,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    markReviewedAction,
    initialState,
  );
  const message = fieldState.error || fieldState.success || reviewState.error || reviewState.success;
  const isError = Boolean(fieldState.error || reviewState.error);

  useEffect(() => {
    if (fieldState.success || reviewState.success) {
      router.refresh();
    }
  }, [fieldState.success, reviewState.success, router]);

  return (
    <div className="space-y-3">
      <div className="sticky top-16 z-10 rounded-md border border-[#dfe4ea] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Selected RFQ Actions
              </p>
              <p className="text-sm text-slate-500">
                {selected
                  ? `Selected RFQ: ${selected.rfq_number}`
                  : "Select an RFQ to manage it."}
              </p>
            </div>
            {message ? (
              <p className={isError ? "text-sm font-medium text-rose-700" : "text-sm font-medium text-teal-700"}>
                {message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <Link
              href={selected ? `/rfqs/${selected.id}` : "#"}
              aria-disabled={!selected}
              className={`inline-flex h-9 items-center justify-center rounded-md border border-[#dfe4ea] bg-white px-3 text-sm font-semibold shadow-sm ${
                selected
                  ? "text-slate-700 hover:border-slate-300 hover:text-slate-950"
                  : "pointer-events-none text-slate-400"
              }`}
            >
              Open RFQ
            </Link>

            <form
              key={selected?.id ?? "empty"}
              action={fieldAction}
              className="flex flex-1 flex-col gap-2 xl:flex-row xl:items-center"
            >
              <input type="hidden" name="rfqId" value={selected?.id ?? ""} />
              <select
                name="assignedTo"
                disabled={!selected || !canManage || fieldPending}
                defaultValue={selected?.assigned_to ?? ""}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {shortUser(member.user_id)} ({member.role})
                  </option>
                ))}
              </select>
              <select
                name="reviewStatus"
                disabled={!selected || !canManage || fieldPending}
                defaultValue={selected?.effectiveReviewStatus ?? "new"}
                className={inputClass}
              >
                {["new", "needs_review", "missing_items", "awaiting_pricing", "awaiting_approval", "ready_to_send", "overdue", "completed"].map((status) => (
                  <option key={status} value={status}>
                    {labelizeReviewValue(status)}
                  </option>
                ))}
              </select>
              <select
                name="priority"
                disabled={!selected || !canManage || fieldPending}
                defaultValue={selected?.effectivePriority ?? "normal"}
                className={inputClass}
              >
                {["low", "normal", "high", "urgent"].map((priority) => (
                  <option key={priority} value={priority}>
                    {labelizeReviewValue(priority)}
                  </option>
                ))}
              </select>
              <input
                name="reviewDueAt"
                type="datetime-local"
                disabled={!selected || !canManage || fieldPending}
                defaultValue={selected?.review_due_at ? selected.review_due_at.slice(0, 16) : ""}
                className={inputClass}
              />
              <input
                name="nextAction"
                disabled={!selected || !canManage || fieldPending}
                defaultValue={selected?.effectiveNextAction ?? ""}
                placeholder="Next action"
                className={`${inputClass} xl:min-w-56 xl:flex-1`}
              />
              <button
                disabled={!selected || !canManage || fieldPending}
                className="h-9 rounded-md border border-[#dfe4ea] bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {fieldPending ? "Saving..." : "Save changes"}
              </button>
            </form>

            <form action={reviewAction}>
              <input type="hidden" name="rfqId" value={selected?.id ?? ""} />
              <button
                disabled={
                  !selected ||
                  !canManage ||
                  reviewPending ||
                  selected.effectiveReviewStatus === "completed"
                }
                className="h-9 w-full rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto"
              >
                {reviewPending ? "Marking..." : "Mark reviewed"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-[#dfe4ea] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          <table className="w-full table-fixed divide-y divide-slate-200 text-sm max-xl:min-w-[1120px]">
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[130px]" />
              <col className="w-[90px]" />
              <col className="w-[130px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[180px]" />
            </colgroup>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                {["", "RFQ number", "Customer", "Subject", "Status", "Priority", "Assigned to", "Created", "Due", "Next action"].map((header) => (
                  <th key={header || "select"} className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((rfq) => {
                const customer = firstRelated(rfq.customers);
                const selectedRow = selected?.id === rfq.id;

                return (
                  <tr
                    key={rfq.id}
                    aria-selected={selectedRow}
                    onClick={() => setSelectedId(rfq.id)}
                    className={`cursor-pointer transition ${
                      selectedRow
                        ? "border-l-2 border-l-teal-500 bg-teal-50/60"
                        : "border-l-2 border-l-transparent hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="radio"
                        name="selectedRfq"
                        checked={selectedRow}
                        onChange={() => setSelectedId(rfq.id)}
                        aria-label={`Select ${rfq.rfq_number}`}
                        className="h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="truncate px-3 py-2.5 font-semibold text-teal-700">
                      <Link
                        href={`/rfqs/${rfq.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:text-teal-800"
                      >
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600">
                      {customer?.company_name ?? "No customer"}
                    </td>
                    <td className="truncate px-3 py-2.5 font-medium text-slate-950" title={rfq.subject}>
                      {rfq.subject}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(rfq.effectiveReviewStatus)}`}>
                        {labelizeReviewValue(rfq.effectiveReviewStatus)}
                      </span>
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600">
                      {labelizeReviewValue(rfq.effectivePriority)}
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600">
                      {shortUser(rfq.assigned_to)}
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600">
                      {formatDate(rfq.created_at)}
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600">
                      {formatDateTime(rfq.review_due_at)}
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-600" title={rfq.effectiveNextAction}>
                      {rfq.effectiveNextAction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
