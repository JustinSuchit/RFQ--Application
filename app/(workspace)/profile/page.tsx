import { UserCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";
import { pageThemeStyle } from "@/lib/page-themes";
import {
  ensureProfileForUser,
  fallbackDisplayName,
  initialsForName,
  roleLabel,
  signedAvatarUrl,
} from "@/lib/user/profile";

export default async function ProfilePage() {
  const user = await requireUser();
  const organization = await requireOrganization();
  const profile = await ensureProfileForUser(user);
  const displayName = profile.display_name?.trim() || fallbackDisplayName(user);
  const jobTitle = profile.job_title?.trim() ?? "";
  const role = roleLabel(organization.role);
  const avatarUrl = await signedAvatarUrl(profile.avatar_path);

  return (
    <div style={pageThemeStyle("settings")} className="page-accent-scope space-y-6">
      <PageHeader
        theme="settings"
        icon={UserCircle}
        eyebrow="Account settings"
        title="My Profile"
        description="Manage the name, photo, and contact details shown in your ProcureFlow workspace."
      />

      <ProfileSettingsForm
        displayName={displayName}
        jobTitle={jobTitle}
        phone={profile.phone ?? ""}
        email={user.email ?? ""}
        role={role}
        avatarPath={profile.avatar_path ?? ""}
        avatarUrl={avatarUrl}
        initials={initialsForName(displayName, user.email)}
      />
    </div>
  );
}
