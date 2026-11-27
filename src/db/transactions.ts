import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb, runInDbTransaction } from "./client";
import {
  dbTransaction,
  dbWallet,
  TransactionType,
  WalletAllocation,
  WalletType,
} from "./schema";
import {
  CompoundingFrequency,
  ExpenseType,
  InterestType,
  SubExpenseType,
} from "@/constants/expense";
import {
  getWalletDeltaSign,
  roundWalletMoney,
} from "@/lib/walletUtils";
import {
  buildUserSummaryStats,
  parseUnixTimestampSeconds,
  UserSummaryStats,
} from "@/lib/userTransactionsUtils";

async function cascadeDeleteNoteImages(images?: string[] | null) {
  if (!images || images.length === 0) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { deleteNoteImages } = require("@/lib/noteImageStorage");
    await deleteNoteImages(images);
  } catch (e) {
    console.warn("Could not cascade delete note images:", e);
  }
}

export type CreateTransactionInput = {
  expenseType: ExpenseType;
  subExpenseType: SubExpenseType;
  amount: AmountTitleObj[];
  toFrom: string;
  toFromPhoneNumber?: string | null;
  note?: string | null;
  noteImages?: string[] | null;
  tags?: string[] | null;
  interestType?: InterestType | null;
  interestRate?: number | null;
  interestTime?: number | null;
  compoundingFrequency?: CompoundingFrequency | null;
  location?: LocationObj | null;
  walletAllocations?: WalletAllocation[] | null;
  creditPayment?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateTransactionInput = Partial<CreateTransactionInput>;
export type TransactionWalletUpdateMode =
  | "none"
  | "save_only"
  | "revert_and_apply";

export type GetTransactionsOptions = {
  txType?: ExpenseType | "All" | "Expense";
  searchTxt?: string;
  timeRange?: { start?: Date; end?: Date };
  tags?: string[];
  amountRange?: { min?: number; max?: number };
  toFrom?: string[];
  cursor?: { id: number; updatedAt: Date } | null;
  limit?: number;
};

export type RecentUserItem = {
  toFrom: string;
  phoneNumber: string | null;
  latestTransactionAt: Date;
  latestTransactionId: number;
  transactionCount: number;
};

export type UserTransactionStats = {
  toFrom: string;
  totalAmount: number;
  transactionCount: number;
};

export type TransactionSummaryStats = {
  totalAmount: number;
  transactionCount: number;
};

export async function getTransactions(
  options: GetTransactionsOptions = {},
): Promise<TransactionType[]> {
  const {
    txType,
    searchTxt,
    timeRange,
    tags,
    amountRange,
    toFrom,
    cursor,
    limit = 10,
  } = options;

  const conditions = [];

  if (searchTxt && searchTxt.trim()) {
    const trimmed = searchTxt.trim();
    conditions.push(
      or(
        like(dbTransaction.toFrom, `%${trimmed}%`),
        like(dbTransaction.note, `%${trimmed}%`),
        sql`EXISTS (
          SELECT 1
          FROM json_each(${dbTransaction.tags})
          WHERE value LIKE ${`%${trimmed}%`}
        )`,
      )!,
    );
  }

  if (timeRange?.start) {
    conditions.push(gte(dbTransaction.updatedAt, timeRange.start));
  }
  if (timeRange?.end) {
    conditions.push(lte(dbTransaction.updatedAt, timeRange.end));
  }

  if (txType && txType !== "All") {
    if (txType === "Expense") {
      conditions.push(eq(dbTransaction.expenseType, "Simple Expense"));
    } else {
      conditions.push(eq(dbTransaction.expenseType, txType as ExpenseType));
    }
  }

  if (tags && tags.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1
        FROM json_each(${dbTransaction.tags})
        WHERE value IN (${sql.join(
          tags.map((tag) => sql`${tag}`),
          sql`, `,
        )})
      )`,
    );
  }

  if (toFrom && toFrom.length > 0) {
    conditions.push(inArray(dbTransaction.toFrom, toFrom));
  }

  if (
    amountRange &&
    (amountRange.min !== undefined || amountRange.max !== undefined)
  ) {
    const amountConditions = [];
    if (amountRange.min !== undefined) {
      amountConditions.push(
        sql`CAST(json_extract(value, '$.amount') AS REAL) >= ${amountRange.min}`,
      );
    }
    if (amountRange.max !== undefined) {
      amountConditions.push(
        sql`CAST(json_extract(value, '$.amount') AS REAL) <= ${amountRange.max}`,
      );
    }
    conditions.push(
      sql`EXISTS (
        SELECT 1
        FROM json_each(${dbTransaction.amount})
        WHERE ${sql.join(amountConditions, sql` AND `)}
      )`,
    );
  }

  if (cursor) {
    conditions.push(
      or(
        lt(dbTransaction.updatedAt, cursor.updatedAt),
        and(
          eq(dbTransaction.updatedAt, cursor.updatedAt),
          lt(dbTransaction.id, cursor.id),
        ),
      )!,
    );
  }

  let query = getDb().select().from(dbTransaction);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return await query
    .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id))
    .limit(limit);
}

export async function getTransactionById(
  id: number,
): Promise<TransactionType | undefined> {
  const [item] = await getDb()
    .select()
    .from(dbTransaction)
    .where(eq(dbTransaction.id, id))
    .limit(1);
  return item;
}

export async function getTransactionsByIds(
  ids: number[],
): Promise<TransactionType[]> {
  if (ids.length === 0) return [];
  return await getDb()
    .select()
    .from(dbTransaction)
    .where(inArray(dbTransaction.id, ids))
    .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id));
}

function normalizeWalletAllocations(
  allocations?: WalletAllocation[] | null,
): WalletAllocation[] | null {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return null;
  }
  const merged = new Map<number, number>();
  for (const item of allocations) {
    const rounded = roundWalletMoney(item.amount);
    if (Number.isFinite(item.walletId) && rounded > 0) {
      merged.set(
        item.walletId,
        roundWalletMoney((merged.get(item.walletId) ?? 0) + rounded),
      );
    }
  }
  if (merged.size === 0) return null;
  return Array.from(merged.entries()).map(([walletId, amount]) => ({
    walletId,
    amount,
  }));
}

function accumulateWalletDeltas(
  deltaMap: Map<number, number>,
  allocations: WalletAllocation[] | null | undefined,
  subExpenseType: SubExpenseType,
  multiplier: 1 | -1,
) {
  if (!Array.isArray(allocations) || allocations.length === 0) return;
  const sign = getWalletDeltaSign(subExpenseType);
  for (const alloc of allocations) {
    const amt = roundWalletMoney(alloc.amount);
    if (amt <= 0) continue;
    const prev = deltaMap.get(alloc.walletId) ?? 0;
    deltaMap.set(alloc.walletId, roundWalletMoney(prev + multiplier * sign * amt));
  }
}

async function applyWalletDeltas(
  db: any,
  deltaMap: Map<number, number>,
  now: Date,
): Promise<void> {
  if (deltaMap.size === 0) return;

  const walletIds = Array.from(deltaMap.keys());
  const rows: WalletType[] = await db
    .select()
    .from(dbWallet)
    .where(inArray(dbWallet.id, walletIds));
  const walletMap = new Map(rows.map((w) => [w.id, w]));

  const nextBalances: { id: number; nextBalance: number }[] = [];
  for (const [walletId, delta] of deltaMap.entries()) {
    if (delta === 0) continue;
    const wallet = walletMap.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet #${walletId} not found.`);
    }
    const current = roundWalletMoney(wallet.currentBalance);
    const nextBalance = roundWalletMoney(current + delta);
    if (nextBalance < -0.0001) {
      throw new Error(
        `Insufficient balance in ${wallet.name} (Available: ₹${current}).`,
      );
    }
    nextBalances.push({
      id: walletId,
      nextBalance: nextBalance < 0 ? 0 : nextBalance,
    });
  }

  for (const item of nextBalances) {
    await db
      .update(dbWallet)
      .set({ currentBalance: item.nextBalance, updatedAt: now })
      .where(eq(dbWallet.id, item.id));
  }
}

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<TransactionType> {
  return await createTransactionWithWallets(data);
}

/**
 * Atomically inserts a transaction and updates linked wallet balances inside
 * a SQLite transaction. Throws and rolls back if any outgoing wallet lacks funds.
 */
export async function createTransactionWithWallets(
  data: CreateTransactionInput,
): Promise<TransactionType> {
  const normalizedAllocs = normalizeWalletAllocations(data.walletAllocations);
  const now = new Date();

  if (!normalizedAllocs) {
    const [inserted] = await getDb()
      .insert(dbTransaction)
      .values({
        ...data,
        walletAllocations: null,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      })
      .returning();
    return inserted;
  }

  return await runInDbTransaction(async (db) => {
    const deltaMap = new Map<number, number>();
    accumulateWalletDeltas(deltaMap, normalizedAllocs, data.subExpenseType, 1);
    await applyWalletDeltas(db, deltaMap, now);

    const [inserted] = await db
      .insert(dbTransaction)
      .values({
        ...data,
        walletAllocations: normalizedAllocs,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      })
      .returning();
    return inserted;
  });
}

export async function updateTransaction(
  id: number,
  updates: UpdateTransactionInput,
): Promise<TransactionType | undefined> {
  return await updateTransactionWithWallets(id, updates, "save_only");
}

/**
 * Updates a transaction with explicit wallet reconciliation control:
 * - "save_only" / "none": updates transaction row without touching wallet balances
 * - "revert_and_apply": reverses old wallet allocations and applies new ones atomically
 */
export async function updateTransactionWithWallets(
  id: number,
  updates: UpdateTransactionInput,
  walletMode: TransactionWalletUpdateMode = "save_only",
): Promise<TransactionType | undefined> {
  let removedImagesToCleanup: string[] = [];
  if (updates.noteImages !== undefined) {
    try {
      const existingForImg = await getTransactionById(id);
      if (existingForImg?.noteImages && existingForImg.noteImages.length > 0) {
        const nextImages = updates.noteImages ?? [];
        removedImagesToCleanup = existingForImg.noteImages.filter(
          (img) => !nextImages.includes(img),
        );
      }
    } catch (e) {
      console.warn(
        `Error checking orphaned images on transaction update ${id}:`,
        e,
      );
    }
  }

  const now = updates.updatedAt ?? new Date();
  let updatedRow: TransactionType | undefined;

  if (walletMode !== "revert_and_apply") {
    const nextPayload: Record<string, unknown> = {
      ...updates,
      updatedAt: now,
    };
    if (updates.walletAllocations !== undefined) {
      nextPayload.walletAllocations = normalizeWalletAllocations(
        updates.walletAllocations,
      );
    }
    const [updated] = await getDb()
      .update(dbTransaction)
      .set(nextPayload)
      .where(eq(dbTransaction.id, id))
      .returning();
    updatedRow = updated;
  } else {
    updatedRow = await runInDbTransaction(async (db) => {
      const [existing]: TransactionType[] = await db
        .select()
        .from(dbTransaction)
        .where(eq(dbTransaction.id, id))
        .limit(1);

      if (!existing) return undefined;

      const deltaMap = new Map<number, number>();
      // Revert previous wallet allocations using previous subExpenseType
      accumulateWalletDeltas(
        deltaMap,
        existing.walletAllocations,
        existing.subExpenseType,
        -1,
      );

      const nextSubExpenseType =
        updates.subExpenseType ?? existing.subExpenseType;
      const nextAllocations =
        updates.walletAllocations !== undefined
          ? normalizeWalletAllocations(updates.walletAllocations)
          : existing.walletAllocations;

      // Apply new wallet allocations
      accumulateWalletDeltas(deltaMap, nextAllocations, nextSubExpenseType, 1);

      await applyWalletDeltas(db, deltaMap, now);

      const [updated] = await db
        .update(dbTransaction)
        .set({
          ...updates,
          walletAllocations: nextAllocations ?? null,
          updatedAt: now,
        })
        .where(eq(dbTransaction.id, id))
        .returning();
      return updated;
    });
  }

  if (updatedRow && removedImagesToCleanup.length > 0) {
    await cascadeDeleteNoteImages(removedImagesToCleanup);
  }
  return updatedRow;
}

export async function deleteTransaction(id: number): Promise<void> {
  await deleteTransactionWithWallets(id, false);
}

export async function deleteTransactionWithWallets(
  id: number,
  revertWalletBalances: boolean,
): Promise<void> {
  await deleteTransactionsWithWallets([id], revertWalletBalances);
}

export async function deleteTransactions(ids: number[]): Promise<void> {
  await deleteTransactionsWithWallets(ids, false);
}

export async function deleteTransactionsWithWallets(
  ids: number[],
  revertWalletBalances: boolean,
): Promise<void> {
  if (ids.length === 0) return;

  const imagesToDelete: string[] = [];

  if (!revertWalletBalances) {
    try {
      const txs = await getTransactionsByIds(ids);
      for (const tx of txs) {
        if (tx.noteImages && tx.noteImages.length > 0) {
          imagesToDelete.push(...tx.noteImages);
        }
      }
    } catch (e) {
      console.warn(`Error loading note images for transactions:`, e);
    }
    await getDb().delete(dbTransaction).where(inArray(dbTransaction.id, ids));
  } else {
    const now = new Date();
    await runInDbTransaction(async (db) => {
      const txs: TransactionType[] = await db
        .select()
        .from(dbTransaction)
        .where(inArray(dbTransaction.id, ids));

      const deltaMap = new Map<number, number>();
      for (const tx of txs) {
        if (tx.noteImages && tx.noteImages.length > 0) {
          imagesToDelete.push(...tx.noteImages);
        }
        accumulateWalletDeltas(
          deltaMap,
          tx.walletAllocations,
          tx.subExpenseType,
          -1,
        );
      }

      await applyWalletDeltas(db, deltaMap, now);
      await db.delete(dbTransaction).where(inArray(dbTransaction.id, ids));
    });
  }

  if (imagesToDelete.length > 0) {
    await cascadeDeleteNoteImages(imagesToDelete);
  }
}

export async function getAllReferencedNoteImages(): Promise<string[]> {
  const rows = await getDb()
    .select({ noteImages: dbTransaction.noteImages })
    .from(dbTransaction)
    .where(sql`${dbTransaction.noteImages} IS NOT NULL`);

  const set = new Set<string>();
  for (const row of rows) {
    if (Array.isArray(row.noteImages)) {
      for (const img of row.noteImages) {
        if (typeof img === "string" && img.trim()) {
          set.add(img.trim());
        }
      }
    }
  }
  return Array.from(set);
}

export async function convertTransactionType(
  id: number,
  targetType: "Simple Expense" | "Credit",
): Promise<TransactionType | undefined> {
  const tx = await getTransactionById(id);
  if (!tx) return undefined;

  if (targetType === "Simple Expense") {
    const [updated] = await getDb()
      .update(dbTransaction)
      .set({
        updatedAt: new Date(),
        creditPayment: null,
        expenseType: "Simple Expense",
        subExpenseType: tx.subExpenseType === "Borrow" ? "Receive" : "Send",
        compoundingFrequency: null,
        interestRate: null,
        interestTime: null,
        interestType: null,
      })
      .where(eq(dbTransaction.id, id))
      .returning();
    return updated;
  } else {
    const [updated] = await getDb()
      .update(dbTransaction)
      .set({
        updatedAt: new Date(),
        creditPayment: 0,
        expenseType: "Credit",
        subExpenseType: tx.subExpenseType === "Send" ? "Lend" : "Borrow",
        compoundingFrequency: null,
        interestRate: null,
        interestTime: null,
        interestType: "None",
      })
      .where(eq(dbTransaction.id, id))
      .returning();
    return updated;
  }
}

export async function updateCreditPayment(
  id: number,
  creditPayment: number | null,
): Promise<TransactionType | undefined> {
  const [updated] = await getDb()
    .update(dbTransaction)
    .set({ creditPayment, updatedAt: new Date() })
    .where(eq(dbTransaction.id, id))
    .returning();
  return updated;
}

export async function addCreditPayment(
  id: number,
  additionalAmount: number,
): Promise<{
  previousPayment: number;
  newPayment: number;
  updatedTransaction?: TransactionType;
}> {
  const tx = await getTransactionById(id);
  const previousPayment = tx?.creditPayment ?? 0;
  const newPayment = previousPayment + additionalAmount;
  const [updated] = await getDb()
    .update(dbTransaction)
    .set({ creditPayment: newPayment, updatedAt: new Date() })
    .where(eq(dbTransaction.id, id))
    .returning();
  return {
    previousPayment,
    newPayment,
    updatedTransaction: updated,
  };
}

export async function getAllTransactions(): Promise<TransactionType[]> {
  return await getDb().select().from(dbTransaction);
}

export async function insertTransactions(
  transactions: Array<CreateTransactionInput & { id?: number }>,
): Promise<void> {
  for (const transaction of transactions) {
    try {
      const { id, ...txData } = transaction;
      await getDb()
        .insert(dbTransaction)
        .values({
          ...txData,
          createdAt: txData.createdAt ? new Date(txData.createdAt) : new Date(),
          updatedAt: txData.updatedAt ? new Date(txData.updatedAt) : new Date(),
        });
    } catch {
      // Continue importing remaining transactions
    }
  }
}

export async function getDistinctToFromList(): Promise<
  { toFrom: string; count: number }[]
> {
  return await getDb()
    .select({
      toFrom: dbTransaction.toFrom,
      count: count(dbTransaction.id),
    })
    .from(dbTransaction)
    .groupBy(dbTransaction.toFrom)
    .orderBy(desc(count(dbTransaction.id)));
}

export async function getRecentUsers(options?: {
  limit?: number;
  offset?: number;
}): Promise<RecentUserItem[]> {
  const limit = options?.limit ?? 8;
  const offset = options?.offset ?? 0;

  const rows = await getDb()
    .select({
      toFrom: dbTransaction.toFrom,
      latestUpdatedAtRaw: sql<number>`MAX(${dbTransaction.updatedAt})`,
      latestTransactionId: sql<number>`MAX(${dbTransaction.id})`,
      transactionCount: sql<number>`COUNT(${dbTransaction.id})`,
      phoneNumber: sql<
        string | null
      >`MAX(NULLIF(trim(${dbTransaction.toFromPhoneNumber}), ''))`,
    })
    .from(dbTransaction)
    .where(sql`trim(${dbTransaction.toFrom}) != ''`)
    .groupBy(dbTransaction.toFrom)
    .orderBy(
      desc(sql`MAX(${dbTransaction.updatedAt})`),
      desc(sql`MAX(${dbTransaction.id})`),
      asc(dbTransaction.toFrom),
    )
    .limit(limit)
    .offset(offset);

  return rows.map((row: any) => ({
    toFrom: row.toFrom,
    phoneNumber: row.phoneNumber ?? null,
    latestTransactionAt: parseUnixTimestampSeconds(row.latestUpdatedAtRaw),
    latestTransactionId: Number(row.latestTransactionId) || 0,
    transactionCount: Number(row.transactionCount) || 0,
  }));
}

export async function getUserTransactionsSummary(
  targetUser: string,
): Promise<UserSummaryStats> {
  const [[sqlAggregate], creditRows] = await Promise.all([
    getDb()
      .select({
        totalCount: sql<number>`COUNT(${dbTransaction.id})`,
        simpleSendTotal: sql<number>`COALESCE(SUM(CASE
          WHEN ${dbTransaction.expenseType} = 'Simple Expense'
            AND ${dbTransaction.subExpenseType} = 'Send'
          THEN (
            SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
            FROM json_each(${dbTransaction.amount})
          )
          ELSE 0
        END), 0)`,
        simpleReceiveTotal: sql<number>`COALESCE(SUM(CASE
          WHEN ${dbTransaction.expenseType} = 'Simple Expense'
            AND ${dbTransaction.subExpenseType} = 'Receive'
          THEN (
            SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
            FROM json_each(${dbTransaction.amount})
          )
          ELSE 0
        END), 0)`,
      })
      .from(dbTransaction)
      .where(eq(dbTransaction.toFrom, targetUser)),
    getDb()
      .select()
      .from(dbTransaction)
      .where(
        and(
          eq(dbTransaction.toFrom, targetUser),
          eq(dbTransaction.expenseType, "Credit"),
        ),
      ),
  ]);

  return buildUserSummaryStats(
    {
      totalCount: Number(sqlAggregate?.totalCount) || 0,
      simpleSendTotal: Number(sqlAggregate?.simpleSendTotal) || 0,
      simpleReceiveTotal: Number(sqlAggregate?.simpleReceiveTotal) || 0,
    },
    creditRows,
  );
}

export async function getUserTransactions(
  user: string,
  options?: {
    cursor?: { id: number; updatedAt: Date } | null;
    limit?: number;
  },
): Promise<TransactionType[]> {
  const conditions = [eq(dbTransaction.toFrom, user)];
  if (options?.cursor) {
    conditions.push(
      or(
        lt(dbTransaction.updatedAt, options.cursor.updatedAt),
        and(
          eq(dbTransaction.updatedAt, options.cursor.updatedAt),
          lt(dbTransaction.id, options.cursor.id),
        ),
      )!,
    );
  }

  return await getDb()
    .select()
    .from(dbTransaction)
    .where(and(...conditions))
    .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id))
    .limit(options?.limit ?? 10);
}

export async function getAllUserTransactions(
  user: string,
): Promise<TransactionType[]> {
  return await getDb()
    .select()
    .from(dbTransaction)
    .where(eq(dbTransaction.toFrom, user))
    .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id));
}

export async function getUserTransactionStats(options: {
  transactionType: SubExpenseType;
  startDate?: Date;
  limit?: number;
}): Promise<UserTransactionStats[]> {
  const conditions = [eq(dbTransaction.subExpenseType, options.transactionType)];
  if (options.startDate) {
    conditions.push(gte(dbTransaction.updatedAt, options.startDate));
  }

  let query = getDb()
    .select({
      toFrom: dbTransaction.toFrom,
      totalAmount: sql<number>`COALESCE(SUM((
        SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
        FROM json_each(${dbTransaction.amount})
      )), 0)`,
      transactionCount: sql<number>`count(${dbTransaction.id})`,
    })
    .from(dbTransaction)
    .where(and(...conditions))
    .groupBy(dbTransaction.toFrom)
    .orderBy(desc(sql`count(${dbTransaction.id})`));

  if (options.limit) {
    query = query.limit(options.limit);
  }

  return await query;
}

export async function getTransactionSummaryStats(options: {
  targetSubtype: SubExpenseType;
  startDate?: Date;
}): Promise<TransactionSummaryStats> {
  const conditions = [eq(dbTransaction.subExpenseType, options.targetSubtype)];
  if (options.startDate) {
    conditions.push(gte(dbTransaction.updatedAt, options.startDate));
  }

  const [result] = await getDb()
    .select({
      totalAmount: sql<number>`COALESCE(SUM((
        SELECT COALESCE(SUM(CAST(json_extract(value, '$.amount') AS REAL)), 0)
        FROM json_each(${dbTransaction.amount})
      )), 0)`,
      transactionCount: sql<number>`count(${dbTransaction.id})`,
    })
    .from(dbTransaction)
    .where(and(...conditions));

  return {
    totalAmount: Number(result?.totalAmount) || 0,
    transactionCount: Number(result?.transactionCount) || 0,
  };
}

export async function getWidgetTransactions(
  limit = 10,
): Promise<TransactionType[]> {
  return await getDb()
    .select()
    .from(dbTransaction)
    .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id))
    .limit(limit);
}

export async function getTransactionsSince(
  since: Date,
): Promise<
  {
    amount: AmountTitleObj[];
    subType: SubExpenseType;
    subExpenseType: SubExpenseType;
  }[]
> {
  const rows = await getDb()
    .select({
      amount: dbTransaction.amount,
      subExpenseType: dbTransaction.subExpenseType,
    })
    .from(dbTransaction)
    .where(gte(dbTransaction.updatedAt, since));

  return rows.map((r: any) => ({
    amount: r.amount,
    subType: r.subExpenseType,
    subExpenseType: r.subExpenseType,
  }));
}
