import {
  getUserTransactions,
  getUserTransactionsSummary,
  TransactionType,
} from "@/db";
import { log } from "@/lib/log";
import { UserSummaryStats } from "@/lib/userTransactionsUtils";
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
      return await getUserTransactionsSummary(targetUser);
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
        const [rows, computedStats] = await Promise.all([
          getUserTransactions(targetUser, {
            cursor,
            limit: USER_TRANSACTIONS_PAGE_SIZE,
          }),
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
          setError("Failed to load user transactions.");
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

  const refresh = useCallback(() => {
    if (!userName) return Promise.resolve();
    return fetchTransactionsPage(userName, false);
  }, [fetchTransactionsPage, userName]);

  const reload = refresh;

  const loadMore = useCallback(() => {
    if (!userName || !hasMoreRef.current || isFetchingRef.current) {
      return;
    }
    fetchTransactionsPage(userName, true);
  }, [fetchTransactionsPage, userName]);

  useEffect(() => {
    if (userName) {
      fetchTransactionsPage(userName, false);
    } else {
      setTransactions([]);
      setStats(EMPTY_STATS);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      cursorRef.current = null;
      hasMoreRef.current = false;
      setHasMore(false);
    }
  }, [fetchTransactionsPage, userName]);

  return {
    transactions,
    stats,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    reload,
    loadMore,
  };
}
