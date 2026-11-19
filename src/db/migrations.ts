import { getDb } from "./client";

export function useDatabaseMigrations() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useMigrations } = require("drizzle-orm/expo-sqlite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migrations = require("./drizzle/migrations").default;
  const db = getDb();
  return useMigrations(db, migrations);
}
