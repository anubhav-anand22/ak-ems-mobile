import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { TransactionType } from "../src/db";
import {
  formatTransactionRow,
  generateExportFilename,
  sanitizeFilenamePart,
  transactionsToCsv,
  transactionsToExcelBase64,
  transactionsToJson,
} from "../src/lib/exportTransactionsFormat";

const MOCK_DATE = new Date("2026-11-22T10:30:00.000Z");

const SAMPLE_TRANSACTIONS: TransactionType[] = [
  {
    id: 1,
    expenseType: "Expense",
    subExpenseType: "Send",
    amount: [
      { title: "Lunch", amount: 150 },
      { title: "Juice", amount: 50 },
    ],
    toFrom: "Alice Smith",
    toFromPhoneNumber: "+91 9876543210",
    note: "Paid for team lunch, with dessert",
    noteImages: null,
    tags: ["food", "office"],
    interestType: "None",
    interestRate: null,
    interestTime: null,
    compoundingFrequency: null,
    location: { lat: 12.9716, lon: 77.5946 },
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
    creditPayment: null,
  },
  {
    id: 2,
    expenseType: "Credit",
    subExpenseType: "Lend",
    amount: [{ title: "Loan", amount: 10000 }],
    toFrom: 'Bob "The Builder" O\'Connor',
    toFromPhoneNumber: null,
    note: 'Line 1\nLine 2 with "quotes"',
    noteImages: null,
    tags: ["loan"],
    interestType: "Simple",
    interestRate: 10,
    interestTime: 1,
    compoundingFrequency: null,
    location: null,
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
    creditPayment: null,
  },
];

test("exportTransactions - formatTransactionRow", async (t) => {
  await t.test("correctly calculates totals, breakdown, and dates", () => {
    const row = formatTransactionRow(SAMPLE_TRANSACTIONS[0]);
    assert.strictEqual(row.ID, 1);
    assert.strictEqual(row.Type, "Expense");
    assert.strictEqual(row["Sub Type"], "Send");
    assert.strictEqual(row["To / From"], "Alice Smith");
    assert.strictEqual(row["Phone Number"], "+91 9876543210");
    assert.strictEqual(row["Total Amount"], 200);
    assert.strictEqual(row["Principal Amount"], 200);
    assert.strictEqual(row["Interest Amount"], 0);
    assert.strictEqual(row.Note, "Paid for team lunch, with dessert");
    assert.strictEqual(row.Tags, "food, office");
    assert.strictEqual(row["Items Breakdown"], "Lunch: ₹150; Juice: ₹50");
    assert.strictEqual(row.Location, "12.9716, 77.5946");
  });

  await t.test("handles credit with interest and special characters", () => {
    const row = formatTransactionRow(SAMPLE_TRANSACTIONS[1]);
    assert.strictEqual(row.ID, 2);
    assert.strictEqual(row.Type, "Credit");
    assert.strictEqual(row["Sub Type"], "Lend");
    assert.strictEqual(row["Principal Amount"], 10000);
    assert.strictEqual(row["Interest Amount"], 1000);
    assert.strictEqual(row["Total Amount"], 11000);
    assert.strictEqual(row["Interest Rate (%)"], 10);
  });
});

test("exportTransactions - transactionsToCsv", async (t) => {
  await t.test("generates valid CSV with header and properly escaped cells", () => {
    const csv = transactionsToCsv(SAMPLE_TRANSACTIONS);
    assert.ok(csv.startsWith("ID,Date,Type,Sub Type,To / From"));

    const lines = csv.split("\r\n");
    assert.strictEqual(lines.length, 3); // 1 header + 2 rows

    // Check row with comma in note: should be wrapped in quotes
    assert.ok(csv.includes('"Paid for team lunch, with dessert"'));

    // Check row with newline and quotes in note: quotes should be doubled
    assert.ok(csv.includes('""quotes""'));
  });

  await t.test("returns empty string when given empty transactions array", () => {
    const csv = transactionsToCsv([]);
    assert.strictEqual(csv, "");
  });
});

test("exportTransactions - transactionsToJson", async (t) => {
  await t.test("produces structured JSON containing count, scope and transactions", () => {
    const jsonStr = transactionsToJson(SAMPLE_TRANSACTIONS, { scope: "selected" });
    const parsed = JSON.parse(jsonStr);

    assert.strictEqual(parsed.count, 2);
    assert.strictEqual(parsed.scope, "selected");
    assert.strictEqual(parsed.transactions.length, 2);
    assert.strictEqual(parsed.transactions[0].toFrom, "Alice Smith");
    assert.ok(parsed.timestamp);
  });
});

test("exportTransactions - transactionsToExcelBase64", async (t) => {
  await t.test("produces a valid Excel spreadsheet readable by SheetJS", () => {
    const base64 = transactionsToExcelBase64(SAMPLE_TRANSACTIONS);
    assert.ok(base64.length > 100);

    // Read back the workbook from the base64 string
    const wb = XLSX.read(base64, { type: "base64" });
    assert.ok(wb.SheetNames.includes("Transactions"));

    const ws = wb.Sheets["Transactions"];
    const rows = XLSX.utils.sheet_to_json(ws);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual((rows[0] as any).ID, 1);
    assert.strictEqual((rows[0] as any)["To / From"], "Alice Smith");
    assert.strictEqual((rows[0] as any)["Total Amount"], 200);
    assert.strictEqual((rows[1] as any).ID, 2);
    assert.strictEqual((rows[1] as any)["Total Amount"], 11000);
  });
});

test("exportTransactions - generateExportFilename & sanitizeFilenamePart", async (t) => {
  await t.test("generates correct filenames for xlsx, csv, and json", () => {
    const date = new Date("2026-11-22T00:00:00.000Z");

    const xlsxName = generateExportFilename({ format: "xlsx", scope: "all", date });
    assert.strictEqual(xlsxName, "transactions_all_2026-11-22.xlsx");

    const csvName = generateExportFilename({ format: "csv", scope: "selected", date });
    assert.strictEqual(csvName, "transactions_selected_2026-11-22.csv");

    const jsonName = generateExportFilename({ format: "json", toFrom: "Alice / Bob", date });
    assert.strictEqual(jsonName, "transactions_Alice_Bob_2026-11-22.json");
  });

  await t.test("sanitizes dangerous or weird characters in person names", () => {
    assert.strictEqual(sanitizeFilenamePart("John Doe / Tech!"), "John_Doe_Tech_");
    assert.strictEqual(sanitizeFilenamePart("  test@domain.com  "), "_test_domain_com_");
  });
});
