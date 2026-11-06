import test from "node:test";
import assert from "node:assert/strict";
import {
  getTotalAmount,
  getTotalAmountWithExtraData,
} from "../src/lib/getTotalAmount";
import type { TransactionType } from "../src/db/schema";

test("getTotalAmount", async (t) => {
  await t.test("calculates simple expense as sum of item amounts", () => {
    const tx: TransactionType = {
      id: 1,
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [
        { amount: 50, title: "Item 1" },
        { amount: 120.5, title: "Item 2" },
      ],
      toFrom: "Vendor",
      toFromPhoneNumber: null,
      note: null,
      tags: null,
      interestType: "None",
      interestRate: null,
      interestTime: null,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      creditPayment: null,
    };

    assert.strictEqual(getTotalAmount(tx), 170.5);
  });

  await t.test("calculates credit with Simple interest accurately", () => {
    // Principal: 1000, Rate: 10% per year, Time: 2 years => Interest: 1000 * 0.10 * 2 = 200 => Total: 1200
    const tx: TransactionType = {
      id: 2,
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 1000, title: "Loan" }],
      toFrom: "Friend",
      toFromPhoneNumber: null,
      note: null,
      tags: null,
      interestType: "Simple",
      interestRate: 10,
      interestTime: 2,
      compoundingFrequency: null,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      creditPayment: null,
    };

    const details = getTotalAmountWithExtraData(tx);
    assert.strictEqual(details.principal, 1000);
    assert.strictEqual(details.interestAmount, 200);
    assert.strictEqual(details.totalAmount, 1200);
    assert.strictEqual(getTotalAmount(tx), 1200);
  });

  await t.test("calculates credit with Compound interest yearly", () => {
    // Principal: 1000, Rate: 10%, Time: 2 years, Yearly compounding
    // Total = 1000 * (1 + 0.10/1)^(1*2) = 1000 * 1.21 = 1210
    const tx: TransactionType = {
      id: 3,
      expenseType: "Credit",
      subExpenseType: "Borrow",
      amount: [{ amount: 1000, title: "Bank" }],
      toFrom: "Bank",
      toFromPhoneNumber: null,
      note: null,
      tags: null,
      interestType: "Compound",
      interestRate: 10,
      interestTime: 2,
      compoundingFrequency: "yearly",
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      creditPayment: null,
    };

    const details = getTotalAmountWithExtraData(tx);
    assert.strictEqual(details.principal, 1000);
    assert.strictEqual(details.interestAmount, 210);
    assert.strictEqual(details.totalAmount, 1210);
    assert.strictEqual(getTotalAmount(tx), 1210);
  });

  await t.test("calculates credit with None interest as just principal", () => {
    const tx: TransactionType = {
      id: 4,
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 500, title: "Personal" }],
      toFrom: "Friend",
      toFromPhoneNumber: null,
      note: null,
      tags: null,
      interestType: "None",
      interestRate: 15,
      interestTime: 3,
      compoundingFrequency: "yearly",
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      creditPayment: null,
    };

    const details = getTotalAmountWithExtraData(tx);
    assert.strictEqual(details.interestAmount, 0);
    assert.strictEqual(details.totalAmount, 500);
  });
});
