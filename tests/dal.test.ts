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
  createWallet,
  getWallets,
  getWalletById,
  updateWallet,
  deleteWallet,
  adjustWalletBalance,
  transferBetweenWallets,
  createSplit,
  getSplitsPaginated,
  deleteSplit,
  createTransactionWithWallets,
  updateTransactionWithWallets,
  deleteTransactionWithWallets,
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
    "0008_yellow_blur.sql",
    "0009_money_splits.sql",
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

test("Data Access Layer (DAL) - Wallets & Atomic Transaction Allocations", async (t) => {
  initTestDb();

  await t.test("creates, reads, updates, and manually adjusts wallet balance with transaction history", async () => {
    const w1 = await createWallet({ name: "Cash" });
    assert.strictEqual(w1.currentBalance, 0);
    assert.strictEqual(w1.minBalance, null);
    assert.strictEqual(w1.maxBalance, null);

    const w2 = await createWallet({
      name: "HDFC Bank",
      currentBalance: 1000,
      minBalance: 500,
      maxBalance: 10000,
    });
    assert.strictEqual(w2.currentBalance, 1000);
    assert.strictEqual(w2.minBalance, 500);
    assert.strictEqual(w2.maxBalance, 10000);

    const list = await getWallets();
    assert.strictEqual(list.length, 2);

    const renamed = await updateWallet(w1.id, { name: "Petty Cash", currentBalance: 300 });
    assert.strictEqual(renamed?.name, "Petty Cash");
    assert.strictEqual(renamed?.currentBalance, 300);

    // Manual add creates Receive transaction
    const addRes = await adjustWalletBalance({
      walletId: w1.id,
      amount: 200,
      action: "add",
      note: "ATM Cash",
    });
    assert.strictEqual(addRes.wallet.currentBalance, 500);
    assert.strictEqual(addRes.transaction.subExpenseType, "Receive");
    assert.deepStrictEqual(addRes.transaction.walletAllocations, [
      { walletId: w1.id, amount: 200 },
    ]);

    // Manual subtract creates Send transaction
    const subRes = await adjustWalletBalance({
      walletId: w1.id,
      amount: 150,
      action: "subtract",
    });
    assert.strictEqual(subRes.wallet.currentBalance, 350);
    assert.strictEqual(subRes.transaction.subExpenseType, "Send");

    // Manual subtract exceeding balance fails atomically
    await assert.rejects(
      adjustWalletBalance({
        walletId: w1.id,
        amount: 400,
        action: "subtract",
      }),
      /Insufficient balance/,
    );
    assert.strictEqual((await getWalletById(w1.id))?.currentBalance, 350);
  });

  await t.test("atomic multi-wallet Send/Receive/Borrow/Lend and rollback on insufficient balance", async () => {
    const walletA = await createWallet({ name: "Wallet A", currentBalance: 500 });
    const walletB = await createWallet({ name: "Wallet B", currentBalance: 300 });

    // Outgoing Send split across A (500) and B (200)
    const sendTx = await createTransactionWithWallets({
      expenseType: "Simple Expense",
      subExpenseType: "Send",
      amount: [{ title: "Shopping", amount: 700 }],
      toFrom: "Mall",
      walletAllocations: [
        { walletId: walletA.id, amount: 500 },
        { walletId: walletB.id, amount: 200 },
      ],
    });
    assert.strictEqual((await getWalletById(walletA.id))?.currentBalance, 0);
    assert.strictEqual((await getWalletById(walletB.id))?.currentBalance, 100);

    // Multi-wallet Lend fails atomically if Wallet B lacks funds; Wallet A stays untouched
    await assert.rejects(
      createTransactionWithWallets({
        expenseType: "Credit",
        subExpenseType: "Lend",
        amount: [{ title: "Loan", amount: 200 }],
        toFrom: "Friend",
        walletAllocations: [
          { walletId: walletB.id, amount: 150 },
        ],
      }),
      /Insufficient balance/,
    );
    assert.strictEqual((await getWalletById(walletB.id))?.currentBalance, 100);

    // Incoming Borrow adds to wallet
    const borrowTx = await createTransactionWithWallets({
      expenseType: "Credit",
      subExpenseType: "Borrow",
      amount: [{ title: "Emergency", amount: 400 }],
      toFrom: "Sibling",
      walletAllocations: [{ walletId: walletA.id, amount: 400 }],
    });
    assert.strictEqual((await getWalletById(walletA.id))?.currentBalance, 400);

    // Update with revert_and_apply reverses old Send (A+500, B+200) and applies new Send (A-300)
    await updateTransactionWithWallets(
      sendTx.id,
      {
        amount: [{ title: "Shopping", amount: 300 }],
        walletAllocations: [{ walletId: walletA.id, amount: 300 }],
      },
      "revert_and_apply",
    );
    assert.strictEqual((await getWalletById(walletA.id))?.currentBalance, 600);
    assert.strictEqual((await getWalletById(walletB.id))?.currentBalance, 300);

    // Delete with revertWalletBalances = false leaves wallet balance untouched
    await deleteTransactionWithWallets(borrowTx.id, false);
    assert.strictEqual((await getWalletById(walletA.id))?.currentBalance, 600);
    assert.strictEqual(await getTransactionById(borrowTx.id), undefined);

    // Delete with revertWalletBalances = true reverts Send allocation
    await deleteTransactionWithWallets(sendTx.id, true);
    assert.strictEqual((await getWalletById(walletA.id))?.currentBalance, 900);
  });

  await t.test("deleting wallet clears wallet link from past transactions while keeping history", async () => {
    const tempWallet = await createWallet({ name: "Temp Wallet", currentBalance: 250 });
    const tx = await createTransactionWithWallets({
      expenseType: "Simple Expense",
      subExpenseType: "Receive",
      amount: [{ title: "Refund", amount: 100 }],
      toFrom: "Store",
      walletAllocations: [{ walletId: tempWallet.id, amount: 100 }],
    });
    assert.strictEqual((await getWalletById(tempWallet.id))?.currentBalance, 350);

    await deleteWallet(tempWallet.id);
    assert.strictEqual(await getWalletById(tempWallet.id), undefined);

    const remainingTx = await getTransactionById(tx.id);
    assert.ok(remainingTx);
    assert.strictEqual(remainingTx?.walletAllocations, null);
  });

  await t.test("atomically transfers balance between two wallets without polluting transaction counts", async () => {
    const from = await createWallet({ name: "HDFC", currentBalance: 1500 });
    const to = await createWallet({ name: "Cash", currentBalance: 200 });

    const { fromWallet, toWallet } = await transferBetweenWallets({
      fromWalletId: from.id,
      toWalletId: to.id,
      amount: 450,
    });
    assert.strictEqual(fromWallet.currentBalance, 1050);
    assert.strictEqual(toWallet.currentBalance, 650);

    // Same wallet transfer rejected atomically
    await assert.rejects(
      transferBetweenWallets({
        fromWalletId: from.id,
        toWalletId: from.id,
        amount: 100,
      }),
      /must be different/,
    );

    // Insufficient balance rejected atomically without partial debit
    await assert.rejects(
      transferBetweenWallets({
        fromWalletId: from.id,
        toWalletId: to.id,
        amount: 2000,
      }),
      /Insufficient balance/,
    );
    assert.strictEqual((await getWalletById(from.id))?.currentBalance, 1050);
    assert.strictEqual((await getWalletById(to.id))?.currentBalance, 650);
  });
});

test("Data Access Layer (DAL) - Money Splits", async (t) => {
  initTestDb();

  await t.test("creates splits, serializes/deserializes participants, and paginates newest-first", async () => {
    const s1 = await createSplit({
      totalAmount: 300,
      participants: [
        {
          id: "p1",
          name: "me",
          phoneNumber: null,
          splitType: "part",
          splitValue: 1,
          calculatedMoney: 150,
          calculatedPercentage: 50,
          isMe: true,
        },
        {
          id: "p2",
          name: "Alex",
          phoneNumber: "+919876543210",
          splitType: "part",
          splitValue: 1,
          calculatedMoney: 150,
          calculatedPercentage: 50,
          isMe: false,
        },
      ],
      createdAt: new Date(1_700_000_000_000),
    });

    const s2 = await createSplit({
      totalAmount: 500,
      participants: [
        {
          id: "p3",
          name: "Bob",
          phoneNumber: null,
          splitType: "money",
          splitValue: 300,
          calculatedMoney: 300,
          calculatedPercentage: 60,
          isMe: false,
        },
      ],
      createdAt: new Date(1_700_000_100_000),
    });

    const s3 = await createSplit({
      totalAmount: 1000,
      participants: [
        {
          id: "p4",
          name: "Carol",
          phoneNumber: "9123456789",
          splitType: "percentage",
          splitValue: 25,
          calculatedMoney: 250,
          calculatedPercentage: 25,
          isMe: false,
        },
      ],
      createdAt: new Date(1_700_000_200_000),
    });

    const page1 = await getSplitsPaginated({ limit: 2, offset: 0 });
    assert.strictEqual(page1.length, 2);
    assert.strictEqual(page1[0].id, s3.id);
    assert.strictEqual(page1[1].id, s2.id);
    assert.strictEqual(page1[0].participants[0].name, "Carol");
    assert.strictEqual(page1[0].participants[0].calculatedMoney, 250);

    const page2 = await getSplitsPaginated({ limit: 2, offset: 2 });
    assert.strictEqual(page2.length, 1);
    assert.strictEqual(page2[0].id, s1.id);
    assert.strictEqual(page2[0].participants.length, 2);
    assert.strictEqual(page2[0].participants[0].isMe, true);
    assert.strictEqual(page2[0].participants[1].phoneNumber, "+919876543210");

    const deleted = await deleteSplit(s2.id);
    assert.strictEqual(deleted?.id, s2.id);
    const afterDelete = await getSplitsPaginated({ limit: 10, offset: 0 });
    assert.strictEqual(afterDelete.length, 2);
    assert.strictEqual(
      afterDelete.some((s) => s.id === s2.id),
      false,
    );
  });
});
