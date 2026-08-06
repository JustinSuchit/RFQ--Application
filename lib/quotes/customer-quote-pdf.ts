import { formatTaxRate, roundCurrency } from "@/lib/quotes/calculations";

type OrganizationPdfData = {
  name: string;
  country: string | null;
  currency: string;
  brand_color?: string | null;
  quote_header_text?: string | null;
  quote_footer_text?: string | null;
};

export type QuotePdfSettingsData = {
  company_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  accent_color?: string | null;
  footer_text?: string | null;
  terms?: string | null;
  show_taxable_subtotal?: boolean | null;
  show_discount?: boolean | null;
  show_delivery?: boolean | null;
  show_item_numbers?: boolean | null;
  show_quote_status?: boolean | null;
  show_approval_status?: boolean | null;
  show_notes?: boolean | null;
  currency_position?: "prefix" | "suffix" | string | null;
  page_size?: "A4" | "Letter" | string | null;
  template?: "professional" | "compact" | string | null;
};

type CustomerPdfData = {
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
};

type RfqPdfData = {
  rfq_number: string;
  subject: string;
  customers: CustomerPdfData | CustomerPdfData[] | null;
};

type QuotePdfData = {
  quote_number: string;
  revision: number;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  tax: number | null;
  discount: number | null;
  delivery_fee: number | null;
  total: number | null;
  status: string;
  approval_status: string;
  valid_until: string | null;
  created_at: string;
  notes: string | null;
};

type QuoteItemPdfData = {
  description: string;
  quantity: number;
  unit_price: number | null;
  discount: number | null;
  total_price: number | null;
  notes: string | null;
};

export type CustomerQuotePdfInput = {
  organization: OrganizationPdfData;
  rfq: RfqPdfData;
  quote: QuotePdfData;
  items: QuoteItemPdfData[];
  settings?: QuotePdfSettingsData | null;
};

type PdfFont = "regular" | "bold";

type TextOptions = {
  size?: number;
  font?: PdfFont;
  align?: "left" | "right" | "center";
  color?: string;
};

type PdfPage = {
  commands: string[];
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 48;
const footerHeight = 38;
const bottomLimit = margin + footerHeight;
const bodyWidth = pageWidth - margin * 2;
const defaultBrandColor = "#0f766e";
const cellPadding = 8;

const tableWidth = bodyWidth;
const fixedColumnWidths = {
  no: 35,
  qty: 46,
  unitPrice: 80,
  discount: 75,
  total: 80,
};
const columnWidths = {
  ...fixedColumnWidths,
  description:
    tableWidth -
    fixedColumnWidths.no -
    fixedColumnWidths.qty -
    fixedColumnWidths.unitPrice -
    fixedColumnWidths.discount -
    fixedColumnWidths.total,
};

function firstRelated<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E\n]/g, " ");
}

function escapePdfText(value: string) {
  return ascii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function sanitizeText(value: string | null | undefined, fallback = "Not set") {
  const text = ascii(String(value ?? "")).replace(/\s+/g, " ").trim();
  return text || fallback;
}

function cleanDescription(value: string) {
  return sanitizeText(value, "Item")
    .replace(/^Product:\s*/i, "")
    .replace(/\s*\*\s*Qty\s*$/i, "")
    .trim();
}

function labelize(value: string) {
  return sanitizeText(value, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatMoneyForPdf(
  amount: number | null | undefined,
  currency = "TTD",
  position: "prefix" | "suffix" | string | null | undefined = "prefix",
) {
  const safeCurrency = String(currency || "TTD")
    .replace(/[^\w]/g, "")
    .toUpperCase()
    .slice(0, 6) || "TTD";
  const safeAmount = Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return position === "suffix" ? `${safeAmount} ${safeCurrency}` : `${safeCurrency} ${safeAmount}`;
}

function savedTaxAmount(quote: QuotePdfData) {
  return Number(quote.tax_amount ?? quote.tax ?? 0);
}

function shouldShowTaxRate(quote: QuotePdfData) {
  return !(Number(quote.tax_rate ?? 0) === 0 && savedTaxAmount(quote) > 0);
}

function safeBrandColor(value: string | null | undefined) {
  const color = sanitizeText(value, defaultBrandColor);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : defaultBrandColor;
}

function hexToRgb01(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function colorCommand(color: string) {
  const { r, g, b } = hexToRgb01(color);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function textWidth(text: string, size: number) {
  return ascii(text).length * size * 0.48;
}

function wrapText(value: string, maxWidth: number, size = 9) {
  const words = sanitizeText(value, "").split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    const next = current ? `${current} ${word}` : word;
    if (textWidth(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function textCommand(text: string, x: number, y: number, options: TextOptions = {}) {
  const size = options.size ?? 9;
  const font = options.font === "bold" ? "F2" : "F1";
  const color = options.color ? colorCommand(options.color) : "0.082 0.122 0.204";
  let drawX = x;

  if (options.align === "right") {
    drawX = x - textWidth(text, size);
  } else if (options.align === "center") {
    drawX = x - textWidth(text, size) / 2;
  }

  return [
    "BT",
    `${color} rg`,
    `/${font} ${size} Tf`,
    `${drawX.toFixed(2)} ${y.toFixed(2)} Td`,
    `(${escapePdfText(text)}) Tj`,
    "ET",
  ].join("\n");
}

function tableColumns() {
  const columns = [
    { key: "no", label: "No.", x: margin, width: columnWidths.no, align: "center" as const },
    {
      key: "description",
      label: "Description",
      x: margin + columnWidths.no,
      width: columnWidths.description,
      align: "left" as const,
    },
    {
      key: "qty",
      label: "Qty",
      x: margin + columnWidths.no + columnWidths.description,
      width: columnWidths.qty,
      align: "center" as const,
    },
    {
      key: "unitPrice",
      label: "Unit Price",
      x: margin + columnWidths.no + columnWidths.description + columnWidths.qty,
      width: columnWidths.unitPrice,
      align: "right" as const,
    },
    {
      key: "discount",
      label: "Discount",
      x: margin + columnWidths.no + columnWidths.description + columnWidths.qty + columnWidths.unitPrice,
      width: columnWidths.discount,
      align: "right" as const,
    },
    {
      key: "total",
      label: "Total",
      x:
        margin +
        columnWidths.no +
        columnWidths.description +
        columnWidths.qty +
        columnWidths.unitPrice +
        columnWidths.discount,
      width: columnWidths.total,
      align: "right" as const,
    },
  ];

  const tableRight = margin + tableWidth;
  const lastColumn = columns[columns.length - 1];
  if (lastColumn.x + lastColumn.width > tableRight) {
    throw new Error("Customer quote PDF item table exceeds page margins.");
  }

  return columns;
}

function cellTextX(column: { x: number; width: number; align: "left" | "right" | "center" }) {
  if (column.align === "right") return column.x + column.width - cellPadding;
  if (column.align === "center") return column.x + column.width / 2;
  return column.x + cellPadding;
}

function rectCommand(x: number, y: number, width: number, height: number, options: { fill?: string; stroke?: string } = {}) {
  const commands = ["q"];
  if (options.fill) commands.push(`${colorCommand(options.fill)} rg`);
  if (options.stroke) commands.push(`${colorCommand(options.stroke)} RG`);
  commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
  commands.push(options.fill && options.stroke ? "B" : options.fill ? "f" : "S");
  commands.push("Q");
  return commands.join("\n");
}

class PdfLayout {
  private pages: PdfPage[] = [];
  private page: PdfPage;
  private y = pageHeight - margin;
  readonly brandColor: string;

  constructor(brandColor: string) {
    this.brandColor = brandColor;
    this.page = this.addPage();
  }

  getPages() {
    return this.pages;
  }

  add(command: string) {
    this.page.commands.push(command);
  }

  addPage() {
    const nextPage = { commands: [] };
    this.pages.push(nextPage);
    this.page = nextPage;
    this.y = pageHeight - margin;
    return nextPage;
  }

  ensureSpace(height: number) {
    if (this.y - height < bottomLimit) {
      this.addPage();
    }
  }

  gap(value: number) {
    this.y -= value;
  }

  text(text: string, x: number, options: TextOptions = {}) {
    this.add(textCommand(text, x, this.y, options));
  }

  textAt(text: string, x: number, y: number, options: TextOptions = {}) {
    this.add(textCommand(text, x, y, options));
  }

  rect(x: number, y: number, width: number, height: number, options?: { fill?: string; stroke?: string }) {
    this.add(rectCommand(x, y, width, height, options));
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "#d8dee8") {
    this.add(
      [
        "q",
        `${colorCommand(color)} RG`,
        "0.8 w",
        `${x1.toFixed(2)} ${y1.toFixed(2)} m`,
        `${x2.toFixed(2)} ${y2.toFixed(2)} l`,
        "S",
        "Q",
      ].join("\n"),
    );
  }

  sectionTitle(title: string) {
    this.ensureSpace(26);
    this.text(title, margin, { font: "bold", size: 10, color: this.brandColor });
    this.gap(12);
  }

  currentY() {
    return this.y;
  }

  setY(value: number) {
    this.y = value;
  }
}

function drawHeader(layout: PdfLayout, input: CustomerQuotePdfInput, currency: string) {
  const { organization, quote, rfq } = input;
  const settings = input.settings;
  const orgName = sanitizeText(settings?.company_name || organization.name, "Amcol Group");
  const contactLines = [
    settings?.address,
    settings?.phone ? `Phone: ${settings.phone}` : null,
    settings?.email ? `Email: ${settings.email}` : null,
    settings?.website,
  ].filter(Boolean) as string[];
  const countryCurrency = [organization.country, currency].filter(Boolean).join(" / ");

  layout.rect(0, pageHeight - 118, pageWidth, 118, { fill: "#f8fafc" });
  layout.rect(0, pageHeight - 118, 9, 118, { fill: layout.brandColor });
  layout.textAt(orgName, margin, 736, { font: "bold", size: 18, color: "#0f172a" });
  layout.textAt(countryCurrency || currency, margin, 718, { size: 10, color: "#475569" });

  const headerText = sanitizeText(contactLines.join(" | ") || organization.quote_header_text, "");
  if (headerText) {
    const headerLines = wrapText(headerText, 250, 8).slice(0, 3);
    headerLines.forEach((line, index) => {
      layout.textAt(line, margin, 700 - index * 11, { size: 8, color: "#64748b" });
    });
  }

  layout.textAt("CUSTOMER QUOTATION", pageWidth - margin, 738, {
    align: "right",
    font: "bold",
    size: 18,
    color: layout.brandColor,
  });
  layout.textAt(`Quote No. ${sanitizeText(quote.quote_number)}`, pageWidth - margin, 716, { align: "right", font: "bold", size: 10 });
  layout.textAt(`RFQ No. ${sanitizeText(rfq.rfq_number)}`, pageWidth - margin, 701, { align: "right", size: 9, color: "#475569" });
  layout.textAt(`Date ${formatDate(quote.created_at)}`, pageWidth - margin, 686, { align: "right", size: 9, color: "#475569" });
  layout.textAt(`Valid Until ${formatDate(quote.valid_until)}`, pageWidth - margin, 671, { align: "right", size: 9, color: "#475569" });
  layout.setY(642);
}

function drawInfoBoxes(layout: PdfLayout, input: CustomerQuotePdfInput) {
  const customer = firstRelated(input.rfq.customers);
  const boxTop = layout.currentY();
  const boxHeight = 102;
  const leftX = margin;
  const rightX = margin + bodyWidth / 2 + 9;
  const boxWidth = bodyWidth / 2 - 9;

  layout.ensureSpace(boxHeight + 18);
  layout.rect(leftX, boxTop - boxHeight, boxWidth, boxHeight, { fill: "#ffffff", stroke: "#d8dee8" });
  layout.rect(rightX, boxTop - boxHeight, boxWidth, boxHeight, { fill: "#ffffff", stroke: "#d8dee8" });
  layout.textAt("BILL TO", leftX + 12, boxTop - 20, { font: "bold", size: 9, color: layout.brandColor });
  layout.textAt(sanitizeText(customer?.company_name, "No customer linked"), leftX + 12, boxTop - 40, { font: "bold", size: 11 });
  layout.textAt(`Contact: ${sanitizeText(customer?.contact_name)}`, leftX + 12, boxTop - 56, { size: 8, color: "#475569" });
  layout.textAt(`Email: ${sanitizeText(customer?.email)}`, leftX + 12, boxTop - 70, { size: 8, color: "#475569" });
  layout.textAt(`Phone: ${sanitizeText(customer?.phone)}`, leftX + 12, boxTop - 84, { size: 8, color: "#475569" });

  layout.textAt("QUOTE DETAILS", rightX + 12, boxTop - 20, { font: "bold", size: 9, color: layout.brandColor });
  layout.textAt(`Subject: ${sanitizeText(input.rfq.subject)}`, rightX + 12, boxTop - 40, { size: 8, color: "#475569" });
  layout.textAt(`Revision: ${input.quote.revision}`, rightX + 12, boxTop - 56, { size: 8, color: "#475569" });
  const showQuoteStatus = input.settings?.show_quote_status !== false;
  const showApprovalStatus = input.settings?.show_approval_status !== false;
  layout.textAt(showQuoteStatus ? `Status: ${labelize(input.quote.status)}` : "Status: Hidden", rightX + 12, boxTop - 70, { size: 8, color: "#475569" });
  layout.textAt(showApprovalStatus ? `Approval: ${labelize(input.quote.approval_status)}` : "Approval: Hidden", rightX + 12, boxTop - 84, { size: 8, color: "#475569" });
  layout.setY(boxTop - boxHeight - 26);
}

function drawTableHeader(layout: PdfLayout, input?: CustomerQuotePdfInput) {
  const y = layout.currentY();
  layout.rect(margin, y - 24, tableWidth, 24, { fill: "#eef2f7", stroke: "#d8dee8" });
  for (const column of tableColumns()) {
    if (column.key === "no" && input?.settings?.show_item_numbers === false) continue;
    if (column.key === "discount" && input?.settings?.show_discount === false) continue;
    layout.textAt(column.label, cellTextX(column), y - 15, {
      align: column.align,
      font: "bold",
      size: 8,
      color: "#334155",
    });
  }
  layout.setY(y - 24);
}

function drawItemsTable(layout: PdfLayout, input: CustomerQuotePdfInput, currency: string) {
  const items = input.items;
  layout.sectionTitle("Quote Items");
  drawTableHeader(layout, input);

  if (items.length === 0) {
    const y = layout.currentY();
    layout.rect(margin, y - 34, bodyWidth, 34, { fill: "#ffffff", stroke: "#d8dee8" });
    layout.textAt("No quote items found.", margin + 10, y - 21, { size: 9, color: "#64748b" });
    layout.setY(y - 46);
    return;
  }

  items.forEach((item, index) => {
    const columns = tableColumns();
    const noColumn = columns[0];
    const descriptionColumn = columns[1];
    const qtyColumn = columns[2];
    const unitPriceColumn = columns[3];
    const discountColumn = columns[4];
    const totalColumn = columns[5];
    const descriptionLines = wrapText(cleanDescription(item.description), descriptionColumn.width - cellPadding * 2, 8.5);
    const noteLines = item.notes ? wrapText(`Notes: ${item.notes}`, descriptionColumn.width - cellPadding * 2, 8) : [];
    const rowHeight = Math.max(34, 18 + descriptionLines.length * 11 + noteLines.length * 10);

    layout.ensureSpace(rowHeight + 30);
    if (layout.currentY() > pageHeight - margin - 6) {
      drawTableHeader(layout, input);
    }

    const y = layout.currentY();
    layout.rect(margin, y - rowHeight, tableWidth, rowHeight, { fill: "#ffffff", stroke: "#d8dee8" });
    if (input.settings?.show_item_numbers !== false) {
      layout.textAt(String(index + 1), cellTextX(noColumn), y - 18, {
        align: noColumn.align,
        size: 8.5,
      });
    }
    descriptionLines.forEach((line, lineIndex) => {
      layout.textAt(line, cellTextX(descriptionColumn), y - 18 - lineIndex * 11, { size: 8.5 });
    });
    noteLines.forEach((line, lineIndex) => {
      layout.textAt(line, cellTextX(descriptionColumn), y - 18 - descriptionLines.length * 11 - lineIndex * 10, {
        size: 8,
        color: "#64748b",
      });
    });

    layout.textAt(String(item.quantity ?? 0), cellTextX(qtyColumn), y - 18, { align: qtyColumn.align, size: 8.5 });
    layout.textAt(formatMoneyForPdf(item.unit_price, currency, input.settings?.currency_position), cellTextX(unitPriceColumn), y - 18, {
      align: unitPriceColumn.align,
      size: 8.5,
    });
    if (input.settings?.show_discount !== false) {
      layout.textAt(formatMoneyForPdf(item.discount, currency, input.settings?.currency_position), cellTextX(discountColumn), y - 18, {
        align: discountColumn.align,
        size: 8.5,
      });
    }
    layout.textAt(formatMoneyForPdf(item.total_price, currency, input.settings?.currency_position), cellTextX(totalColumn), y - 18, {
      align: totalColumn.align,
      font: "bold",
      size: 8.5,
    });
    layout.setY(y - rowHeight);
  });

  layout.gap(20);
}

function drawSummary(layout: PdfLayout, input: CustomerQuotePdfInput, currency: string) {
  const { quote } = input;
  const taxableSubtotal = roundCurrency(Math.max(Number(quote.subtotal ?? 0) - Number(quote.discount ?? 0), 0));
  const taxRate = shouldShowTaxRate(quote) ? formatTaxRate(quote.tax_rate) : "Not set";
  const taxLabel = shouldShowTaxRate(quote) ? `Tax (${formatTaxRate(quote.tax_rate)})` : "Tax amount";
  const currencyPosition = input.settings?.currency_position;
  const rows = [
    ["Subtotal", formatMoneyForPdf(quote.subtotal, currency, currencyPosition)],
    input.settings?.show_discount === false ? null : ["Discount", formatMoneyForPdf(quote.discount, currency, currencyPosition)],
    input.settings?.show_taxable_subtotal === false ? null : ["Taxable subtotal", formatMoneyForPdf(taxableSubtotal, currency, currencyPosition)],
    ["Tax rate", taxRate],
    [taxLabel, formatMoneyForPdf(savedTaxAmount(quote), currency, currencyPosition)],
    input.settings?.show_delivery === false ? null : ["Delivery", formatMoneyForPdf(quote.delivery_fee, currency, currencyPosition)],
  ].filter((row): row is string[] => Boolean(row));
  const boxWidth = 252;
  const boxX = pageWidth - margin - boxWidth;
  const boxHeight = 146;

  layout.ensureSpace(boxHeight + 28);
  const top = layout.currentY();
  layout.rect(boxX, top - boxHeight, boxWidth, boxHeight, { fill: "#ffffff", stroke: "#d8dee8" });
  layout.textAt("Summary", boxX + 14, top - 20, { font: "bold", size: 10, color: layout.brandColor });

  rows.forEach(([label, value], index) => {
    const y = top - 40 - index * 15;
    layout.textAt(label, boxX + 14, y, { size: 8.5, color: "#475569" });
    layout.textAt(value, boxX + boxWidth - 14, y, { align: "right", size: 8.5 });
  });

  layout.line(boxX + 12, top - 121, boxX + boxWidth - 12, top - 121);
  layout.textAt("Grand total", boxX + 14, top - 137, { font: "bold", size: 11 });
  layout.textAt(formatMoneyForPdf(quote.total, currency, currencyPosition), boxX + boxWidth - 14, top - 137, {
    align: "right",
    font: "bold",
    size: 12,
    color: layout.brandColor,
  });

  layout.setY(top - boxHeight - 24);
}

function drawNotes(layout: PdfLayout, input: CustomerQuotePdfInput) {
  const notes = sanitizeText(input.quote.notes, "");
  if (!notes || input.settings?.show_notes !== true) return;

  const lines = wrapText(notes, bodyWidth - 24, 8.5);
  const height = 32 + lines.length * 11;
  layout.ensureSpace(height + 12);
  const top = layout.currentY();
  layout.rect(margin, top - height, bodyWidth, height, { fill: "#f8fafc", stroke: "#d8dee8" });
  layout.textAt("Notes", margin + 12, top - 18, { font: "bold", size: 9, color: layout.brandColor });
  lines.forEach((line, index) => {
    layout.textAt(line, margin + 12, top - 35 - index * 11, { size: 8.5, color: "#475569" });
  });
  layout.setY(top - height - 14);
}

function addFooters(layout: PdfLayout, input: CustomerQuotePdfInput) {
  const pages = layout.getPages();
  const footerText =
    sanitizeText(input.settings?.footer_text || input.organization.quote_footer_text, "") ||
    `This quotation is valid until ${formatDate(input.quote.valid_until)}.`;

  pages.forEach((page, index) => {
    page.commands.push(rectCommand(margin, 35, bodyWidth, 0.6, { fill: "#d8dee8" }));
    page.commands.push(textCommand(footerText, margin, 22, { size: 7.5, color: "#64748b" }));
    page.commands.push(textCommand(`Generated ${formatDate(new Date().toISOString())}`, margin, 11, { size: 7.5, color: "#64748b" }));
    page.commands.push(
      textCommand(`Page ${index + 1} of ${pages.length}`, pageWidth - margin, 11, {
        align: "right",
        size: 7.5,
        color: "#64748b",
      }),
    );
  });
}

function renderPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  pages.forEach((page) => {
    const stream = page.commands.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

export function generateCustomerQuotePdf(input: CustomerQuotePdfInput) {
  const currency = input.organization.currency || "TTD";
  const layout = new PdfLayout(safeBrandColor(input.settings?.accent_color || input.organization.brand_color));

  drawHeader(layout, input, currency);
  if (input.settings?.template !== "compact") {
    drawInfoBoxes(layout, input);
  }
  drawItemsTable(layout, input, currency);
  drawSummary(layout, input, currency);
  drawNotes(layout, input);
  addFooters(layout, input);

  return renderPdf(layout.getPages());
}

export function quotePdfFilename(quoteNumber: string) {
  const safeQuoteNumber = quoteNumber.replace(/[/\\?%*:|"<>]/g, "-").trim() || "customer-quote";
  return `${safeQuoteNumber}.pdf`;
}
