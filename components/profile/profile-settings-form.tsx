"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  removeProfilePhotoAction,
  updateProfileAction,
  type ProfileActionState,
} from "@/app/(workspace)/profile/actions";

type ProfileSettingsFormProps = {
  displayName: string;
  jobTitle: string;
  phone: string;
  email: string;
  role: string;
  avatarPath: string;
  avatarUrl: string | null;
  initials: string;
};

const initialState: ProfileActionState = { error: "" };
const inputClass =
  "mt-2 h-10 w-full rounded-md border border-[#dfe4ea] bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export function ProfileSettingsForm({
  displayName,
  jobTitle,
  phone,
  email,
  role,
  avatarPath,
  avatarUrl,
  initials,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeProfilePhotoAction,
    initialState,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const shownAvatarUrl = previewUrl ?? avatarUrl;
  const message = state.error || state.success || removeState.error || removeState.success;
  const error = state.error || removeState.error;

  const helpText = useMemo(
    () => "JPG, PNG, or WebP. Maximum size 2 MB.",
    [],
  );

  useEffect(() => {
    if (state.success || removeState.success) {
      router.refresh();
    }
  }, [removeState.success, router, state.success]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form action={formAction} className="rounded-md border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <input type="hidden" name="previousAvatarPath" value={avatarPath} />
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Display name
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={displayName}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Job title
            <input
              name="jobTitle"
              maxLength={100}
              defaultValue={jobTitle}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Phone
            <input name="phone" maxLength={40} defaultValue={phone} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Profile photo
            <input
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:h-10 file:rounded-md file:border file:border-[#dfe4ea] file:bg-white file:px-3 file:text-sm file:font-semibold file:text-slate-700 hover:file:border-slate-300"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            <span className="mt-2 block text-xs font-medium text-slate-500">
              {helpText}
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input value={email} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Role
            <input value={role} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
          </label>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-[#dfe4ea] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Profile"}
          </button>
          {message ? (
            <p className={error ? "text-sm font-medium text-rose-700" : "text-sm font-medium text-teal-700"}>
              {message}
            </p>
          ) : null}
        </div>
      </form>

      <aside className="rounded-md border border-[#dfe4ea] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold text-slate-950">Profile preview</p>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-950 text-lg font-semibold text-white">
            {shownAvatarUrl ? (
              <Image
                src={shownAvatarUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{jobTitle || role}</p>
          </div>
        </div>
        {avatarPath ? (
          <form action={removeAction} className="mt-5">
            <input type="hidden" name="previousAvatarPath" value={avatarPath} />
            <button
              disabled={removePending}
              className="h-10 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removePending ? "Removing..." : "Remove Photo"}
            </button>
          </form>
        ) : null}
      </aside>
    </div>
  );
}
