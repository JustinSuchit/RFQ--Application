import { RFQ_STATUS_FILTERS } from "@/lib/rfqs/status";

export const rfqStatusTabs = RFQ_STATUS_FILTERS.map((filter) => filter.label);

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
