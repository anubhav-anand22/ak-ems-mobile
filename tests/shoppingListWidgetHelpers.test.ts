import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import type { ShoppingCartType, ShoppingProduct } from "../src/db/schema";
import { widgetThemes } from "../src/constants/widgetTheme";
import {
  blendHexColors,
  createShoppingListItemToggler,
  formatShoppingListDate,
  formatShoppingProductMeta,
  getCheckboxSvg,
  getCompletedCountForList,
  getLatestShoppingLists,
  getRefreshIconSvg,
  getShoppingListDisplayTitle,
  getShoppingListUri,
  getShoppingWidgetPalette,
  MAX_WIDGET_SHOPPING_LISTS,
  parseToggleShoppingItemData,
} from "../src/widget/ShopingListWidget/widgetHelpers";

const require = createRequire(import.meta.url);
const {
  extractExpoPathFromURL,
} = require("../node_modules/expo-router/build/fork/extractPathFromURL.js") as {
  extractExpoPathFromURL: (prefixes: string[], url?: string) => string;
};

const makeList = (
  id: number,
  updatedAtIso: string,
  overrides: Partial<ShoppingCartType> = {},
): ShoppingCartType => ({
  id,
  products: [{ productName: `Item ${id}`, amount: 50, quantity: 1, unit: "pc" }],
  note: `List ${id}`,
  createdAt: new Date(updatedAtIso),
  updatedAt: new Date(updatedAtIso),
  location: null,
  completedItems: [],
  ...overrides,
});

test("getLatestShoppingLists", async (t) => {
  await t.test("returns latest 3 lists sorted by updatedAt desc then id desc", () => {
    const lists = [
      makeList(1, "2026-01-01T10:00:00Z"),
      makeList(2, "2026-01-03T10:00:00Z"),
      makeList(3, "2026-01-02T10:00:00Z"),
      makeList(4, "2026-01-04T10:00:00Z"),
      makeList(5, "2026-01-03T10:00:00Z"),
    ];

    const latest = getLatestShoppingLists(lists);
    assert.strictEqual(latest.length, MAX_WIDGET_SHOPPING_LISTS);
    assert.deepStrictEqual(
      latest.map((l) => l.id),
      [4, 5, 2],
    );
    assert.strictEqual(lists[0].id, 1);
  });

  await t.test("returns all available lists when fewer than 3 exist", () => {
    assert.deepStrictEqual(getLatestShoppingLists([]), []);
    const two = [
      makeList(1, "2026-01-01T10:00:00Z"),
      makeList(2, "2026-01-02T10:00:00Z"),
    ];
    assert.deepStrictEqual(
      getLatestShoppingLists(two).map((l) => l.id),
      [2, 1],
    );
  });
});

test("getShoppingListUri", async (t) => {
  await t.test("builds deep links compatible with prod/dev schemes and Expo Router", () => {
    const prodUri = getShoppingListUri(false, 7);
    assert.strictEqual(
      prodUri,
      "akemsmobile://(tabs)/shoping-list?isFromWidget=true&listId=7",
    );
    assert.strictEqual(
      extractExpoPathFromURL([], prodUri),
      "(tabs)/shoping-list?isFromWidget=true&listId=7",
    );

    const devUri = getShoppingListUri(true);
    assert.strictEqual(
      devUri,
      "akemsmobile-dev://(tabs)/shoping-list?isFromWidget=true",
    );
    assert.strictEqual(
      extractExpoPathFromURL([], devUri),
      "(tabs)/shoping-list?isFromWidget=true",
    );
  });
});

test("parseToggleShoppingItemData", async (t) => {
  await t.test("parses valid payloads", () => {
    assert.deepStrictEqual(
      parseToggleShoppingItemData({ listId: 5, productName: "Milk" }),
      { listId: 5, productName: "Milk" },
    );
    assert.deepStrictEqual(
      parseToggleShoppingItemData({ listId: "12", productName: "Bread" }),
      { listId: 12, productName: "Bread" },
    );
  });

  await t.test("rejects malformed or unsafe payloads", () => {
    assert.strictEqual(parseToggleShoppingItemData(null), null);
    assert.strictEqual(parseToggleShoppingItemData({}), null);
    assert.strictEqual(
      parseToggleShoppingItemData({ listId: 0, productName: "Milk" }),
      null,
    );
    assert.strictEqual(
      parseToggleShoppingItemData({ listId: -3, productName: "Milk" }),
      null,
    );
    assert.strictEqual(
      parseToggleShoppingItemData({ listId: 1.5, productName: "Milk" }),
      null,
    );
    assert.strictEqual(
      parseToggleShoppingItemData({ listId: 1, productName: "" }),
      null,
    );
  });
});

test("formatShoppingProductMeta", async (t) => {
  await t.test("formats quantity, unit, and Indian currency amount", () => {
    assert.strictEqual(
      formatShoppingProductMeta({ quantity: 2, unit: "kg", amount: 1250 }),
      "2 kg • ₹1,250",
    );
    assert.strictEqual(
      formatShoppingProductMeta({ quantity: 500, unit: "ml" }),
      "500 ml",
    );
    assert.strictEqual(
      formatShoppingProductMeta({ quantity: 3 }),
      "3",
    );
    assert.strictEqual(
      formatShoppingProductMeta({ unit: "pack", amount: 40 }),
      "pack • ₹40",
    );
    assert.strictEqual(formatShoppingProductMeta({}), "");
  });
});

test("list titles, counts, dates, and palette generation", async (t) => {
  await t.test("formats display title and counts checked products accurately", () => {
    assert.strictEqual(getShoppingListDisplayTitle("  Groceries  "), "Groceries");
    assert.strictEqual(getShoppingListDisplayTitle("   "), "Shopping List");
    assert.strictEqual(getShoppingListDisplayTitle(null), "Shopping List");

    const count = getCompletedCountForList({
      products: [
        { productName: "Apples" },
        { productName: "Milk" },
        { productName: "Bread" },
      ],
      completedItems: ["Apples", "StaleItem"],
    });
    assert.strictEqual(count, 1);
    assert.strictEqual(getCompletedCountForList({ products: [], completedItems: null }), 0);
  });

  await t.test("handles valid and invalid date inputs gracefully", () => {
    assert.ok(formatShoppingListDate(new Date("2026-01-01T08:30:00Z")).length > 0);
    assert.strictEqual(formatShoppingListDate("not-a-date"), "");
  });

  await t.test("blends hex colors into 6-digit hex and produces compatible theme palettes & SVGs", () => {
    assert.strictEqual(blendHexColors("#000000", "#ffffff", 0), "#000000");
    assert.strictEqual(blendHexColors("#000000", "#ffffff", 1), "#ffffff");
    assert.strictEqual(blendHexColors("#000", "#fff", 0.5), "#808080");

    for (const theme of widgetThemes) {
      for (const isDark of [false, true]) {
        const palette = getShoppingWidgetPalette(
          isDark
            ? { color: theme.txtDark, backgroundColor: theme.dark }
            : { color: theme.txtLight, backgroundColor: theme.light },
        );
        for (const colorVal of Object.values(palette)) {
          assert.match(colorVal, /^#[0-9a-fA-F]{6}$/);
        }

        const checkedSvg = getCheckboxSvg(
          palette.text,
          palette.background,
          true,
          palette.checkboxBorder,
        );
        const uncheckedSvg = getCheckboxSvg(
          palette.text,
          palette.background,
          false,
          palette.checkboxBorder,
        );
        const refreshSvg = getRefreshIconSvg(palette.text);

        for (const svg of [checkedSvg, uncheckedSvg, refreshSvg]) {
          assert.ok(svg.startsWith("<svg "));
          assert.ok(svg.endsWith("</svg>"));
          assert.ok(!svg.includes("currentColor"));
        }
      }
    }
  });
});

test("SQLite shopping list widget query and toggle serialization", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE shoppingcart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      products TEXT NOT NULL,
      note TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      location TEXT,
      completed_items TEXT DEFAULT '[]'
    );
  `);

  const insertStmt = sqlite.prepare(`
    INSERT INTO shoppingcart (products, note, createdAt, updatedAt, completed_items)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    JSON.stringify([{ productName: "Old Item" }]),
    "List 1 Old",
    1700000100,
    1700000100,
    JSON.stringify([]),
  );
  insertStmt.run(
    JSON.stringify([{ productName: "Hardware Bolt" }]),
    "List 2 Tie A",
    1700000200,
    1700000200,
    JSON.stringify([]),
  );
  insertStmt.run(
    JSON.stringify([
      { productName: "Milk", quantity: 1, unit: "L", amount: 60 },
      { productName: "Bread", quantity: 2, unit: "pcs", amount: 80 },
      { productName: "Eggs", quantity: 12 },
    ]),
    "List 3 Latest Groceries",
    1700000300,
    1700000300,
    JSON.stringify(["Milk"]),
  );
  insertStmt.run(
    JSON.stringify([{ productName: "Cable" }]),
    "List 4 Tie B",
    1700000200,
    1700000200,
    JSON.stringify([]),
  );

  await t.test("selects latest 3 shopping lists ordered by updatedAt desc, id desc", () => {
    const rows = sqlite
      .prepare(
        `SELECT id, note, updatedAt FROM shoppingcart ORDER BY updatedAt DESC, id DESC LIMIT 3`,
      )
      .all() as { id: number; note: string; updatedAt: number }[];

    assert.deepStrictEqual(
      rows.map((r) => ({ id: r.id, note: r.note })),
      [
        { id: 3, note: "List 3 Latest Groceries" },
        { id: 4, note: "List 4 Tie B" },
        { id: 2, note: "List 2 Tie A" },
      ],
    );
  });

  await t.test("toggles items sequentially without losing concurrent taps or shifting updatedAt", async () => {
    const selectStmt = sqlite.prepare(
      `SELECT id, products, completed_items, updatedAt FROM shoppingcart WHERE id = ? LIMIT 1`,
    );
    const updateStmt = sqlite.prepare(
      `UPDATE shoppingcart SET completed_items = ? WHERE id = ?`,
    );

    const toggler = createShoppingListItemToggler({
      getListById: async (listId) => {
        await Promise.resolve();
        const row = selectStmt.get(listId) as
          | {
              id: number;
              products: string;
              completed_items: string | null;
            }
          | undefined;
        if (!row) return null;
        return {
          id: row.id,
          products: JSON.parse(row.products) as ShoppingProduct[],
          completedItems: row.completed_items
            ? (JSON.parse(row.completed_items) as string[])
            : [],
        };
      },
      saveCompletedItems: async (listId, completedItems) => {
        await Promise.resolve();
        updateStmt.run(JSON.stringify(completedItems), listId);
      },
    });

    // Rapid parallel taps on list 3: uncheck Milk, check Bread, check Eggs
    await Promise.all([
      toggler(3, "Milk"),
      toggler(3, "Bread"),
      toggler(3, "Eggs"),
    ]);

    const afterRow = selectStmt.get(3) as {
      completed_items: string;
      updatedAt: number;
    };
    assert.deepStrictEqual(JSON.parse(afterRow.completed_items), [
      "Bread",
      "Eggs",
    ]);
    assert.strictEqual(afterRow.updatedAt, 1700000300);

    // Non-existent list or non-existent product should safely no-op
    assert.strictEqual(await toggler(999, "Milk"), null);
    assert.deepStrictEqual(await toggler(3, "NonExistent"), ["Bread", "Eggs"]);
  });

  sqlite.close();
});
