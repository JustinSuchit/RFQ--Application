import Link from "next/link";
import type { ReactNode } from "react";

type KpiItem = {
  label: string;
  value: string;
  href?: string;
  helper?: string;
  indicator?: "neutral" | "teal" | "blue" | "amber" | "green" | "purple";
};

function KpiContent({ item }: { item: KpiItem }) {
  const indicatorClass = {
    neutral: "bg-slate-300",
    teal: "bg-teal-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    green: "bg-emerald-600",
    purple: "bg-violet-600",
  }[item.indicator ?? "neutral"];

  return (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${indicatorClass}`} />
        {item.label}
      </span>
      <span className="mt-1 block text-2xl font-semibold leading-none text-slate-950">
        {item.value}
      </span>
      {item.helper ? (
        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.helper}</span>
      ) : null}
    </>
  );
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white">
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {items.map((item) => {
          const className =
            "block min-h-24 px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

          return item.href ? (
            <Link key={item.label} href={item.href} className={className} aria-label={`${item.label}: ${item.value}`}>
              <KpiContent item={item} />
            </Link>
          ) : (
            <div key={item.label} className={className as string}>
              <KpiContent item={item} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between border-b border-slate-200 px-4 py-3">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {action}
    </div>
  );
}
