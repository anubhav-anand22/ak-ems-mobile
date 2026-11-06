import { widgetThemes } from "@/constants/widgetTheme";
import { db } from "@/db/dbinit";
import { dbShoppingCart, ShoppingCartType } from "@/db/schema";
import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { desc } from "drizzle-orm";
import { Appearance } from "react-native";

export type ShoppingListWidgetData = {
  isDarkMode: boolean;
  widgetTheme: (typeof widgetThemes)[number];
  id: "shopping-list";
  shoppingList: ShoppingCartType[];
};

export const getShoppingListWidgetData =
  async (): Promise<ShoppingListWidgetData> => {
    const widgetThemeIndexStr = await AsyncStorage.getItem(
      KVStoreKeyVals.WIDGET_THEME.key,
    );
    const widgetThemeIndex = widgetThemeIndexStr
      ? parseInt(widgetThemeIndexStr) || 0
      : 0;
    const widgetTheme = widgetThemes[widgetThemeIndex];

    const shoppingList = await db
      .select()
      .from(dbShoppingCart)
      .orderBy(desc(dbShoppingCart.updatedAt))
      .limit(3);

    const data: ShoppingListWidgetData = {
      isDarkMode: Appearance.getColorScheme() === "dark",
      widgetTheme,
      id: "shopping-list",
      shoppingList,
    };
    return data;
  };
