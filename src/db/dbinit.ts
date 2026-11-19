import { getDb } from "./client";

export const getExpoDb = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openDatabaseSync } = require("expo-sqlite");
  return openDatabaseSync("app_database.db");
};

export const expoDb = new Proxy({} as any, {
  get(_target, prop) {
    return (getExpoDb() as any)[prop];
  },
});

export const db = new Proxy({} as any, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
