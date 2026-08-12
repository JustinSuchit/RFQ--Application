import type { CSSProperties } from "react";

export type PageThemeKey =
  | "dashboard"
  | "rfqs"
  | "reviewQueue"
  | "emailIntake"
  | "quotes"
  | "approvals"
  | "customers"
  | "suppliers"
  | "integrations"
  | "settings";

export type PageTheme = {
  key: PageThemeKey;
  accent: string;
  soft: string;
  border: string;
  hover: string;
  ring: string;
  darkAccent: string;
  darkSoft: string;
  darkBorder: string;
  darkHover: string;
  darkRing: string;
};

export const pageThemes: Record<PageThemeKey, PageTheme> = {
  dashboard: {
    key: "dashboard",
    accent: "#0F766E",
    soft: "#F0FDFA",
    border: "#CCFBF1",
    hover: "#F0FDFA",
    ring: "rgba(15, 118, 110, 0.18)",
    darkAccent: "#2DD4BF",
    darkSoft: "rgba(15, 118, 110, 0.18)",
    darkBorder: "rgba(45, 212, 191, 0.28)",
    darkHover: "rgba(15, 118, 110, 0.12)",
    darkRing: "rgba(45, 212, 191, 0.22)",
  },
  rfqs: {
    key: "rfqs",
    accent: "#2563EB",
    soft: "#EFF6FF",
    border: "#BFDBFE",
    hover: "#F8FBFF",
    ring: "rgba(37, 99, 235, 0.16)",
    darkAccent: "#60A5FA",
    darkSoft: "rgba(37, 99, 235, 0.16)",
    darkBorder: "rgba(96, 165, 250, 0.28)",
    darkHover: "rgba(37, 99, 235, 0.10)",
    darkRing: "rgba(96, 165, 250, 0.22)",
  },
  reviewQueue: {
    key: "reviewQueue",
    accent: "#D97706",
    soft: "#FFFBEB",
    border: "#FDE68A",
    hover: "#FFFDF5",
    ring: "rgba(217, 119, 6, 0.18)",
    darkAccent: "#FBBF24",
    darkSoft: "rgba(217, 119, 6, 0.16)",
    darkBorder: "rgba(251, 191, 36, 0.28)",
    darkHover: "rgba(217, 119, 6, 0.10)",
    darkRing: "rgba(251, 191, 36, 0.22)",
  },
  emailIntake: {
    key: "emailIntake",
    accent: "#0284C7",
    soft: "#F0F9FF",
    border: "#BAE6FD",
    hover: "#F7FCFF",
    ring: "rgba(2, 132, 199, 0.16)",
    darkAccent: "#38BDF8",
    darkSoft: "rgba(2, 132, 199, 0.16)",
    darkBorder: "rgba(56, 189, 248, 0.28)",
    darkHover: "rgba(2, 132, 199, 0.10)",
    darkRing: "rgba(56, 189, 248, 0.22)",
  },
  quotes: {
    key: "quotes",
    accent: "#7C3AED",
    soft: "#F5F3FF",
    border: "#DDD6FE",
    hover: "#FAF9FF",
    ring: "rgba(124, 58, 237, 0.16)",
    darkAccent: "#A78BFA",
    darkSoft: "rgba(124, 58, 237, 0.16)",
    darkBorder: "rgba(167, 139, 250, 0.28)",
    darkHover: "rgba(124, 58, 237, 0.10)",
    darkRing: "rgba(167, 139, 250, 0.22)",
  },
  approvals: {
    key: "approvals",
    accent: "#059669",
    soft: "#ECFDF5",
    border: "#A7F3D0",
    hover: "#F6FEFA",
    ring: "rgba(5, 150, 105, 0.16)",
    darkAccent: "#34D399",
    darkSoft: "rgba(5, 150, 105, 0.16)",
    darkBorder: "rgba(52, 211, 153, 0.28)",
    darkHover: "rgba(5, 150, 105, 0.10)",
    darkRing: "rgba(52, 211, 153, 0.22)",
  },
  customers: {
    key: "customers",
    accent: "#4F46E5",
    soft: "#EEF2FF",
    border: "#C7D2FE",
    hover: "#F8FAFF",
    ring: "rgba(79, 70, 229, 0.16)",
    darkAccent: "#818CF8",
    darkSoft: "rgba(79, 70, 229, 0.16)",
    darkBorder: "rgba(129, 140, 248, 0.28)",
    darkHover: "rgba(79, 70, 229, 0.10)",
    darkRing: "rgba(129, 140, 248, 0.22)",
  },
  suppliers: {
    key: "suppliers",
    accent: "#0891B2",
    soft: "#ECFEFF",
    border: "#A5F3FC",
    hover: "#F6FEFF",
    ring: "rgba(8, 145, 178, 0.16)",
    darkAccent: "#22D3EE",
    darkSoft: "rgba(8, 145, 178, 0.16)",
    darkBorder: "rgba(34, 211, 238, 0.28)",
    darkHover: "rgba(8, 145, 178, 0.10)",
    darkRing: "rgba(34, 211, 238, 0.22)",
  },
  integrations: {
    key: "integrations",
    accent: "#475569",
    soft: "#F8FAFC",
    border: "#CBD5E1",
    hover: "#F8FAFC",
    ring: "rgba(71, 85, 105, 0.16)",
    darkAccent: "#CBD5E1",
    darkSoft: "rgba(148, 163, 184, 0.12)",
    darkBorder: "rgba(148, 163, 184, 0.24)",
    darkHover: "rgba(148, 163, 184, 0.10)",
    darkRing: "rgba(148, 163, 184, 0.20)",
  },
  settings: {
    key: "settings",
    accent: "#64748B",
    soft: "#F8FAFC",
    border: "#CBD5E1",
    hover: "#F8FAFC",
    ring: "rgba(100, 116, 139, 0.16)",
    darkAccent: "#CBD5E1",
    darkSoft: "rgba(148, 163, 184, 0.12)",
    darkBorder: "rgba(148, 163, 184, 0.24)",
    darkHover: "rgba(148, 163, 184, 0.10)",
    darkRing: "rgba(148, 163, 184, 0.20)",
  },
};

export function pageThemeStyle(theme: PageTheme | PageThemeKey): CSSProperties {
  const resolved = typeof theme === "string" ? pageThemes[theme] : theme;

  return {
    "--page-accent": `light-dark(${resolved.accent}, ${resolved.darkAccent})`,
    "--page-accent-soft": `light-dark(${resolved.soft}, ${resolved.darkSoft})`,
    "--page-accent-border": `light-dark(${resolved.border}, ${resolved.darkBorder})`,
    "--page-accent-hover": `light-dark(${resolved.hover}, ${resolved.darkHover})`,
    "--page-accent-ring": `light-dark(${resolved.ring}, ${resolved.darkRing})`,
  } as CSSProperties;
}

export function themeForPath(pathname: string): PageTheme {
  if (pathname === "/dashboard" || pathname === "/") return pageThemes.dashboard;
  if (pathname.startsWith("/review-queue")) return pageThemes.reviewQueue;
  if (pathname.startsWith("/email-intake")) return pageThemes.emailIntake;
  if (pathname.startsWith("/quotes")) return pageThemes.quotes;
  if (pathname.startsWith("/approvals")) return pageThemes.approvals;
  if (pathname.startsWith("/customers")) return pageThemes.customers;
  if (pathname.startsWith("/suppliers")) return pageThemes.suppliers;
  if (pathname.startsWith("/settings/email")) return pageThemes.integrations;
  if (pathname.startsWith("/settings")) return pageThemes.settings;
  if (pathname.startsWith("/rfqs")) return pageThemes.rfqs;
  return pageThemes.dashboard;
}
