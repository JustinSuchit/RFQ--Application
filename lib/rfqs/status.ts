export const RFQ_STATUSES = [
  "draft",
  "awaiting_approval",
  "accepted",
  "declined",
  "closed",
  "cancelled",
] as const;

export type RfqStatusValue = (typeof RFQ_STATUSES)[number];

export const RFQ_STATUS_FILTERS = [
  { label: "All", value: "all", dbValues: [] },
  { label: "Draft", value: "draft", dbValues: ["draft"] },
  {
    label: "Awaiting Approval",
    value: "awaiting_approval",
    dbValues: ["awaiting_approval"],
  },
  { label: "Accepted", value: "accepted", dbValues: ["accepted"] },
  { label: "Declined", value: "declined", dbValues: ["declined"] },
  { label: "Closed", value: "closed", dbValues: ["closed"] },
  { label: "Cancelled", value: "cancelled", dbValues: ["cancelled"] },
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
