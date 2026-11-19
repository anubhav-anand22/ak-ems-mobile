import { widgetThemes } from "@/constants/widgetTheme";
import { getShoppingLists, ShoppingCartType } from "@/db";
import { KVStoreKeyVals } from "@/lib/parseInvoicePDF";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { MAX_WIDGET_SHOPPING_LISTS } from "./widgetHelpers";

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
    const parsedIndex = widgetThemeIndexStr
      ? Number.parseInt(widgetThemeIndexStr, 10)
      : 0;
    const widgetTheme =
      Number.isInteger(parsedIndex) &&
      parsedIndex >= 0 &&
      parsedIndex < widgetThemes.length
        ? widgetThemes[parsedIndex]
        : widgetThemes[0];

    const shoppingList = await getShoppingLists({
      limit: MAX_WIDGET_SHOPPING_LISTS,
    });

    const data: ShoppingListWidgetData = {
      isDarkMode: Appearance.getColorScheme() === "dark",
      widgetTheme,
      id: "shopping-list",
      shoppingList,
    };
    return data;
  };
