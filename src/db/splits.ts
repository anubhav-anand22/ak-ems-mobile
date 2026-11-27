import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { dbSplits, SplitParticipant, SplitRecordType } from "./schema";

export type CreateSplitInput = {
  totalAmount: number;
  participants: SplitParticipant[];
  createdAt?: Date;
};

export type GetSplitsPaginatedOptions = {
  limit?: number;
  offset?: number;
};

export async function createSplit(
  input: CreateSplitInput,
): Promise<SplitRecordType> {
  const totalAmount = Math.round((input.totalAmount + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Split total amount must be greater than 0.");
  }
  if (!Array.isArray(input.participants) || input.participants.length === 0) {
    throw new Error("At least one participant is required.");
  }

  const [inserted] = await getDb()
    .insert(dbSplits)
    .values({
      totalAmount,
      participants: input.participants,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();

  return inserted;
}

export async function getSplitsPaginated(
  options: GetSplitsPaginatedOptions = {},
): Promise<SplitRecordType[]> {
  const limit = Math.max(1, options.limit ?? 10);
  const offset = Math.max(0, options.offset ?? 0);

  return await getDb()
    .select()
    .from(dbSplits)
    .orderBy(desc(dbSplits.createdAt), desc(dbSplits.id))
    .limit(limit)
    .offset(offset);
}

export async function deleteSplit(
  id: number,
): Promise<SplitRecordType | undefined> {
  const [deleted] = await getDb()
    .delete(dbSplits)
    .where(eq(dbSplits.id, id))
    .returning();
  return deleted;
}
