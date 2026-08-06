import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import {
  fallbackDisplayName,
  getProfileForUser,
  initialsForName,
  roleLabel,
  signedAvatarUrl,
} from "@/lib/user/profile";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireUser();
  const organization = await requireOrganization();
  const profile = await getProfileForUser(user.id);
  const displayName = profile?.display_name?.trim() || fallbackDisplayName(user);
  const subtitle = profile?.job_title?.trim() || roleLabel(organization.role);
  const avatarUrl = await signedAvatarUrl(profile?.avatar_path);

  return (
    <DashboardLayout
      organizationName={organization.name}
      userProfile={{
        displayName,
        subtitle,
        email: user.email ?? "",
        initials: initialsForName(displayName, user.email),
        avatarUrl,
      }}
    >
      {children}
    </DashboardLayout>
  );
}
