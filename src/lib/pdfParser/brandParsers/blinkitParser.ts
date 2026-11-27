import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

export const blinkitParser: BrandInvoiceParser = {
  brand: "Blinkit",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("blinkit") ||
      lower.includes("blink commerce") ||
      lower.includes("pyd retail") ||
      lower.includes("pjtj technologies") ||
      lower.includes("hands on trades") ||
      /\bOrder\s*ID\s*:\s*\d{14,16}\b/i.test(fullText) ||
      /\bInvoice\s*No\s*:\s*\d{6}IM[A-Z0-9]+/i.test(fullText) ||
      (lower.includes("handling fee") && lower.includes("inclusive of gst") && lower.includes("uqc"))
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // Strip Annexure section(s) so ancillary handling tax breakdown tables never pollute totals or items
    const stripAnnexure = (txt: string) =>
      txt.split(/\n\s*Annexure\b/i)[0] || txt;
    const bodyText =
      rawResult.pages && rawResult.pages.length > 0
        ? rawResult.pages.map((p) => stripAnnexure(p.text)).join("\n")
        : stripAnnexure(fullText);

    // 1. Invoice Number(s)
    const invMatches = [
      ...fullText.matchAll(
        /Invoice\s*(?:No\.?|Number)\s*:\s*([A-Z0-9-]+)/gi,
      ),
    ];
    const uniqueInvoices = Array.from(
      new Set(
        invMatches
          .map((m) => m[1].trim())
          .filter(
            (v) => v.length > 2 && !["no", "number", "date"].includes(v.toLowerCase()),
          ),
      ),
    );
    const invoiceNumber =
      uniqueInvoices.length > 0 ? uniqueInvoices.join(", ") : "";

    // 2. Invoice Date
    const dateMatch =
      fullText.match(
        /Date\s*of\s*Invoice\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/i,
      ) ||
      fullText.match(
        /Invoice\s*Date\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/i,
      ) ||
      fullText.match(
        /Invoice\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/i,
      ) ||
      fullText.match(
        /(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})/,
      );
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts (may have multiple pages/sellers in same order)
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const invoiceValueMatches = [
      ...bodyText.matchAll(/Invoice\s*Value\s*[:\s]*([\d,.]+)/gi),
    ];
    if (invoiceValueMatches.length > 0) {
      totalAmount = invoiceValueMatches.reduce(
        (sum, m) => sum + parseCurrencyValue(m[1]),
        0,
      );
    }

    const handlingFeeMatches = [
      ...bodyText.matchAll(
        /Handling\s*Fee\s*(?:\(Inclusive\s*of\s*GST\))?\s*[:\s]*([\d,.]+)/gi,
      ),
    ];
    const totalHandlingFee = handlingFeeMatches.reduce(
      (sum, m) => sum + parseCurrencyValue(m[1]),
      0,
    );

    // Look for explicit bottom totals per page:
    // Format 1 (PYD/PJTJ): printed right after Handling Fee line
    // Format 2 (Blink Commerce): "Total <Qty> ... <GrandTotal>" line before Annexure
    const bottomTotals = [
      ...bodyText.matchAll(/Handling\s*Fee[^\n]*\n\s*([\d,.]+)/gi),
    ];
    const tableSummaryTotals = [
      ...bodyText.matchAll(/^\s*Total\s+\d+\s+[^\n]*?\s([\d,.]+)\s*$/gim),
    ];

    if (bottomTotals.length > 0) {
      finalTotalAmount = bottomTotals.reduce(
        (sum, m) => sum + parseCurrencyValue(m[1]),
        0,
      );
    } else if (tableSummaryTotals.length > 0) {
      finalTotalAmount = tableSummaryTotals.reduce(
        (sum, m) => sum + parseCurrencyValue(m[1]),
        0,
      );
    } else {
      finalTotalAmount =
        Math.round((totalAmount + totalHandlingFee) * 100) / 100;
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];
    const isBlinkCommerceUpcFormat =
      /^\s*\d+\s+\d{2,14}\s+\S+.*?\s+\d+\s+[\d,.]+/m.test(bodyText);

    // Attempt 1: From structured tables (PYD/PJTJ or cleanly parsed item tables)
    if (!isBlinkCommerceUpcFormat && rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        const headersLower = table.headers.map((h) => h.toLowerCase());
        const headersText = headersLower.join(" ");

        // Skip Annexure tables and metadata address blocks
        if (
          headersText.includes("nature of charge") ||
          headersText.includes("tax rate") ||
          headersText.includes("invoice to") ||
          headersText.includes("gstin") ||
          headersText.includes("cin")
        ) {
          continue;
        }

        let descIdx = -1;
        let qtyIdx = -1;
        let totalIdx = -1;

        headersLower.forEach((lh, idx) => {
          if (
            lh.includes("description") ||
            lh.includes("goods") ||
            lh.includes("item")
          ) {
            descIdx = idx;
          } else if (lh.includes("quantity") || lh === "qty") {
            qtyIdx = idx;
          } else if (lh.includes("total") || lh.includes("amount")) {
            totalIdx = idx;
          }
        });

        // Must actually be an item table with recognizable description header
        if (descIdx === -1 && headersText.includes("uqc") && table.colCount >= 5) {
          descIdx = 1;
        }
        if (descIdx === -1) continue;

        if (qtyIdx === -1 && table.colCount >= 5) qtyIdx = 2;
        if (totalIdx === -1 && table.colCount >= 5)
          totalIdx = table.colCount - 1;

        if (descIdx !== -1 && totalIdx !== -1) {
          for (const row of table.rows) {
            const rawName = row[descIdx] || "";
            const rawQty = qtyIdx !== -1 ? row[qtyIdx] : "1";
            const rawVal = row[totalIdx] || "";

            const strippedHsn = rawName.replace(/\s*\(HSN-[^)]*\)/gi, "");
            const itemName = cleanItemName(strippedHsn);
            // If last cell merged multiple columns (e.g. "0.00 119.00"), take last numeric token
            const numTokens = rawVal.match(/[\d,.]+/g);
            const value = numTokens
              ? parseCurrencyValue(numTokens[numTokens.length - 1])
              : 0;
            const qtyMatch = (rawQty || "").match(/\d+/);
            const Quantity = qtyMatch ? qtyMatch[0] : "1";

            const lowerName = itemName.toLowerCase();
            if (
              itemName &&
              value > 0 &&
              !/^\d+$/.test(itemName) &&
              !/^total\b/i.test(lowerName) &&
              !lowerName.includes("invoice value") &&
              !lowerName.includes("handling fee") &&
              !lowerName.includes("handling charge") &&
              !lowerName.includes("delivery and other charges") &&
              !lowerName.includes("annexure") &&
              !lowerName.includes("seller name") &&
              !lowerName.includes("amount in words") &&
              !lowerName.includes("blink commerce")
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

    // Attempt 2: Full-text line parser (handles Blink Commerce UPC format & wrapped OCR descriptions)
    if (items.length === 0) {
      const pagesText =
        rawResult.pages && rawResult.pages.length > 0
          ? rawResult.pages.map((p) => stripAnnexure(p.text)).filter(Boolean)
          : [bodyText];

      for (const pageText of pagesText) {
        const lines = pageText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        let currentUpcItem: {
          nameParts: string[];
          quantity: string;
          value: number;
          inHsnParen: boolean;
        } | null = null;

        const flushUpcItem = () => {
          if (!currentUpcItem) return;
          let joined = currentUpcItem.nameParts.join(" ");
          joined = joined
            .replace(/\s*\(HSN-[^)]*\)?/gi, "")
            .replace(/\b\d{6,8}\)/g, "")
            .trim();
          const itemName = cleanItemName(joined);
          if (itemName && currentUpcItem.value > 0) {
            items.push({
              itemName,
              Quantity: currentUpcItem.quantity,
              value: currentUpcItem.value,
            });
          }
          currentUpcItem = null;
        };

        for (const line of lines) {
          // Stop before Total summary line
          if (/^Total\s+\d+\s+/i.test(line)) {
            flushUpcItem();
            continue;
          }

          // Skip "Delivery and other charges" sub-rows (1+ leading dashes, including wrapped "charges" line)
          if (/^(?:-\s*)+Delivery\b/i.test(line)) {
            flushUpcItem();
            continue;
          }

          // Blink Commerce UPC item row:
          // "1 8901331041 Pro-ease GO XL Sanitary Pads 125.00 6.00 1 119.00 ... 119.00"
          // "1 890 Royal Gulab 375.00 190.00 1 176.19 ... 185.00"
          const upcMatch = line.match(
            /^(\d+)\s+(\d{2,14})\s+(.+?)\s+[\d,.]+\s+[\d,.]+\s+(\d+)\s+[\d,.]+\s+(?:[\d,.]+\s+){4,7}([\d,.]+)\s*$/,
          );
          if (upcMatch) {
            flushUpcItem();
            currentUpcItem = {
              nameParts: [upcMatch[3].trim()],
              quantity: upcMatch[4],
              value: parseCurrencyValue(upcMatch[5]),
              inHsnParen: /\(HSN-/i.test(upcMatch[3]) && !/\)$/.test(upcMatch[3]),
            };
            continue;
          }

          // Continuation lines for wrapped UPC / Item Description / (HSN-...)
          if (currentUpcItem) {
            // Line may start with wrapped UPC numeric chunk like "141 Jamun by", "002 (280 mm)...", or just "3"
            const strippedUpcChunk = line.replace(/^\d{1,5}(?:\s+|$)/, "").trim();
            if (!strippedUpcChunk) continue;

            // Remove HSN tail if it wrapped onto its own continuation
            const noHsn = strippedUpcChunk
              .replace(/\(HSN-[^)]*\)?/gi, "")
              .replace(/^\d{6,8}\)$/, "")
              .trim();
            if (noHsn) {
              currentUpcItem.nameParts.push(noHsn);
            }
          }
        }

        flushUpcItem();
      }

      // Fallback regex for older PYD/PJTJ text-only layout
      if (items.length === 0) {
        const itemRegex =
          /^\s*(\d+)[.)\s]+([A-Za-z][^\n]+?)\s+(\d+)\s+NOS\s+\d{6,8}\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)/gm;
        let match: RegExpExecArray | null;

        while ((match = itemRegex.exec(bodyText)) !== null) {
          const rawName = match[2];
          const qty = match[3];
          const val = match[4];

          const itemName = cleanItemName(rawName);
          const value = parseCurrencyValue(val);

          if (itemName && value > 0) {
            items.push({
              itemName,
              Quantity: qty,
              value,
            });
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
      finalTotalAmount =
        Math.round((totalAmount + totalHandlingFee) * 100) / 100 || itemsSum;
    }

    return {
      invoiceFrom: "Blinkit",
      invoiceNumber,
      invoiceDate,
      totalAmount: Math.round(totalAmount * 100) / 100,
      finalTotalAmount: Math.round(finalTotalAmount * 100) / 100,
      items,
    };
  },
};
