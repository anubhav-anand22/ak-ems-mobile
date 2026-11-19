import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import {
  cleanDuplicatedWords,
  cleanItemName,
  parseCurrencyValue,
} from "../textUtils";

export const bigBasketParser: BrandInvoiceParser = {
  brand: "BigBasket",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("big basket") ||
      lower.includes("bigbasket") ||
      lower.includes("bbnow") ||
      lower.includes("innovative retail concepts") ||
      /\bIBNUP\w+/i.test(fullText)
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    const cleanedText = cleanDuplicatedWords(fullText);

    // 1. Invoice Number
    const ibnuMatch =
      cleanedText.match(/\b(IBNUP\w+)\b/i) || fullText.match(/\b(IBNUP\w+)\b/i);
    const invMatch =
      ibnuMatch ||
      cleanedText.match(/Invoice\s*Number\s*[:\s]*([A-Z0-9]+)/i) ||
      fullText.match(/Invoice\s*Number(?:\s*Invoice\s*Number)?\s*[:\s]*([A-Z0-9]+)/i);

    let invoiceNumber = "";
    if (invMatch) {
      const val = invMatch[1].trim();
      if (val.toLowerCase() !== "invoice" && val.toLowerCase() !== "number") {
        invoiceNumber = val;
      }
    }
    if (!invoiceNumber && ibnuMatch) {
      invoiceNumber = ibnuMatch[1].trim();
    }

    // 2. Invoice Date
    const dateMatch =
      cleanedText.match(/Invoice\s*Date\s*[:\s]*(\d{4}-\d{2}-\d{2})/i) ||
      fullText.match(/Invoice\s*Date(?:\s*Invoice\s*Date)?\s*[:\s]*(\d{4}-\d{2}-\d{2})/i) ||
      cleanedText.match(/(\d{4}-\d{2}-\d{2})/);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const subTotalMatch = fullText.match(
      /Sub\s*Total\s*[:\s]*(?:Rs\.?)?\s*([\d,.]+)/i,
    );
    if (subTotalMatch) {
      totalAmount = parseCurrencyValue(subTotalMatch[1]);
    }

    const payableMatch =
      fullText.match(/Payable\s*Amount\s*[:\s]*(?:Rs\.?)?\s*([\d,.]+)/i) ||
      fullText.match(/Final\s*Total\s*[:\s]*(?:Rs\.?)?\s*([\d,.]+)/i) ||
      fullText.match(
        /Total\s*Invoice\s*value\s*\(In\s*Figure\)\s*[:\s]*(?:Rs\.?)?\s*([\d,.]+)/i,
      );
    if (payableMatch) {
      finalTotalAmount = parseCurrencyValue(payableMatch[1]);
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    // Attempt 1: From structured tables if available and populated
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
            lh.includes("product")
          ) {
            descIdx = idx;
          } else if (lh.includes("qty") || lh.includes("quantity")) {
            qtyIdx = idx;
          } else if (
            lh.includes("total") ||
            lh.includes("amount") ||
            lh.includes("value")
          ) {
            totalIdx = idx;
          }
        });

        if (descIdx === -1 && table.colCount >= 4) descIdx = 1;
        if (qtyIdx === -1 && table.colCount >= 4) qtyIdx = 3;
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

            if (
              itemName &&
              value > 0 &&
              !itemName.toLowerCase().includes("handling charge") &&
              !itemName.toLowerCase().includes("sub total") &&
              !itemName.toLowerCase().includes("total value")
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

    // Attempt 2: Advanced text line scanner specifically tailored for BigBasket / bbnow invoice text stream
    if (items.length === 0) {
      const lines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tokens = line.split(/\s+/);
        const lastToken = tokens[tokens.length - 1];

        // Must start with an integer index and end with a price number, having at least 6 tokens
        if (
          tokens.length >= 6 &&
          /^\d+$/.test(tokens[0]) &&
          /^\d+(?:\.\d+)?$/.test(lastToken)
        ) {
          const value = parseFloat(lastToken);

          // Find HSN code (6-8 digit number)
          let hsnIdx = -1;
          for (let tIdx = 1; tIdx < Math.min(tokens.length - 3, 10); tIdx++) {
            if (/^\d{6,8}$/.test(tokens[tIdx])) {
              hsnIdx = tIdx;
              break;
            }
          }

          let quantity = "1";
          let itemSuffix = "";

          if (hsnIdx !== -1) {
            itemSuffix = tokens.slice(1, hsnIdx).join(" ");
            if (tokens[hsnIdx + 1] && /^\d+$/.test(tokens[hsnIdx + 1])) {
              quantity = tokens[hsnIdx + 1];
            }
          }

          // Find prefix from preceding 1-4 lines (ignoring tax percentage lines or return tags)
          let itemPrefix = "";
          for (let prevIdx = i - 1; prevIdx >= Math.max(0, i - 4); prevIdx--) {
            const prevLine = lines[prevIdx];
            if (
              /^(?:\d+(?:\.\d+)?%?\s*)+$/.test(prevLine) ||
              /\bDays?\s*Return\b/i.test(prevLine) ||
              /\bNon-Returnable\b/i.test(prevLine) ||
              /\bAmount\b/i.test(prevLine) ||
              /\bRate\b/i.test(prevLine)
            ) {
              continue;
            }
            if (
              /^(?:SI|HSN|Unit|Gross|Discount|Charges|Taxable|UTGST|CESS|TOTAL)/i.test(
                prevLine,
              )
            ) {
              break;
            }
            itemPrefix = prevLine;
            break;
          }

          let fullName = "";
          if (itemPrefix && itemSuffix) {
            fullName = `${itemPrefix} ${itemSuffix}`;
          } else {
            fullName = itemPrefix || itemSuffix;
          }

          // Strip any trailing tax percentages from item description
          fullName = fullName.replace(/(?:\s+\d+(?:\.\d+)?%)+$/, "");
          const cleanedName = cleanItemName(fullName);

          if (cleanedName && value > 0) {
            items.push({
              itemName: cleanedName,
              Quantity: quantity,
              value,
            });
          }
        }
      }
    }

    // Totals fallback
    const itemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;
    if (totalAmount === 0 && itemsSum > 0) {
      totalAmount = itemsSum;
    }
    if (finalTotalAmount === 0) {
      finalTotalAmount = totalAmount || itemsSum;
    }

    return {
      invoiceFrom: "BigBasket",
      invoiceNumber,
      invoiceDate,
      totalAmount,
      finalTotalAmount,
      items,
    };
  },
};
