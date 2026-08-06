"use client";

import { useActionState } from "react";
import {
  clearStaleScanLockAction,
  runMonitoringScanAction,
  testMonitoringConnectionAction,
  type ScanMonitoringState,
} from "@/app/(workspace)/settings/email/monitoring/actions";

const initialState: ScanMonitoringState = { error: "" };

function StatusMessage({ state }: { state: ScanMonitoringState }) {
  if (state.error) return <p className="text-sm font-medium text-rose-600">{state.error}</p>;
  if (state.success) return <p className="text-sm font-medium text-teal-700">{state.success}</p>;
  return null;
}

export function ScanMonitoringActions({ canClearLock }: { canClearLock: boolean }) {
  const [scanState, scanAction, scanPending] = useActionState(runMonitoringScanAction, initialState);
  const [testState, testAction, testPending] = useActionState(testMonitoringConnectionAction, initialState);
  const [clearState, clearAction, clearPending] = useActionState(clearStaleScanLockAction, initialState);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={scanAction}>
          <button
            disabled={scanPending}
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {scanPending ? "Scanning..." : "Run Scan Now"}
          </button>
        </form>
        <form action={testAction}>
          <button
            disabled={testPending}
            className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
          >
            {testPending ? "Testing..." : "Test Connection"}
          </button>
        </form>
        <a
          href="/settings/email/monitoring"
          className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
        >
          Refresh status
        </a>
        {canClearLock ? (
          <form action={clearAction}>
            <button
              disabled={clearPending}
              className="h-10 rounded-md border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 shadow-sm hover:border-amber-300 disabled:opacity-60"
            >
              Clear stale lock
            </button>
          </form>
        ) : null}
      </div>
      <StatusMessage state={scanState.error || scanState.success ? scanState : testState.error || testState.success ? testState : clearState} />
    </div>
  );
}
