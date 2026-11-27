import test from "node:test";
import assert from "node:assert/strict";
import { resolveAmountItemsForSubmit } from "../src/lib/expenseValidation";

test("resolveAmountItemsForSubmit", async (t) => {
  await t.test("warns and returns when amountArr is empty and both inputs are empty", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "   ",
      amountTitleTxt: "",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.amountErr, "Amount is required");
      assert.strictEqual(res.titleErr, "Amount title is required");
      assert.strictEqual(res.warningMessage, "Please enter amount and amount title");
    }
  });

  await t.test("warns and returns when amountArr is empty and amount is empty", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "",
      amountTitleTxt: "Groceries",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.amountErr, "Amount is required");
      assert.strictEqual(res.titleErr, "");
      assert.strictEqual(res.warningMessage, "Please enter an amount");
    }
  });

  await t.test("warns and returns when amountArr is empty and title is empty", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "250",
      amountTitleTxt: "  ",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.amountErr, "");
      assert.strictEqual(res.titleErr, "Amount title is required");
      assert.strictEqual(res.warningMessage, "Please enter an amount title");
    }
  });

  await t.test("warns and returns when amountArr is empty and amount expression is invalid", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "100++",
      amountTitleTxt: "Lunch",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.amountErr, "Invalid amount");
      assert.strictEqual(res.warningMessage, "Please enter a valid amount");
    }
  });

  await t.test("warns and returns when amountArr is empty and evaluated amount is 0", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "50 - 50",
      amountTitleTxt: "Zero item",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.amountErr, "Amount cannot be 0");
      assert.strictEqual(res.warningMessage, "Total amount cannot be 0");
    }
  });

  await t.test("adds item and proceeds when amountArr is empty and both inputs are valid & non-zero", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [],
      amountTxt: "100 + 50",
      amountTitleTxt: "  Dinner  ",
    });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.addedFromInputs, true);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].title, "Dinner");
      assert.strictEqual(res.items[0].amount, 150);
      assert.strictEqual(res.totalAmount, 150);
    }
  });

  await t.test("warns and returns when amountArr is non-empty but total amount sums to 0", () => {
    const res = resolveAmountItemsForSubmit({
      amountArr: [
        { id: 1, title: "Item", amount: 100 },
        { id: 2, title: "Discount", amount: -100 },
      ],
      amountTxt: "",
      amountTitleTxt: "",
    });
    assert.strictEqual(res.ok, false);
    if (!res.ok) {
      assert.strictEqual(res.warningMessage, "Total amount cannot be 0");
    }
  });

  await t.test("proceeds when amountArr is non-empty and total amount is non-zero", () => {
    const existing = [{ id: 1, title: "Rent", amount: 5000 }];
    const res = resolveAmountItemsForSubmit({
      amountArr: existing,
      amountTxt: "",
      amountTitleTxt: "",
    });
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.addedFromInputs, false);
      assert.deepStrictEqual(res.items, existing);
      assert.strictEqual(res.totalAmount, 5000);
    }
  });
});
