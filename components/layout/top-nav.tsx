import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { sidebarNavigation } from "@/lib/data/navigation";

type TopNavProps = {
  organizationName?: string | null;
};

export function TopNav({ organizationName }: TopNavProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between lg:px-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300">
            <p className="text-xs font-medium text-slate-500">Organization</p>
            <p className="text-sm font-semibold text-slate-950">
              {organizationName ?? "No organization selected"}
            </p>
          </button>
          <label className="relative min-w-56 flex-1 sm:max-w-md">
            <span className="sr-only">Search workspace</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              /
            </span>
            <input
              type="search"
              placeholder="Search RFQs, customers, suppliers..."
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {sidebarNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <button
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
          >
            !
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-500" />
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-950">Platform user</p>
            <p className="text-xs text-slate-500">Workspace admin</p>
          </div>
          <button
            aria-label="Open user menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white"
          >
            U
          </button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
