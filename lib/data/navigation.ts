import type { NavigationItem } from "@/lib/types/navigation";

export const sidebarNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", symbol: "D" },
  { label: "RFQs", href: "/rfqs", symbol: "R" },
  { label: "Customers", href: "/customers", symbol: "C" },
  { label: "Suppliers", href: "/suppliers", symbol: "S" },
  { label: "Quotes", href: "/quotes", symbol: "Q" },
  { label: "Approvals", href: "/approvals", symbol: "A" },
  { label: "Settings", href: "/settings", symbol: "T" },
];
