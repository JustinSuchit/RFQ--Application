export type QuoteTotalsInput = {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  deliveryCharge: number;
};

export type QuoteTotals = {
  subtotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  deliveryCharge: number;
  total: number;
};

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyValue(value: number) {
  return Number.isFinite(value) ? roundCurrency(value) : 0;
}

export function calculateQuoteTotals({
  subtotal,
  discountAmount,
  taxRate,
  deliveryCharge,
}: QuoteTotalsInput): QuoteTotals {
  const safeSubtotal = Math.max(0, moneyValue(subtotal));
  const safeDiscount = Math.max(0, moneyValue(discountAmount));
  const safeDelivery = Math.max(0, moneyValue(deliveryCharge));
  const safeTaxRate = Number.isFinite(taxRate) ? taxRate : 0;
  const taxableSubtotal = Math.max(0, roundCurrency(safeSubtotal - safeDiscount));
  const taxAmount = roundCurrency(taxableSubtotal * (safeTaxRate / 100));
  const total = roundCurrency(taxableSubtotal + taxAmount + safeDelivery);

  return {
    subtotal: safeSubtotal,
    discountAmount: safeDiscount,
    taxableSubtotal,
    taxRate: safeTaxRate,
    taxAmount,
    deliveryCharge: safeDelivery,
    total,
  };
}

export function formatTaxRate(value: number | null | undefined): string {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate)) return "0%";

  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}
