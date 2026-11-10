import test from "node:test";
import assert from "node:assert/strict";
import type { ShoppingCartType } from "../src/db/schema";
import {
  appendProductToShoppingList,
  removeProductFromShoppingListByIndex,
  sanitizeDecimalInput,
  updateShoppingListCompletedItems,
  updateShoppingListMetadata,
  validateShoppingProductInput,
} from "../src/lib/shoppingListUtils";

const createMockList = (
  overrides: Partial<ShoppingCartType> = {},
): ShoppingCartType => ({
  id: 1,
  products: [
    { productName: "Apples", amount: 120, quantity: 2, unit: "kg" },
    { productName: "Milk", amount: 60, quantity: 1, unit: "L" },
  ],
  note: "Weekly Groceries",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  location: null,
  completedItems: ["Apples"],
  ...overrides,
});

test("sanitizeDecimalInput", async (t) => {
  await t.test("strips non-numeric characters and duplicate decimals", () => {
    assert.strictEqual(sanitizeDecimalInput("12a.3b.4"), "12.34");
    assert.strictEqual(sanitizeDecimalInput("-50"), "50");
    assert.strictEqual(sanitizeDecimalInput("..25"), ".25");
  });
});

test("validateShoppingProductInput", async (t) => {
  await t.test("rejects empty and whitespace-only item names", () => {
    const emptyRes = validateShoppingProductInput({ productName: "" });
    assert.strictEqual(emptyRes.isValid, false);
    assert.ok(emptyRes.errors.productName);

    const spaceRes = validateShoppingProductInput({ productName: "   \n\t  " });
    assert.strictEqual(spaceRes.isValid, false);
    assert.ok(spaceRes.errors.productName);
  });

  await t.test("trims valid product fields and rounds numeric values", () => {
    const res = validateShoppingProductInput({
      productName: "  Organic Bananas  ",
      amount: " 45.678 ",
      quantity: " 1.5 ",
      unit: " dozen ",
    });

    assert.strictEqual(res.isValid, true);
    if (res.isValid) {
      assert.deepStrictEqual(res.product, {
        productName: "Organic Bananas",
        amount: 45.68,
        quantity: 1.5,
        unit: "dozen",
      });
    }
  });

  await t.test("allows optional fields to be omitted", () => {
    const res = validateShoppingProductInput({
      productName: "Bread",
      amount: "",
      quantity: " ",
      unit: "",
    });

    assert.strictEqual(res.isValid, true);
    if (res.isValid) {
      assert.deepStrictEqual(res.product, {
        productName: "Bread",
        amount: undefined,
        quantity: undefined,
        unit: undefined,
      });
    }
  });

  await t.test("rejects invalid amount or non-positive quantity", () => {
    const badAmount = validateShoppingProductInput({
      productName: "Sugar",
      amount: ".",
    });
    assert.strictEqual(badAmount.isValid, false);
    assert.ok(badAmount.errors.amount);

    const zeroQty = validateShoppingProductInput({
      productName: "Sugar",
      quantity: "0",
    });
    assert.strictEqual(zeroQty.isValid, false);
    assert.ok(zeroQty.errors.quantity);
  });
});

test("appendProductToShoppingList", async (t) => {
  await t.test("immutably appends a product to only the targeted list", () => {
    const list1 = createMockList({ id: 1 });
    const list2 = createMockList({
      id: 2,
      note: "Hardware",
      products: [{ productName: "Screws", quantity: 10 }],
    });
    const initial = [list1, list2];
    const nextDate = new Date("2026-02-01T10:00:00Z");

    const updated = appendProductToShoppingList(
      initial,
      1,
      { productName: "Eggs", quantity: 12, unit: "pcs" },
      nextDate,
    );

    assert.notStrictEqual(updated, initial);
    assert.strictEqual(list1.products.length, 2);
    assert.strictEqual(updated[0].products.length, 3);
    assert.deepStrictEqual(updated[0].products[2], {
      productName: "Eggs",
      quantity: 12,
      unit: "pcs",
    });
    assert.strictEqual(updated[0].updatedAt, nextDate);
    assert.strictEqual(updated[1], list2);
  });
});

test("removeProductFromShoppingListByIndex", async (t) => {
  await t.test(
    "removes targeted row immutably and syncs completedItems",
    () => {
      const list = createMockList({
        id: 1,
        products: [
          { productName: "Apples" },
          { productName: "Milk" },
        ],
        completedItems: ["Apples", "Milk"],
      });
      const initial = [list];
      const nextDate = new Date("2026-02-02T12:00:00Z");

      const result = removeProductFromShoppingListByIndex(
        initial,
        1,
        0,
        nextDate,
      );
      assert.ok(result);
      assert.strictEqual(result.removedProduct.productName, "Apples");
      assert.deepStrictEqual(result.nextProducts, [{ productName: "Milk" }]);
      assert.deepStrictEqual(result.nextCompletedItems, ["Milk"]);
      assert.strictEqual(list.products.length, 2);
      assert.strictEqual(result.updatedLists[0].updatedAt, nextDate);
    },
  );

  await t.test(
    "preserves completed status if another row shares the same product name",
    () => {
      const list = createMockList({
        id: 1,
        products: [
          { productName: "Milk", unit: "1L" },
          { productName: "Milk", unit: "500ml" },
        ],
        completedItems: ["Milk"],
      });

      const result = removeProductFromShoppingListByIndex([list], 1, 0);
      assert.ok(result);
      assert.deepStrictEqual(result.nextProducts, [
        { productName: "Milk", unit: "500ml" },
      ]);
      assert.deepStrictEqual(result.nextCompletedItems, ["Milk"]);
    },
  );

  await t.test("returns null for invalid index or missing list", () => {
    const list = createMockList({ id: 1 });
    assert.strictEqual(removeProductFromShoppingListByIndex([list], 99, 0), null);
    assert.strictEqual(removeProductFromShoppingListByIndex([list], 1, -1), null);
    assert.strictEqual(removeProductFromShoppingListByIndex([list], 1, 5), null);
  });
});

test("updateShoppingListMetadata", async (t) => {
  await t.test("immutably updates note, location, and updatedAt", () => {
    const list1 = createMockList({ id: 1, note: "Old Note", location: null });
    const list2 = createMockList({ id: 2, note: "Keep" });
    const nextDate = new Date("2026-03-01T09:00:00Z");

    const updated = updateShoppingListMetadata(
      [list1, list2],
      1,
      {
        note: "Supermarket Run",
        location: { lat: 12.9716, lon: 77.5946, geoFenceId: "geo_1" },
      },
      nextDate,
    );

    assert.strictEqual(updated[0].note, "Supermarket Run");
    assert.deepStrictEqual(updated[0].location, {
      lat: 12.9716,
      lon: 77.5946,
      geoFenceId: "geo_1",
    });
    assert.strictEqual(updated[0].updatedAt, nextDate);
    assert.strictEqual(list1.note, "Old Note");
    assert.strictEqual(updated[1], list2);
  });
});

test("updateShoppingListCompletedItems", async (t) => {
  await t.test("immutably updates completedItems", () => {
    const list = createMockList({ id: 1, completedItems: [] });
    const updated = updateShoppingListCompletedItems([list], 1, ["Apples"]);
    assert.deepStrictEqual(updated[0].completedItems, ["Apples"]);
    assert.deepStrictEqual(list.completedItems, []);
  });
});
