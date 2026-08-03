import { db } from "@/db/dbinit";
import { dbTransaction, TransactionType } from "@/db/schema";
import { desc, gte } from "drizzle-orm";
import { Appearance } from "react-native";

export type WidgetData = {
  transactions: TransactionType[];
  totalSpendAndReceive: { spend: number; recive: number };
  isDarkMode: boolean;
};

const getWidgetData = async (): Promise<WidgetData> => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const transactions: TransactionType[] = await db
    .select()
    .from(dbTransaction)
    .orderBy(desc(dbTransaction.updatedAt))
    .limit(10);

  const todayTxs = await db
    .select({
      amount: dbTransaction.amount,
      subType: dbTransaction.subExpenseType,
    })
    .from(dbTransaction)
    .where(gte(dbTransaction.updatedAt, now));

  const totalSpendAndReceive = todayTxs.reduce(
    (p, c) => {
      if (c.subType === "Send") {
        p.spend += c.amount.reduce((p, c) => p + c.amount, 0);
      } else {
        p.recive += c.amount.reduce((p, c) => p + c.amount, 0);
      }
      return p;
    },
    { spend: 0, recive: 0 },
  );
  return {
    transactions: transactions,
    totalSpendAndReceive: totalSpendAndReceive,
    isDarkMode: Appearance.getColorScheme() === "dark",
  };
};

export default getWidgetData;
