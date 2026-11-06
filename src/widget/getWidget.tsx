import { WidgetInfo } from "react-native-android-widget";
import { ShoppingListWidgetData } from "./ShopingListWidget/getWidgetData";
import { TxWidgetData } from "./TxWidget/getWidgetData";
import { widgetRegistry, WidgetName } from "./widgetRegistry";

export const getWidget = async (widgetName: WidgetName) => {
  switch (widgetName) {
    case "Transactions":
      return widgetRegistry.Transactions;
    case "ShoppingList":
      return widgetRegistry.ShoppingList;
    default:
      return null as never;
  }
};
