import { createHash } from "node:crypto";

export function normalizeMessageId(value: string | null | undefined) {
  const text = String(value ?? "")
    .replace(/\r?\n[\t ]+/g, " ")
    .trim();
  if (!text) return null;
  const match = text.match(/<[^<>]+>/);
  return (match?.[0] ?? text).trim().toLowerCase();
}

export function normalizeReferences(value: string | string[] | null | undefined) {
  const source = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  const matches = source.match(/<[^<>]+>/g) ?? [];
  if (matches.length > 0) {
    return Array.from(new Set(matches.map((item) => normalizeMessageId(item)).filter(Boolean))) as string[];
  }
  return source
    .split(/\s+/)
    .map((item) => normalizeMessageId(item))
    .filter((item): item is string => Boolean(item));
}

export function normalizeEmailSubject(value: string | null | undefined) {
  let subject = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  let previous = "";
  while (subject && subject !== previous) {
    previous = subject;
    subject = subject.replace(/^\s*(?:re|fw|fwd|aw)\s*:\s*/i, "").trim();
  }

  return subject.toLowerCase();
}

export function senderDomain(value: string | null | undefined) {
  const email = String(value ?? "").toLowerCase();
  const domain = email.split("@")[1]?.trim();
  return domain || email || "unknown";
}

export function extractRfqReference(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  const match = text.match(/\b(?:rfq|tender|quote|enquiry|inquiry)[\s:#-]*([a-z0-9][a-z0-9/-]{2,})\b/i);
  return match ? match[0].replace(/\s+/g, " ").toLowerCase() : null;
}

export function fallbackThreadKey(input: {
  organizationId: string;
  subject: string | null | undefined;
  fromEmail: string | null | undefined;
  body?: string | null;
}) {
  const normalizedSubject = normalizeEmailSubject(input.subject);
  const reference = extractRfqReference(input.subject, input.body);
  const base = reference
    ? `ref:${reference}`
    : `subject:${normalizedSubject}|domain:${senderDomain(input.fromEmail)}`;
  const digest = createHash("sha1")
    .update(`${input.organizationId}|${base}`)
    .digest("hex")
    .slice(0, 24);
  return `thread-${digest}`;
}

export function threadPositionFromDate(value: string | null | undefined) {
  const time = new Date(value || Date.now()).getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : Math.floor(Date.now() / 1000);
}
