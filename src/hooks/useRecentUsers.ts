import { db } from "@/db/dbinit";
import { dbTransaction } from "@/db/schema";
import { log } from "@/lib/log";
import { parseUnixTimestampSeconds } from "@/lib/userTransactionsUtils";
import { asc, desc, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";

export const RECENT_USERS_PAGE_SIZE = 8;

export type RecentUserItem = {
  toFrom: string;
  phoneNumber: string | null;
  latestTransactionAt: Date;
  latestTransactionId: number;
  transactionCount: number;
};

export function useRecentUsers(enabled: boolean) {
  const [users, setUsers] = useState<RecentUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const fetchPage = useCallback(async (isLoadMore: boolean) => {
    if (isLoadMore && (isFetchingRef.current || !hasMoreRef.current)) {
      return;
    }

    const requestId = ++fetchIdRef.current;
    const offset = isLoadMore ? offsetRef.current : 0;

    isFetchingRef.current = true;
    setError(null);

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      hasMoreRef.current = true;
      setHasMore(true);
      offsetRef.current = 0;
      setIsLoading(true);
    }

    try {
      const rows = await db
        .select({
          toFrom: dbTransaction.toFrom,
          latestUpdatedAtRaw: sql<number>`MAX(${dbTransaction.updatedAt})`,
          latestTransactionId: sql<number>`MAX(${dbTransaction.id})`,
          transactionCount: sql<number>`COUNT(${dbTransaction.id})`,
          phoneNumber: sql<string | null>`MAX(NULLIF(trim(${dbTransaction.toFromPhoneNumber}), ''))`,
        })
        .from(dbTransaction)
        .where(sql`trim(${dbTransaction.toFrom}) != ''`)
        .groupBy(dbTransaction.toFrom)
        .orderBy(
          desc(sql`MAX(${dbTransaction.updatedAt})`),
          desc(sql`MAX(${dbTransaction.id})`),
          asc(dbTransaction.toFrom),
        )
        .limit(RECENT_USERS_PAGE_SIZE)
        .offset(offset);

      if (requestId !== fetchIdRef.current) {
        return;
      }

      const mapped: RecentUserItem[] = rows.map((row) => ({
        toFrom: row.toFrom,
        phoneNumber: row.phoneNumber ?? null,
        latestTransactionAt: parseUnixTimestampSeconds(row.latestUpdatedAtRaw),
        latestTransactionId: Number(row.latestTransactionId) || 0,
        transactionCount: Number(row.transactionCount) || 0,
      }));

      const nextHasMore = mapped.length === RECENT_USERS_PAGE_SIZE;
      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);
      offsetRef.current = offset + mapped.length;

      if (isLoadMore) {
        setUsers((prev) => {
          const existingNames = new Set(prev.map((u) => u.toFrom));
          const uniqueNext = mapped.filter((u) => !existingNames.has(u.toFrom));
          return [...prev, ...uniqueNext];
        });
      } else {
        setUsers(mapped);
      }
    } catch (err) {
      log.error(err);
      if (requestId === fetchIdRef.current) {
        setError("Failed to load recent contacts.");
      }
    } finally {
      if (requestId === fetchIdRef.current) {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchPage(false);
    }
  }, [enabled, fetchPage]);

  const refresh = useCallback(() => {
    return fetchPage(false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    return fetchPage(true);
  }, [fetchPage]);

  return {
    users,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
