type ExtractionStatus = "completed" | "failed" | "skipped";
type ExtractionMethod = "pdf_text" | "image_ocr" | "scanned_pdf_ocr" | "manual" | "future_ai";

export type AttachmentTextExtractionResult = {
  status: ExtractionStatus;
  text: string;
  method: ExtractionMethod | null;
  error: string | null;
  raw: Record<string, unknown>;
};

type ExtractTextInput = {
  fileBuffer: Buffer;
  fileName: string;
  contentType: string | null;
};

type PdfParseFunctionResult = {
  numpages?: number;
  info?: Record<string, unknown>;
  text?: string;
};

async function loadPdfParse() {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse =
    (pdfParseModule as unknown as { default?: unknown }).default ||
    (pdfParseModule as unknown);

  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse did not export a callable parser");
  }

  return pdfParse as (buffer: Buffer) => Promise<PdfParseFunctionResult>;
}

const supportedImages = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
]);
const supportedImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

function normalizeContentType(contentType: string | null) {
  return (contentType || "").split(";")[0].trim().toLowerCase();
}

function previewText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function extractPdfText(fileBuffer: Buffer): Promise<AttachmentTextExtractionResult> {
  const pdfParse = await loadPdfParse();
  const parsed = await pdfParse(fileBuffer);
  const text = previewText(parsed.text || "");

  if (text.length <= 20) {
    return {
      status: "failed",
      text: "",
      method: "pdf_text",
      error: "No readable PDF text found. This PDF may be scanned or image-based.",
      raw: {
        pageCount: parsed.numpages ?? null,
        textLength: text.length,
        info: parsed.info ?? null,
        note: "This PDF may be scanned or image-based. Scanned PDF OCR will be added in a later phase.",
      },
    };
  }

  return {
    status: "completed",
    text,
    method: "pdf_text",
    error: null,
    raw: {
      pageCount: parsed.numpages ?? null,
      textLength: text.length,
      info: parsed.info ?? null,
    },
  };
}

async function extractImageText(fileBuffer: Buffer): Promise<AttachmentTextExtractionResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });

  try {
    const result = await worker.recognize(fileBuffer);
    const text = previewText(result.data.text || "");

    return {
      status: text ? "completed" : "failed",
      text,
      method: "image_ocr",
      error: text ? null : "No readable text found in image.",
      raw: {
        confidence: result.data.confidence,
        textLength: text.length,
      },
    };
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromAttachment({
  fileBuffer,
  fileName,
  contentType,
}: ExtractTextInput): Promise<AttachmentTextExtractionResult> {
  const normalizedType = normalizeContentType(contentType);
  const lowerFileName = fileName.toLowerCase();

  try {
    if (normalizedType === "application/pdf" || lowerFileName.endsWith(".pdf")) {
      return await extractPdfText(fileBuffer);
    }

    if (
      supportedImages.has(normalizedType) ||
      supportedImageExtensions.some((extension) => lowerFileName.endsWith(extension))
    ) {
      return await extractImageText(fileBuffer);
    }

    return {
      status: "skipped",
      text: "",
      method: null,
      error: "Unsupported attachment type.",
      raw: {
        contentType: normalizedType || null,
        fileName,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      text: "",
      method: normalizedType.startsWith("image/") ? "image_ocr" : "pdf_text",
      error: error instanceof Error ? error.message : "Attachment text extraction failed.",
      raw: {
        contentType: normalizedType || null,
        fileName,
      },
    };
  }
}
