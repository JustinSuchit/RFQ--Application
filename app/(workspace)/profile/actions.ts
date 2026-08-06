"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { avatarBucket } from "@/lib/user/profile";

export type ProfileActionState = {
  error: string;
  success?: string;
};

const maxAvatarSize = 2 * 1024 * 1024;
const supportedAvatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").replace(/\s+/g, " ").trim();
}

function validateProfile(displayName: string, jobTitle: string, phone: string) {
  if (displayName.length < 2) return "Display name is required.";
  if (displayName.length > 80) return "Display name must be 80 characters or fewer.";
  if (jobTitle.length > 100) return "Job title must be 100 characters or fewer.";
  if (phone.length > 40) return "Phone must be 40 characters or fewer.";
  return "";
}

async function uploadAvatar({
  userId,
  file,
  previousPath,
}: {
  userId: string;
  file: File;
  previousPath: string;
}) {
  if (file.size > maxAvatarSize) {
    return { error: "Profile image is too large. Maximum size is 2 MB." };
  }

  const extension = supportedAvatarTypes.get(file.type);
  if (!extension) {
    return { error: "Unsupported image format. Upload JPG, PNG, or WebP." };
  }

  const supabase = await createClient();
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(avatarBucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  if (previousPath) {
    await supabase.storage.from(avatarBucket).remove([previousPath]);
  }

  return { path };
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  const displayName = textValue(formData, "displayName");
  const jobTitle = textValue(formData, "jobTitle");
  const phone = textValue(formData, "phone");
  const previousAvatarPath = textValue(formData, "previousAvatarPath");
  const validationError = validateProfile(displayName, jobTitle, phone);

  if (validationError) return { error: validationError };

  const avatar = formData.get("avatar");
  let avatarPath: string | null = previousAvatarPath || null;

  if (avatar instanceof File && avatar.size > 0) {
    const uploaded = await uploadAvatar({
      userId: user.id,
      file: avatar,
      previousPath: previousAvatarPath,
    });

    if (uploaded.error) return { error: uploaded.error };
    avatarPath = uploaded.path ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      avatar_path: avatarPath,
      job_title: jobTitle || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: `Profile update failed: ${error.message}` };

  revalidatePath("/", "layout");
  revalidatePath("/profile");

  return { error: "", success: "Profile saved." };
}

export async function removeProfilePhotoAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  const previousAvatarPath = textValue(formData, "previousAvatarPath");
  const supabase = await createClient();

  if (previousAvatarPath) {
    const { error: removeError } = await supabase.storage
      .from(avatarBucket)
      .remove([previousAvatarPath]);

    if (removeError) return { error: removeError.message };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      avatar_path: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: `Profile update failed: ${error.message}` };

  revalidatePath("/", "layout");
  revalidatePath("/profile");

  return { error: "", success: "Profile photo removed." };
}
