"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountMenuProps = {
  displayName: string;
  subtitle: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
};

export function AccountMenu({
  displayName,
  subtitle,
  email,
  initials,
  avatarUrl,
}: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[260px] items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-100"
      >
        <span className="hidden min-w-0 text-right sm:block">
          <span className="block truncate text-sm font-semibold text-slate-950">
            {displayName}
          </span>
          <span className="block truncate text-xs text-slate-500">{subtitle}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-950 text-sm font-semibold text-white">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-md border border-[#dfe4ea] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            className="mt-2 block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
            onClick={() => setOpen(false)}
          >
            Account Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={loading}
            onClick={signOut}
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
