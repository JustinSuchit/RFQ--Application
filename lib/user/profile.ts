import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  job_title: string | null;
  phone: string | null;
  created_at?: string;
  updated_at?: string;
};

export type HeaderUserProfile = {
  displayName: string;
  subtitle: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
};

export const avatarBucket = "user-avatars";

export function fallbackDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const metadataName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
  const emailPrefix = user.email?.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  return (metadataName || emailPrefix || "User").trim();
}

export function initialsForName(name: string, email?: string | null) {
  const source = name.trim() || email?.split("@")[0] || "User";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function roleLabel(role: string) {
  if (role === "admin") return "Workspace admin";
  if (role === "owner") return "Workspace owner";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getProfileForUser(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, job_title, phone, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Profile lookup failed", error.message);
    return null;
  }

  return (data ?? null) as UserProfile | null;
}

export async function ensureProfileForUser(user: User) {
  const existing = await getProfileForUser(user.id);
  if (existing) return existing;

  const supabase = await createClient();
  const displayName = fallbackDisplayName(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, display_name, avatar_path, job_title, phone, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.warn("Initial profile creation failed", error.message);
    return {
      id: user.id,
      display_name: displayName,
      avatar_path: null,
      job_title: null,
      phone: null,
    };
  }

  return data as UserProfile;
}

export async function signedAvatarUrl(path: string | null | undefined) {
  if (!path) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(avatarBucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.warn("Avatar signed URL failed", error.message);
    return null;
  }

  return data.signedUrl;
}
