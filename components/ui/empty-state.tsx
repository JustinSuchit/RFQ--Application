import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: LucideIcon;
  marker?: string;
  tone?: "neutral" | "page";
};

export function EmptyState({
  title,
  description,
  action,
  className = "",
  icon: Icon,
  marker = "RFQ",
  tone = "page",
}: EmptyStateProps) {
  const iconClass =
    tone === "page"
      ? "border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]"
      : "bg-slate-100 text-slate-500";

  return (
    <div
      className={`flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center ${className}`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-semibold ${iconClass}`}>
        {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : marker}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
