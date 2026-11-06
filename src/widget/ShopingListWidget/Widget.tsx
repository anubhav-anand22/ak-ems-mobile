"use no memo";
import React from "react";
import {
  ColorProp,
  FlexWidget,
  IconWidget,
  ImageWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
  WidgetInfo,
} from "react-native-android-widget";

import { ShoppingListWidgetData } from "./getWidgetData";

type ShoppingListWidgetProps = {
  data: ShoppingListWidgetData;
  info?: WidgetInfo;
  isDev?: boolean;
};

export const ShoppingListWidget = ({
  data,
  info,
  isDev,
}: ShoppingListWidgetProps) => {
  const darkBg = data.widgetTheme.dark as ColorProp;
  const darkTxt = data.widgetTheme.txtDark as ColorProp;
  const lightBg = data.widgetTheme.light as ColorProp;
  const lightTxt = data.widgetTheme.txtLight as ColorProp;

  const theme = data.isDarkMode
    ? { color: darkTxt, backgroundColor: darkBg }
    : { color: lightTxt, backgroundColor: lightBg };

  const scheme = isDev ? "akemsmobile-dev" : "akemsmobile";

  return (
    <FlexWidget
      style={{
        height: info?.height ?? "match_parent",
        width: info?.width ?? "match_parent",
        flex: 1,
        backgroundColor: theme.backgroundColor,
        borderRadius: 16,
      }}
      // clickAction="OPEN_URI"
      // clickActionData={{
      //   uri: `${scheme}://add-expense?isFromWidget=true`,
      // }}
    >
      <TextWidget
        style={{
          fontWeight: "bold",
          fontSize: 16,
          paddingLeft: 10,
          color: theme.color,
        }}
        text="Shopping List"
      />
      <ListWidget>
        {data.shoppingList.map((item, index) => {
          return (
            <FlexWidget key={index}>
              <TextWidget text={`${item.products.length} items`} />
              {item.products.map((product, index) => {
                let productQuantityAndUnit = "";

                if (product.quantity) {
                  productQuantityAndUnit += product.quantity;
                  if (product.unit) {
                    productQuantityAndUnit += `${product.unit}`;
                  }
                }

                return (
                  <TextWidget
                    key={index}
                    text={`${product.amount ? "₹" + product.amount : ""} ${product.productName} ${productQuantityAndUnit}`}
                  />
                );
              })}
            </FlexWidget>
          );
        })}
      </ListWidget>
    </FlexWidget>
  );
};
