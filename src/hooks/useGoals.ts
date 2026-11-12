import { db } from "@/db/dbinit";
import { dbGoals, GoalType } from "@/db/schema";
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
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
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
    const [row] = await db
      .select({
        active: sql<number>`COALESCE(SUM(CASE WHEN ${dbGoals.currentMoney} < ${dbGoals.targetMoney} THEN 1 ELSE 0 END), 0)`,
        achieved: sql<number>`COALESCE(SUM(CASE WHEN ${dbGoals.currentMoney} >= ${dbGoals.targetMoney} THEN 1 ELSE 0 END), 0)`,
      })
      .from(dbGoals);

    return {
      active: Math.max(0, Number(row?.active) || 0),
      achieved: Math.max(0, Number(row?.achieved) || 0),
    };
  }, []);

  const fetchGoalsPage = useCallback(
    async (tab: GoalTabType, isLoadMore: boolean) => {
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
        const tabCondition =
          tab === "achieved"
            ? gte(dbGoals.currentMoney, dbGoals.targetMoney)
            : lt(dbGoals.currentMoney, dbGoals.targetMoney);

        const conditions = [tabCondition];

        if (cursor) {
          const cursorCondition = or(
            lt(dbGoals.createdAt, cursor.createdAt),
            and(
              eq(dbGoals.createdAt, cursor.createdAt),
              lt(dbGoals.id, cursor.id),
            ),
          );
          if (cursorCondition) {
            conditions.push(cursorCondition);
          }
        }

        const pagePromise = db
          .select()
          .from(dbGoals)
          .where(and(...conditions))
          .orderBy(desc(dbGoals.createdAt), desc(dbGoals.id))
          .limit(GOALS_PAGE_SIZE);

        const [rows, nextCounts] = await Promise.all([
          pagePromise,
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
            const seenIds = new Set(prev.map((item) => item.id));
            const uniqueNext = rows.filter((item) => !seenIds.has(item.id));
            return [...prev, ...uniqueNext];
          });
        } else {
          setGoals(rows);
        }
      } catch (err) {
        log.error("Failed to fetch goals", err);
        if (requestId === fetchIdRef.current) {
          setError("Failed to load goals.");
        }
      } finally {
        if (requestId === fetchIdRef.current) {
          isFetchingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fetchCounts],
  );

  useEffect(() => {
    setGoals([]);
    fetchGoalsPage(activeTab, false);
  }, [activeTab, fetchGoalsPage]);

  const refresh = useCallback(() => {
    return fetchGoalsPage(activeTabRef.current, false);
  }, [fetchGoalsPage]);

  const loadMore = useCallback(() => {
    return fetchGoalsPage(activeTabRef.current, true);
  }, [fetchGoalsPage]);

  useEffect(() => {
    if (
      goals.length < 3 &&
      hasMore &&
      !isLoading &&
      !isLoadingMore &&
      !error
    ) {
      fetchGoalsPage(activeTab, true);
    }
  }, [goals.length, hasMore, isLoading, isLoadingMore, error, activeTab, fetchGoalsPage]);

  const createGoal = useCallback(
    async (values: NormalizedGoalValues): Promise<GoalType> => {
      const safeCurrent = clampGoalMoney(
        values.currentMoney,
        values.targetMoney,
      );
      const now = new Date();

      const [inserted] = await db
        .insert(dbGoals)
        .values({
          targetName: values.targetName,
          targetMoney: values.targetMoney,
          currentMoney: safeCurrent,
          note: values.note,
          tags: values.tags,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

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
        const [existing] = await db
          .select()
          .from(dbGoals)
          .where(eq(dbGoals.id, goalId))
          .limit(1);

        if (!existing) {
          return null;
        }

        const previousTab = getGoalTab(existing);
        const safeCurrent = clampGoalMoney(
          values.currentMoney,
          values.targetMoney,
        );
        const now = new Date();

        const [updated] = await db
          .update(dbGoals)
          .set({
            targetName: values.targetName,
            targetMoney: values.targetMoney,
            currentMoney: safeCurrent,
            note: values.note,
            tags: values.tags,
            updatedAt: now,
          })
          .where(eq(dbGoals.id, goalId))
          .returning();

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
        const [existing] = await db
          .select()
          .from(dbGoals)
          .where(eq(dbGoals.id, goalId))
          .limit(1);

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

        const [updated] = await db
          .update(dbGoals)
          .set({
            currentMoney: nextCurrentMoney,
            updatedAt: new Date(),
          })
          .where(eq(dbGoals.id, goalId))
          .returning();

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
        const [deleted] = await db
          .delete(dbGoals)
          .where(eq(dbGoals.id, goalId))
          .returning();

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
