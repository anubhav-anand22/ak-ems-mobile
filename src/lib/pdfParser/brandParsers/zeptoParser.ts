import { ParsedPdfResult, PDFParsedData, PDFParsedItem } from "../types";
import { BrandInvoiceParser } from "./types";
import { parseInvoiceDateToTimestamp } from "../dateUtils";
import { cleanItemName, parseCurrencyValue } from "../textUtils";

export const zeptoParser: BrandInvoiceParser = {
  brand: "Zepto",

  canParse(_rawResult: ParsedPdfResult, fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return (
      lower.includes("zepto") ||
      lower.includes("zeptonow") ||
      lower.includes("commodum groceries") ||
      lower.includes("kiranakart") ||
      /\bOrder\s*No\.?\s*:\s*[A-Z0-9]+\b/i.test(fullText) && lower.includes("tax invoice/bill of supply")
    );
  },

  parse(rawResult: ParsedPdfResult, fullText: string): PDFParsedData {
    // 1. Invoice Number
    const invMatch = fullText.match(/Invoice\s*No\.?\s*:\s*([A-Z0-9]+)/i);
    const invoiceNumber = invMatch ? invMatch[1].trim() : "";

    // 2. Invoice Date
    const dateMatch =
      fullText.match(/Date\s*:\s*(\d{2}-\d{2}-\d{4})/i) ||
      fullText.match(/(\d{2}-\d{2}-\d{4})/);
    const invoiceDate = parseInvoiceDateToTimestamp(
      dateMatch ? dateMatch[1] : undefined,
    );

    // 3. Amounts
    let totalAmount = 0;
    let finalTotalAmount = 0;

    const itemTotalMatch = fullText.match(
      /Item\s*Total\s*[:\s]*([\d,.]+)/i,
    );
    if (itemTotalMatch) {
      totalAmount = parseCurrencyValue(itemTotalMatch[1]);
    }

    const invoiceValueMatch = fullText.match(
      /Invoice\s*Value\s*[:\s]*([\d,.]+)/i,
    );
    if (invoiceValueMatch) {
      finalTotalAmount = parseCurrencyValue(invoiceValueMatch[1]);
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
            lh.includes("item") ||
            lh.includes("description")
          ) {
            descIdx = idx;
          } else if (lh === "qty" || lh.includes("quantity")) {
            qtyIdx = idx;
          } else if (
            lh.includes("total") ||
            lh.includes("amt")
          ) {
            totalIdx = idx;
          }
        });

        // Zepto standard table layout:
        // Col 0: SR No, Col 1: Item & Description, Col 2: Unit MRP, Col 3: HSN, Col 4: Qty, ..., Last Col: Total Amt.
        if (descIdx === -1 && table.colCount >= 5) descIdx = 1;
        if (qtyIdx === -1 && table.colCount >= 5) qtyIdx = 4;
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
              !lowerName.includes("item total") &&
              !lowerName.includes("invoice value") &&
              !lowerName.includes("order delivered from") &&
              !lowerName.includes("whether gst is payable")
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

    // Text parsing fallback if needed
    if (items.length === 0) {
      // Line: "1 Daily Good Chana Brown 1 pack (1 kg) 175.00 07132010 1 ... 105.00"
      const itemRegex =
        /^\s*(\d+)\s+([A-Za-z][^\n]+?)\s+[\d.]+\s+\d{6,8}\s+(\d+)\s+[\d.]+\s+[\d.%+]+\s+[\d.]+\s+[\d.%+]+\s+[\d.%+]+\s+[\d.]+\s+[\d.]+\s+[\d.%+]+\s+[\d.]+\s+([\d.]+)/gm;
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
      finalTotalAmount = totalAmount || itemsSum;
    }

    return {
      invoiceFrom: "Zepto",
      invoiceNumber,
      invoiceDate,
      totalAmount,
      finalTotalAmount,
      items,
    };
  },
};
