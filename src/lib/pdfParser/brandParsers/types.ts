import { ParsedPdfResult, PDFParsedData } from "../types";

export interface BrandInvoiceParser {
  brand: string;
  canParse(rawResult: ParsedPdfResult, fullText: string): boolean;
  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData;
}
