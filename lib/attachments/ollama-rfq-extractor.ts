import type { ExtractedRfqItem } from "@/lib/email/rfq-item-extractor";

type OllamaAssistMode = "off" | "when_empty" | "always" | "refine";

type OllamaItemCandidate = {
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
  notes?: unknown;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  response?: string;
};

type OllamaRequestResult =
  | {
      ok: true;
      content: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export type OllamaRfqExtractionResult = {
  enabled: boolean;
  used: boolean;
  unavailable: boolean;
  items: ExtractedRfqItem[];
  error: string | null;
  metadata: {
    provider: "ollama";
    mode: OllamaAssistMode;
    model: string | null;
    inputCharacters: number;
    returnedItems: number;
  };
};

type ExtractWithOllamaInput = {
  text: string;
  existingItemCount: number;
  source?: "attachment" | "notes";
  existingItems?: ExtractedRfqItem[];
};

const defaultBaseUrl = "http://127.0.0.1:11434";
const defaultModel = "llama3.1:8b";
const defaultTimeoutMs = 120000;
const defaultMaxChars = 7000;

function envFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function assistMode(): OllamaAssistMode {
  const mode = String(process.env.OLLAMA_RFQ_ASSIST_MODE || "when_empty")
    .trim()
    .toLowerCase();

  if (mode === "always") return "always";
  if (mode === "refine") return "refine";
  if (mode === "off") return "off";
  return "when_empty";
}

export function isOllamaRfqAssistEnabled() {
  return envFlag(process.env.OLLAMA_ENABLED) && assistMode() !== "off";
}

function numericEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, value));
}

function normalizeUnit(value: unknown) {
  if (value === null || value === undefined) return null;
  const unit = String(value)
    .replace(/[^\w/.-]/g, "")
    .trim()
    .toLowerCase();

  return unit || null;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function tableFocusedText(value: string, maxLength: number) {
  const normalized = cleanText(value, Math.max(maxLength * 2, maxLength));
  const headerMatch = normalized.match(
    /\b(?:#\s*)?item\s+description\s+quantity\s+unit\s+price\s+total\s+amount\b/i,
  );
  const start = headerMatch?.index ?? 0;
  let tableText = normalized.slice(start);
  const stopMatch = tableText.match(/\b(?:warranty|terms|conditions|subtotal|sales\s+tax|grand\s+total)\b/i);

  if (stopMatch?.index && stopMatch.index > 500) {
    tableText = tableText.slice(0, stopMatch.index);
  }

  return tableText.slice(0, maxLength);
}

function parseJsonObject(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitizeItems(value: unknown): ExtractedRfqItem[] {
  const sourceItems = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  const items: ExtractedRfqItem[] = [];
  const seen = new Set<string>();

  for (const candidate of sourceItems as OllamaItemCandidate[]) {
    if (!candidate || typeof candidate !== "object") continue;

    const description = cleanText(candidate.description, 300);
    const quantity = Number(candidate.quantity);
    const unit = normalizeUnit(candidate.unit);
    const notes = cleanText(candidate.notes, 300) || null;

    if (!description || description.length < 3) continue;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) continue;
    if (/@|https?:\/\//i.test(description)) continue;
    if (/\b(subtotal|sales tax|grand total|terms and conditions|prepared by|payment terms)\b/i.test(description)) {
      continue;
    }

    const key = `${description.toLowerCase()}|${quantity}|${unit ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      description,
      quantity,
      unit,
      notes,
      confidence: 0.7,
    });
  }

  return items.slice(0, 100);
}

function buildPrompt(text: string, source: "attachment" | "notes", existingItems: ExtractedRfqItem[]) {
  if (source === "notes") {
    return [
      "You are extracting requested products from an RFQ email or note.",
      "Return only genuine requested products.",
      "Ignore greetings, urgency wording such as ASAP, sender names, job titles, phone numbers, email addresses, postal addresses, websites, social media links, signatures, disclaimers, CID image references, and company contact blocks.",
      "Preserve dimensions, sizes, model numbers, drive sizes, depth requirements, material details, and specification details.",
      "If existing parser candidates are provided, verify them but retain every genuine product row.",
      "Do not summarize the list or return only representative items.",
      "Do not discard size variants. Preserve separate rows for each product size.",
      "Preserve every row from deterministic Description + Unit + Quantity tables unless the row is clearly not a requested product.",
      "Do not omit rows when a parser candidate list is longer than your extracted list.",
      "Ignore supplier reply text, including quotation attached wording, specification sheet links, URLs, and supplier signatures.",
      "Remove signature/footer text and attachment labels only when they are not valid product rows.",
      "If a single clear product is requested and no quantity is stated, use quantity 1 and unit each.",
      "Return strict JSON only with this shape: {\"items\":[{\"description\":\"string\",\"quantity\":number,\"unit\":\"string|null\",\"notes\":\"string|null\"}]}",
      "Do not invent products. If no clear requested product exists, return {\"items\":[]}.",
      existingItems.length
        ? `Existing parser candidates to verify or refine: ${JSON.stringify({ items: existingItems })}`
        : "Existing parser candidates: none.",
      "",
      "RFQ note text:",
      text,
    ].join("\n");
  }

  return [
    "Extract only real RFQ line items from the attachment text.",
    "Return strict JSON only with this shape: {\"items\":[{\"description\":\"string\",\"quantity\":number,\"unit\":\"string|null\",\"notes\":\"string|null\"}]}",
    "Ignore page numbers, repeated headers, footers, subtotal, sales tax, total, terms and conditions, prepared by, quote number, customer details, payment terms, expiration dates, addresses, emails, and phone numbers.",
    "Keep item descriptions concise. Do not invent items. If no clear items exist, return {\"items\":[]}.",
    "",
    "Attachment text:",
    text,
  ].join("\n");
}

async function safeErrorMessage(response: Response) {
  const fallback = `status ${response.status}`;

  try {
    const text = cleanText(await response.text(), 500);
    if (!text) return fallback;

    const parsed = parseJsonObject(text);
    if (parsed && typeof parsed === "object") {
      const error = (parsed as { error?: unknown; message?: unknown }).error ?? (parsed as { message?: unknown }).message;
      if (error) return cleanText(error, 500);
    }

    return text;
  } catch {
    return fallback;
  }
}

async function requestOllamaChat(baseUrl: string, model: string, prompt: string, timeoutMs: number): Promise<OllamaRequestResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: {
        temperature: 0,
      },
      messages: [
        {
          role: "system",
          content:
            "You extract RFQ item rows into JSON. You do not return markdown, commentary, totals, customer data, or invented items.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await safeErrorMessage(response),
    };
  }

  const data = (await response.json()) as OllamaResponse;
  return {
    ok: true,
    content: data.message?.content || data.response || "",
  };
}

async function requestOllamaGenerate(baseUrl: string, model: string, prompt: string, timeoutMs: number): Promise<OllamaRequestResult> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: [
        "You extract RFQ item rows into JSON. Return strict JSON only.",
        prompt,
      ].join("\n\n"),
      stream: false,
      format: "json",
      options: {
        temperature: 0,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await safeErrorMessage(response),
    };
  }

  const data = (await response.json()) as OllamaResponse;
  return {
    ok: true,
    content: data.response || data.message?.content || "",
  };
}

function emptyResult(enabled: boolean, used: boolean, error: string | null): OllamaRfqExtractionResult {
  const mode = assistMode();

  return {
    enabled,
    used,
    unavailable: Boolean(error),
    items: [],
    error,
    metadata: {
      provider: "ollama",
      mode,
      model: enabled ? process.env.OLLAMA_MODEL || defaultModel : null,
      inputCharacters: 0,
      returnedItems: 0,
    },
  };
}

export async function extractRfqItemsWithOllama({
  text,
  existingItemCount,
  source = "attachment",
  existingItems = [],
}: ExtractWithOllamaInput): Promise<OllamaRfqExtractionResult> {
  const mode = assistMode();
  const enabled = isOllamaRfqAssistEnabled();

  if (!enabled) return emptyResult(false, false, null);
  if (mode === "when_empty" && existingItemCount > 0) return emptyResult(true, false, null);

  const baseUrl = (process.env.OLLAMA_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || defaultModel;
  const timeoutMs = numericEnv("OLLAMA_TIMEOUT_MS", defaultTimeoutMs, 5000, 180000);
  const maxChars = numericEnv("OLLAMA_MAX_INPUT_CHARS", defaultMaxChars, 1000, 60000);
  const inputText = source === "notes" ? cleanText(text, maxChars) : tableFocusedText(text, maxChars);

  if (!inputText) return emptyResult(true, false, null);

  try {
    const prompt = buildPrompt(inputText, source, existingItems);
    let requestResult = await requestOllamaChat(baseUrl, model, prompt, timeoutMs);

    if (!requestResult.ok && requestResult.status === 404) {
      requestResult = await requestOllamaGenerate(baseUrl, model, prompt, timeoutMs);
    }

    if (!requestResult.ok) {
      return emptyResult(
        true,
        true,
        `Ollama request failed (${requestResult.status}): ${requestResult.message}.`,
      );
    }

    const content = requestResult.content;
    const parsed = parseJsonObject(content);
    const items = sanitizeItems(parsed);

    return {
      enabled: true,
      used: true,
      unavailable: false,
      items,
      error: null,
      metadata: {
        provider: "ollama",
        mode,
        model,
        inputCharacters: inputText.length,
        returnedItems: items.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ollama request failed.";
    return emptyResult(true, true, message);
  }
}
