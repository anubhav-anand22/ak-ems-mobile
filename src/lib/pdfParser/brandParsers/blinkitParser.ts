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
      lower.includes("pyd retail") ||
      lower.includes("pjtj technologies") ||
      lower.includes("hands on trades") ||
      /\bOrder\s*ID\s*:\s*\d{14,16}\b/i.test(fullText) ||
      /\bInvoice\s*No\s*:\s*\d{6}IM[A-Z0-9]+/i.test(fullText) ||
      (lower.includes("handling fee") && lower.includes("inclusive of gst") && lower.includes("uqc"))
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice Number(s)
    const invMatches = [...fullText.matchAll(/Invoice\s*No\s*:\s*([A-Z0-9]+)/gi)];
    const uniqueInvoices = Array.from(new Set(invMatches.map((m) => m[1].trim())));
    const invoiceNumber = uniqueInvoices.length > 0 ? uniqueInvoices.join(", ") : "";

    // 2. Invoice Date
    const dateMatch =
      fullText.match(/Date\s*of\s*Invoice\s*:\s*(\d{2}-\d{2}-\d{4})/i) ||
      fullText.match(/(\d{2}-\d{2}-\d{4})/);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts (may have multiple pages/sellers in same order)
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const invoiceValueMatches = [
      ...fullText.matchAll(/Invoice\s*Value\s*[:\s]*([\d,.]+)/gi),
    ];
    if (invoiceValueMatches.length > 0) {
      totalAmount = invoiceValueMatches.reduce(
        (sum, m) => sum + parseCurrencyValue(m[1]),
        0,
      );
    }

    const handlingFeeMatches = [
      ...fullText.matchAll(
        /Handling\s*Fee\s*(?:\(Inclusive\s*of\s*GST\))?\s*[:\s]*([\d,.]+)/gi,
      ),
    ];
    const totalHandlingFee = handlingFeeMatches.reduce(
      (sum, m) => sum + parseCurrencyValue(m[1]),
      0,
    );

    // Look for explicit bottom totals per page
    // Often printed right after handling fee line
    const bottomTotals = [
      ...fullText.matchAll(
        /Handling\s*Fee[^\n]*\n\s*([\d,.]+)/gi,
      ),
    ];
    if (bottomTotals.length > 0) {
      finalTotalAmount = bottomTotals.reduce(
        (sum, m) => sum + parseCurrencyValue(m[1]),
        0,
      );
    } else {
      finalTotalAmount = Math.round((totalAmount + totalHandlingFee) * 100) / 100;
    }

    // 4. Line Items
    const items: PDFParsedItem[] = [];

    // Attempt 1: From structured tables
    if (rawResult.tables && rawResult.tables.length > 0) {
      for (const table of rawResult.tables) {
        let descIdx = -1;
        let qtyIdx = -1;
        let totalIdx = -1;

        table.headers.forEach((h, idx) => {
          const lh = h.toLowerCase();
          if (
            lh.includes("description") ||
            lh.includes("goods") ||
            lh.includes("item")
          ) {
            descIdx = idx;
          } else if (lh.includes("quantity") || lh === "qty") {
            qtyIdx = idx;
          } else if (
            lh.includes("total") ||
            lh.includes("amount")
          ) {
            totalIdx = idx;
          }
        });

        // Common layout for Blinkit tables:
        // Col 0: Sr No, Col 1: Description, Col 2: Quantity, Col 3: UQC, ..., Last Col: Total Amount
        if (descIdx === -1 && table.colCount >= 5) descIdx = 1;
        if (qtyIdx === -1 && table.colCount >= 5) qtyIdx = 2;
        if (totalIdx === -1 && table.colCount >= 5)
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
              !lowerName.includes("invoice value") &&
              !lowerName.includes("handling fee") &&
              !lowerName.includes("annexure") &&
              !lowerName.includes("seller name")
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

    // Attempt 2: Text parsing if tables were empty
    if (items.length === 0) {
      const itemRegex =
        /^\s*(\d+)[.)\s]+([A-Za-z][^\n]+?)\s+(\d+)\s+NOS\s+\d{6,8}\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)/gm;
      let match: RegExpExecArray | null;

      while ((match = itemRegex.exec(fullText)) !== null) {
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

    const itemsSum =
      Math.round(items.reduce((sum, it) => sum + it.value, 0) * 100) / 100;
    if (totalAmount === 0) {
      totalAmount = itemsSum;
    }
    if (finalTotalAmount === 0) {
      finalTotalAmount = Math.round((totalAmount + totalHandlingFee) * 100) / 100 || itemsSum;
    }

    return {
      invoiceFrom: "Blinkit",
      invoiceNumber,
      invoiceDate,
      totalAmount,
      finalTotalAmount,
      items,
    };
  },
};
