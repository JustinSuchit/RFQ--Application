import { labelizeRfqStatus } from "@/lib/rfqs/status";

type StatusTone = "neutral" | "processing" | "attention" | "success" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200 before:bg-slate-400",
  processing: "bg-cyan-50 text-cyan-800 ring-cyan-200 before:bg-cyan-500",
  attention: "bg-amber-50 text-amber-800 ring-amber-200 before:bg-amber-500",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200 before:bg-emerald-500",
  danger: "bg-rose-50 text-rose-800 ring-rose-200 before:bg-rose-500",
};

export function statusTone(status: string): StatusTone {
  if (["accepted", "approved", "won", "completed", "success", "healthy"].includes(status)) {
    return "success";
  }

  if (["awaiting_approval", "pending", "warning"].includes(status)) {
    return "attention";
  }

  if (["declined", "rejected", "lost", "failed", "cancelled"].includes(status)) {
    return "danger";
  }

  if (["sent", "running", "processing"].includes(status)) {
    return "processing";
  }

  return "neutral";
}

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  const normalized = String(status || "draft");

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset before:h-1.5 before:w-1.5 before:rounded-full ${toneClasses[statusTone(normalized)]} ${className}`}
    >
      {label ?? labelizeRfqStatus(normalized)}
    </span>
  );
}
