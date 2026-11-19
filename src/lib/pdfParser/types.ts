export interface RawPdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  hasEOL?: boolean;
}

export interface RawPdfPage {
  pageNumber: number;
  items: RawPdfTextItem[];
}

export interface TableBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedPdfTable {
  headers: string[];
  rows: string[][];
  data: Record<string, string>[];
  rowCount: number;
  colCount: number;
  bbox?: TableBoundingBox;
}

export interface ParsedPdfTextBlock {
  text: string;
  lines: string[];
  bbox?: TableBoundingBox;
}

export interface ParsedPdfPage {
  pageNumber: number;
  tables: ParsedPdfTable[];
  textBlocks: ParsedPdfTextBlock[];
  text: string;
}

export interface ParsedPdfMetadata {
  numPages: number;
  fingerprint?: string;
  info?: Record<string, any>;
}

export interface ParsedPdfResult {
  metadata?: ParsedPdfMetadata;
  pages?: ParsedPdfPage[];
  tables?: ParsedPdfTable[];
  text?: string;
}

export interface PDFParsedItem {
  itemName: string;
  Quantity: string;
  value: number;
}

export interface PDFParsedData {
  invoiceFrom: string;
  invoiceNumber: string;
  invoiceDate: number;
  totalAmount: number;
  finalTotalAmount: number;
  items: PDFParsedItem[];
}
