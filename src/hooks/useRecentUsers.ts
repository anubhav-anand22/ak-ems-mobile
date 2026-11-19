import { getRecentUsers, RecentUserItem } from "@/db";
import { log } from "@/lib/log";
import { useCallback, useEffect, useRef, useState } from "react";

export const RECENT_USERS_PAGE_SIZE = 8;
export type { RecentUserItem };

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
      const mapped = await getRecentUsers({
        limit: RECENT_USERS_PAGE_SIZE,
        offset,
      });

      if (requestId !== fetchIdRef.current) {
        return;
      }

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

  const refresh = useCallback(() => {
    return fetchPage(false);
  }, [fetchPage]);

  const reload = refresh;

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isFetchingRef.current) {
      return;
    }
    fetchPage(true);
  }, [fetchPage]);

  useEffect(() => {
    if (enabled) {
      fetchPage(false);
    } else {
      setUsers([]);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      offsetRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
    }
  }, [enabled, fetchPage]);

  return {
    users,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    reload,
    loadMore,
  };
}
