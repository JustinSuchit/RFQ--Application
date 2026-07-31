export type ExtractedRfqItem = {
  description: string;
  quantity: number;
  unit: string | null;
  notes?: string | null;
  confidence?: number;
};

const knownUnits = new Set([
  "each",
  "ea",
  "nos",
  "m",
  "mts",
  "pcs",
  "pc",
  "piece",
  "pieces",
  "box",
  "boxes",
  "bag",
  "bags",
  "roll",
  "rolls",
  "length",
  "lengths",
  "pair",
  "pairs",
  "set",
  "sets",
  "carton",
  "cartons",
  "case",
  "cases",
  "pack",
  "packs",
  "kg",
  "lb",
  "lbs",
  "ton",
  "tons",
  "litre",
  "liter",
  "litres",
  "liters",
  "gallon",
  "gallons",
  "ft",
  "feet",
  "meter",
  "meters",
  "metre",
  "metres",
]);

const cutoffPatterns = [
  /\bquotation deadline\b/i,
  /\bdeadline\b/i,
  /\bdelivery date\b/i,
  /\brequired by\b/i,
  /\bregards\b/i,
  /\bthank you\b/i,
  /\bthanks\b/i,
  /\bsincerely\b/i,
  /\bbsc information technology\b/i,
  /\bconfidentiality\b/i,
  /\bsent from my iphone\b/i,
];

const ignoredLinePatterns = [
  /^good day\b/i,
  /^hello\b/i,
  /^hi\b/i,
  /^dear\b/i,
  /^please quote\b/i,
  /^please provide\b/i,
  /^quote\b/i,
  /^quotation\b/i,
  /^request for quotation\b/i,
  /^rfq\b/i,
  /^subject\b/i,
  /^date\b/i,
  /^page\b/i,
  /^invoice\b/i,
  /\bdeadline\b/i,
  /\bquotation deadline\b/i,
  /^required by\b/i,
  /^delivery\b/i,
  /\bdelivery location\b/i,
  /^address\b/i,
  /^phone\b/i,
  /^email\b/i,
  /^website\b/i,
  /^company\b/i,
  /^tax\b/i,
  /^vat\b/i,
  /^payment terms\b/i,
  /^regards\b/i,
  /^thanks\b/i,
  /^thank you\b/i,
  /^sincerely\b/i,
  /^signature\b/i,
  /\bsent from my iphone\b/i,
  /\bconfidentiality\b/i,
  /\bbsc information technology\b/i,
];

const ignoredDescriptionPatterns = [
  /^(deadline|delivery|address|phone|email)$/i,
  /\bquote\s*no\b/i,
  /\bquotation\s+date\b/i,
  /\bquotation\b/i,
  /\bvat\s+reg\b/i,
  /\bsubtotal\b/i,
  /\bsales\s+tax\b/i,
  /\bprepared\s+by\b/i,
  /\bprepared\s+by\b/i,
  /\bpayment\s+terms\b/i,
  /\bexpiration\s+date\b/i,
  /\bcustomer\b/i,
  /\bship\s+to\b/i,
  /\btel\b/i,
  /\btel:/i,
  /\bemail:/i,
  /\beastern\s+main\s+road\b/i,
  /\blaventille\b/i,
  /\bport-of-spain\b/i,
  /\btrinidad\b/i,
  /\bprices\s+are\s+valid\b/i,
  /\bdelivery\s+provided\b/i,
  /\bttd\b/i,
  /\btotal\b/i,
  /\btax\b/i,
  /\bwebsite\b/i,
  /\bphone\b/i,
  /\baddress\b/i,
  /\bterms\s+and\s+conditions\b/i,
  /\bquotation\s+specific\s+terms\b/i,
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /^(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i,
];

const quoteTableHeaderPatterns = [
  /item\s*description\s*delivery\s*qty\s*no\.?\s*u\/?m\s*unit\s*cost\s*total/i,
  /no\.?\s+qty\s+u\/?m\s+item\s+description/i,
  /qty\s+u\/?m\s+item\s+description/i,
  /item\s+description\s+delivery\s+unit\s+cost\s+total/i,
  /quantity\s+unit\s+description/i,
];

const quoteTableStopPatterns = [
  /\bquotation\s+specific\s+terms\b/i,
  /\bterms\s+and\s+conditions\b/i,
  /\bsubtotal\b/i,
  /\bsales\s+tax\b/i,
  /\btotal\s+ttd\b/i,
  /\bprepared\s+by\b/i,
  /\bvat\s+reg\b/i,
  /\bpayment\s+terms\b/i,
  /\bexpiration\s+date\b/i,
];

const deliveryStatusPattern =
  /\b(?:EX\s+STOCK|IN\s+STOCK|OUT\s+OF\s+STOCK|BACKORDER|TO\s+ORDER|DELIVERY|ETA)\b/i;

const priceAtEndPattern =
  /\s+(?:TTD\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2,4})?T?\s*$/i;

const skuLikePattern = /^(?=.*\d)[A-Z0-9][A-Z0-9/-]*[A-Z0-9]$/i;
const skuScanPattern =
  /\d{2}-[A-Z]{2,}\d{2}(?=\d-)|\d{2}-\d{2}-\d{4}-\d{2}|\d{2}-\d{5}-\d{2}|\d{2}-[A-Z]{2}-[A-Z0-9]+-\d{5}|[A-Z0-9]{2,}-[A-Z0-9-]+/gi;
const productNounPattern =
  /\b(?:pipe|valve|cable|wire|connector|bolt|cement|screw|screws|gland|glands|locknut|box|pvc|breaker|switch|panel|fitting|elbow|coupling|helmet|helmets|gloves|tool|tools|wire|pull\s+box)\b/i;
const priceLikePattern = /\b(?:TTD\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2,4})T?\b/gi;

const leadingNoisePatterns = [
  /^please\s+quote\s+for\s+the\s+following\s*/i,
  /^please\s+quote\s*/i,
  /^please\s+/i,
  /^quote\s+for\s+/i,
  /^quote\s+/i,
  /^provide\s+(a\s+)?quotation\s+for\s*/i,
  /^provide\s+(a\s+)?quote\s+for\s*/i,
  /^request\s+for\s+quotation\s*:?/i,
  /^rfq\s*:?/i,
  /^for\s+delivery\s+to\s+[^:]+:\s*/i,
  /^for\s+the\s+following\s*:?/i,
  /^the\s+following\s*:?/i,
];

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•]/g, "\n- ");
}

function cutOffTrailingNonItems(value: string) {
  let cutoffIndex = value.length;

  for (const pattern of cutoffPatterns) {
    const match = value.match(pattern);
    if (match?.index !== undefined && match.index < cutoffIndex) {
      cutoffIndex = match.index;
    }
  }

  return value.slice(0, cutoffIndex).trim();
}

function compactText(value: string) {
  return cutOffTrailingNonItems(normalizeText(value))
    .replace(/\s+/g, " ")
    .trim();
}

function compactQuoteText(value: string) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .replace(/([A-Z0-9-])(?=EX\s+STOCK\b)/gi, "$1 ")
    .trim();
}

export function isSupplierQuoteTableText(text: string): boolean {
  const compact = compactQuoteText(text || "");

  return [
    /item\s*description\s*delivery\s*qty\s*no\.?\s*u\/?m\s*unit\s*cost\s*total/i,
    /no\.?\s+qty\s+u\/?m\s+item\s+description/i,
    /qty\s+u\/?m\s+item\s+description/i,
    /unit\s+cost\s+total/i,
    /subtotal\s+sales\s+tax/i,
    /\bquotation\b/i,
    /\bquote\s*no\.?\b/i,
  ].some((pattern) => pattern.test(compact));
}

function stripListMarker(value: string) {
  return value
    .replace(/^\s*(?:[-*]+|[>]+)\s*/, "")
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .trim();
}

function stripLeadingNoise(value: string) {
  let next = value.trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const pattern of leadingNoisePatterns) {
      const stripped = next.replace(pattern, "").trim();
      if (stripped !== next) {
        next = stripped;
        changed = true;
      }
    }
  }

  const quantityMatch = next.match(/\d+(?:\.\d+)?\b/);
  if (quantityMatch && quantityMatch.index && quantityMatch.index > 0) {
    const prefix = next.slice(0, quantityMatch.index).toLowerCase();
    if (/\b(quote|quotation|rfq|following|provide|request|delivery)\b/.test(prefix)) {
      next = next.slice(quantityMatch.index).trim();
    }
  }

  return next;
}

function cleanupDescription(value: string) {
  return value
    .replace(/^(?:for\s+)/i, "")
    .replace(/^(?:x\s+)/i, "")
    .replace(/\b(?:qty|quantity)\s*:?$/i, "")
    .replace(/^\s*[-*]+\s*/, "")
    .replace(/[-*;:,.\s]+$/g, "")
    .replace(/,?\s+and$/i, "")
    .replace(/[-*;:,.\s]+$/g, "")
    .trim();
}

function descriptionIsIgnored(description: string) {
  return ignoredDescriptionPatterns.some((pattern) => pattern.test(description));
}

function hasTooManyPriceTokens(description: string) {
  return (description.match(priceLikePattern) ?? []).length > 2;
}

function isProductLikeDescription(description: string) {
  const cleaned = description.trim();
  if (cleaned.length < 3) return false;
  if (cleaned.length > 300) return false;
  if (descriptionIsIgnored(cleaned)) return false;
  if (/^ttd\b/i.test(cleaned)) return false;
  if (/^(?:\d+[./-]?)+$/.test(cleaned)) return false;
  if (/^[\d\s,.$]+T?$/i.test(cleaned)) return false;
  if (/@|www\.|https?:\/\//i.test(cleaned)) return false;
  if (hasTooManyPriceTokens(cleaned)) return false;

  const hasSku = cleaned.split(/\s+/).some((token) => skuLikePattern.test(token));
  const hasProductNoun = productNounPattern.test(cleaned);
  const hasWords = /[a-z]{3,}/i.test(cleaned);

  return hasSku || hasProductNoun || hasWords;
}

function shouldIgnoreSegment(value: string) {
  const segment = value.trim();
  if (!segment) return true;
  if (ignoredLinePatterns.some((pattern) => pattern.test(segment))) return true;
  if (!/\d/.test(segment)) return true;

  return false;
}

function splitIntoSegments(text: string) {
  return normalizeText(text)
    .split(/\n|;|,(?=\s*(?:and\s+)?\d)|\s+and\s+(?=\d)/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function findQuoteTableBody(text: string) {
  const compact = compactQuoteText(text);
  let headerEnd = -1;

  for (const pattern of quoteTableHeaderPatterns) {
    const match = compact.match(pattern);
    if (match?.index !== undefined) {
      headerEnd = match.index + match[0].length;
      break;
    }
  }

  if (headerEnd < 0) return null;

  let tableBody = compact.slice(headerEnd).trim();
  let stopIndex = tableBody.length;

  for (const pattern of quoteTableStopPatterns) {
    const match = tableBody.match(pattern);
    if (match?.index !== undefined && match.index < stopIndex) {
      stopIndex = match.index;
    }
  }

  tableBody = tableBody.slice(0, stopIndex).trim();
  return tableBody || null;
}

function stripTrailingPrices(value: string) {
  let next = value.trim();
  let previous = "";

  while (next && next !== previous) {
    previous = next;
    next = next.replace(priceAtEndPattern, "").trim();
  }

  return next;
}

function cleanupQuoteRowDescription(value: string) {
  const deliveryMatch = value.match(deliveryStatusPattern);
  const withoutDelivery =
    deliveryMatch?.index !== undefined ? value.slice(0, deliveryMatch.index) : value;
  return cleanupDescription(stripTrailingPrices(withoutDelivery));
}

function normalizeQuoteDescriptionSpacing(value: string) {
  return value
    .replace(/([a-z)])(?=[A-Z]{2,}\b)/g, "$1 ")
    .replace(/([A-Z]{2,})(?=\d)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function findQuantityAndUnitNearSku(prefix: string, suffix: string) {
  const beforeMatch = prefix.match(
    /(?:^|\s)(\d{1,3})\s+(\d+(?:\.\d+)?)\s+([a-zA-Z/]+)\s*$/,
  );
  if (beforeMatch && knownUnits.has(beforeMatch[3].toLowerCase())) {
    const quantity = Number(beforeMatch[2]);
    if (Number.isFinite(quantity) && quantity > 0 && quantity <= 10000) {
      return { quantity, unit: beforeMatch[3].toLowerCase(), confidence: 0.85 };
    }
  }

  const compressedAfterDelivery = suffix.match(
    deliveryStatusPattern,
  );
  const afterDeliveryText =
    compressedAfterDelivery?.index !== undefined
      ? suffix.slice(compressedAfterDelivery.index)
      : suffix;
  const joinedMatch = afterDeliveryText.match(
    /\b(\d+)(\d)(ea|each|mts|m|pcs|pc|nos|ft|kg|lb|lbs|box|boxes|roll|rolls|set|sets|pair|pairs)\b/i,
  );
  if (joinedMatch) {
    const quantity = Number(joinedMatch[1]);
    if (Number.isFinite(quantity) && quantity > 0 && quantity <= 10000) {
      return { quantity, unit: joinedMatch[3].toLowerCase(), confidence: 0.75 };
    }
  }

  const suffixQtyMatch = afterDeliveryText.match(
    /\b(\d+(?:\.\d+)?)\s*(ea|each|mts|m|pcs|pc|nos|ft|kg|lb|lbs|box|boxes|roll|rolls|set|sets|pair|pairs)\b/i,
  );
  if (suffixQtyMatch) {
    const quantity = Number(suffixQtyMatch[1]);
    if (Number.isFinite(quantity) && quantity > 0 && quantity <= 10000) {
      return { quantity, unit: suffixQtyMatch[2].toLowerCase(), confidence: 0.7 };
    }
  }

  return { quantity: 1, unit: null, confidence: 0.6 };
}

function parseQuoteTableRow(rowText: string): ExtractedRfqItem | null {
  const match = rowText.match(
    /^\s*(\d{1,3})\s+(\d+(?:\.\d+)?)\s+([a-zA-Z/]+)\s+(.+)$/,
  );
  if (!match) return null;

  const quantity = Number(match[2]);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return null;

  const unit = match[3].toLowerCase();
  if (!knownUnits.has(unit)) return null;

  const body = cleanupQuoteRowDescription(match[4]);
  if (!isProductLikeDescription(body)) return null;

  const [firstToken, ...restTokens] = body.split(/\s+/);
  const description =
    firstToken && skuLikePattern.test(firstToken) && restTokens.length > 0
      ? `${firstToken} - ${cleanupDescription(restTokens.join(" "))}`
      : body;

  if (!isProductLikeDescription(description)) return null;

  return {
    description,
    quantity,
    unit,
    notes: null,
    confidence: skuLikePattern.test(firstToken || "") ? 0.85 : 0.75,
  };
}

function extractQuoteTableItemsFromSkuSegments(tableBody: string) {
  const matches = Array.from(tableBody.matchAll(skuScanPattern));
  if (matches.length === 0) return [];

  return matches
    .map((match, index): ExtractedRfqItem | null => {
      const itemCode = match[0];
      const start = match.index ?? 0;
      const nextStart = matches[index + 1]?.index ?? tableBody.length;
      const prefix = tableBody.slice(Math.max(0, start - 40), start);
      const suffix = tableBody.slice(start + itemCode.length, nextStart);
      const quantityUnit = findQuantityAndUnitNearSku(prefix, suffix);
      let descriptionRest = cleanupQuoteRowDescription(
        normalizeQuoteDescriptionSpacing(suffix),
      );

      const gluedPrefix = descriptionRest.match(/^(\d+-)/);
      if (gluedPrefix) {
        descriptionRest = `${gluedPrefix[1]}${descriptionRest.slice(gluedPrefix[1].length)}`;
      }

      const description = cleanupDescription(
        descriptionRest ? `${itemCode} - ${descriptionRest}` : itemCode,
      );

      if (!isProductLikeDescription(description)) return null;

      return {
        description,
        quantity: quantityUnit.quantity,
        unit: quantityUnit.unit,
        notes: null,
        confidence: quantityUnit.confidence,
      };
    })
    .filter((item): item is ExtractedRfqItem => Boolean(item));
}

function extractQuoteTableItems(text: string) {
  const tableBody = findQuoteTableBody(text);
  if (!tableBody) return [];

  const rowStartPattern =
    /(?:^|\s)(\d{1,3})\s+(\d+(?:\.\d+)?)\s+([a-zA-Z/]+)\s+(?=\S)/g;
  const starts: Array<{ index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = rowStartPattern.exec(tableBody)) !== null) {
    const unit = match[3].toLowerCase();
    if (!knownUnits.has(unit)) continue;

    const rowOffset = match[0].search(/\d/);
    starts.push({ index: match.index + Math.max(rowOffset, 0) });
  }

  const lineBasedItems = starts
    .map((start, index) => {
      const nextStart = starts[index + 1]?.index ?? tableBody.length;
      return parseQuoteTableRow(tableBody.slice(start.index, nextStart));
    })
    .filter((item): item is ExtractedRfqItem => Boolean(item));

  if (lineBasedItems.length > 0) return lineBasedItems;

  return extractQuoteTableItemsFromSkuSegments(tableBody);
}

function parseSegment(segment: string): ExtractedRfqItem | null {
  if (shouldIgnoreSegment(segment)) return null;

  const cleaned = stripLeadingNoise(stripListMarker(segment));
  if (shouldIgnoreSegment(cleaned)) return null;

  const match = cleaned.match(/^(?:qty|quantity)?\s*:?\s*(\d+(?:\.\d+)?)\s+(?:x\s+)?(.+)$/i);
  if (!match) return null;

  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) return null;

  const words = match[2].trim().split(/\s+/);
  const possibleUnit = words[0]?.toLowerCase().replace(/[.,;:]+$/g, "");
  const hasKnownUnit = knownUnits.has(possibleUnit);
  const unit = hasKnownUnit ? possibleUnit : null;
  const description = cleanupDescription(
    hasKnownUnit ? words.slice(1).join(" ") : words.join(" "),
  );

  if (!description || !isProductLikeDescription(description)) return null;

  return {
    description,
    quantity,
    unit,
    notes: null,
    confidence: hasKnownUnit ? 0.75 : 0.6,
  };
}

function isLikelyQuantityStart(rawQuantity: string, nextToken: string) {
  const normalizedToken = nextToken.toLowerCase().replace(/[.,;:]+$/g, "");
  if (!normalizedToken) return false;
  if (/^\d{4}$/.test(rawQuantity)) return false;
  if (knownUnits.has(normalizedToken)) return true;
  if (normalizedToken === "x") return true;
  if (descriptionIsIgnored(normalizedToken)) return false;

  return /^[a-z][a-z-]*$/i.test(normalizedToken);
}

function extractWithGlobalQuantityScan(text: string) {
  const cleaned = stripLeadingNoise(compactText(text));
  const startPattern = /(?:^|\s)(?:qty|quantity)?\s*:?\s*(\d+(?:\.\d+)?)\s+([a-zA-Z][a-zA-Z-]*)/gi;
  const starts: Array<{
    index: number;
    quantity: number;
    token: string;
    matchEnd: number;
  }> = [];
  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(cleaned)) !== null) {
    const rawQuantity = match[1];
    const quantity = Number(rawQuantity);
    const token = match[2];
    const quantityOffset = match[0].indexOf(rawQuantity);
    const index = match.index + quantityOffset;

    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!isLikelyQuantityStart(rawQuantity, token)) continue;

    starts.push({
      index,
      quantity,
      token,
      matchEnd: match.index + match[0].length,
    });
  }

  return starts
    .map((start, index): ExtractedRfqItem | null => {
      const token = start.token.toLowerCase().replace(/[.,;:]+$/g, "");
      const hasKnownUnit = knownUnits.has(token);
      const hasMultiplierToken = token === "x";
      const quantityEnd = start.index + String(start.quantity).length;
      const descriptionStart =
        hasKnownUnit || hasMultiplierToken ? start.matchEnd : quantityEnd;
      const nextStart = starts[index + 1]?.index ?? cleaned.length;
      const description = cleanupDescription(
        cleaned.slice(descriptionStart, nextStart),
      );

      if (
        !Number.isFinite(start.quantity) ||
        start.quantity <= 0 ||
        start.quantity > 10000 ||
        !description ||
        !isProductLikeDescription(description)
      ) {
        return null;
      }

      return {
        description,
        quantity: start.quantity,
        unit: hasKnownUnit ? token : null,
        notes: null,
        confidence: hasKnownUnit ? 0.75 : 0.6,
      };
    })
    .filter((item): item is ExtractedRfqItem => Boolean(item));
}

export function extractRfqItemsFromEmailText(text: string): ExtractedRfqItem[] {
  const uniqueItems = new Map<string, ExtractedRfqItem>();
  const isSupplierQuoteTable = isSupplierQuoteTableText(text || "");
  const quoteTableItems = extractQuoteTableItems(text || "");

  if (isSupplierQuoteTable) {
    for (const item of quoteTableItems) {
      const key = `${item.quantity}|${item.unit ?? ""}|${item.description.toLowerCase()}`;
      uniqueItems.set(key, item);
    }

    return Array.from(uniqueItems.values());
  }

  const globalItems = extractWithGlobalQuantityScan(text || "");

  for (const item of globalItems) {
    const key = `${item.quantity}|${item.unit ?? ""}|${item.description.toLowerCase()}`;
    uniqueItems.set(key, item);
  }

  if (globalItems.length === 0) {
    for (const segment of splitIntoSegments(text || "")) {
      const item = parseSegment(segment);
      if (!item) continue;

      const key = `${item.quantity}|${item.unit ?? ""}|${item.description.toLowerCase()}`;
      uniqueItems.set(key, item);
    }
  }

  return Array.from(uniqueItems.values());
}
