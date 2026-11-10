import { db } from "@/db/dbinit";
import { dbTransaction, TransactionType } from "@/db/schema";
import { log } from "@/lib/log";
import {
  buildUserSummaryStats,
  UserSummaryStats,
} from "@/lib/userTransactionsUtils";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";

export const USER_TRANSACTIONS_PAGE_SIZE = 10;

const EMPTY_STATS: UserSummaryStats = {
  totalCount: 0,
  totalExpense: 0,
  simpleReceiveTotal: 0,
  totalCredit: 0,
  creditLendTotal: 0,
  creditBorrowTotal: 0,
  remainingToReceive: 0,
  remainingToPay: 0,
  netCreditBalance: 0,
};

type TransactionCursor = {
  id: number;
  updatedAt: Date;
};

export function useUserTransactions(userName: string | null) {
  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [stats, setStats] = useState<UserSummaryStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const cursorRef = useRef<TransactionCursor | null>(null);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(false);

  const fetchSummaryForUser = useCallback(
    async (targetUser: string): Promise<UserSummaryStats> => {
      const [[sqlAggregate], creditRows] = await Promise.all([
        db
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
        db
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
    },
    [],
  );

  const fetchTransactionsPage = useCallback(
    async (targetUser: string, isLoadMore: boolean) => {
      if (isLoadMore && (isFetchingRef.current || !hasMoreRef.current)) {
        return;
      }

      const requestId = ++fetchIdRef.current;
      const cursor = isLoadMore ? cursorRef.current : null;

      isFetchingRef.current = true;
      setError(null);

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        cursorRef.current = null;
        hasMoreRef.current = false;
        setHasMore(false);
        setIsLoading(true);
      }

      try {
        const conditions = [eq(dbTransaction.toFrom, targetUser)];
        if (cursor) {
          const cursorCondition = or(
            lt(dbTransaction.updatedAt, cursor.updatedAt),
            and(
              eq(dbTransaction.updatedAt, cursor.updatedAt),
              lt(dbTransaction.id, cursor.id),
            ),
          );
          if (cursorCondition) {
            conditions.push(cursorCondition);
          }
        }

        const pagePromise = db
          .select()
          .from(dbTransaction)
          .where(and(...conditions))
          .orderBy(desc(dbTransaction.updatedAt), desc(dbTransaction.id))
          .limit(USER_TRANSACTIONS_PAGE_SIZE);

        const [rows, computedStats] = await Promise.all([
          pagePromise,
          isLoadMore ? Promise.resolve(null) : fetchSummaryForUser(targetUser),
        ]);

        if (requestId !== fetchIdRef.current) {
          return;
        }

        if (computedStats) {
          setStats(computedStats);
        }

        const last = rows.at(-1);
        cursorRef.current = last
          ? { id: last.id, updatedAt: last.updatedAt }
          : cursor;

        const nextHasMore = rows.length === USER_TRANSACTIONS_PAGE_SIZE;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);

        if (isLoadMore) {
          setTransactions((prev) => {
            const seenIds = new Set(prev.map((t) => t.id));
            const uniqueNext = rows.filter((t) => !seenIds.has(t.id));
            return [...prev, ...uniqueNext];
          });
        } else {
          setTransactions(rows);
        }
      } catch (err) {
        log.error(err);
        if (requestId === fetchIdRef.current) {
          setError("Failed to load transactions for this user.");
        }
      } finally {
        if (requestId === fetchIdRef.current) {
          isFetchingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fetchSummaryForUser],
  );

  useEffect(() => {
    if (!userName) {
      fetchIdRef.current += 1;
      isFetchingRef.current = false;
      cursorRef.current = null;
      hasMoreRef.current = false;
      setTransactions([]);
      setStats(EMPTY_STATS);
      setHasMore(false);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    fetchTransactionsPage(userName, false);
  }, [userName, fetchTransactionsPage]);

  const refresh = useCallback(() => {
    if (!userName) return Promise.resolve();
    return fetchTransactionsPage(userName, false);
  }, [userName, fetchTransactionsPage]);

  const loadMore = useCallback(() => {
    if (!userName) return Promise.resolve();
    return fetchTransactionsPage(userName, true);
  }, [userName, fetchTransactionsPage]);

  return {
    transactions,
    stats,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
