"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarNavigation } from "@/lib/data/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
            RFQ
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">ProcureFlow</p>
            <p className="text-xs text-slate-500">RFQ SaaS platform</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-4 py-5">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Workspace
        </p>
        <nav className="mt-3 space-y-1">
          {sidebarNavigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold ${
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.symbol}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            Current workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Review RFQs, suppliers, quotes, and customer activity from one
            shared operating view.
          </p>
        </div>
      </div>
    </aside>
  );
}
