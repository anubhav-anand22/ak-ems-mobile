import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import {
  ExpenseType,
  SubExpenseType,
  InterestType,
  CompoundingFrequency,
} from "@/constants/expense";
import { sql } from "drizzle-orm";

export type WalletAllocation = {
  walletId: number;
  amount: number;
};

export const dbWallet = sqliteTable("wallets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  currentBalance: real("current_balance").default(0).notNull(),
  minBalance: real("min_balance"),
  maxBalance: real("max_balance"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type WalletType = typeof dbWallet.$inferSelect;

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
  noteImages: text("note_images", { mode: "json" }).$type<string[]>(),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  interestType: text("interestType").$type<InterestType>().default("None"),
  interestRate: real("interestRate"),
  interestTime: real("interestTime"),
  compoundingFrequency: text(
    "compoundingFrequency",
  ).$type<CompoundingFrequency>(),
  location: text("location", { mode: "json" }).$type<LocationObj>(),
  walletAllocations: text("wallet_allocations", { mode: "json" }).$type<
    WalletAllocation[]
  >(),
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

export const dbGoals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetName: text("targetName").notNull(),
  targetMoney: real("targetMoney").notNull(),
  currentMoney: real("currentMoney").default(0).notNull(),
  note: text("note"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type GoalType = typeof dbGoals.$inferSelect;

export type SplitType = "percentage" | "part" | "money";

export type SplitParticipant = {
  id: string;
  name: string;
  phoneNumber?: string | null;
  splitType: SplitType;
  splitValue: number;
  calculatedMoney: number;
  calculatedPercentage: number;
  isMe: boolean;
};

export const dbSplits = sqliteTable("splits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalAmount: real("total_amount").notNull(),
  participants: text("participants", { mode: "json" })
    .$type<SplitParticipant[]>()
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type SplitRecordType = typeof dbSplits.$inferSelect;
