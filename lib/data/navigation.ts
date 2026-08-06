import type { NavigationItem } from "@/lib/types/navigation";

export const sidebarNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", symbol: "D" },
  { label: "Review Queue", href: "/review-queue", symbol: "V" },
  { label: "RFQs", href: "/rfqs", symbol: "R" },
  { label: "Email Intake", href: "/email-intake", symbol: "E" },
  { label: "Customers", href: "/customers", symbol: "C" },
  { label: "Suppliers", href: "/suppliers", symbol: "S" },
  { label: "Quotes", href: "/quotes", symbol: "Q" },
  { label: "Approvals", href: "/approvals", symbol: "A" },
  { label: "Integrations", href: "/settings/email", symbol: "I" },
  { label: "Settings", href: "/settings", symbol: "T" },
];
