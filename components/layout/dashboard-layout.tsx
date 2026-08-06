import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

type DashboardLayoutProps = {
  children: ReactNode;
  organizationName?: string | null;
};

export function DashboardLayout({
  children,
  organizationName,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav organizationName={organizationName} />
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
