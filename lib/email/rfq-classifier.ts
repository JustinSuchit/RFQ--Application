export type RfqClassification = "likely_rfq" | "possible_rfq" | "not_rfq";

export type RfqClassificationResult = {
  classification: RfqClassification;
  matchedKeywords: string[];
  reason: string;
};

const keywords = [
  "rfq",
  "request for quotation",
  "quotation request",
  "quote request",
  "tender",
  "bid",
  "pricing request",
  "supply and delivery",
  "estimate",
  "proposal",
  "jobsite",
  "site visit",
  "purchase request",
];

const strongSubjectKeywords = [
  "rfq",
  "tender",
  "quotation",
  "quote request",
  "pricing request",
];

function uniqueMatches(content: string) {
  return keywords.filter((keyword) => content.includes(keyword));
}

export function classifyRfqEmail(
  subject: string,
  bodyPreview: string,
): RfqClassificationResult {
  const normalizedSubject = subject.toLowerCase();
  const normalizedBody = bodyPreview.toLowerCase();
  const subjectMatches = uniqueMatches(normalizedSubject);
  const bodyMatches = uniqueMatches(normalizedBody);
  const matchedKeywords = Array.from(new Set([...subjectMatches, ...bodyMatches]));
  const hasStrongSubjectMatch = strongSubjectKeywords.some((keyword) =>
    normalizedSubject.includes(keyword),
  );

  if (hasStrongSubjectMatch) {
    return {
      classification: "likely_rfq",
      matchedKeywords,
      reason: "Subject contains a strong RFQ keyword.",
    };
  }

  if (bodyMatches.length >= 2) {
    return {
      classification: "likely_rfq",
      matchedKeywords,
      reason: "Body preview contains multiple RFQ keywords.",
    };
  }

  if (bodyMatches.length === 1 || subjectMatches.length === 1) {
    return {
      classification: "possible_rfq",
      matchedKeywords,
      reason: "Message contains one RFQ keyword.",
    };
  }

  return {
    classification: "not_rfq",
    matchedKeywords,
    reason: "No RFQ keywords were detected.",
  };
}
