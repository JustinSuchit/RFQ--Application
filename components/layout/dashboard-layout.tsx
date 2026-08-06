import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import type { HeaderUserProfile } from "@/lib/user/profile";

type DashboardLayoutProps = {
  children: ReactNode;
  organizationName?: string | null;
  userProfile: HeaderUserProfile;
};

export function DashboardLayout({
  children,
  organizationName,
  userProfile,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav organizationName={organizationName} userProfile={userProfile} />
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
