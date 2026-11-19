import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpenseItemsFromInvoice,
  buildInvoiceNote,
} from "../src/lib/pdfParser/invoiceExpenseUtils";
import { PDFParsedData } from "../src/lib/pdfParser/types";

test("Invoice Expense Utils - Items and Miscellaneous Difference", async (t) => {
  await t.test("adds miscellaneous item when items sum differs from finalTotalAmount (user example)", () => {
    // User's exact prompt example:
    // apple -> 100, banana -> 50, total amount -> 250, finalTotalAmount -> 200 => miscellaneous should be 50
    const invoiceData: PDFParsedData = {
      invoiceFrom: "Supermarket",
      invoiceNumber: "INV-12345",
      invoiceDate: new Date("2026-11-19").getTime(),
      totalAmount: 250,
      finalTotalAmount: 200,
      items: [
        { itemName: "apple", Quantity: "1", value: 100 },
        { itemName: "banana", Quantity: "1", value: 50 },
      ],
    };

    const expenseItems = buildExpenseItemsFromInvoice(invoiceData);

    assert.equal(expenseItems.length, 3);
    assert.equal(expenseItems[0].title, "apple");
    assert.equal(expenseItems[0].amount, 100);

    assert.equal(expenseItems[1].title, "banana");
    assert.equal(expenseItems[1].amount, 50);

    assert.equal(expenseItems[2].title, "miscellaneous");
    assert.equal(expenseItems[2].amount, 50);

    // Sum of all items in the expense list matches finalTotalAmount
    const totalSum = expenseItems.reduce((acc, curr) => acc + curr.amount, 0);
    assert.equal(totalSum, 200);
  });

  await t.test("handles handling fee / extra charges (e.g. Blinkit)", () => {
    const invoiceData: PDFParsedData = {
      invoiceFrom: "Blinkit",
      invoiceNumber: "260802IMAP100599",
      invoiceDate: new Date("2026-08-02").getTime(),
      totalAmount: 190,
      finalTotalAmount: 197.81,
      items: [
        { itemName: "MAGGI Instant Noodles", Quantity: "1", value: 81 },
        { itemName: "Ghadi Detergent Powder", Quantity: "1", value: 78 },
        { itemName: "Bingo Tedhe Medhe Masala Tadka", Quantity: "1", value: 15 },
        { itemName: "Bingo Tedhe Medhe Chatpata Twist", Quantity: "1", value: 16 },
      ],
    };

    const expenseItems = buildExpenseItemsFromInvoice(invoiceData);

    assert.equal(expenseItems.length, 5);
    const miscItem = expenseItems.find((it) => it.title === "miscellaneous");
    assert.ok(miscItem);
    assert.equal(miscItem.amount, 7.81);

    const totalSum = Math.round(expenseItems.reduce((acc, curr) => acc + curr.amount, 0) * 100) / 100;
    assert.equal(totalSum, 197.81);
  });

  await t.test("does not add miscellaneous item when items sum exactly equals finalTotalAmount", () => {
    const invoiceData: PDFParsedData = {
      invoiceFrom: "Zepto",
      invoiceNumber: "26099C0009334691",
      invoiceDate: new Date("2026-09-30").getTime(),
      totalAmount: 100,
      finalTotalAmount: 100,
      items: [
        { itemName: "Item 1", Quantity: "1", value: 60 },
        { itemName: "Item 2", Quantity: "1", value: 40 },
      ],
    };

    const expenseItems = buildExpenseItemsFromInvoice(invoiceData);

    assert.equal(expenseItems.length, 2);
    assert.equal(expenseItems.some((it) => it.title === "miscellaneous"), false);
  });
});

test("Invoice Expense Utils - Note Formatting", async (t) => {
  await t.test("formats invoice numbers, date, and totals into note string", () => {
    const invoiceData: PDFParsedData = {
      invoiceFrom: "BigBasket",
      invoiceNumber: "IBNUP26INDH32923",
      invoiceDate: new Date("2026-11-14").getTime(),
      totalAmount: 164.0,
      finalTotalAmount: 153.0,
      items: [],
    };

    const note = buildInvoiceNote(invoiceData);

    assert.ok(note.includes("Invoice No: IBNUP26INDH32923"));
    assert.ok(note.includes("Invoice Date:"));
    assert.ok(note.includes("Subtotal: ₹164.00 | Final Total: ₹153.00"));
  });
});
