import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { pageThemes, pageThemeStyle, type PageThemeKey } from "@/lib/page-themes";

type PageHeaderProps = {
  theme: PageThemeKey;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  theme,
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  children,
}: PageHeaderProps) {
  const resolvedTheme = pageThemes[theme];

  return (
    <div style={pageThemeStyle(resolvedTheme)} className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-[var(--page-accent-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--page-accent-border)] bg-[var(--page-accent-soft)] text-[var(--page-accent)]">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--page-accent)]">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
