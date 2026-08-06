import assert from "node:assert/strict";
// @ts-expect-error Node runs this regression with --experimental-strip-types.
import { extractRfqItemsFromEmailText, hasFlattenedDescriptionUnitQuantityTableHeader, parseFlattenedDescriptionUnitQuantityTable, parseFlattenedDescriptionUnitQuantityTableDetailed, selectForwardedRfqSection } from "../lib/email/rfq-item-extractor.ts";
// @ts-expect-error Node runs this regression with --experimental-strip-types.
import { selectRfqExtractionSource } from "../lib/rfqs/rfq-extraction-source.ts";

function table(rows: Array<[string, string, number]>, suffix = "") {
  return [
    "Item Description",
    "Unit of Measure",
    "Quantity",
    "",
    ...rows.flatMap(([description, unit, quantity]) => [
      description,
      unit,
      String(quantity),
    ]),
    suffix,
  ].join("\n");
}

const expectedRows: Array<[string, string, number]> = [
  ["Leather Apron", "EA", 12],
  ["Back Support Belt Small", "EA", 10],
  ["Back Support Belt XL", "EA", 10],
  ["Back Support Belt XXL", "EA", 10],
  ["Back Support Belt XXXL", "EA", 10],
  ["Boots Rubber Size 10", "EA", 10],
  ["Boots Rubber Size 11", "EA", 10],
  ["Boots Rubber Size 12", "EA", 10],
  ["Boots Rubber Size 13", "EA", 10],
  ["Boots Rubber Size 8", "EA", 10],
  ["Boots Rubber Size 9", "EA", 10],
  ["Ear Muffs", "EA", 10],
  ["Ear Plugs", "EA", 10],
  ["Coverall Disposable", "EA", 50],
  ["Glasses Safety Clear", "EA", 50],
  ["Glasses Safety Otg Clear", "EA", 20],
  ["Glasses Safety Otg Dark", "EA", 20],
  ["Gloves Mittens", "EA", 100],
  ["Gloves Riggers", "EA", 100],
  ["Gloves Riggers Black Latex", "EA", 100],
  ["Gloves Welders", "EA", 10],
  ["Harness Fall Protection", "EA", 50],
  ["Raincoat L", "EA", 10],
  ["Raincoat XXL", "EA", 10],
  ["Raincoat XXXL", "EA", 10],
  ["Traffic Vest", "EA", 100],
];

const single = extractRfqItemsFromEmailText(table([["Leather Apron", "EA", 12]]));
assert.deepEqual(single, [
  {
    description: "Leather Apron",
    quantity: 12,
    unit: "each",
    notes: null,
    confidence: 0.9,
  },
]);

const multiple = extractRfqItemsFromEmailText(
  table([
    ["Leather Apron", "EA", 12],
    ["Back Support Belt Small", "EA", 10],
  ]),
);
assert.equal(multiple.length, 2);
assert.equal(multiple[1].description, "Back Support Belt Small");
assert.equal(multiple[1].quantity, 10);
assert.equal(multiple[1].unit, "each");

const fullTable = extractRfqItemsFromEmailText(
  table(expectedRows, "\nSpecification Sheets\nKind regards\nBuyer"),
);
assert.equal(fullTable.length, 26);
assert.deepEqual(
  fullTable.map((item) => `${item.description}|${item.quantity}|${item.unit}`),
  expectedRows.map(([description, , quantity]) => `${description}|${quantity}|each`),
);

const withSignature = extractRfqItemsFromEmailText(
  table([["Traffic Vest", "EA", 100]], "\nRegards\nSpecification Sheets\nPhone: 555-5555"),
);
assert.equal(withSignature.length, 1);
assert.equal(withSignature[0].description, "Traffic Vest");

const specificationSheetsOnly = extractRfqItemsFromEmailText(
  [
    "Item Description",
    "Unit of Measure",
    "Quantity",
    "Specification Sheets",
    "Attachments",
    "Regards",
  ].join("\n"),
);
assert.equal(specificationSheetsOnly.length, 0);

const sizeVariants = extractRfqItemsFromEmailText(
  table([
    ["Raincoat L", "EA", 10],
    ["Raincoat XXL", "EA", 10],
    ["Raincoat XXXL", "EA", 10],
  ]),
);
assert.deepEqual(sizeVariants.map((item) => item.description), [
  "Raincoat L",
  "Raincoat XXL",
  "Raincoat XXXL",
]);

const flattenedForwardedEmail = [
  "Good Day Ms. Khan, Please see our quotation attached as requested.",
  "Specification Sheets can be viewed at https://meccaindustries.com/.",
  "From: Ann (AMCOL Sales)",
  "Sent: Wednesday, 5 August 2026",
  "Subject: URGENT REQUEST FOR QUOTE",
  "Good day, Please quote on the under-mentioned:",
  "Item Description Unit of Measure Quantity",
  ...expectedRows.map(([description, unit, quantity]) => `${description} ${unit} ${quantity}`),
  "Thank You Ann Khan Procurement Manager Mobile: 555-1212 Office: 555-2323 Email: ann@example.com Disclaimer: confidential",
].join(" ");

const selectedForwardedSection = selectForwardedRfqSection(flattenedForwardedEmail);
assert.equal(selectedForwardedSection.forwardedSectionDetected, true);
assert(!selectedForwardedSection.text.includes("quotation attached"));
assert.equal(hasFlattenedDescriptionUnitQuantityTableHeader(selectedForwardedSection.text), true);

const flattenedRows = parseFlattenedDescriptionUnitQuantityTable(selectedForwardedSection.text);
assert.equal(flattenedRows.length, 26);
assert.deepEqual(
  flattenedRows.map((item) => `${item.description}|${item.quantity}|${item.unit}`),
  expectedRows.map(([description, , quantity]) => `${description}|${quantity}|each`),
);
assert(!flattenedRows.some((item) => /specification sheets/i.test(item.description)));
assert(!flattenedRows.some((item) => /procurement manager|ann khan|mobile|office|disclaimer/i.test(item.description)));

const flattenedDiagnostics = parseFlattenedDescriptionUnitQuantityTableDetailed(selectedForwardedSection.text);
assert.equal(flattenedDiagnostics.tableHeaderDetected, true);
assert.equal(flattenedDiagnostics.unitQuantityPairCount, 26);
assert.equal(flattenedDiagnostics.candidateCount, 26);
assert.equal(flattenedDiagnostics.acceptedCount, 26);
assert.deepEqual(flattenedDiagnostics.rejected, []);

const squeezedFirstRow = parseFlattenedDescriptionUnitQuantityTable(
  "Item Description Unit of Measure Quantity Leather Apron EA 12Back Support Belt Small EA 10",
);
assert.deepEqual(
  squeezedFirstRow.map((item) => item.description),
  ["Leather Apron", "Back Support Belt Small"],
);

const shortFlattenedRows = parseFlattenedDescriptionUnitQuantityTable(
  "Item Description Unit of Measure Quantity Raincoat L EA 10 Raincoat XXL EA 10 Raincoat XXXL EA 10",
);
assert.deepEqual(shortFlattenedRows.map((item) => item.description), [
  "Raincoat L",
  "Raincoat XXL",
  "Raincoat XXXL",
]);

const finalRowWithSignature = parseFlattenedDescriptionUnitQuantityTable(
  "Item Description Unit of Measure Quantity Traffic Vest EA 100 Thank You Ann Khan Procurement Manager Mobile: 555-1212",
);
assert.equal(finalRowWithSignature.length, 1);
assert.equal(finalRowWithSignature[0].description, "Traffic Vest");
assert.equal(finalRowWithSignature[0].quantity, 100);
assert.equal(finalRowWithSignature[0].unit, "each");

const flattenedFromEmailText = extractRfqItemsFromEmailText(flattenedForwardedEmail);
assert.equal(flattenedFromEmailText.length, 26);
assert.deepEqual(
  flattenedFromEmailText.map((item) => item.description),
  expectedRows.map(([description]) => description),
);
assert(flattenedFromEmailText.some((item) => item.description === "Leather Apron"));
assert(flattenedFromEmailText.some((item) => item.description === "Harness Fall Protection"));
assert(flattenedFromEmailText.some((item) => item.description === "Raincoat L"));
assert(flattenedFromEmailText.some((item) => item.description === "Raincoat XXL"));
assert(flattenedFromEmailText.some((item) => item.description === "Raincoat XXXL"));
assert(flattenedFromEmailText.some((item) => item.description === "Traffic Vest"));

const sentenceStyle = extractRfqItemsFromEmailText(
  "Please quote 12 each leather aprons and 5 pcs safety glasses.",
);
assert(sentenceStyle.some((item) => item.description.toLowerCase().includes("leather")));

const bodyTextSource = selectRfqExtractionSource({
  linkedEmails: [
    {
      body_text: table(expectedRows),
      body_html: "<p>Specification Sheets</p>",
      body_preview: "Specification Sheets",
    },
  ],
  rfqNotes: "Specification Sheets",
});
assert.equal(bodyTextSource.sourceUsed, "email_body_text");
assert.equal(bodyTextSource.lineCount, 81);
assert.equal(extractRfqItemsFromEmailText(bodyTextSource.sourceText).length, 26);

const htmlSource = selectRfqExtractionSource({
  linkedEmails: [
    {
      body_text: null,
      body_html: "<div>Item Description</div><div>Unit of Measure</div><div>Quantity</div><div>Leather Apron</div><div>EA</div><div>12</div>",
      body_preview: "Specification Sheets",
    },
  ],
  rfqNotes: "Specification Sheets",
});
assert.equal(htmlSource.sourceUsed, "email_body_html");
assert.equal(extractRfqItemsFromEmailText(htmlSource.sourceText).length, 1);

type MockRfqItem = {
  description: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
};

function replaceGeneratedNoteItems(existing: MockRfqItem[], parsed: MockRfqItem[]) {
  if (parsed.length === 0) return existing;
  const manualRows = existing.filter((item) => item.notes !== "Extracted from RFQ notes");
  const keys = new Set(
    manualRows.map((item) => `${item.description.toLowerCase()}|${item.quantity}|${item.unit ?? ""}`),
  );
  const inserted = parsed.filter((item) => {
    const key = `${item.description.toLowerCase()}|${item.quantity}|${item.unit ?? ""}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });

  return [...manualRows, ...inserted];
}

const generatedParsedRows = fullTable.map((item) => ({
  description: item.description,
  quantity: item.quantity,
  unit: item.unit,
  notes: "Extracted from RFQ notes",
}));
const manualItem = {
  description: "Manual Custom Item",
  quantity: 2,
  unit: "each",
  notes: "Added manually",
};
const replacedRows = replaceGeneratedNoteItems(
  [
    {
      description: "Specification Sheets",
      quantity: 1,
      unit: null,
      notes: "Extracted from RFQ notes",
    },
    manualItem,
  ],
  generatedParsedRows,
);
assert.equal(replacedRows.length, 27);
assert(replacedRows.some((item) => item.description === "Manual Custom Item"));
assert(!replacedRows.some((item) => item.description === "Specification Sheets"));

const rerunRows = replaceGeneratedNoteItems(replacedRows, generatedParsedRows);
assert.equal(rerunRows.length, 27);

console.log("RFQ item extractor regression tests passed.");
