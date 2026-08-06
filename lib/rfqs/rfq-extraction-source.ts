export type LinkedEmailExtractionSource = {
  body_text: string | null;
  body_html: string | null;
  body_preview: string | null;
};

export type RfqExtractionSource = {
  sourceText: string;
  sourceUsed: "email_body_text" | "email_body_html" | "email_body_preview" | "rfq_notes";
  sourceCharacterCount: number;
  lineCount: number;
};

export function htmlToSafeText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countNonEmptyLines(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function selectRfqExtractionSource({
  linkedEmails,
  rfqNotes,
}: {
  linkedEmails: LinkedEmailExtractionSource[];
  rfqNotes: string | null;
}): RfqExtractionSource {
  const bodyText = linkedEmails
    .map((email) => email.body_text?.trim() ?? "")
    .find(Boolean);
  const bodyHtmlText = linkedEmails
    .map((email) => (email.body_html ? htmlToSafeText(email.body_html) : ""))
    .find(Boolean);
  const bodyPreview = linkedEmails
    .map((email) => email.body_preview?.trim() ?? "")
    .find(Boolean);
  const sourceText = bodyText || bodyHtmlText || bodyPreview || rfqNotes || "";
  const sourceUsed = bodyText
    ? "email_body_text"
    : bodyHtmlText
      ? "email_body_html"
      : bodyPreview
        ? "email_body_preview"
        : "rfq_notes";

  return {
    sourceText,
    sourceUsed,
    sourceCharacterCount: sourceText.length,
    lineCount: countNonEmptyLines(sourceText),
  };
}
