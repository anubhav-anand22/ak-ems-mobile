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
