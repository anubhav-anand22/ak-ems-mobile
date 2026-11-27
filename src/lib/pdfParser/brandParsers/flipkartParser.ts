import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

const FLIPKART_CATEGORY_PREFIXES = [
  "Fresh Vegetable",
  "Fresh Fruit",
  "Flours & Sooji",
  "Paste & Purees",
  "Chocolates",
  "Biscuits & Cookies",
  "Chips & Namkeen",
  "Tea & Coffee",
  "Dairy & Bakery",
  "Edible Oils",
  "Spices & Masalas",
  "Rice & Grains",
  "Pulses",
  "Dry Fruits",
  "Personal Care",
  "Home Care",
  "Beverages",
  "Sauces & Spreads",
  "Noodles & Pasta",
];

function stripFlipkartCategoryPrefix(raw: string): string {
  let text = raw.trim();
  for (const cat of FLIPKART_CATEGORY_PREFIXES) {
    const escaped = cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${escaped}\\s+(.+)$`, "i");
    const m = text.match(re);
    if (m && m[1].trim().length > 0) {
      return m[1].trim();
    }
  }
  return text;
}

export const flipkartParser: BrandInvoiceParser = {
  brand: "Flipkart",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("flipkart") ||
      lower.includes("cigfil") ||
      (lower.includes("fsn:") && lower.includes("hsn/sac:"))
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice Number(s) - supports multi-invoice PDFs
    const invMatches = [
      ...fullText.matchAll(
        /Invoice\s*(?:Number|No\.?)\s*[#:\s]*([A-Z0-9-]+)/gi,
      ),
    ];
    const uniqueInvoices = Array.from(
      new Set(
        invMatches
          .map((m) => m[1].trim())
          .filter(
            (val) =>
              val.length >= 6 &&
              !/^(?:date|value|details)$/i.test(val),
          ),
      ),
    );
    const invoiceNumber = uniqueInvoices.join(", ");

    // 2. Invoice Date
    const dateMatch =
      fullText.match(
        /Invoice\s*Date\s*[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i,
      ) ||
      fullText.match(
        /Order\s*Date\s*[:\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
      );
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Per-page sections (Flipkart Grocery/Minutes puts each seller invoice on its own page)
    const pagesText =
      rawResult.pages && rawResult.pages.length > 0
        ? rawResult.pages.map((p) => p.text).filter(Boolean)
        : [fullText];

    let totalAmount = 0;
    let finalTotalAmount = 0;

    for (const pageText of pagesText) {
      const grandTotalMatch = pageText.match(
        /Grand\s*Total\s*(?:Rs\.?|₹)?\s*([\d,.]+)/i,
      );
      const summaryRowMatch = pageText.match(
        /^\s*Total\s+\d+\s+[\d,.-]+\s+-?[\d,.-]+\s+[\d,.-]+\s+[\d,.-]+\s+[\d,.-]+\s+([\d,.]+)\s*$/m,
      );

      if (summaryRowMatch) {
        totalAmount += parseCurrencyValue(summaryRowMatch[1]);
      } else if (grandTotalMatch) {
        totalAmount += parseCurrencyValue(grandTotalMatch[1]);
      }

      if (grandTotalMatch) {
        finalTotalAmount += parseCurrencyValue(grandTotalMatch[1]);
      } else if (summaryRowMatch) {
        finalTotalAmount += parseCurrencyValue(summaryRowMatch[1]);
      }
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    // Build known titles per page from structured Flipkart tables if available
    // (helps separate `Product` category vs `Title` accurately when line-scanner sees them together)
    const knownCategories = new Set<string>();
    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        const hdrs = table.headers.map((h) => h.toLowerCase());
        const prodIdx = hdrs.findIndex((h) => h.includes("product"));
        const titleIdx = hdrs.findIndex((h) => h.includes("title"));
        const qtyIdx = hdrs.findIndex(
          (h) => h === "qty" || h.includes("quantity"),
        );
        const totalIdx = hdrs.findIndex((h) => h.includes("total"));

        if (prodIdx !== -1 && titleIdx !== -1 && qtyIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const catRaw = (row[prodIdx] || "").split("\n")[0].trim();
            if (
              catRaw &&
              !/^(?:FSN:|HSN\/SAC:|Amount|₹|Total)/i.test(catRaw) &&
              catRaw.length < 40
            ) {
              knownCategories.add(catRaw);
            }
          }
        }
      }
    }

    const stripDetectedCategory = (raw: string): string => {
      for (const cat of knownCategories) {
        if (raw.startsWith(`${cat} `) && raw.length > cat.length + 1) {
          return raw.slice(cat.length).trim();
        }
      }
      return stripFlipkartCategoryPrefix(raw);
    };

    // Attempt 1: Clean structured tables (when each item has non-empty Title and Total column)
    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        const hdrs = table.headers.map((h) => h.toLowerCase());
        const titleIdx = hdrs.findIndex((h) => h.includes("title"));
        const qtyIdx = hdrs.findIndex(
          (h) => h === "qty" || h.includes("quantity"),
        );
        const totalIdx = hdrs.findIndex((h) => h.includes("total"));

        if (titleIdx !== -1 && qtyIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const rawTitleCell = (row[titleIdx] || "").trim();
            if (!rawTitleCell) continue;

            // Remove tax lines appended inside Title multi-line cell
            const titleLines = rawTitleCell
              .split("\n")
              .map((l) => l.trim())
              .filter(
                (l) =>
                  l &&
                  !/^(?:SGST|CGST|IGST|UTGST)\b/i.test(l) &&
                  !/^Amount\s*₹/i.test(l) &&
                  l !== "₹",
              );
            const itemName = cleanItemName(titleLines.join(" "));
            const lowerName = itemName.toLowerCase();

            const qtyMatch = (row[qtyIdx] || "").match(/\d+/);
            const value = parseCurrencyValue(row[totalIdx] || "");

            if (
              itemName &&
              value > 0 &&
              !lowerName.includes("handling fee") &&
              !lowerName.includes("grand total") &&
              lowerName !== "total"
            ) {
              items.push({
                itemName,
                Quantity: qtyMatch ? qtyMatch[0] : "1",
                value,
              });
            }
          }
        }
      }
    }

    const tableItemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;

    // Attempt 2: Page-by-page line scanner (handles merged Product+Title or multi-line Title on FSN line)
    if (
      items.length === 0 ||
      (totalAmount > 0 && Math.abs(tableItemsSum - totalAmount) > 0.5)
    ) {
      const textItems: PDFParsedItem[] = [];

      for (const pageText of pagesText) {
        const lines = pageText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        let inTable = false;
        let currentItem: {
          nameParts: string[];
          quantity: string;
          value: number;
          isHandlingFee: boolean;
        } | null = null;

        const flushCurrent = () => {
          if (!currentItem) return;
          if (!currentItem.isHandlingFee && currentItem.value > 0) {
            const fullTitle = cleanItemName(currentItem.nameParts.join(" "));
            if (fullTitle) {
              textItems.push({
                itemName: fullTitle,
                Quantity: currentItem.quantity,
                value: currentItem.value,
              });
            }
          }
          currentItem = null;
        };

        for (const line of lines) {
          if (/^Product\s+Title\s+Qty\b/i.test(line)) {
            inTable = true;
            continue;
          }
          if (!inTable) continue;

          if (/^(?:Grand\s*Total\b|Returns\s*Policy\b|Regd\.\s*office\b)/i.test(line)) {
            flushCurrent();
            inTable = false;
            continue;
          }

          // Summary row: "Total 3 209.00 -20.00 189.00 0.00 0.00 189.00"
          if (/^Total\s+\d+\s+[\d,.-]+/i.test(line)) {
            flushCurrent();
            inTable = false;
            continue;
          }

          // Main item row OR Handling Fee row:
          // "<Prefix> <Qty> <Gross> <Disc> <Taxable> <SGST> <CGST> <Total>"
          const rowMatch = line.match(
            /^(.+?)\s+(\d+)\s+[\d,.]+\s+-?[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+([\d,.]+)\s*$/,
          );
          if (rowMatch) {
            flushCurrent();
            const rawPrefix = rowMatch[1].trim();
            const qty = rowMatch[2];
            const val = parseCurrencyValue(rowMatch[3]);
            const isFee = /\bHandling\s*Fee\b/i.test(rawPrefix);

            const titleOnly = isFee ? rawPrefix : stripDetectedCategory(rawPrefix);
            currentItem = {
              nameParts: titleOnly ? [titleOnly] : [],
              quantity: qty,
              value: val,
              isHandlingFee: isFee,
            };
            continue;
          }

          // Continuation lines inside an item block before Handling Fee / next item
          if (currentItem && !currentItem.isHandlingFee) {
            // Line like: "FSN: Chocolate Bar" -> extract "Chocolate Bar"
            const fsnLineMatch = line.match(/^FSN:\s*(.+)$/i);
            if (fsnLineMatch) {
              const remainder = fsnLineMatch[1]
                .replace(/\b(?:SGST|CGST|IGST|UTGST)\/?(?:UTGST)?\s*:.*$/i, "")
                .trim();
              if (remainder && !/^[A-Z0-9]{10,}$/.test(remainder)) {
                currentItem.nameParts.push(remainder);
              }
              continue;
            }

            // Skip pure metadata lines: FSN value (e.g. VEGGH6YPVKGHXMQW CGST: 0.0 %), HSN/SAC, tax rates
            if (
              /^(?:[A-Z0-9]{12,}|HSN\/SAC:|SGST|CGST|IGST|UTGST)/i.test(line) ||
              /^[\d.]+%$/.test(line)
            ) {
              continue;
            }

            const cleanedCont = line
              .replace(/\b(?:SGST|CGST|IGST|UTGST)\/?(?:UTGST)?\s*:.*$/i, "")
              .trim();
            if (cleanedCont && !/^[A-Z0-9]{12,}$/.test(cleanedCont)) {
              currentItem.nameParts.push(cleanedCont);
            }
          }
        }

        flushCurrent();
      }

      if (textItems.length > 0) {
        items.length = 0;
        items.push(...textItems);
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
      invoiceFrom: "Flipkart",
      invoiceNumber,
      invoiceDate,
      totalAmount: Math.round(totalAmount * 100) / 100,
      finalTotalAmount: Math.round(finalTotalAmount * 100) / 100,
      items,
    };
  },
};
