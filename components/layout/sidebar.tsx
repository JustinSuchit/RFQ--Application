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
import { pageThemes, pageThemeStyle } from "@/lib/page-themes";

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

type SidebarProps = {
  organizationName?: string | null;
};

export function Sidebar({ organizationName }: SidebarProps) {
  const pathname = usePathname();
  const sections = ["Workspace", "Procurement", "Directory", "System"] as const;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] lg:flex lg:flex-col">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary)] text-[11px] font-bold text-white">
            RFQ
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">ProcurementFlow</p>
            <p className="text-xs text-slate-500">Procurement workspace</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4" aria-label="Main navigation">
        {sections.map((section) => {
          const items = sidebarNavigation.filter((item) => item.section === section);

          return (
            <div key={section}>
              <p className="px-2 text-[11px] font-semibold uppercase text-slate-400">
                {section}
              </p>
              <div className="mt-1 space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
                  const Icon = navigationIcons[item.label] ?? FileText;
                  const theme = pageThemes[item.theme ?? "dashboard"];

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      style={active ? pageThemeStyle(theme) : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
                        active
                          ? "bg-[var(--page-accent-soft)] text-slate-950"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--page-accent)]" />
                      ) : null}
                      <span className={active ? "text-[var(--page-accent)]" : "text-slate-400 group-hover:text-slate-500"}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Organization</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
            {organizationName ?? "No organization selected"}
          </p>
        </div>
      </div>
    </aside>
  );
}
