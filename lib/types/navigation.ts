export type NavigationItem = {
  label: string;
  href: string;
  symbol: string;
  section?: "Workspace" | "Procurement" | "Directory" | "System";
  theme?: import("@/lib/page-themes").PageThemeKey;
};
