import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

const MFR_CONTINUATION_RE =
  /^(?:Pharmaceuticals?(?:\s+Pvt\.?)?(?:\s+Ltd\.?)?|Pvt\.?\s*Ltd\.?|Private\s+Limited|Limited|Ltd\.?|Labs?\s*Ltd\.?|Healthcare)$/i;

function stripManufacturerName(raw: string): string {
  let cleaned = raw.trim();

  // Remove batch no. token if it somehow remained at the end
  cleaned = cleaned.replace(/\s+[A-Z0-9-]{4,}\s*$/, (m) => {
    const token = m.trim();
    return /\d/.test(token) && !/\b\d+\s*(?:mg|ml|gm|g|kg|mcg|iu|s|tab|cap)\b/i.test(token)
      ? ""
      : m;
  });

  // Common manufacturer phrases placed right before Batch No. in Tata 1mg tables
  const patterns: RegExp[] = [
    /\s+(?:Dr\.?\s+Morepen|Zeelab\s+Pharmacy|Micro\s+Labs|Bayer\s+Pharmaceuticals|Bayer|Cipla|Sun\s+Pharma|Abbott|GSK|Mankind|Alkem|Lupin|Torrent|Cadila|Zydus|Glenmark|Intas|Aristo|Macleods|Sanofi|Pfizer|Himalaya|Dabur|Patanjali|Reckitt|Nestle|Johnson\s*&\s*Johnson|Procter\s*&\s*Gamble)(?:\s+(?:Pharmaceuticals?|Pharmacy|Labs?|Laboratories|Healthcare|India|Private|Pvt\.?|Limited|Ltd\.?))*$/i,
    /\s+(?:[A-Z][A-Za-z.&-]+\s+){1,4}(?:Pharmaceuticals?|Pharmacy|Laboratories|Labs|Healthcare)(?:\s+(?:Private|Pvt\.?|Limited|Ltd\.?))*$/i,
    /\s+(?:[A-Z][A-Za-z.&-]+\s+){1,3}(?:Private\s+Limited|Pvt\.?\s*Ltd\.?|Limited|Ltd\.?)$/i,
  ];

  for (const re of patterns) {
    cleaned = cleaned.replace(re, "");
  }

  // Also strip isolated trailing MFR continuation tokens like "Pharmaceuticals Pvt" or "Ltd"
  cleaned = cleaned.replace(
    /\s+(?:Pharmaceuticals?(?:\s+Pvt\.?)?|Pvt\.?\s*Ltd\.?|Pvt\.|Ltd\.?)$/i,
    "",
  );

  return cleaned.trim();
}

export const tata1mgParser: BrandInvoiceParser = {
  brand: "Tata 1mg",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("tata 1mg") ||
      lower.includes("1mg healthcare") ||
      lower.includes("care@1mg.com")
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice Number(s)
    const invMatches = [
      ...fullText.matchAll(/Invoice\s*(?:no\.?|number)\s*[:\s]*([A-Z0-9-]+)/gi),
    ];
    const uniqueInvoices = Array.from(
      new Set(
        invMatches
          .map((m) => m[1].trim())
          .filter(
            (val) =>
              val.length > 2 &&
              !["no", "number", "date", "for", "purpose"].includes(
                val.toLowerCase(),
              ),
          ),
      ),
    );
    const invoiceNumber = uniqueInvoices.join(", ");

    // 2. Invoice Date
    const dateMatch =
      fullText.match(
        /(?:Invoice\s*)?Date\s*[:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
      ) || fullText.match(/(\d{4}-\d{2}-\d{2})/);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts (Page 2 / summary section)
    const billMatches = [
      ...fullText.matchAll(/BILL\s*AMOUNT\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/gi),
    ];
    const payableMatches = [
      ...fullText.matchAll(
        /PAYABLE\s*AMOUNT\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/gi,
      ),
    ];

    let totalAmount = billMatches.reduce(
      (sum, m) => sum + parseCurrencyValue(m[1]),
      0,
    );
    let finalTotalAmount = payableMatches.reduce(
      (sum, m) => sum + parseCurrencyValue(m[1]),
      0,
    );

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    // Attempt 1: Clean structured tables (synthetic tests or cleanly split columns)
    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        const headerJoined = table.headers.join(" ").toLowerCase();
        if (
          !headerJoined.includes("product") ||
          (!headerJoined.includes("total") && !headerJoined.includes("amt"))
        ) {
          continue;
        }

        let descIdx = -1;
        let qtyIdx = -1;
        let totalIdx = -1;

        table.headers.forEach((h, idx) => {
          const lh = h.toLowerCase();
          if (
            descIdx === -1 &&
            (lh.includes("product") || lh.includes("description")) &&
            !lh.includes("mfr")
          ) {
            descIdx = idx;
          } else if (lh === "qty" || lh.includes("quantity")) {
            qtyIdx = idx;
          } else if (lh.includes("total")) {
            totalIdx = idx;
          }
        });

        if (descIdx !== -1 && qtyIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const rawName = (row[descIdx] || "").trim();
            const rawQty = (row[qtyIdx] || "").trim();
            const rawVal = (row[totalIdx] || "").trim();

            if (!rawName || /^date$/i.test(rawName)) continue;

            const qtyMatch = rawQty.match(/^\d+/);
            const value = parseCurrencyValue(rawVal);
            const itemName = cleanItemName(rawName);

            if (
              itemName &&
              qtyMatch &&
              value > 0 &&
              !itemName.toLowerCase().includes("total")
            ) {
              items.push({
                itemName,
                Quantity: qtyMatch[0],
                value,
              });
            }
          }
        }
      }
    }

    const tableItemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;

    // Attempt 2: Full-text / per-page line scanner (handles wrapped MFR/Product cols)
    if (
      items.length === 0 ||
      (totalAmount > 0 && Math.abs(tableItemsSum - totalAmount) > 1)
    ) {
      const textItems: PDFParsedItem[] = [];
      const pagesText =
        rawResult.pages && rawResult.pages.length > 0
          ? rawResult.pages.map((p) => p.text).filter(Boolean)
          : [fullText];

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
          isFee: boolean;
        } | null = null;

        const flushCurrent = () => {
          if (!currentItem) return;
          const combined = currentItem.nameParts
            .map((part) => (currentItem!.isFee ? part : stripManufacturerName(part)))
            .filter(Boolean)
            .join(" ");
          const itemName = cleanItemName(combined);
          if (itemName && currentItem.value > 0) {
            textItems.push({
              itemName,
              Quantity: currentItem.quantity,
              value: currentItem.value,
            });
          }
          currentItem = null;
        };

        for (const line of lines) {
          if (/^SR\.\s*PRODUCT\s*NAME/i.test(line)) {
            inTable = true;
            continue;
          }

          if (!inTable) {
            continue;
          }

          if (/^(?:DATE\b.*AMT\.|TOTAL\s*QUANTITY|GST\s+Taxable|GROSS\s*AMOUNT)/i.test(line)) {
            if (/^(?:TOTAL\s*QUANTITY|GST\s+Taxable|GROSS\s*AMOUNT)/i.test(line)) {
              flushCurrent();
              inTable = false;
            }
            continue;
          }

          // Medicine row: starts with SR number, contains EXP DATE (MM/YY), ends with HSN GST% GST_AMT TOTAL
          const medMatch = line.match(
            /^(\d+)\s+(.+?)\s+(\d{2}\/\d{2})\s+(\d+(?:\.\d+)?)\s+(?:[\d,.]+\s+){2,5}\d{6,8}\s+[\d.]+\s+[\d.]+\s+([\d,.]+)\s*$/,
          );
          if (medMatch) {
            flushCurrent();
            const prefixBeforeExp = medMatch[2].trim();
            // Drop trailing Batch No. token right before MM/YY
            const tokens = prefixBeforeExp.split(/\s+/);
            if (tokens.length >= 2) {
              tokens.pop();
            }
            const nameOnly = stripManufacturerName(tokens.join(" "));
            currentItem = {
              nameParts: nameOnly ? [nameOnly] : [],
              quantity: String(Math.round(parseFloat(medMatch[4])) || 1),
              value: parseCurrencyValue(medMatch[5]),
              isFee: false,
            };
            continue;
          }

          // Charge / Fee row: e.g. "2 Shipping Fee - OTH 1 0.00 14.84 996812 12 1.78 16.62"
          const feeMatch = line.match(
            /^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+[\d,.]+\s+[\d,.]+\s+\d{6,8}\s+[\d.]+\s+[\d.]+\s+([\d,.]+)\s*$/,
          );
          if (feeMatch) {
            flushCurrent();
            currentItem = {
              nameParts: [feeMatch[2].trim()],
              quantity: String(Math.round(parseFloat(feeMatch[3])) || 1),
              value: parseCurrencyValue(feeMatch[4]),
              isFee: true,
            };
            continue;
          }

          // Wrapped continuation lines for product name / manufacturer name
          if (currentItem && !currentItem.isFee) {
            if (
              !MFR_CONTINUATION_RE.test(line) &&
              !/^[\d\s.%₹-]+$/.test(line)
            ) {
              const stripped = stripManufacturerName(line);
              if (stripped && !MFR_CONTINUATION_RE.test(stripped)) {
                currentItem.nameParts.push(stripped);
              }
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
      invoiceFrom: "Tata 1mg",
      invoiceNumber,
      invoiceDate,
      totalAmount: Math.round(totalAmount * 100) / 100,
      finalTotalAmount: Math.round(finalTotalAmount * 100) / 100,
      items,
    };
  },
};
