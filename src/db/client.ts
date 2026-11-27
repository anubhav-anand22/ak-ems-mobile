import { sql } from "drizzle-orm";

let currentDb: any = null;

export const setDb = (customDb: any) => {
  currentDb = customDb;
};

export const getDb = () => {
  if (!currentDb) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabaseSync } = require("expo-sqlite");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { drizzle } = require("drizzle-orm/expo-sqlite");
    const expoDb = openDatabaseSync("app_database.db");
    currentDb = drizzle(expoDb);
  }
  return currentDb;
};

let dbTxQueue: Promise<void> = Promise.resolve();

/**
 * Executes an async database operation inside a serialized SQLite transaction
 * (BEGIN -> work -> COMMIT / ROLLBACK) compatible with both expo-sqlite and
 * sqlite-proxy test databases.
 */
export async function runInDbTransaction<T>(
  work: (db: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> {
  const execute = async (): Promise<T> => {
    const db = getDb();
    await db.run(sql.raw("BEGIN"));
    try {
      const result = await work(db);
      await db.run(sql.raw("COMMIT"));
      return result;
    } catch (error) {
      try {
        await db.run(sql.raw("ROLLBACK"));
      } catch {
        // Ignore rollback failure if no active transaction
      }
      throw error;
    }
  };

  const next = dbTxQueue.then(execute, execute);
  dbTxQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
