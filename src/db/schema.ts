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
  toFromPhoneNumber: text("toFromPhoneNumber"),
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
  creditPayment: integer("creditPayment"),
});

export type TransactionType = typeof dbTransaction.$inferSelect;

export type ShoppingProduct = {
  productName: string;
  amount?: number;
  quantity?: number;
  unit?: string;
};

export const dbShoppingCart = sqliteTable("shoppingcart", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  products: text("products", { mode: "json" })
    .$type<ShoppingProduct[]>()
    .notNull(),
  note: text("note"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  location: text("location", { mode: "json" }).$type<{
    lon: number;
    lat: number;
    geoFenceId?: string;
  }>(),
  completedItems: text("completed_items", { mode: "json" })
    .$type<string[]>()
    .default([]),
});

export type ShoppingCartType = typeof dbShoppingCart.$inferSelect;
