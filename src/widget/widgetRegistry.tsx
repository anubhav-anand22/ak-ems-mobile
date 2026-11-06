import { ShoppingListWidget } from "./ShopingListWidget/Widget";
import { getShoppingListWidgetData } from "./ShopingListWidget/getWidgetData";
import { TxWidget } from "./TxWidget/Widget";
import { getTxWidgetData } from "./TxWidget/getWidgetData";

export const widgetRegistry = {
  Transactions: {
    Component: TxWidget,
    getData: getTxWidgetData,
  },
  ShoppingList: {
    Component: ShoppingListWidget,
    getData: getShoppingListWidgetData,
  },
} as const;

export type WidgetName = keyof typeof widgetRegistry;
