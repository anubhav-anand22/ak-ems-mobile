"use no memo";

import { WidgetInfo } from "react-native-android-widget";
import { ShoppingListWidgetData } from "./ShopingListWidget/getWidgetData";
import { TxWidgetData } from "./TxWidget/getWidgetData";
import { widgetRegistry } from "./widgetRegistry";

export function WidgetCall({
  data,
  info,
  isDev,
}: {
  data: TxWidgetData | ShoppingListWidgetData;
  info: WidgetInfo;
  isDev: boolean;
}) {
  if (data.id === "tx") {
    const Widget = widgetRegistry["Transactions"].Component;
    return <Widget data={data as TxWidgetData} />;
  } else if (data.id === "shopping-list") {
    const Widget = widgetRegistry["ShoppingList"].Component;
    return (
      <Widget data={data as ShoppingListWidgetData} info={info} isDev={isDev} />
    );
  } else {
    return null;
  }
}
