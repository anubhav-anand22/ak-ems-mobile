import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import {
  ExpenseType,
  SubExpenseType,
  InterestType,
  CompoundingFrequency,
} from "@/constants/expense";
import { sql } from "drizzle-orm";

export const dbTransaction = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseType: text("expenseType").$type<ExpenseType>().notNull(),
  subExpenseType: text("subExpenseType").$type<SubExpenseType>().notNull(),
  amount: text("amountArr", { mode: "json" })
    .$type<AmountTitleObj[]>()
    .notNull(),
  toFrom: text("toFrom").notNull(),
  note: text("note"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  interestType: text("interestType").$type<InterestType>().default("None"),
  interestRate: real("interestRate"),
  interestTime: real("interestTime"),
  compoundingFrequency: text(
    "compoundingFrequency",
  ).$type<CompoundingFrequency>(),
  location: text("location", { mode: "json" }).$type<LocationObj>(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type TransactionType = typeof dbTransaction.$inferSelect;
