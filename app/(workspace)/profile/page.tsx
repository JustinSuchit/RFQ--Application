import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { requireOrganization, requireUser } from "@/lib/auth/session";
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
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Account settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          My Profile
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Manage the name, photo, and contact details shown in your ProcureFlow
          workspace.
        </p>
      </div>

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
