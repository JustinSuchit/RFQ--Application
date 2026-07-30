"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createApprovalRuleAction,
  toggleApprovalRuleAction,
  type ApprovalRuleActionState,
} from "@/app/(workspace)/settings/actions";
import { EmptyState } from "@/components/ui/empty-state";

export type ApprovalRule = {
  id: string;
  name: string;
  rule_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  approver_role: string;
  is_active: boolean;
  created_at: string;
};

const initialState: ApprovalRuleActionState = {
  error: "",
  success: "",
};

type ApprovalRulesManagerProps = {
  rules: ApprovalRule[];
  canManage: boolean;
};

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function ToggleApprovalRuleButton({ rule }: { rule: ApprovalRule }) {
  const [state, formAction, pending] = useActionState(
    toggleApprovalRuleAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="ruleId" value={rule.id} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Updating..."
          : rule.is_active
            ? "Deactivate"
            : "Activate"}
      </button>
      {state.error ? (
        <p className="text-xs font-medium text-rose-600">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-xs font-medium text-teal-700">{state.success}</p>
      ) : null}
    </form>
  );
}

export function ApprovalRulesManager({
  rules,
  canManage,
}: ApprovalRulesManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createApprovalRuleAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="space-y-6">
      {canManage ? (
        <form
          ref={formRef}
          action={formAction}
          className="rounded-md border border-slate-200 bg-slate-50 p-5"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Rule name</span>
              <input
                required
                name="name"
                type="text"
                placeholder="Owner approval above 1000"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Rule type</span>
              <select
                name="ruleType"
                defaultValue="quote_total"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              >
                <option value="quote_total">Quote total</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Condition field</span>
              <select
                name="conditionField"
                defaultValue="total"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              >
                <option value="total">Total</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Condition operator</span>
              <select
                name="conditionOperator"
                defaultValue="greater_than"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              >
                <option value="greater_than">Greater than</option>
                <option value="greater_than_or_equal">
                  Greater than or equal
                </option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Condition value</span>
              <input
                required
                name="conditionValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="1000"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Approver role</span>
              <select
                name="approverRole"
                defaultValue="owner"
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="finance">Finance</option>
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Is active</span>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating..." : "Create Approval Rule"}
            </button>
            {state.error ? (
              <p className="text-sm font-medium text-rose-600">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="text-sm font-medium text-teal-700">
                {state.success}
              </p>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Only organization admins can manage approval rules.
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">
            Existing rules
          </h3>
        </div>
        {rules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Rule name</th>
                  <th className="px-5 py-3">Rule type</th>
                  <th className="px-5 py-3">Condition</th>
                  <th className="px-5 py-3">Approver role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  {canManage ? <th className="px-5 py-3">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950">
                      {rule.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {labelize(rule.rule_type)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {`${rule.condition_field} ${rule.condition_operator} ${rule.condition_value}`}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {labelize(rule.approver_role)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          rule.is_active
                            ? "rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200"
                            : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                        }
                      >
                        {rule.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(rule.created_at)}
                    </td>
                    {canManage ? (
                      <td className="px-5 py-4">
                        <ToggleApprovalRuleButton rule={rule} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No approval rules yet"
            description="Create a rule to require approval before certain quotes can be sent."
          />
        )}
      </div>
    </div>
  );
}
