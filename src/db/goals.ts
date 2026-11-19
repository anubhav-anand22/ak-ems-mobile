import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { dbGoals, GoalType } from "./schema";

export type CreateGoalInput = {
  targetName: string;
  targetMoney: number;
  currentMoney?: number;
  note?: string | null;
  tags?: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateGoalInput = Partial<CreateGoalInput>;

export type GetGoalsOptions = {
  tab: "active" | "achieved";
  cursor?: { id: number; createdAt: Date } | null;
  limit?: number;
};

export async function getGoalsSummaryCounts(): Promise<{
  active: number;
  achieved: number;
}> {
  const [row] = await getDb()
    .select({
      active: sql<number>`COALESCE(SUM(CASE WHEN ${dbGoals.currentMoney} < ${dbGoals.targetMoney} THEN 1 ELSE 0 END), 0)`,
      achieved: sql<number>`COALESCE(SUM(CASE WHEN ${dbGoals.currentMoney} >= ${dbGoals.targetMoney} THEN 1 ELSE 0 END), 0)`,
    })
    .from(dbGoals);

  return {
    active: Math.max(0, Number(row?.active) || 0),
    achieved: Math.max(0, Number(row?.achieved) || 0),
  };
}

export async function getGoals(options: GetGoalsOptions): Promise<GoalType[]> {
  const { tab, cursor, limit = 10 } = options;

  const tabCondition =
    tab === "achieved"
      ? gte(dbGoals.currentMoney, dbGoals.targetMoney)
      : lt(dbGoals.currentMoney, dbGoals.targetMoney);

  const conditions = [tabCondition];

  if (cursor) {
    conditions.push(
      or(
        lt(dbGoals.createdAt, cursor.createdAt),
        and(
          eq(dbGoals.createdAt, cursor.createdAt),
          lt(dbGoals.id, cursor.id),
        ),
      )!,
    );
  }

  return await getDb()
    .select()
    .from(dbGoals)
    .where(and(...conditions))
    .orderBy(desc(dbGoals.createdAt), desc(dbGoals.id))
    .limit(limit);
}

export async function getGoalById(id: number): Promise<GoalType | undefined> {
  const [goal] = await getDb()
    .select()
    .from(dbGoals)
    .where(eq(dbGoals.id, id))
    .limit(1);
  return goal;
}

export async function createGoal(data: CreateGoalInput): Promise<GoalType> {
  const [inserted] = await getDb()
    .insert(dbGoals)
    .values({
      ...data,
      currentMoney: data.currentMoney ?? 0,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning();
  return inserted;
}

export async function updateGoal(
  id: number,
  updates: UpdateGoalInput,
): Promise<GoalType | undefined> {
  const [updated] = await getDb()
    .update(dbGoals)
    .set({
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    })
    .where(eq(dbGoals.id, id))
    .returning();
  return updated;
}

export async function updateGoalProgress(
  id: number,
  currentMoney: number,
  updatedAt: Date = new Date(),
): Promise<GoalType | undefined> {
  const [updated] = await getDb()
    .update(dbGoals)
    .set({
      currentMoney,
      updatedAt,
    })
    .where(eq(dbGoals.id, id))
    .returning();
  return updated;
}

export async function deleteGoal(id: number): Promise<GoalType | undefined> {
  const [deleted] = await getDb()
    .delete(dbGoals)
    .where(eq(dbGoals.id, id))
    .returning();
  return deleted;
}
