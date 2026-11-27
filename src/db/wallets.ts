import { asc, eq, isNotNull } from "drizzle-orm";
import { roundWalletMoney, WalletAdjustmentAction } from "@/lib/walletUtils";
import { getDb, runInDbTransaction } from "./client";
import {
  dbTransaction,
  dbWallet,
  TransactionType,
  WalletType,
} from "./schema";

export type CreateWalletInput = {
  name: string;
  currentBalance?: number;
  minBalance?: number | null;
  maxBalance?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateWalletInput = {
  name?: string;
  currentBalance?: number;
  minBalance?: number | null;
  maxBalance?: number | null;
  updatedAt?: Date;
};

export async function getWallets(): Promise<WalletType[]> {
  return await getDb()
    .select()
    .from(dbWallet)
    .orderBy(asc(dbWallet.id));
}

export async function getWalletById(
  id: number,
): Promise<WalletType | undefined> {
  const [wallet] = await getDb()
    .select()
    .from(dbWallet)
    .where(eq(dbWallet.id, id))
    .limit(1);
  return wallet;
}

export async function createWallet(
  data: CreateWalletInput,
): Promise<WalletType> {
  const now = new Date();
  const [inserted] = await getDb()
    .insert(dbWallet)
    .values({
      name: data.name.trim(),
      currentBalance: roundWalletMoney(data.currentBalance ?? 0),
      minBalance: data.minBalance ?? null,
      maxBalance: data.maxBalance ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    })
    .returning();
  return inserted;
}

export async function updateWallet(
  id: number,
  updates: UpdateWalletInput,
): Promise<WalletType | undefined> {
  const payload: Record<string, unknown> = {
    updatedAt: updates.updatedAt ?? new Date(),
  };
  if (updates.name !== undefined) {
    payload.name = updates.name.trim();
  }
  if (updates.currentBalance !== undefined) {
    payload.currentBalance = roundWalletMoney(updates.currentBalance);
  }
  if (updates.minBalance !== undefined) {
    payload.minBalance = updates.minBalance;
  }
  if (updates.maxBalance !== undefined) {
    payload.maxBalance = updates.maxBalance;
  }

  const [updated] = await getDb()
    .update(dbWallet)
    .set(payload)
    .where(eq(dbWallet.id, id))
    .returning();
  return updated;
}

/**
 * Deletes a wallet inside an atomic SQLite transaction and clears references
 * to that wallet from any linked transactions while keeping transaction history intact.
 */
export async function deleteWallet(
  id: number,
): Promise<WalletType | undefined> {
  return await runInDbTransaction(async (db) => {
    const linkedRows: TransactionType[] = await db
      .select()
      .from(dbTransaction)
      .where(isNotNull(dbTransaction.walletAllocations));

    for (const tx of linkedRows) {
      if (!Array.isArray(tx.walletAllocations)) continue;
      if (!tx.walletAllocations.some((alloc) => alloc.walletId === id)) continue;

      const remaining = tx.walletAllocations.filter(
        (alloc) => alloc.walletId !== id,
      );
      await db
        .update(dbTransaction)
        .set({
          walletAllocations: remaining.length > 0 ? remaining : null,
        })
        .where(eq(dbTransaction.id, tx.id));
    }

    const [deleted] = await db
      .delete(dbWallet)
      .where(eq(dbWallet.id, id))
      .returning();
    return deleted;
  });
}

/**
 * Atomically adjusts a wallet balance (+ / -) and records a corresponding
 * Simple Expense transaction (Receive for add, Send for subtract) linked to the wallet.
 */
export async function adjustWalletBalance(params: {
  walletId: number;
  amount: number;
  action: WalletAdjustmentAction;
  note?: string;
}): Promise<{ wallet: WalletType; transaction: TransactionType }> {
  const amount = roundWalletMoney(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Adjustment amount must be greater than 0.");
  }

  return await runInDbTransaction(async (db) => {
    const [wallet]: WalletType[] = await db
      .select()
      .from(dbWallet)
      .where(eq(dbWallet.id, params.walletId))
      .limit(1);

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const currentBalance = roundWalletMoney(wallet.currentBalance);
    if (params.action === "subtract" && amount > currentBalance + 0.0001) {
      throw new Error(
        `Insufficient balance in ${wallet.name} (Available: ₹${currentBalance}).`,
      );
    }

    const nextBalance = roundWalletMoney(
      currentBalance + (params.action === "add" ? amount : -amount),
    );
    const now = new Date();

    const [updatedWallet]: WalletType[] = await db
      .update(dbWallet)
      .set({
        currentBalance: nextBalance,
        updatedAt: now,
      })
      .where(eq(dbWallet.id, params.walletId))
      .returning();

    const trimmedNote = params.note?.trim() ?? "";
    const itemTitle =
      trimmedNote ||
      (params.action === "add" ? "Wallet Deposit" : "Wallet Withdrawal");

    const [insertedTx]: TransactionType[] = await db
      .insert(dbTransaction)
      .values({
        expenseType: "Simple Expense",
        subExpenseType: params.action === "add" ? "Receive" : "Send",
        amount: [{ amount, title: itemTitle }],
        toFrom: wallet.name,
        note: trimmedNote || null,
        walletAllocations: [{ walletId: wallet.id, amount }],
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      wallet: updatedWallet,
      transaction: insertedTx,
    };
  });
}

/**
 * Atomically transfers funds between two wallets inside a single SQLite transaction.
 * Does not create expense/income entries so spending/received statistics stay accurate.
 */
export async function transferBetweenWallets(params: {
  fromWalletId: number;
  toWalletId: number;
  amount: number;
}): Promise<{ fromWallet: WalletType; toWallet: WalletType }> {
  if (params.fromWalletId === params.toWalletId) {
    throw new Error("Source and destination wallets must be different.");
  }

  const amount = roundWalletMoney(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be greater than 0.");
  }

  return await runInDbTransaction(async (db) => {
    const [fromWallet]: WalletType[] = await db
      .select()
      .from(dbWallet)
      .where(eq(dbWallet.id, params.fromWalletId))
      .limit(1);

    if (!fromWallet) {
      throw new Error("Source wallet not found.");
    }

    const [toWallet]: WalletType[] = await db
      .select()
      .from(dbWallet)
      .where(eq(dbWallet.id, params.toWalletId))
      .limit(1);

    if (!toWallet) {
      throw new Error("Destination wallet not found.");
    }

    const fromBalance = roundWalletMoney(fromWallet.currentBalance);
    if (amount > fromBalance + 0.0001) {
      throw new Error(
        `Insufficient balance in ${fromWallet.name} (Available: ₹${fromBalance}).`,
      );
    }

    const toBalance = roundWalletMoney(toWallet.currentBalance);
    const nextFromBalance = roundWalletMoney(fromBalance - amount);
    const nextToBalance = roundWalletMoney(toBalance + amount);
    const now = new Date();

    const [updatedFrom]: WalletType[] = await db
      .update(dbWallet)
      .set({
        currentBalance: nextFromBalance,
        updatedAt: now,
      })
      .where(eq(dbWallet.id, fromWallet.id))
      .returning();

    const [updatedTo]: WalletType[] = await db
      .update(dbWallet)
      .set({
        currentBalance: nextToBalance,
        updatedAt: now,
      })
      .where(eq(dbWallet.id, toWallet.id))
      .returning();

    return {
      fromWallet: updatedFrom,
      toWallet: updatedTo,
    };
  });
}
