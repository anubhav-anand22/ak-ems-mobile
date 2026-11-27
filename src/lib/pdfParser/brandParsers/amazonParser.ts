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
    // 1. Invoice Number(s) (supports multi-seller Amazon PDFs)
    const invMatches = [
      ...fullText.matchAll(/Invoice\s*(?:Number|No\.?)\s*[:\s]*([A-Z0-9/-]+)/gi),
    ];
    const uniqueInvoices = Array.from(
      new Set(
        invMatches
          .map((m) => m[1].trim())
          .filter(
            (v) =>
              v.length > 2 &&
              !["details", "date", "value", "number", "no"].includes(
                v.toLowerCase(),
              ),
          ),
      ),
    );
    const invoiceNumber = uniqueInvoices.join(", ");

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

    // Amazon table footer prints "TOTAL: ₹<taxTotal> ₹<grandTotal>" — always take the LAST currency value on each TOTAL: line!
    const totalLineMatches = [...fullText.matchAll(/^TOTAL\s*:([^\n]+)/gim)];
    if (totalLineMatches.length > 0) {
      for (const m of totalLineMatches) {
        const amounts = m[1].match(/(?:Rs\.?|₹)?\s*([\d,.]+)/gi);
        if (amounts && amounts.length > 0) {
          finalTotalAmount += parseCurrencyValue(amounts[amounts.length - 1]);
        }
      }
      totalAmount = finalTotalAmount;
    } else {
      const invValMatches = [
        ...fullText.matchAll(
          /Invoice\s*Value\s*[:\s\n]*(?:Rs\.?|₹)?\s*([\d,.]+)/gi,
        ),
      ];
      if (invValMatches.length > 0) {
        finalTotalAmount = invValMatches.reduce(
          (sum, m) => sum + parseCurrencyValue(m[1]),
          0,
        );
        totalAmount = finalTotalAmount;
      } else {
        const totalMatch =
          fullText.match(
            /(?:Grand\s*Total|Invoice\s*Amount|Total\s*Amount)\s*[:\s]*(?:Rs\.?|₹)?\s*([\d,.]+)/i,
          );
        if (totalMatch) {
          finalTotalAmount = parseCurrencyValue(totalMatch[1]);
          totalAmount = finalTotalAmount;
        }
      }
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    // Attempt 1: Structured tables (synthetic or cleanly column-separated tables)
    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        const hdrJoined = table.headers.join(" ").toLowerCase();
        if (!hdrJoined.includes("description") && !hdrJoined.includes("title")) {
          continue;
        }

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
          } else if (lh.includes("total")) {
            totalIdx = idx;
          }
        });

        if (totalIdx === -1) {
          table.headers.forEach((h, idx) => {
            if (h.toLowerCase().includes("amount")) {
              totalIdx = idx;
            }
          });
        }

        if (descIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const rawName = row[descIdx] || "";
            const rawQty = qtyIdx !== -1 ? row[qtyIdx] : "1";
            const rawVal = row[totalIdx] || "";

            const cleanedAsin = rawName
              .replace(/\|\s*B[A-Z0-9]{9}\s*(?:\([^)]*\)?)?/gi, "")
              .replace(/\bHSN\s*:\s*\d+/gi, "");
            const itemName = cleanItemName(cleanedAsin);
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

    const tableItemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;

    // Attempt 2: Full-text / page line scanner (handles Amazon PDFs with split CGST/SGST tax sub-rows)
    if (
      items.length === 0 ||
      (finalTotalAmount > 0 && Math.abs(tableItemsSum - finalTotalAmount) > 1)
    ) {
      const textItems: PDFParsedItem[] = [];
      const pagesText =
        rawResult.pages && rawResult.pages.length > 0
          ? rawResult.pages.map((p) => p.text).filter(Boolean)
          : [fullText];

      const priceAnchorRe =
        /^(.*?)\s*(?:Rs\.?|₹)\s*[\d,.]+\s+(\d+)\s+(?:Rs\.?|₹)\s*[\d,.]+\s+[\d.]+%\s+(?:CGST|SGST|IGST|UTGST)\s+(?:Rs\.?|₹)\s*[\d,.]+\s+(?:Rs\.?|₹)\s*([\d,.]+)\s*$/i;

      for (const pageText of pagesText) {
        const lines = pageText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        let inTable = false;
        let descBuffer: string[] = [];
        let pendingItem: { item: PDFParsedItem; rawParts: string[] } | null =
          null;

        const commitPending = () => {
          if (!pendingItem) return;
          const cleaned = cleanItemName(
            pendingItem.rawParts
              .join(" ")
              .replace(/\|\s*B[A-Z0-9]{9}(?:\s*\([^)]*\)?)?/gi, "")
              .replace(/\bHSN\s*:\s*\d+/gi, ""),
          );
          if (cleaned) {
            pendingItem.item.itemName = cleaned;
            textItems.push(pendingItem.item);
          }
          pendingItem = null;
        };

        for (const line of lines) {
          if (
            /\bPrice\s+Amount\s+Rate\s+Type\s+Amount\s+Amount\b/i.test(line) ||
            /^Sl\.\s+Unit\s+Net\s+Tax\b/i.test(line)
          ) {
            commitPending();
            inTable = true;
            descBuffer = [];
            continue;
          }

          if (!inTable) continue;

          if (/^TOTAL\s*:/i.test(line)) {
            commitPending();
            inTable = false;
            descBuffer = [];
            continue;
          }

          // Skip table subheaders & SGST tax continuation lines; also closes any open wrapped suffix
          if (
            /^(?:No|Description|Qty|Price)$/i.test(line) ||
            /^[)\s]+$/.test(line) ||
            /^HSN\s*:/i.test(line) ||
            /^[\d.]+%\s*(?:CGST|SGST|IGST|UTGST)\s*(?:Rs\.?|₹)/i.test(line)
          ) {
            commitPending();
            continue;
          }

          // Check if this line carries the price / qty / total columns
          const anchorMatch = line.match(priceAnchorRe);
          if (anchorMatch) {
            commitPending();
            const inlinePrefix = anchorMatch[1].trim();
            if (inlinePrefix) {
              descBuffer.push(inlinePrefix);
            }

            const rawParts = descBuffer.filter((part) => !/^\d{1,2}$/.test(part));
            const qty = anchorMatch[2];
            const value = parseCurrencyValue(anchorMatch[3]);

            if (value > 0) {
              pendingItem = {
                item: { itemName: "", Quantity: qty, value },
                rawParts,
              };
            }

            descBuffer = [];
            continue;
          }

          // If an item's price line just appeared before its wrapped ASIN/suffix tail (before HSN:), attach it!
          if (pendingItem) {
            if (/^\d+\s+[A-Za-z]/.test(line)) {
              // Next numbered item already started without HSN line
              commitPending();
            } else {
              pendingItem.rawParts.push(line);
              continue;
            }
          }

          // Otherwise accumulate description lines (skip bare serial numbers on their own line)
          if (!/^\d{1,2}$/.test(line)) {
            descBuffer.push(line);
          }
        }

        commitPending();
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
      invoiceFrom: "Amazon",
      invoiceNumber,
      invoiceDate,
      totalAmount: Math.round(totalAmount * 100) / 100,
      finalTotalAmount: Math.round(finalTotalAmount * 100) / 100,
      items,
    };
  },
};
