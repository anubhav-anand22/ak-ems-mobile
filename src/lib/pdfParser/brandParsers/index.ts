import { ParsedPdfResult, PDFParsedData } from "../types";
import { BrandInvoiceParser } from "./types";
import { bigBasketParser } from "./bigBasketParser";
import { blinkitParser } from "./blinkitParser";
import { zeptoParser } from "./zeptoParser";
import { amazonParser } from "./amazonParser";
import { tata1mgParser } from "./tata1mgParser";
import { flipkartParser } from "./flipkartParser";
import { genericParser } from "./genericParser";

export * from "./types";
export * from "./bigBasketParser";
export * from "./blinkitParser";
export * from "./zeptoParser";
export * from "./amazonParser";
export * from "./tata1mgParser";
export * from "./flipkartParser";
export * from "./genericParser";

const BRAND_PARSERS: BrandInvoiceParser[] = [
  bigBasketParser,
  blinkitParser,
  zeptoParser,
  amazonParser,
  tata1mgParser,
  flipkartParser,
  genericParser,
];

/**
 * Automatically identifies the invoice format/brand (BigBasket, Blinkit, Zepto, Amazon, etc.)
 * and parses it into clean structured `PDFParsedData`.
 */
export function parseInvoiceData(rawResult: ParsedPdfResult): PDFParsedData {
  if (!rawResult || !rawResult.pages || rawResult.pages.length === 0) {
    return {
      invoiceFrom: "",
      invoiceNumber: "",
      invoiceDate: Date.now(),
      totalAmount: 0,
      finalTotalAmount: 0,
      items: [],
    };
  }

  const fullText = rawResult.text || "";

  for (const parser of BRAND_PARSERS) {
    if (parser.canParse(rawResult, fullText)) {
      try {
        const result = parser.parse(rawResult, fullText);
        if (result && result.items && result.items.length > 0) {
          return result;
        }
        // If brand matched but extracted 0 items, check if generic or another handles it better
        if (result && result.invoiceNumber) {
          return result;
        }
      } catch {
        // Fallback to next parser
      }
    }
  }

  return genericParser.parse(rawResult, fullText);
}
