import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

export const genericParser: BrandInvoiceParser = {
  brand: "Generic",

  canParse(): boolean {
    return true; // Always available as fallback
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice From / Seller
    let invoiceFrom = "Invoice";
    const sellerMatch =
      fullText.match(/Seller\s*Name\s*[:\s]*([^\n]+)/i) ||
      fullText.match(/Sold\s*By\s*[:\s]*([^\n]+)/i) ||
      fullText.match(/Supplier\s*[:\s]*([^\n]+)/i) ||
      fullText.match(/Details\s*of\s*Supplier\s*[:\s]*([^\n]+)/i);

    if (sellerMatch) {
      invoiceFrom = cleanItemName(sellerMatch[1].split(",")[0].trim());
    } else {
      // Pick first meaningful non-header line if available
      const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (
          !lower.includes("tax invoice") &&
          !lower.includes("original") &&
          !lower.includes("bill of supply") &&
          line.length > 3 &&
          line.length < 50
        ) {
          invoiceFrom = line;
          break;
        }
      }
    }

    // 2. Invoice Number
    const invMatch =
      fullText.match(/Invoice\s*(?:No\.?|Number)\s*[:\s]*([A-Z0-9/-]+)/i) ||
      fullText.match(/Bill\s*No\.?\s*[:\s]*([A-Z0-9/-]+)/i);
    const invoiceNumber = invMatch ? invMatch[1].trim() : "";

    // 3. Invoice Date
    const dateMatch =
      fullText.match(/(?:Invoice\s*Date|Date\s*of\s*Invoice|Date)\s*[:\s]*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i) ||
      fullText.match(/(\d{4}-\d{2}-\d{2})/) ||
      fullText.match(/(\d{2}-\d{2}-\d{4})/);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 4. Amounts
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const subTotalMatch = fullText.match(
      /(?:Sub\s*Total|Item\s*Total)\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/i,
    );
    if (subTotalMatch) {
      totalAmount = parseCurrencyValue(subTotalMatch[1]);
    }

    const totalMatch =
      fullText.match(
        /(?:Grand\s*Total|Final\s*Total|Invoice\s*Value|Payable\s*Amount|Total\s*Amount|TOTAL)\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/i,
      );
    if (totalMatch) {
      finalTotalAmount = parseCurrencyValue(totalMatch[1]);
    }

    // 5. Line items
    const items: PDFParsedItem[] = [];

    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        let descIdx = -1;
        let qtyIdx = -1;
        let totalIdx = -1;

        table.headers.forEach((h, idx) => {
          const lh = h.toLowerCase();
          if (
            lh.includes("item") ||
            lh.includes("description") ||
            lh.includes("product") ||
            lh.includes("particulars") ||
            lh.includes("goods")
          ) {
            descIdx = idx;
          } else if (lh.includes("qty") || lh.includes("quantity")) {
            qtyIdx = idx;
          } else if (
            lh.includes("total") ||
            lh.includes("amount") ||
            lh.includes("value") ||
            lh.includes("net")
          ) {
            totalIdx = idx;
          }
        });

        if (descIdx === -1 && table.colCount >= 3) descIdx = 1;
        if (qtyIdx === -1 && table.colCount >= 3) qtyIdx = 2;
        if (totalIdx === -1 && table.colCount >= 3)
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
              !lowerName.includes("sub total") &&
              !lowerName.includes("grand total") &&
              !lowerName.includes("total amount") &&
              !lowerName.includes("invoice value")
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
      invoiceFrom,
      invoiceNumber,
      invoiceDate,
      totalAmount,
      finalTotalAmount,
      items,
    };
  },
};
