import {
  createGoal as dalCreateGoal,
  deleteGoal as dalDeleteGoal,
  getGoalById,
  getGoals,
  getGoalsSummaryCounts,
  GoalType,
  updateGoal as dalUpdateGoal,
  updateGoalProgress,
} from "@/db";
import {
  applyGoalProgressDelta,
  clampGoalMoney,
  getGoalTab,
  GOALS_PAGE_SIZE,
  GoalCounts,
  GoalTabType,
  NormalizedGoalValues,
} from "@/lib/goalsUtils";
import { log } from "@/lib/log";
import { useCallback, useEffect, useRef, useState } from "react";

type GoalCursor = {
  id: number;
  createdAt: Date;
};

const EMPTY_COUNTS: GoalCounts = {
  active: 0,
  achieved: 0,
};

export type GoalProgressResult = {
  updatedGoal: GoalType;
  previousTab: GoalTabType;
  nextTab: GoalTabType;
  movedTabs: boolean;
  wasClamped: boolean;
};

export function useGoals(activeTab: GoalTabType) {
  const [goals, setGoals] = useState<GoalType[]>([]);
  const [counts, setCounts] = useState<GoalCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTabRef = useRef<GoalTabType>(activeTab);
  activeTabRef.current = activeTab;

  const fetchIdRef = useRef(0);
  const cursorRef = useRef<GoalCursor | null>(null);
  const isFetchingRef = useRef(false);
  const fetchingTabRef = useRef<GoalTabType | null>(null);
  const hasMoreRef = useRef(false);
  const goalQueuesRef = useRef<globalThis.Map<number, Promise<unknown>>>(
    new globalThis.Map(),
  );

  const enqueueGoalOperation = useCallback(
    <T>(goalId: number, operation: () => Promise<T>): Promise<T> => {
      const previous = goalQueuesRef.current.get(goalId) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(operation);
      goalQueuesRef.current.set(goalId, next);
      next.finally(() => {
        if (goalQueuesRef.current.get(goalId) === next) {
          goalQueuesRef.current.delete(goalId);
        }
      });
      return next;
    },
    [],
  );

  const fetchCounts = useCallback(async (): Promise<GoalCounts> => {
    return await getGoalsSummaryCounts();
  }, []);

  const fetchGoalsPage = useCallback(
    async (tab: GoalTabType, isLoadMore: boolean) => {
      if (isLoadMore) {
        if (isFetchingRef.current || !hasMoreRef.current) {
          return;
        }
      } else {
        if (isFetchingRef.current && fetchingTabRef.current === tab) {
          return;
        }
      }

      const requestId = ++fetchIdRef.current;
      const cursor = isLoadMore ? cursorRef.current : null;

      isFetchingRef.current = true;
      fetchingTabRef.current = tab;
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
        const [rows, nextCounts] = await Promise.all([
          getGoals({
            tab,
            cursor,
            limit: GOALS_PAGE_SIZE,
          }),
          isLoadMore ? Promise.resolve(null) : fetchCounts(),
        ]);

        if (requestId !== fetchIdRef.current) {
          return;
        }

        if (nextCounts) {
          setCounts(nextCounts);
        }

        const last = rows.at(-1);
        cursorRef.current = last
          ? { id: last.id, createdAt: last.createdAt }
          : cursor;

        const nextHasMore = rows.length === GOALS_PAGE_SIZE;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);

        if (isLoadMore) {
          setGoals((prev) => {
            const seenIds = new Set(prev.map((g) => g.id));
            const uniqueNext = rows.filter((g) => !seenIds.has(g.id));
            return [...prev, ...uniqueNext];
          });
        } else {
          setGoals(rows);
        }
      } catch (err) {
        log.error(err);
        if (requestId === fetchIdRef.current) {
          setError("Failed to load goals.");
        }
      } finally {
        if (requestId === fetchIdRef.current) {
          isFetchingRef.current = false;
          fetchingTabRef.current = null;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fetchCounts],
  );

  const refresh = useCallback(() => {
    return fetchGoalsPage(activeTabRef.current, false);
  }, [fetchGoalsPage]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isFetchingRef.current) {
      return;
    }
    fetchGoalsPage(activeTabRef.current, true);
  }, [fetchGoalsPage]);

  useEffect(() => {
    setGoals([]);
    fetchGoalsPage(activeTab, false);
  }, [activeTab, fetchGoalsPage]);

  const createGoal = useCallback(
    async (values: NormalizedGoalValues): Promise<GoalType> => {
      const safeCurrent = clampGoalMoney(
        values.currentMoney,
        values.targetMoney,
      );
      const now = new Date();

      const inserted = await dalCreateGoal({
        targetName: values.targetName,
        targetMoney: values.targetMoney,
        currentMoney: safeCurrent,
        note: values.note,
        tags: values.tags,
        createdAt: now,
        updatedAt: now,
      });

      const insertedTab = getGoalTab(inserted);

      setCounts((prev) => ({
        ...prev,
        [insertedTab]: prev[insertedTab] + 1,
      }));

      if (insertedTab === activeTabRef.current) {
        setGoals((prev) => [
          inserted,
          ...prev.filter((item) => item.id !== inserted.id),
        ]);
      }

      return inserted;
    },
    [],
  );

  const updateGoal = useCallback(
    async (
      goalId: number,
      values: NormalizedGoalValues,
    ): Promise<GoalProgressResult | null> => {
      return enqueueGoalOperation(goalId, async () => {
        const existing = await getGoalById(goalId);

        if (!existing) {
          return null;
        }

        const previousTab = getGoalTab(existing);
        const safeCurrent = clampGoalMoney(
          values.currentMoney,
          values.targetMoney,
        );
        const now = new Date();

        const updated = await dalUpdateGoal(goalId, {
          targetName: values.targetName,
          targetMoney: values.targetMoney,
          currentMoney: safeCurrent,
          note: values.note,
          tags: values.tags,
          updatedAt: now,
        });

        if (!updated) {
          return null;
        }

        const nextTab = getGoalTab(updated);
        const movedTabs = previousTab !== nextTab;

        if (movedTabs) {
          setCounts((prev) => ({
            active:
              previousTab === "active"
                ? Math.max(0, prev.active - 1)
                : prev.active + (nextTab === "active" ? 1 : 0),
            achieved:
              previousTab === "achieved"
                ? Math.max(0, prev.achieved - 1)
                : prev.achieved + (nextTab === "achieved" ? 1 : 0),
          }));
        }

        setGoals((prev) => {
          if (nextTab === activeTabRef.current) {
            const exists = prev.some((item) => item.id === updated.id);
            return exists
              ? prev.map((item) => (item.id === updated.id ? updated : item))
              : prev;
          }
          return prev.filter((item) => item.id !== updated.id);
        });

        return {
          updatedGoal: updated,
          previousTab,
          nextTab,
          movedTabs,
          wasClamped: values.currentMoney > values.targetMoney,
        };
      });
    },
    [enqueueGoalOperation],
  );

  const adjustGoalProgress = useCallback(
    async (
      goalId: number,
      delta: number,
    ): Promise<GoalProgressResult | null> => {
      return enqueueGoalOperation(goalId, async () => {
        const existing = await getGoalById(goalId);

        if (!existing) {
          return null;
        }

        const previousTab = getGoalTab(existing);
        const rawUnclamped = existing.currentMoney + delta;
        const nextCurrentMoney = applyGoalProgressDelta(
          existing.currentMoney,
          delta,
          existing.targetMoney,
        );
        const wasClamped =
          rawUnclamped < 0 || rawUnclamped > existing.targetMoney;

        if (nextCurrentMoney === existing.currentMoney) {
          return {
            updatedGoal: existing,
            previousTab,
            nextTab: previousTab,
            movedTabs: false,
            wasClamped: true,
          };
        }

        const updated = await updateGoalProgress(
          goalId,
          nextCurrentMoney,
          new Date(),
        );

        if (!updated) {
          return null;
        }

        const nextTab = getGoalTab(updated);
        const movedTabs = previousTab !== nextTab;

        if (movedTabs) {
          setCounts((prev) => ({
            active:
              previousTab === "active"
                ? Math.max(0, prev.active - 1)
                : prev.active + (nextTab === "active" ? 1 : 0),
            achieved:
              previousTab === "achieved"
                ? Math.max(0, prev.achieved - 1)
                : prev.achieved + (nextTab === "achieved" ? 1 : 0),
          }));
        }

        setGoals((prev) => {
          if (nextTab === activeTabRef.current) {
            const exists = prev.some((item) => item.id === updated.id);
            return exists
              ? prev.map((item) => (item.id === updated.id ? updated : item))
              : prev;
          }
          return prev.filter((item) => item.id !== updated.id);
        });

        return {
          updatedGoal: updated,
          previousTab,
          nextTab,
          movedTabs,
          wasClamped,
        };
      });
    },
    [enqueueGoalOperation],
  );

  const deleteGoal = useCallback(
    async (goalId: number): Promise<boolean> => {
      return enqueueGoalOperation(goalId, async () => {
        const deleted = await dalDeleteGoal(goalId);

        if (!deleted) {
          return false;
        }

        const deletedTab = getGoalTab(deleted);
        setCounts((prev) => ({
          ...prev,
          [deletedTab]: Math.max(0, prev[deletedTab] - 1),
        }));

        setGoals((prev) => prev.filter((item) => item.id !== goalId));

        return true;
      });
    },
    [enqueueGoalOperation],
  );

  return {
    goals,
    counts,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    createGoal,
    updateGoal,
    adjustGoalProgress,
    deleteGoal,
  };
}
