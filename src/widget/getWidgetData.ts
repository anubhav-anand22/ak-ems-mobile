import { widgetThemes } from "@/constants/widgetTheme";
import { db } from "@/db/dbinit";
import { dbTransaction, TransactionType } from "@/db/schema";
import { getTotalAmount } from "@/lib/getTotalAmount";
import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { desc, gte } from "drizzle-orm";
import { Appearance } from "react-native";

export type WidgetData = {
  transactions: { tx: TransactionType; total: number }[];
  totalSpendAndReceive: { spend: number; recive: number };
  isDarkMode: boolean;
  widgetTheme: (typeof widgetThemes)[number];
  widgetDataSummaryTimePeriod: (typeof KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals)[number];
};

const getWidgetData = async (): Promise<WidgetData> => {
  const transactions: TransactionType[] = await db
    .select()
    .from(dbTransaction)
    .orderBy(desc(dbTransaction.updatedAt))
    .limit(10);

  const widgetDataSummaryTimePeriod = ((await AsyncStorage.getItem(
    KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.key,
  )) ||
    "Today") as (typeof KVStoreKeyVals.WIDGET_DATA_SUMMARY_TIME.vals)[number];

  const now = new Date();

  if (widgetDataSummaryTimePeriod === "Today") {
    now.setHours(0, 0, 0, 0);
  } else if (widgetDataSummaryTimePeriod === "This Week") {
    now.setDate(now.getDate() - now.getDay());
    now.setHours(0, 0, 0, 0);
  } else if (widgetDataSummaryTimePeriod === "This Month") {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
  }

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

  const widgetThemeIndexStr = await AsyncStorage.getItem(
    KVStoreKeyVals.WIDGET_THEME.key,
  );
  const widgetThemeIndex = widgetThemeIndexStr
    ? parseInt(widgetThemeIndexStr) || 0
    : 0;
  const widgetTheme = widgetThemes[widgetThemeIndex];

  return {
    transactions: transactions.map((tx) => {
      if (tx.expenseType === "Credit") {
        const total = getTotalAmount(tx);
        return { tx, total };
      } else {
        return { tx, total: tx.amount.reduce((p, c) => p + c.amount, 0) };
      }
    }),
    totalSpendAndReceive: totalSpendAndReceive,
    isDarkMode: Appearance.getColorScheme() === "dark",
    widgetTheme,
    widgetDataSummaryTimePeriod,
  };
};

export default getWidgetData;
