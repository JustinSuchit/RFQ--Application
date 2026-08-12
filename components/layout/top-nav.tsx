"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { sidebarNavigation } from "@/lib/data/navigation";
import { pageThemes, pageThemeStyle, themeForPath } from "@/lib/page-themes";
import type { HeaderUserProfile } from "@/lib/user/profile";
import { usePathname } from "next/navigation";

type TopNavProps = {
  organizationName?: string | null;
  userProfile: HeaderUserProfile;
};

export function TopNav({ organizationName, userProfile }: TopNavProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const activeTheme = themeForPath(pathname);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header style={pageThemeStyle(activeTheme)} className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--topbar-bg)] backdrop-blur">
      <div className="flex min-h-14 flex-col gap-2 px-4 py-2.5 sm:px-6 xl:flex-row xl:items-center xl:justify-between lg:px-7 2xl:px-9">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <button className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-left transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">
            <p className="text-[11px] font-medium text-slate-500">Organization</p>
            <p className="text-sm font-semibold text-slate-950">
              {organizationName ?? "No organization selected"}
            </p>
          </button>
          <label className="relative min-w-56 flex-1 sm:max-w-md">
            <span className="sr-only">Search workspace</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search RFQs, customers, suppliers..."
              className="accent-input h-9 w-full rounded-md bg-slate-50 pl-9 pr-16 text-sm placeholder:text-slate-400 focus:bg-white"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:block">
              Ctrl K
            </span>
          </label>
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {sidebarNavigation.map((item) => (
              (() => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
                const theme = pageThemes[item.theme ?? "dashboard"];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={active ? pageThemeStyle(theme) : undefined}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
                      active
                        ? "bg-[var(--page-accent-soft)] text-[var(--page-accent)]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })()
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <NotificationBell />
          <ThemeMenu />
          <AccountMenu {...userProfile} />
        </div>
      </div>
    </header>
  );
}
