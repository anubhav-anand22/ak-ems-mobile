import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import {
  setDb,
  createTransaction,
  getTransactionById,
  getTransactions,
  getTransactionsByIds,
  updateTransaction,
  deleteTransaction,
  deleteTransactions,
  getAllReferencedNoteImages,
  convertTransactionType,
  updateCreditPayment,
  addCreditPayment,
  getAllTransactions,
  getDistinctToFromList,
  getRecentUsers,
  getUserTransactionsSummary,
  getUserTransactions,
  getUserTransactionStats,
  getTransactionSummaryStats,
  getWidgetTransactions,
  getTransactionsSince,
  createShoppingList,
  getShoppingLists,
  getShoppingListById,
  getAllShoppingLists,
  getShoppingListsByGeofenceIds,
  updateShoppingList,
  updateShoppingListProducts,
  updateShoppingListMetadata,
  updateShoppingListProductsAndCompleted,
  updateShoppingListCompletedItems,
  toggleShoppingListItem,
  deleteShoppingList,
  createGoal,
  getGoalById,
  getGoals,
  getGoalsSummaryCounts,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
} from "../src/db";

const initTestDb = () => {
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
    "0007_dizzy_living_mummy.sql",
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

  const proxyDb = drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      if (method === "run") {
        stmt.run(...(params as any[]));
        return { rows: [] };
      }
      const rows = stmt.all(...(params as any[]));
      const rawRows = rows.map((r) => Object.values(r as Record<string, unknown>));
      return { rows: rawRows };
    },
    { schema },
  );

  setDb(proxyDb);
  return sqlite;
};

test("Data Access Layer (DAL) - Transactions", async (t) => {
  initTestDb();

  await t.test("creates, retrieves by id, updates, and deletes transactions", async () => {
    const created = await createTransaction({
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [{ amount: 250, title: "Coffee" }],
      toFrom: "Cafe Coffee Day",
      toFromPhoneNumber: "9876543210",
      note: "Meeting with client",
      noteImages: ["note_receipt_1.webp", "note_receipt_2.webp"],
      tags: ["food", "work"],
    });

    assert.ok(created.id);
    assert.strictEqual(created.toFrom, "Cafe Coffee Day");
    assert.deepStrictEqual(created.tags, ["food", "work"]);
    assert.deepStrictEqual(created.noteImages, [
      "note_receipt_1.webp",
      "note_receipt_2.webp",
    ]);

    const referencedImages = await getAllReferencedNoteImages();
    assert.ok(referencedImages.includes("note_receipt_1.webp"));
    assert.ok(referencedImages.includes("note_receipt_2.webp"));

    const retrieved = await getTransactionById(created.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.id, created.id);
    assert.strictEqual(retrieved?.note, "Meeting with client");
    assert.deepStrictEqual(retrieved?.noteImages, [
      "note_receipt_1.webp",
      "note_receipt_2.webp",
    ]);

    const updated = await updateTransaction(created.id, {
      note: "Updated meeting note",
      noteImages: ["note_receipt_1.webp"],
    });
    assert.strictEqual(updated?.note, "Updated meeting note");
    assert.deepStrictEqual(updated?.noteImages, ["note_receipt_1.webp"]);

    await deleteTransaction(created.id);
    const afterDelete = await getTransactionById(created.id);
    assert.strictEqual(afterDelete, undefined);
  });

  await t.test("filtering, search, pagination, and batch retrieval", async () => {
    const baseDate = new Date("2026-01-01T10:00:00Z");
    const t1 = await createTransaction({
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [{ amount: 100 }],
      toFrom: "Alice",
      tags: ["groceries"],
      createdAt: new Date(baseDate.getTime() + 1000),
      updatedAt: new Date(baseDate.getTime() + 1000),
    });

    const t2 = await createTransaction({
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 500 }],
      toFrom: "Bob",
      tags: ["loan"],
      createdAt: new Date(baseDate.getTime() + 2000),
      updatedAt: new Date(baseDate.getTime() + 2000),
    });

    const t3 = await createTransaction({
      expenseType: "Simple Expense",
      subExpenseType: "Receive",
      amount: [{ amount: 150 }],
      toFrom: "Charlie",
      tags: ["freelance"],
      createdAt: new Date(baseDate.getTime() + 3000),
      updatedAt: new Date(baseDate.getTime() + 3000),
    });

    // Test getTransactionsByIds
    const batch = await getTransactionsByIds([t1.id, t3.id]);
    assert.strictEqual(batch.length, 2);

    // Test filter by expenseType
    const creditList = await getTransactions({ txType: "Credit" });
    assert.strictEqual(creditList.length, 1);
    assert.strictEqual(creditList[0].id, t2.id);

    // Test searchTxt
    const searchRes = await getTransactions({ searchTxt: "Charlie" });
    assert.strictEqual(searchRes.length, 1);
    assert.strictEqual(searchRes[0].id, t3.id);

    // Test pagination with cursor
    const page1 = await getTransactions({ limit: 2 });
    assert.strictEqual(page1.length, 2);
    const lastItem = page1[1];
    const page2 = await getTransactions({
      cursor: { id: lastItem.id, updatedAt: lastItem.updatedAt },
      limit: 2,
    });
    assert.strictEqual(page2.length, 1);
  });

  await t.test("credit payment updates and type conversion", async () => {
    const tx = await createTransaction({
      expenseType: "Credit",
      subExpenseType: "Lend",
      amount: [{ amount: 1000 }],
      toFrom: "David",
      creditPayment: 100,
    });

    const updated = await updateCreditPayment(tx.id, 500);
    assert.strictEqual(updated?.creditPayment, 500);

    const partialAdd = await addCreditPayment(tx.id, 200);
    assert.strictEqual(partialAdd.previousPayment, 500);
    assert.strictEqual(partialAdd.newPayment, 700);

    const converted = await convertTransactionType(tx.id, "Simple Expense");
    assert.strictEqual(converted?.expenseType, "Simple Expense");
    assert.strictEqual(converted?.subExpenseType, "Send");
    assert.strictEqual(converted?.creditPayment, null);
  });

  await t.test("distinct toFrom, recent users, and user summary stats", async () => {
    const distinct = await getDistinctToFromList();
    assert.ok(Array.isArray(distinct));

    const recent = await getRecentUsers({ limit: 5 });
    assert.ok(recent.length > 0);

    const userSummary = await getUserTransactionsSummary("Alice");
    assert.ok(userSummary);
    assert.strictEqual(userSummary.totalExpense, 100);

    const userTxs = await getUserTransactions("Alice");
    assert.strictEqual(userTxs.length, 1);

    const summaryStats = await getTransactionSummaryStats({
      targetSubtype: "Send",
    });
    assert.ok(summaryStats.transactionCount >= 1);
  });
});

test("Data Access Layer (DAL) - Shopping Lists", async (t) => {
  initTestDb();

  await t.test("creates, retrieves, updates products, completed items, and geofence ids", async () => {
    const list = await createShoppingList({
      products: [
        { productName: "Milk", quantity: 2, unit: "L", amount: 120 },
        { productName: "Bread", quantity: 1, amount: 40 },
      ],
      note: "Weekly Groceries",
      location: { lat: 28.5355, lon: 77.391, geoFenceId: "geo-home" },
      completedItems: [],
    });

    assert.ok(list.id);
    assert.strictEqual(list.note, "Weekly Groceries");
    assert.strictEqual(list.products.length, 2);

    const retrieved = await getShoppingListById(list.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.id, list.id);

    // Update completed items
    const completedRes = await updateShoppingListCompletedItems(list.id, ["Milk"]);
    assert.deepStrictEqual(completedRes?.completedItems, ["Milk"]);

    // Toggle shopping list item
    const toggled = await toggleShoppingListItem(list.id, "Bread");
    assert.ok(toggled?.completedItems?.includes("Bread"));
    assert.ok(toggled?.completedItems?.includes("Milk"));

    // Toggle again to uncheck
    const untoggled = await toggleShoppingListItem(list.id, "Bread");
    assert.ok(!untoggled?.completedItems?.includes("Bread"));

    // Query by geofence ids
    const geoLists = await getShoppingListsByGeofenceIds(["geo-home"]);
    assert.strictEqual(geoLists.length, 1);
    assert.strictEqual(geoLists[0].id, list.id);

    // Delete
    await deleteShoppingList(list.id);
    const afterDelete = await getShoppingListById(list.id);
    assert.strictEqual(afterDelete, undefined);
  });
});

test("Data Access Layer (DAL) - Goals", async (t) => {
  initTestDb();

  await t.test("creates, counts, queries with pagination, updates progress, and deletes goals", async () => {
    const goal1 = await createGoal({
      targetName: "Emergency Fund",
      targetMoney: 50000,
      currentMoney: 10000,
      note: "Rainy day fund",
      tags: ["savings"],
    });

    const goal2 = await createGoal({
      targetName: "New Monitor",
      targetMoney: 20000,
      currentMoney: 20000,
    });

    const counts = await getGoalsSummaryCounts();
    assert.strictEqual(counts.active, 1);
    assert.strictEqual(counts.achieved, 1);

    const activeGoals = await getGoals({ tab: "active" });
    assert.strictEqual(activeGoals.length, 1);
    assert.strictEqual(activeGoals[0].id, goal1.id);

    const achievedGoals = await getGoals({ tab: "achieved" });
    assert.strictEqual(achievedGoals.length, 1);
    assert.strictEqual(achievedGoals[0].id, goal2.id);

    // Update progress
    const updated = await updateGoalProgress(goal1.id, 50000);
    assert.strictEqual(updated?.currentMoney, 50000);

    const updatedCounts = await getGoalsSummaryCounts();
    assert.strictEqual(updatedCounts.active, 0);
    assert.strictEqual(updatedCounts.achieved, 2);

    await deleteGoal(goal1.id);
    await deleteGoal(goal2.id);

    const finalCounts = await getGoalsSummaryCounts();
    assert.strictEqual(finalCounts.active, 0);
    assert.strictEqual(finalCounts.achieved, 0);
  });
});
