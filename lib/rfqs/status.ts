export const RFQ_STATUSES = [
  "draft",
  "new",
  "in_review",
  "supplier_pricing",
  "awaiting_approval",
  "sent",
  "approved",
  "accepted",
  "declined",
  "rejected",
  "closed",
] as const;

export type RfqStatusValue = (typeof RFQ_STATUSES)[number];

export const RFQ_STATUS_FILTERS = [
  { label: "All", value: "all", dbValues: [] },
  { label: "New", value: "new", dbValues: ["new", "draft"] },
  { label: "In Review", value: "in_review", dbValues: ["in_review"] },
  {
    label: "Supplier Pricing",
    value: "supplier_pricing",
    dbValues: ["supplier_pricing"],
  },
  {
    label: "Awaiting Approval",
    value: "awaiting_approval",
    dbValues: ["awaiting_approval"],
  },
  { label: "Sent", value: "sent", dbValues: ["sent"] },
  { label: "Accepted", value: "accepted", dbValues: ["accepted", "approved"] },
  { label: "Declined", value: "declined", dbValues: ["declined", "rejected", "closed"] },
] as const;

export type RfqStatusFilterValue = (typeof RFQ_STATUS_FILTERS)[number]["value"];

export const RFQ_STATUS_FILTER_VALUES = new Set<string>(
  RFQ_STATUS_FILTERS.map((filter) => filter.value),
);

export const RFQ_STATUS_VALUES = new Set<string>(RFQ_STATUSES);

export function getRfqStatusFilter(value: string | null | undefined) {
  return (
    RFQ_STATUS_FILTERS.find((filter) => filter.value === value) ??
    RFQ_STATUS_FILTERS[0]
  );
}

export function labelizeRfqStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
