import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  TransactionType,
  ShoppingCartType,
  ShoppingProduct,
  GoalType,
} from "../src/db/schema";
import type { ExpenseType, SubExpenseType } from "../src/constants/expense";

export const setupTestDb = () => {
  const sqlite = new DatabaseSync(":memory:");
  const migrationDir = path.resolve(process.cwd(), "src/db/drizzle");
  const files = [
    "0000_small_electro.sql",
    "0001_conscious_wraith.sql",
    "0002_chief_infant_terrible.sql",
    "0003_square_dark_beast.sql",
    "0004_rich_warpath.sql",
    "0005_fresh_goblin_queen.sql",
    "0006_demonic_naoko.sql",
  ];

  for (const file of files) {
    const filePath = path.join(migrationDir, file);
    if (fs.existsSync(filePath)) {
      const sqlContent = fs.readFileSync(filePath, "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const statement of statements) {
        sqlite.exec(statement);
      }
    }
  }

  return sqlite;
};

test("Transactions Database Operations Characterization Baseline", async (t) => {
  const sqlite = setupTestDb();

  await t.test("inserts, retrieves, and updates transactions with JSON serialization", () => {
    const insertStmt = sqlite.prepare(`
      INSERT INTO transactions (
        expenseType, subExpenseType, amountArr, toFrom, toFromPhoneNumber,
        note, tags, interestType, interestRate, interestTime,
        compoundingFrequency, location, createdAt, updatedAt, creditPayment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const now = Math.floor(Date.now() / 1000);
    const amountArr = JSON.stringify([{ amount: 1500, title: "Groceries" }]);
    const tags = JSON.stringify(["Food", "Weekly"]);
    const location = JSON.stringify({ lat: 28.6139, lon: 77.209 });

    const inserted = insertStmt.get(
      "Simple Expense",
      "Send",
      amountArr,
      "Supermarket",
      "+919876543210",
      "Vegetables & fruits",
      tags,
      "None",
      null,
      null,
      null,
      location,
      now,
      now,
      null,
    ) as any;

    assert.ok(inserted.id > 0);
    assert.strictEqual(inserted.expenseType, "Simple Expense");
    assert.strictEqual(inserted.toFrom, "Supermarket");
    assert.deepStrictEqual(JSON.parse(inserted.amountArr), [
      { amount: 1500, title: "Groceries" },
    ]);
    assert.deepStrictEqual(JSON.parse(inserted.tags), ["Food", "Weekly"]);

    // Update transaction
    const updateStmt = sqlite.prepare(`
      UPDATE transactions
      SET note = ?, creditPayment = ?, updatedAt = ?
      WHERE id = ?
      RETURNING *
    `);
    const updated = updateStmt.get(
      "Updated Note",
      500,
      now + 60,
      inserted.id,
    ) as any;

    assert.strictEqual(updated.note, "Updated Note");
    assert.strictEqual(updated.creditPayment, 500);

    // Delete transaction
    const deleteStmt = sqlite.prepare("DELETE FROM transactions WHERE id = ?");
    deleteStmt.run(inserted.id);

    const getStmt = sqlite.prepare("SELECT * FROM transactions WHERE id = ?");
    const found = getStmt.get(inserted.id);
    assert.strictEqual(found, undefined);
  });

  await t.test("cursor pagination and expenseType filtering work as expected", () => {
    const insertStmt = sqlite.prepare(`
      INSERT INTO transactions (
        expenseType, subExpenseType, amountArr, toFrom, note, tags, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert 10 transactions across different types
    const baseTime = 1700000000;
    for (let i = 1; i <= 10; i++) {
      const type = i % 2 === 0 ? "Simple Expense" : "Credit";
      insertStmt.run(
        type,
        "Send",
        JSON.stringify([{ amount: i * 100 }]),
        `Vendor ${i}`,
        `Note ${i}`,
        JSON.stringify([`Tag${i}`]),
        baseTime + i * 10,
        baseTime + i * 10,
      );
    }

    // Filter by Simple Expense
    const simpleStmt = sqlite.prepare(`
      SELECT id, expenseType, updatedAt
      FROM transactions
      WHERE expenseType = 'Simple Expense'
      ORDER BY updatedAt DESC, id DESC
      LIMIT 3
    `);
    const simpleRows = simpleStmt.all() as any[];
    assert.strictEqual(simpleRows.length, 3);
    assert.strictEqual(simpleRows[0].expenseType, "Simple Expense");
    assert.strictEqual(simpleRows[1].expenseType, "Simple Expense");
    assert.strictEqual(simpleRows[2].expenseType, "Simple Expense");

    // Cursor pagination (page 2)
    const cursor = simpleRows[2];
    const page2Stmt = sqlite.prepare(`
      SELECT id, expenseType, updatedAt
      FROM transactions
      WHERE expenseType = 'Simple Expense'
        AND (updatedAt < ? OR (updatedAt = ? AND id < ?))
      ORDER BY updatedAt DESC, id DESC
      LIMIT 3
    `);
    const page2Rows = page2Stmt.all(
      cursor.updatedAt,
      cursor.updatedAt,
      cursor.id,
    ) as any[];
    assert.strictEqual(page2Rows.length, 2); // 5 total, page 1 had 3, page 2 has 2
  });

  await t.test("search query matches tags, toFrom, and note", () => {
    const searchStmt = sqlite.prepare(`
      SELECT id, toFrom, note, tags
      FROM transactions
      WHERE toFrom LIKE ? OR note LIKE ? OR tags LIKE ?
    `);

    const result = searchStmt.all("%Vendor 3%", "%Vendor 3%", "%Vendor 3%") as any[];
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].toFrom, "Vendor 3");
  });
});

test("Shopping Cart Database Operations Characterization Baseline", async (t) => {
  const sqlite = setupTestDb();

  await t.test("inserts shopping list, updates items, and queries by geofence id", () => {
    const insertStmt = sqlite.prepare(`
      INSERT INTO shoppingcart (
        products, note, createdAt, updatedAt, location, completed_items
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const now = Math.floor(Date.now() / 1000);
    const products = JSON.stringify([
      { productName: "Milk", amount: 50, quantity: 2, unit: "L" },
      { productName: "Bread", amount: 30, quantity: 1, unit: "pc" },
    ]);
    const location = JSON.stringify({
      lat: 28.5,
      lon: 77.5,
      geoFenceId: "fence_abc_123",
    });

    const inserted = insertStmt.get(
      products,
      "Supermarket Run",
      now,
      now,
      location,
      JSON.stringify([]),
    ) as any;

    assert.ok(inserted.id > 0);
    assert.strictEqual(inserted.note, "Supermarket Run");
    assert.deepStrictEqual(JSON.parse(inserted.products).length, 2);

    // Query by geofence ID
    const geoStmt = sqlite.prepare(`
      SELECT id, note, location
      FROM shoppingcart
      WHERE json_extract(location, '$.geoFenceId') = ?
    `);
    const geoMatch = geoStmt.get("fence_abc_123") as any;
    assert.ok(geoMatch);
    assert.strictEqual(geoMatch.id, inserted.id);

    // Update completed items
    const updateStmt = sqlite.prepare(`
      UPDATE shoppingcart
      SET completed_items = ?, updatedAt = ?
      WHERE id = ?
      RETURNING *
    `);
    const updated = updateStmt.get(
      JSON.stringify(["Milk"]),
      now + 60,
      inserted.id,
    ) as any;
    assert.deepStrictEqual(JSON.parse(updated.completed_items), ["Milk"]);

    // Delete list
    const deleteStmt = sqlite.prepare("DELETE FROM shoppingcart WHERE id = ?");
    deleteStmt.run(inserted.id);

    const checkStmt = sqlite.prepare("SELECT * FROM shoppingcart WHERE id = ?");
    assert.strictEqual(checkStmt.get(inserted.id), undefined);
  });
});

test("Goals Database Operations Characterization Baseline", async (t) => {
  const sqlite = setupTestDb();

  await t.test("creates goal, calculates active vs achieved counts, and updates money", () => {
    const insertStmt = sqlite.prepare(`
      INSERT INTO goals (
        targetName, targetMoney, currentMoney, note, tags, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const now = Math.floor(Date.now() / 1000);
    const goal1 = insertStmt.get(
      "Buy Laptop",
      60000,
      20000,
      "For work",
      JSON.stringify(["Tech"]),
      now,
      now,
    ) as any;

    const goal2 = insertStmt.get(
      "Trip to Goa",
      15000,
      15000,
      "Vacation",
      JSON.stringify(["Travel"]),
      now + 10,
      now + 10,
    ) as any;

    assert.ok(goal1.id > 0);
    assert.ok(goal2.id > 0);

    // Summary counts
    const countStmt = sqlite.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN currentMoney < targetMoney THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN currentMoney >= targetMoney THEN 1 ELSE 0 END), 0) AS achieved
      FROM goals
    `);
    const counts = countStmt.get() as { active: number; achieved: number };
    assert.strictEqual(Number(counts.active), 1);
    assert.strictEqual(Number(counts.achieved), 1);

    // Update progress on goal 1
    const updateStmt = sqlite.prepare(`
      UPDATE goals
      SET currentMoney = ?, updatedAt = ?
      WHERE id = ?
      RETURNING *
    `);
    const updated1 = updateStmt.get(60000, now + 50, goal1.id) as any;
    assert.strictEqual(updated1.currentMoney, 60000);

    const countsAfter = countStmt.get() as { active: number; achieved: number };
    assert.strictEqual(Number(countsAfter.active), 0);
    assert.strictEqual(Number(countsAfter.achieved), 2);
  });
});
