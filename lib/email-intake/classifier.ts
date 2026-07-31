export type EmailClassification = "likely_rfq" | "not_rfq" | "needs_review";

const rfqKeywords = [
  "rfq",
  "request for quote",
  "request for quotation",
  "quote request",
  "quotation",
  "pricing",
  "price request",
  "bid",
  "tender",
  "proposal",
  "scope of work",
  "lead time",
  "delivery",
  "qty",
  "quantity",
];

const nonRfqKeywords = [
  "newsletter",
  "unsubscribe",
  "receipt",
  "invoice paid",
  "password reset",
  "marketing",
];

export function classifyEmailForRfq(subject: string, body: string): EmailClassification {
  const content = `${subject} ${body}`.toLowerCase();
  const rfqMatches = rfqKeywords.filter((keyword) => content.includes(keyword)).length;
  const nonRfqMatches = nonRfqKeywords.filter((keyword) => content.includes(keyword)).length;

  if (rfqMatches >= 2 || (rfqMatches >= 1 && nonRfqMatches === 0)) {
    return "likely_rfq";
  }

  if (nonRfqMatches > rfqMatches) {
    return "not_rfq";
  }

  return "needs_review";
}
