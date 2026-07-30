import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { requireOrganization } from "@/lib/auth/session";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const organization = await requireOrganization();

  return (
    <DashboardLayout organizationName={organization.name}>
      {children}
    </DashboardLayout>
  );
}
