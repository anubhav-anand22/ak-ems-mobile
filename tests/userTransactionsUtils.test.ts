import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { TransactionType } from "../src/db/schema";
import {
  buildUserSummaryStats,
  formatFullDateTime,
  getInitials,
  getTransactionAmountBreakdown,
  getTransactionDisplaySummary,
  parseUnixTimestampSeconds,
  summarizeUserCreditTransactions,
} from "../src/lib/userTransactionsUtils";

const createTx = (
  overrides: Partial<TransactionType> = {},
): TransactionType => ({
  id: 1,
  expenseType: "Simple Expense",
  subExpenseType: "Send",
  amount: [{ amount: 250, title: "Groceries" }],
  toFrom: "Rahul",
  toFromPhoneNumber: "+919876543210",
  note: null,
  tags: null,
  interestType: "None",
  interestRate: null,
  interestTime: null,
  compoundingFrequency: null,
  location: null,
  createdAt: new Date("2026-06-01T10:00:00Z"),
  updatedAt: new Date("2026-06-01T10:00:00Z"),
  creditPayment: null,
  ...overrides,
});

test("getInitials", async (t) => {
  await t.test("computes initials for single, multiple, and empty names", () => {
    assert.strictEqual(getInitials("Amazon"), "AM");
    assert.strictEqual(getInitials("Rahul Kumar"), "RK");
    assert.strictEqual(getInitials("  alice   b.   smith "), "AS");
    assert.strictEqual(getInitials("   "), "?");
  });
});

test("parseUnixTimestampSeconds", async (t) => {
  await t.test("converts unixepoch seconds, Date objects, and strings", () => {
    const d1 = parseUnixTimestampSeconds(1700000000);
    assert.strictEqual(d1.getTime(), 1700000000 * 1000);

    const ref = new Date("2026-03-04T05:06:07Z");
    assert.strictEqual(parseUnixTimestampSeconds(ref).getTime(), ref.getTime());

    assert.strictEqual(
      parseUnixTimestampSeconds("1700000100").getTime(),
      1700000100 * 1000,
    );
    assert.strictEqual(parseUnixTimestampSeconds(null).getTime(), 0);
  });
});

test("summarizeUserCreditTransactions & buildUserSummaryStats", async (t) => {
  await t.test("calculates credit interest totals, remaining balances, and stats", () => {
    const lendTx = createTx({
      id: 10,
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 1000, title: "Loan" }],
      interestType: "Simple",
      interestRate: 10,
      interestTime: 1,
      creditPayment: 300, // total 1100, remaining to receive = 800
    });
    const borrowTx = createTx({
      id: 11,
      expenseType: "Credit",
      subExpenseType: "Borrow",
      amount: [{ amount: 500, title: "Temp borrow" }],
      interestType: "None",
      creditPayment: 100, // total 500, remaining to pay = 400
    });

    const creditSummary = summarizeUserCreditTransactions([lendTx, borrowTx]);
    assert.strictEqual(creditSummary.creditLendTotal, 1100);
    assert.strictEqual(creditSummary.creditBorrowTotal, 500);
    assert.strictEqual(creditSummary.remainingToReceive, 800);
    assert.strictEqual(creditSummary.remainingToPay, 400);

    const stats = buildUserSummaryStats(
      {
        totalCount: 5,
        simpleSendTotal: 750.25,
        simpleReceiveTotal: 150,
      },
      [lendTx, borrowTx],
    );

    assert.strictEqual(stats.totalCount, 5);
    assert.strictEqual(stats.totalExpense, 750.25);
    assert.strictEqual(stats.simpleReceiveTotal, 150);
    assert.strictEqual(stats.totalCredit, 1600);
    assert.strictEqual(stats.netCreditBalance, 400); // user owes me 400 net
  });
});

test("getTransactionAmountBreakdown & display helpers", async (t) => {
  await t.test("returns breakdown and readable summary strings", () => {
    const creditTx = createTx({
      id: 22,
      expenseType: "Credit",
      subExpenseType: "Borrow",
      amount: [
        { amount: 600, title: "Hardware" },
        { amount: 400, title: "Paint" },
      ],
      interestType: "Compound",
      interestRate: 10,
      interestTime: 2,
      compoundingFrequency: "yearly",
      creditPayment: 200,
      note: "Home renovation",
    });

    const breakdown = getTransactionAmountBreakdown(creditTx);
    assert.strictEqual(breakdown.principal, 1000);
    assert.strictEqual(breakdown.interestAmount, 210);
    assert.strictEqual(breakdown.totalAmount, 1210);
    assert.strictEqual(breakdown.paidAmount, 200);
    assert.strictEqual(breakdown.remainingAmount, 1010);

    assert.strictEqual(
      getTransactionDisplaySummary(creditTx),
      "Hardware, Paint — Home renovation",
    );

    const noteOnly = createTx({ amount: [{ amount: 50, title: "" }], note: "Tea" });
    assert.strictEqual(getTransactionDisplaySummary(noteOnly), "Tea");

    assert.ok(formatFullDateTime(new Date("2026-06-01T10:00:00Z")).length > 0);
    assert.strictEqual(formatFullDateTime(new Date("invalid")), "Unknown");
  });
});

test("SQLite aggregation and recent user pagination queries", async (t) => {
  await t.test("groups recent users in descending recency and computes SQL sums", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        expenseType TEXT NOT NULL,
        subExpenseType TEXT NOT NULL,
        amountArr TEXT NOT NULL,
        toFrom TEXT NOT NULL,
        toFromPhoneNumber TEXT,
        note TEXT,
        tags TEXT,
        interestType TEXT DEFAULT 'None',
        interestRate REAL,
        interestTime REAL,
        compoundingFrequency TEXT,
        location TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        creditPayment INTEGER
      );
    `);

    const insert = sqlite.prepare(`
      INSERT INTO transactions (expenseType, subExpenseType, amountArr, toFrom, toFromPhoneNumber, createdAt, updatedAt, creditPayment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 10; i++) {
      insert.run(
        "Simple Expense",
        "Send",
        JSON.stringify([{ amount: i * 100, title: `Item ${i}` }]),
        `User ${i}`,
        i % 2 === 0 ? `90000000${i}` : null,
        1700000000 + i * 10,
        1700000000 + i * 10,
        null,
      );
    }
    insert.run(
      "Simple Expense",
      "Receive",
      JSON.stringify([{ amount: 50, title: "Refund" }]),
      "User 10",
      null,
      1700000500,
      1700000500,
      null,
    );

    const page1 = sqlite
      .prepare(
        `
      SELECT
        toFrom,
        MAX(updatedAt) AS latestUpdatedAtRaw,
        MAX(id) AS latestTransactionId,
        COUNT(id) AS transactionCount,
        MAX(NULLIF(trim(toFromPhoneNumber), '')) AS phoneNumber
      FROM transactions
      WHERE trim(toFrom) != ''
      GROUP BY toFrom
      ORDER BY MAX(updatedAt) DESC, MAX(id) DESC, toFrom ASC
      LIMIT 8 OFFSET 0
    `,
      )
      .all() as { toFrom: string; transactionCount: number; phoneNumber: string | null }[];

    assert.strictEqual(page1.length, 8);
    assert.strictEqual(page1[0].toFrom, "User 10");
    assert.strictEqual(page1[0].transactionCount, 2);
    assert.strictEqual(page1[0].phoneNumber, "9000000010");

    const page2 = sqlite
      .prepare(
        `
      SELECT toFrom FROM transactions
      WHERE trim(toFrom) != ''
      GROUP BY toFrom
      ORDER BY MAX(updatedAt) DESC, MAX(id) DESC, toFrom ASC
      LIMIT 8 OFFSET 8
    `,
      )
      .all() as { toFrom: string }[];
    assert.strictEqual(page2.length, 2);
    assert.strictEqual(page2[0].toFrom, "User 2");
    assert.strictEqual(page2[1].toFrom, "User 1");

    const summary = sqlite
      .prepare(
        `
      SELECT
        COUNT(id) AS totalCount,
        COALESCE(SUM(CASE
          WHEN expenseType = 'Simple Expense' AND subExpenseType = 'Send'
          THEN (
            SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
            FROM json_each(amountArr)
          )
          ELSE 0
        END), 0) AS simpleSendTotal,
        COALESCE(SUM(CASE
          WHEN expenseType = 'Simple Expense' AND subExpenseType = 'Receive'
          THEN (
            SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
            FROM json_each(amountArr)
          )
          ELSE 0
        END), 0) AS simpleReceiveTotal
      FROM transactions
      WHERE toFrom = ?
    `,
      )
      .get("User 10") as {
      totalCount: number;
      simpleSendTotal: number;
      simpleReceiveTotal: number;
    };

    assert.strictEqual(summary.totalCount, 2);
    assert.strictEqual(summary.simpleSendTotal, 1000);
    assert.strictEqual(summary.simpleReceiveTotal, 50);
  });
});
