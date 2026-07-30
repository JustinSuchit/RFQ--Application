import type { RfqStatus } from "@/lib/types/mvp";

export const rfqStatusTabs: ("All" | RfqStatus)[] = [
  "All",
  "New",
  "In Review",
  "Supplier Pricing",
  "Awaiting Approval",
  "Sent",
  "Accepted",
  "Declined",
];

export const dashboardMetrics = [
  { label: "Total RFQs", value: "0", helper: "All workspace records" },
  { label: "Open RFQs", value: "0", helper: "Currently in progress" },
  { label: "Awaiting supplier quotes", value: "0", helper: "Pricing due soon" },
  { label: "Awaiting approval", value: "0", helper: "Ready for buyer review" },
  { label: "Quote value this month", value: "$0", helper: "Submitted quotes" },
  { label: "Win rate", value: "0%", helper: "Conversion trend" },
];

export const settingsSections = [
  "Organization profile",
  "Branding",
  "Currency and tax",
  "RFQ numbering",
  "Approval rules",
  "Email templates",
  "User roles",
  "Integrations",
];
