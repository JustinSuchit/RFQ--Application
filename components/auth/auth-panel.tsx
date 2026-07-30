import type { ReactNode } from "react";
import Link from "next/link";

type AuthPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footerLabel: string;
  footerHref: string;
  footerText: string;
};

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footerLabel,
  footerHref,
  footerText,
}: AuthPanelProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-teal-700">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-slate-600">
          {footerText}{" "}
          <Link href={footerHref} className="font-semibold text-teal-700">
            {footerLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
