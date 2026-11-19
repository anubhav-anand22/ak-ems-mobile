import { PDFParsedData } from "./types";

export interface ExpenseItemEntry {
  title: string;
  amount: number;
  id: number;
}

/**
 * Builds the expense item list from parsed invoice data.
 * Computes the difference between the sum of items and the final total price,
 * adding it as "miscellaneous".
 */
export function buildExpenseItemsFromInvoice(
  data: PDFParsedData,
): ExpenseItemEntry[] {
  const items: ExpenseItemEntry[] = [];

  if (Array.isArray(data.items)) {
    data.items.forEach((item, idx) => {
      if (item.value !== undefined && item.value !== null && item.itemName) {
        items.push({
          title: item.itemName,
          amount: item.value,
          id: Date.now() + idx + Math.random(),
        });
      }
    });
  }

  // Calculate difference between addition of total items and final total price
  const targetTotal =
    data.finalTotalAmount > 0 ? data.finalTotalAmount : data.totalAmount;

  if (targetTotal > 0) {
    const itemsAddition = items.reduce((acc, curr) => acc + curr.amount, 0);
    const diff = Math.round((targetTotal - itemsAddition) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      items.push({
        title: "miscellaneous",
        amount: diff,
        id: Date.now() + items.length + Math.random(),
      });
    }
  }

  return items;
}

/**
 * Formats invoice numbers, dates, and subtotal/final totals into a clean note string.
 */
export function buildInvoiceNote(data: PDFParsedData): string {
  const noteLines: string[] = [];

  if (data.invoiceNumber) {
    noteLines.push(`Invoice No: ${data.invoiceNumber}`);
  }

  if (data.invoiceDate) {
    const d = new Date(data.invoiceDate);
    const formattedDate = !isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : data.invoiceDate;
    noteLines.push(`Invoice Date: ${formattedDate}`);
  }

  if (
    data.totalAmount > 0 &&
    data.finalTotalAmount > 0 &&
    data.totalAmount !== data.finalTotalAmount
  ) {
    noteLines.push(
      `Subtotal: ₹${data.totalAmount.toFixed(2)} | Final Total: ₹${data.finalTotalAmount.toFixed(2)}`,
    );
  }

  return noteLines.join("\n");
}
