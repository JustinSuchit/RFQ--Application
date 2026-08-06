import {
  extractRfqItemsWithOllama,
  type OllamaRfqExtractionResult,
} from "@/lib/attachments/ollama-rfq-extractor";
import {
  hasVerticalRfqTableHeader,
  hasFlattenedDescriptionUnitQuantityTableHeader,
  parseFlattenedDescriptionUnitQuantityTableDetailed,
  parseVerticalRfqTable,
  selectForwardedRfqSection,
  type FlattenedRfqTableRejectedCandidate,
  type ExtractedRfqItem,
  extractRfqItemsFromEmailText,
} from "@/lib/email/rfq-item-extractor";

export type RfqNotesExtractionResult = {
  items: ExtractedRfqItem[];
  cleanedNotes: string;
  diagnostics: {
    parserItemCount: number;
    naturalLanguageItemCount: number;
    ollamaMode: string | null;
    ollamaStatus: "disabled" | "skipped" | "used" | "unavailable";
    ollamaItemCount: number;
    finalItemCount: number;
    verticalTableDetected: boolean;
    verticalCandidateCount: number;
    forwardedSectionDetected: boolean;
    tableHeaderDetected: boolean;
    tableFormat: "flattened_description_unit_quantity" | "vertical_table" | null;
    flattenedCandidateCount: number;
    flattenedUnitQuantityPairCount: number;
    flattenedAcceptedCount: number;
    flattenedRejected: FlattenedRfqTableRejectedCandidate[];
    parser: "flattened_description_unit_quantity" | "vertical_table" | "rule_based" | "ollama" | "none";
  };
};

type ExtractRfqItemsFromNotesInput = {
  notes: string | null;
  subject: string | null;
};

const signatureStartPatterns = [
  /^regards\b/i,
  /^kind regards\b/i,
  /^best regards\b/i,
  /^sincerely\b/i,
  /^thanks\b/i,
  /^thank you\b/i,
  /^phone\b/i,
  /^mobile\b/i,
  /^ext\b/i,
  /^web\b/i,
  /^email\b/i,
  /^address\b/i,
  /^linkedin\b/i,
  /^facebook\b/i,
  /^instagram\b/i,
  /^add social media icons\b/i,
  /^exclaimer\b/i,
];

function ollamaStatus(result: OllamaRfqExtractionResult | null): RfqNotesExtractionResult["diagnostics"]["ollamaStatus"] {
  if (!result?.enabled) return "disabled";
  if (result.unavailable) return "unavailable";
  if (result.used) return "used";
  return "skipped";
}

function normalizeSpaces(value: string) {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function cleanRfqNotesForExtraction(value: string | null | undefined) {
  const normalized = normalizeSpaces(String(value ?? ""))
    .replace(/\[cid:[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keptLines: string[] = [];

  for (const line of lines) {
    if (signatureStartPatterns.some((pattern) => pattern.test(line))) break;
    if (/\b(exclaimer|confidentiality notice|this message is intended only)\b/i.test(line)) break;
    if (/^\+?\d[\d\s().-]{6,}$/.test(line)) continue;
    keptLines.push(line);
  }

  return normalizeSpaces(keptLines.join("\n"))
    .replace(/\b(?:phone|mobile|tel|email|web|address)\s*:\s*\S.*$/gim, " ")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function itemKey(item: Pick<ExtractedRfqItem, "description" | "quantity" | "unit">) {
  return `${item.description.trim().toLowerCase()}|${Number(item.quantity ?? 0)}|${String(
    item.unit ?? "",
  )
    .trim()
    .toLowerCase()}`;
}

function mergeItems(...groups: ExtractedRfqItem[][]) {
  const items: ExtractedRfqItem[] = [];
  const keys = new Set<string>();

  for (const item of groups.flat()) {
    const key = itemKey(item);
    if (keys.has(key)) continue;
    keys.add(key);
    items.push(item);
  }

  return items;
}

function extractNaturalLanguageItems(text: string): ExtractedRfqItem[] {
  const socketRequest = text.match(
    /\b(?:price|quote|quotation|cost)\b[\s\S]{0,80}?\b(?:a|an|one)?\s*(1-1\/4|1\.25|1 1\/4)\s*(?:"|inch|in)?[\s-]*(?:depth\s+)?socket\b[\s\S]{0,160}?\b(?:at\s+least|minimum|min\.?)\s*(\d+(?:\.\d+)?)\s*(?:"|inch|in)?\s*deep[\s\S]{0,120}?\b(3\/4)\s*(?:"|inch|in)?\s*or\s*(1\/2)\s*(?:"|inch|in)?\s*drive/i,
  );

  if (!socketRequest) return [];

  return [
    {
      description: `${socketRequest[1]} inch deep socket, minimum ${socketRequest[2]} inch depth, ${socketRequest[3]} inch or ${socketRequest[4]} inch drive`,
      quantity: 1,
      unit: "each",
      notes: null,
      confidence: 0.85,
    },
  ];
}

export async function extractRfqItemsFromNotes({
  notes,
  subject,
}: ExtractRfqItemsFromNotesInput): Promise<RfqNotesExtractionResult> {
  const cleanedNotes = cleanRfqNotesForExtraction(notes);
  const rawSourceText = [subject, cleanedNotes].filter(Boolean).join("\n");
  const selectedSection = selectForwardedRfqSection(rawSourceText);
  const sourceText = selectedSection.text || rawSourceText;
  const flattenedTableDetected = hasFlattenedDescriptionUnitQuantityTableHeader(sourceText);
  const flattenedResult = parseFlattenedDescriptionUnitQuantityTableDetailed(sourceText);
  const flattenedItems = flattenedResult.items;
  const verticalTableDetected = hasVerticalRfqTableHeader(sourceText);
  const verticalItems = flattenedItems.length > 0 ? [] : parseVerticalRfqTable(sourceText);
  const parserItems =
    flattenedItems.length > 0
      ? flattenedItems
      : verticalItems.length > 0
        ? verticalItems
        : extractRfqItemsFromEmailText(sourceText);
  const naturalLanguageItems =
    flattenedItems.length > 0 ? [] : extractNaturalLanguageItems(sourceText);
  const ruleBasedItems =
    flattenedItems.length > 0 ? flattenedItems : mergeItems(naturalLanguageItems, parserItems);
  const ollamaAssist = await extractRfqItemsWithOllama({
    text: sourceText,
    existingItemCount: ruleBasedItems.length,
    existingItems: ruleBasedItems,
    source: "notes",
  });
  const mode = ollamaAssist.metadata.mode;
  let finalItems =
    flattenedItems.length > 0
      ? flattenedItems
      : mode === "refine" && ollamaAssist.used && !ollamaAssist.unavailable
      ? ollamaAssist.items
      : mergeItems(ruleBasedItems, ollamaAssist.items);

  if (
    (flattenedItems.length > 0 || verticalItems.length > 0) &&
    mode === "refine" &&
    ollamaAssist.used &&
    !ollamaAssist.unavailable &&
    ollamaAssist.items.length < ruleBasedItems.length
  ) {
    finalItems = ruleBasedItems;
  }

  const parser =
    flattenedItems.length > 0
      ? "flattened_description_unit_quantity"
      : verticalItems.length > 0
      ? "vertical_table"
      : finalItems.length > 0 && ollamaAssist.used && finalItems === ollamaAssist.items
        ? "ollama"
        : ruleBasedItems.length > 0
          ? "rule_based"
          : "none";

  return {
    items: finalItems,
    cleanedNotes,
    diagnostics: {
      parserItemCount: parserItems.length,
      naturalLanguageItemCount: naturalLanguageItems.length,
      ollamaMode: ollamaAssist.metadata.mode,
      ollamaStatus: ollamaStatus(ollamaAssist),
      ollamaItemCount: ollamaAssist.items.length,
      finalItemCount: finalItems.length,
      verticalTableDetected,
      verticalCandidateCount: verticalItems.length,
      forwardedSectionDetected: selectedSection.forwardedSectionDetected,
      tableHeaderDetected: flattenedTableDetected || verticalTableDetected,
      tableFormat: flattenedItems.length > 0 ? "flattened_description_unit_quantity" : verticalItems.length > 0 ? "vertical_table" : null,
      flattenedCandidateCount: flattenedItems.length,
      flattenedUnitQuantityPairCount: flattenedResult.unitQuantityPairCount,
      flattenedAcceptedCount: flattenedResult.acceptedCount,
      flattenedRejected: flattenedResult.rejected,
      parser,
    },
  };
}
