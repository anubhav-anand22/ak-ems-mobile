import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

export const amazonParser: BrandInvoiceParser = {
  brand: "Amazon",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("amazon") ||
      lower.includes("appario") ||
      lower.includes("cloudtail") ||
      lower.includes("amazon seller services") ||
      lower.includes("amazon.in")
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice Number
    const invMatch =
      fullText.match(/Invoice\s*Number\s*[:\s]*([A-Z0-9/-]+)/i) ||
      fullText.match(/Invoice\s*No\.?\s*[:\s]*([A-Z0-9/-]+)/i);
    const invoiceNumber = invMatch ? invMatch[1].trim() : "";

    // 2. Invoice Date
    const dateMatch =
      fullText.match(/Invoice\s*Date\s*[:\s]*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i) ||
      fullText.match(/Order\s*Date\s*[:\s]*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const totalMatch =
      fullText.match(/(?:TOTAL|Grand\s*Total|Invoice\s*Amount)\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/i) ||
      fullText.match(/(?:Total\s*Amount)\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/i);
    if (totalMatch) {
      finalTotalAmount = parseCurrencyValue(totalMatch[1]);
      totalAmount = finalTotalAmount;
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        let descIdx = -1;
        let qtyIdx = -1;
        let totalIdx = -1;

        table.headers.forEach((h, idx) => {
          const lh = h.toLowerCase();
          if (
            lh.includes("description") ||
            lh.includes("title") ||
            lh.includes("item")
          ) {
            descIdx = idx;
          } else if (lh.includes("qty") || lh.includes("quantity")) {
            qtyIdx = idx;
          } else if (
            lh.includes("total") ||
            lh.includes("amount")
          ) {
            totalIdx = idx;
          }
        });

        if (descIdx === -1 && table.colCount >= 4) descIdx = 1;
        if (qtyIdx === -1 && table.colCount >= 4) qtyIdx = 2;
        if (totalIdx === -1 && table.colCount >= 4)
          totalIdx = table.colCount - 1;

        if (descIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const rawName = row[descIdx] || "";
            const rawQty = qtyIdx !== -1 ? row[qtyIdx] : "1";
            const rawVal = row[totalIdx] || "";

            const itemName = cleanItemName(rawName);
            const value = parseCurrencyValue(rawVal);
            const qtyMatch = (rawQty || "").match(/\d+/);
            const Quantity = qtyMatch ? qtyMatch[0] : "1";

            const lowerName = itemName.toLowerCase();
            if (
              itemName &&
              value > 0 &&
              !lowerName.includes("total") &&
              !lowerName.includes("grand total")
            ) {
              items.push({
                itemName,
                Quantity,
                value,
              });
            }
          }
        }
      }
    }

    const itemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;
    if (totalAmount === 0) {
      totalAmount = itemsSum;
    }
    if (finalTotalAmount === 0) {
      finalTotalAmount = totalAmount || itemsSum;
    }

    return {
      invoiceFrom: "Amazon",
      invoiceNumber,
      invoiceDate,
      totalAmount,
      finalTotalAmount,
      items,
    };
  },
};
