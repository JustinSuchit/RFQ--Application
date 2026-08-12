"use client";

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTheme, type ThemePreference } from "@/components/theme/theme-provider";

const themeOptions: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Follow device appearance",
    icon: Monitor,
  },
  {
    value: "light",
    label: "Light",
    description: "Always use light mode",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use dark mode",
    icon: Moon,
  },
];

export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const CurrentIcon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Appearance: ${theme}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Theme: ${theme}`}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-slate-600 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      >
        <CurrentIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-elevated)]"
        >
          <p className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            Appearance
          </p>
          <div className="space-y-1">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setTheme(option.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-950">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.description}</span>
                  </span>
                  {active ? (
                    <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
