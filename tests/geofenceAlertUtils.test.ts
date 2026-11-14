import test from "node:test";
import assert from "node:assert/strict";
import { formatGeofenceNotification } from "../src/lib/shoppingListUtils";
import type { ShoppingCartType } from "../src/db/schema";

test("formatGeofenceNotification", async (t) => {
  await t.test("returns generic reminder when no matching lists exist", () => {
    const res = formatGeofenceNotification([]);
    assert.deepStrictEqual(res, {
      title: "🚨 Geofence Alert!",
      body: "You have entered a shopping list reminder zone.",
    });
  });

  await t.test("formats alert with list note and preview of pending items", () => {
    const mockList: ShoppingCartType = {
      id: 1,
      products: [
        { productName: "Apples", amount: 100, quantity: 1, unit: "kg" },
        { productName: "Milk", amount: 50, quantity: 2, unit: "L" },
        { productName: "Bread" },
        { productName: "Butter" },
      ],
      note: "Supermarket Run",
      createdAt: new Date(),
      updatedAt: new Date(),
      location: { lat: 12.34, lon: 56.78, geoFenceId: "geo_123" },
      completedItems: ["Apples"],
    };

    const res = formatGeofenceNotification([mockList]);
    assert.strictEqual(res.title, "🚨 Supermarket Run");
    assert.strictEqual(res.body, "Items to buy: Milk, Bread, Butter");
  });

  await t.test("adds extra count when more than 3 pending items exist", () => {
    const mockList: ShoppingCartType = {
      id: 2,
      products: [
        { productName: "Item 1" },
        { productName: "Item 2" },
        { productName: "Item 3" },
        { productName: "Item 4" },
        { productName: "Item 5" },
      ],
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      location: { lat: 12.34, lon: 56.78, geoFenceId: "geo_456" },
      completedItems: [],
    };

    const res = formatGeofenceNotification([mockList]);
    assert.strictEqual(res.title, "🚨 Shopping List");
    assert.strictEqual(res.body, "Items to buy: Item 1, Item 2, Item 3 +2 more");
  });

  await t.test("handles when all products in list are already marked completed", () => {
    const mockList: ShoppingCartType = {
      id: 3,
      products: [{ productName: "Eggs" }],
      note: "Grocery",
      createdAt: new Date(),
      updatedAt: new Date(),
      location: { lat: 12.34, lon: 56.78, geoFenceId: "geo_789" },
      completedItems: ["Eggs"],
    };

    const res = formatGeofenceNotification([mockList]);
    assert.strictEqual(res.title, "🚨 Grocery");
    assert.strictEqual(res.body, "You are near this shopping location.");
  });
});
