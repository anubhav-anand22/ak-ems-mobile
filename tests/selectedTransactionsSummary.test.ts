import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSelectedTransactionsSummary,
  getTimeOfDayPeriod,
  formatDateShort,
  formatTimeShort,
} from "../src/lib/selectedTransactionsSummary";
import type { TransactionType } from "../src/db";

test("selectedTransactionsSummary - getTimeOfDayPeriod classification", () => {
  assert.equal(getTimeOfDayPeriod(5), "Morning");
  assert.equal(getTimeOfDayPeriod(8), "Morning");
  assert.equal(getTimeOfDayPeriod(11), "Morning");
  assert.equal(getTimeOfDayPeriod(12), "Afternoon");
  assert.equal(getTimeOfDayPeriod(15), "Afternoon");
  assert.equal(getTimeOfDayPeriod(16), "Afternoon");
  assert.equal(getTimeOfDayPeriod(17), "Evening");
  assert.equal(getTimeOfDayPeriod(20), "Evening");
  assert.equal(getTimeOfDayPeriod(21), "Night");
  assert.equal(getTimeOfDayPeriod(2), "Night");
});

test("selectedTransactionsSummary - date formatting helpers", () => {
  const d = new Date(2026, 10, 15, 14, 30); // 15 Nov 2026, 2:30 pm
  assert.equal(formatDateShort(d), "15 Nov");
  assert.equal(formatTimeShort(d), "2:30pm");
});

test("selectedTransactionsSummary - empty transactions returns zeroes", () => {
  const summary = calculateSelectedTransactionsSummary([]);
  assert.equal(summary.totalCount, 0);
  assert.equal(summary.totalGrossVolume, 0);
  assert.equal(summary.netCashFlow, 0);
  assert.equal(summary.averageAmount, 0);
  assert.equal(summary.send.totalAmount, 0);
  assert.equal(summary.receive.totalAmount, 0);
  assert.equal(summary.lend.totalAmount, 0);
  assert.equal(summary.borrow.totalAmount, 0);
  assert.equal(summary.toFromCount, 0);
  assert.equal(summary.toFromList.length, 0);
  assert.equal(summary.oldestDate, null);
  assert.equal(summary.newestDate, null);
  assert.equal(summary.highestTransaction, null);
});

test("selectedTransactionsSummary - aggregates Send, Receive, Lend, Borrow and ToFrom correctly", () => {
  const mockTransactions: TransactionType[] = [
    {
      id: 1,
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [{ amount: 500, title: "Groceries", id: 1 }],
      toFrom: "Alice Store",
      toFromPhoneNumber: "9876543210",
      note: "Weekly groceries",
      noteImages: null,
      tags: ["food"],
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-10T09:00:00Z"),
      updatedAt: new Date("2026-11-10T09:00:00Z"),
      creditPayment: null,
    },
    {
      id: 2,
      expenseType: "Simple Expense",
      subExpenseType: "Receive",
      amount: [{ amount: 1200, title: "Freelance", id: 2 }],
      toFrom: "Alice Store",
      toFromPhoneNumber: "9876543210",
      note: "Consulting",
      noteImages: null,
      tags: ["income"],
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-12T13:30:00Z"),
      updatedAt: new Date("2026-11-12T13:30:00Z"),
      creditPayment: null,
    },
    {
      id: 3,
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 300, title: "Loan", id: 3 }],
      toFrom: "Bob",
      toFromPhoneNumber: "9876500000",
      note: "Emergency money",
      noteImages: null,
      tags: ["credit"],
      interestType: "Simple",
      interestRate: 10,
      interestTime: 1,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-14T18:00:00Z"),
      updatedAt: new Date("2026-11-14T18:00:00Z"),
      creditPayment: null,
    },
    {
      id: 4,
      expenseType: "Credit",
      subExpenseType: "Borrow",
      amount: [{ amount: 400, title: "Borrowed Cash", id: 4 }],
      toFrom: "Bob",
      toFromPhoneNumber: "9876500000",
      note: null,
      noteImages: null,
      tags: null,
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-15T22:00:00Z"),
      updatedAt: new Date("2026-11-15T22:00:00Z"),
      creditPayment: null,
    },
  ];

  const summary = calculateSelectedTransactionsSummary(mockTransactions);

  assert.equal(summary.totalCount, 4);

  // Send: 500
  assert.equal(summary.send.totalAmount, 500);
  assert.equal(summary.send.count, 1);

  // Receive: 1200
  assert.equal(summary.receive.totalAmount, 1200);
  assert.equal(summary.receive.count, 1);

  // Lend: 300 + 10% simple interest (30) = 330
  assert.equal(summary.lend.totalAmount, 330);
  assert.equal(summary.lend.count, 1);

  // Borrow: 400
  assert.equal(summary.borrow.totalAmount, 400);
  assert.equal(summary.borrow.count, 1);

  // Gross volume: 500 + 1200 + 330 + 400 = 2430
  assert.equal(summary.totalGrossVolume, 2430);

  // Net Cash Flow: (Receive 1200 + Borrow 400) - (Send 500 + Lend 330) = 1600 - 830 = 770
  assert.equal(summary.netCashFlow, 770);

  // Highest transaction: Freelance (1200)
  assert.ok(summary.highestTransaction);
  assert.equal(summary.highestTransaction.amount, 1200);
  assert.equal(summary.highestTransaction.toFrom, "Alice Store");

  // ToFrom breakdown
  assert.equal(summary.toFromCount, 2);
  const alice = summary.toFromList.find((p) => p.name === "Alice Store");
  assert.ok(alice);
  assert.equal(alice.sendAmount, 500);
  assert.equal(alice.receiveAmount, 1200);
  assert.equal(alice.totalAmount, 1700);
  assert.equal(alice.netBalance, 700); // 1200 - 500 = +700
  assert.equal(alice.transactionCount, 2);
  assert.equal(alice.phoneNumber, "9876543210");

  const bob = summary.toFromList.find((p) => p.name === "Bob");
  assert.ok(bob);
  assert.equal(bob.lendAmount, 330);
  assert.equal(bob.borrowAmount, 400);
  assert.equal(bob.totalAmount, 730);
  assert.equal(bob.netBalance, 70); // Borrow (inflow) 400 - Lend (outflow) 330 = +70
  assert.equal(bob.transactionCount, 2);

  // Time series
  assert.equal(summary.chronologicalTransactions.length, 4);
  assert.equal(summary.chronologicalTransactions[0].id, 1);
  assert.equal(summary.chronologicalTransactions[3].id, 4);
  assert.ok(summary.oldestDate);
  assert.ok(summary.newestDate);
  assert.ok(summary.oldestDate.getTime() < summary.newestDate.getTime());
});

test("selectedTransactionsSummary - negative net cash flow and contact volume sorting", () => {
  const transactions: TransactionType[] = [
    {
      id: 10,
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [
        { amount: 1500, title: "Phone", id: 1 },
        { amount: 500, title: "Cover", id: 2 },
      ],
      toFrom: "Tech Shop",
      toFromPhoneNumber: null,
      note: "New phone purchase",
      noteImages: null,
      tags: ["tech"],
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-16T10:00:00Z"),
      updatedAt: new Date("2026-11-16T10:00:00Z"),
      creditPayment: null,
    },
    {
      id: 11,
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 1000, title: "Personal Loan", id: 3 }],
      toFrom: "Charlie",
      toFromPhoneNumber: "9123456780",
      note: null,
      noteImages: null,
      tags: null,
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date("2026-11-17T15:00:00Z"),
      updatedAt: new Date("2026-11-17T15:00:00Z"),
      creditPayment: null,
    },
  ];

  const summary = calculateSelectedTransactionsSummary(transactions);

  assert.equal(summary.totalCount, 2);
  assert.equal(summary.totalGrossVolume, 3000); // 2000 + 1000
  // Net cash flow: (0 receive + 0 borrow) - (2000 send + 1000 lend) = -3000
  assert.equal(summary.netCashFlow, -3000);
  assert.equal(summary.averageAmount, 1500);

  // Highest transaction
  assert.equal(summary.highestTransaction?.amount, 2000);
  assert.equal(summary.highestTransaction?.title, "Phone");
  assert.equal(summary.highestTransaction?.toFrom, "Tech Shop");

  // Sorted by gross volume desc: Tech Shop (2000), Charlie (1000)
  assert.equal(summary.toFromList.length, 2);
  assert.equal(summary.toFromList[0].name, "Tech Shop");
  assert.equal(summary.toFromList[0].totalAmount, 2000);
  assert.equal(summary.toFromList[0].netBalance, -2000);
  assert.equal(summary.toFromList[1].name, "Charlie");
  assert.equal(summary.toFromList[1].totalAmount, 1000);
  assert.equal(summary.toFromList[1].netBalance, -1000);
});

