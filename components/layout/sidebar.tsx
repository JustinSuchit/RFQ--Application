"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BellCheck,
  Building2,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { sidebarNavigation } from "@/lib/data/navigation";

const navigationIcons: Record<string, LucideIcon> = {
  Dashboard: BarChart3,
  "Review Queue": BellCheck,
  RFQs: FileText,
  "Email Intake": Inbox,
  Customers: Building2,
  Suppliers: Users,
  Quotes: Mail,
  Approvals: CheckCircle2,
  Integrations: ShieldCheck,
  Settings,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#dfe4ea] bg-white lg:flex lg:flex-col">
      <div className="border-b border-[#dfe4ea] px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-600 text-[11px] font-bold text-white">
            RFQ
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">ProcureFlow</p>
            <p className="text-xs text-slate-500">Procurement workspace</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-3 py-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Workspace
        </p>
        <nav className="mt-2 space-y-0.5">
          {sidebarNavigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
            const Icon = navigationIcons[item.label] ?? FileText;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-100 ${
                  active
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-sm ${
                    active
                      ? "text-teal-700"
                      : "text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-[#dfe4ea] p-3">
        <div className="rounded-md bg-slate-50 p-3">
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
