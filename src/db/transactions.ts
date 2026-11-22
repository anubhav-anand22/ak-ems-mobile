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
import { getDb } from "./client";
import { dbTransaction, TransactionType } from "./schema";
import {
  CompoundingFrequency,
  ExpenseType,
  InterestType,
  SubExpenseType,
} from "@/constants/expense";
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
  creditPayment?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

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

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<TransactionType> {
  const [inserted] = await getDb()
    .insert(dbTransaction)
    .values({
      ...data,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning();
  return inserted;
}

export async function updateTransaction(
  id: number,
  updates: UpdateTransactionInput,
): Promise<TransactionType | undefined> {
  if (updates.noteImages !== undefined) {
    try {
      const existing = await getTransactionById(id);
      if (existing?.noteImages && existing.noteImages.length > 0) {
        const nextImages = updates.noteImages ?? [];
        const removedImages = existing.noteImages.filter(
          (img) => !nextImages.includes(img),
        );
        if (removedImages.length > 0) {
          await cascadeDeleteNoteImages(removedImages);
        }
      }
    } catch (e) {
      console.warn(
        `Error removing orphaned images on transaction update ${id}:`,
        e,
      );
    }
  }

  const [updated] = await getDb()
    .update(dbTransaction)
    .set({
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    })
    .where(eq(dbTransaction.id, id))
    .returning();
  return updated;
}

export async function deleteTransaction(id: number): Promise<void> {
  try {
    const tx = await getTransactionById(id);
    if (tx?.noteImages && tx.noteImages.length > 0) {
      await cascadeDeleteNoteImages(tx.noteImages);
    }
  } catch (e) {
    console.warn(`Error deleting note images for transaction ${id}:`, e);
  }
  await getDb().delete(dbTransaction).where(eq(dbTransaction.id, id));
}

export async function deleteTransactions(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const txs = await getTransactionsByIds(ids);
    const imagesToDelete: string[] = [];
    for (const tx of txs) {
      if (tx.noteImages && tx.noteImages.length > 0) {
        imagesToDelete.push(...tx.noteImages);
      }
    }
    if (imagesToDelete.length > 0) {
      await cascadeDeleteNoteImages(imagesToDelete);
    }
  } catch (e) {
    console.warn(`Error deleting note images for transactions:`, e);
  }
  await getDb().delete(dbTransaction).where(inArray(dbTransaction.id, ids));
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
