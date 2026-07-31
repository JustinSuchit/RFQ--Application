declare module "pdf-parse" {
  type PdfParseResult = {
    numpages?: number;
    info?: Record<string, unknown>;
    text: string;
  };

  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    numpages?: number;
    info?: Record<string, unknown>;
    text?: string;
  };

  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}
