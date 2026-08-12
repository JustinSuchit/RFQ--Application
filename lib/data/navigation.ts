import type { NavigationItem } from "@/lib/types/navigation";

export const sidebarNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", symbol: "D", section: "Workspace", theme: "dashboard" },
  { label: "RFQs", href: "/rfqs", symbol: "R", section: "Procurement", theme: "rfqs" },
  { label: "Review Queue", href: "/review-queue", symbol: "V", section: "Procurement", theme: "reviewQueue" },
  { label: "Email Intake", href: "/email-intake", symbol: "E", section: "Procurement", theme: "emailIntake" },
  { label: "Quotes", href: "/quotes", symbol: "Q", section: "Procurement", theme: "quotes" },
  { label: "Approvals", href: "/approvals", symbol: "A", section: "Procurement", theme: "approvals" },
  { label: "Customers", href: "/customers", symbol: "C", section: "Directory", theme: "customers" },
  { label: "Suppliers", href: "/suppliers", symbol: "S", section: "Directory", theme: "suppliers" },
  { label: "Integrations", href: "/settings/email", symbol: "I", section: "System", theme: "integrations" },
  { label: "Settings", href: "/settings", symbol: "T", section: "System", theme: "settings" },
];
