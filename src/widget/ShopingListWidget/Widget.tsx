"use no memo";
import React from "react";
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
  WidgetInfo,
} from "react-native-android-widget";
import { widgetThemes } from "@/constants/widgetTheme";
import { ShoppingListWidgetData } from "./getWidgetData";
import {
  formatShoppingListDate,
  formatShoppingProductMeta,
  getCheckboxSvg,
  getCompletedCountForList,
  getLatestShoppingLists,
  getRefreshIconSvg,
  getShoppingListDisplayTitle,
  getShoppingListUri,
  getShoppingWidgetPalette,
  MAX_WIDGET_SHOPPING_LISTS,
  TOGGLE_SHOPPING_ITEM_ACTION,
} from "./widgetHelpers";

type ShoppingListWidgetProps = {
  data: ShoppingListWidgetData;
  info?: WidgetInfo;
  isDev?: boolean;
};

export const ShoppingListWidget = ({
  data,
  info,
  isDev = false,
}: ShoppingListWidgetProps) => {
  const widgetTheme = data.widgetTheme ?? widgetThemes[0];
  const palette = getShoppingWidgetPalette(
    data.isDarkMode
      ? {
          color: widgetTheme.txtDark,
          backgroundColor: widgetTheme.dark,
        }
      : {
          color: widgetTheme.txtLight,
          backgroundColor: widgetTheme.light,
        },
  );

  const rootShoppingListUri = getShoppingListUri(isDev);
  const shoppingLists = getLatestShoppingLists(
    data.shoppingList,
    MAX_WIDGET_SHOPPING_LISTS,
  );

  const listRows = shoppingLists.flatMap((list, listIndex) => {
    const products = Array.isArray(list.products) ? list.products : [];
    const completedSet = new Set(
      Array.isArray(list.completedItems) ? list.completedItems : [],
    );
    const completedCount = getCompletedCountForList({
      products,
      completedItems: list.completedItems,
    });
    const listTitle = getShoppingListDisplayTitle(list.note);
    const dateLabel = formatShoppingListDate(list.updatedAt);
    const listSummaryText = dateLabel
      ? `${completedCount}/${products.length} • ${dateLabel}`
      : `${completedCount}/${products.length}`;
    const listUri = getShoppingListUri(isDev, list.id);

    const headerRow = (
      <FlexWidget
        key={`shopping-list-header-${list.id}`}
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingTop: listIndex > 0 ? 9 : 7,
          paddingBottom: 5,
          backgroundColor: palette.sectionBg,
          borderColor: palette.divider,
          borderTopWidth: listIndex > 0 ? 1 : 0,
          borderBottomWidth: 1,
          borderLeftWidth: 0,
          borderRightWidth: 0,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: listUri }}
        accessibilityLabel={`Open ${listTitle}, ${completedCount} of ${products.length} items completed`}
      >
        <FlexWidget style={{ flex: 1, paddingRight: 8 }}>
          <TextWidget
            text={listTitle}
            maxLines={1}
            truncate="END"
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: palette.text,
            }}
          />
        </FlexWidget>
        <TextWidget
          text={listSummaryText}
          maxLines={1}
          style={{
            fontSize: 11,
            color: palette.secondaryText,
          }}
        />
      </FlexWidget>
    );

    if (products.length === 0) {
      return [
        headerRow,
        <FlexWidget
          key={`shopping-list-empty-${list.id}`}
          style={{
            width: "match_parent",
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: listUri }}
          accessibilityLabel={`Open ${listTitle}, no items yet`}
        >
          <TextWidget
            text="No items in this list"
            maxLines={1}
            style={{
              fontSize: 12,
              color: palette.secondaryText,
            }}
          />
        </FlexWidget>,
      ];
    }

    const itemRows = products.map((product, productIndex) => {
      const isChecked = completedSet.has(product.productName);
      const metaText = formatShoppingProductMeta(product);

      return (
        <FlexWidget
          key={`shopping-list-${list.id}-item-${productIndex}-${product.productName}`}
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            borderColor: palette.divider,
            borderTopWidth: productIndex > 0 ? 1 : 0,
            borderBottomWidth: 0,
            borderLeftWidth: 0,
            borderRightWidth: 0,
          }}
        >
          <FlexWidget
            style={{
              paddingLeft: 12,
              paddingRight: 8,
              paddingVertical: 7,
              alignItems: "center",
              justifyContent: "center",
            }}
            clickAction={TOGGLE_SHOPPING_ITEM_ACTION}
            clickActionData={{
              listId: list.id,
              productName: product.productName,
            }}
            accessibilityLabel={`${isChecked ? "Uncheck" : "Check"} ${product.productName}`}
          >
            <SvgWidget
              svg={getCheckboxSvg(
                palette.text,
                palette.background,
                isChecked,
                palette.checkboxBorder,
              )}
              style={{ height: 18, width: 18 }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: 2,
              paddingRight: 12,
              paddingVertical: 7,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: listUri }}
            accessibilityLabel={`Open shopping list page from ${product.productName}`}
          >
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={product.productName}
                maxLines={1}
                truncate="END"
                style={{
                  fontSize: 13,
                  fontWeight: isChecked ? "normal" : "500",
                  color: isChecked ? palette.checkedText : palette.text,
                }}
              />
            </FlexWidget>
            {metaText ? (
              <TextWidget
                text={metaText}
                maxLines={1}
                style={{
                  fontSize: 11,
                  color: isChecked
                    ? palette.checkedSecondaryText
                    : palette.secondaryText,
                  marginLeft: 8,
                }}
              />
            ) : null}
          </FlexWidget>
        </FlexWidget>
      );
    });

    return [headerRow, ...itemRows];
  });

  return (
    <FlexWidget
      style={{
        height: info?.height ?? "match_parent",
        width: info?.width ?? "match_parent",
        flex: 1,
        backgroundColor: palette.background,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: palette.headerBg,
          borderColor: palette.divider,
          borderBottomWidth: 1,
          borderTopWidth: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 12,
            paddingRight: 6,
            paddingVertical: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: rootShoppingListUri }}
          accessibilityLabel="Open Shopping List page"
        >
          <TextWidget
            text="Shopping List"
            maxLines={1}
            truncate="END"
            style={{
              fontWeight: "bold",
              fontSize: 15,
              color: palette.text,
            }}
          />
          {shoppingLists.length > 0 ? (
            <TextWidget
              text={`${shoppingLists.length} ${shoppingLists.length === 1 ? "list" : "lists"}`}
              maxLines={1}
              style={{
                fontSize: 11,
                color: palette.secondaryText,
                marginLeft: 8,
              }}
            />
          ) : null}
        </FlexWidget>

        <FlexWidget
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="WIDGET_UPDATE"
          accessibilityLabel="Refresh Shopping List widget"
        >
          <SvgWidget
            svg={getRefreshIconSvg(palette.text)}
            style={{ height: 18, width: 18 }}
          />
        </FlexWidget>
      </FlexWidget>

      {shoppingLists.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            width: "match_parent",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: rootShoppingListUri }}
          accessibilityLabel="No shopping lists yet. Tap to open Shopping List page."
        >
          <TextWidget
            text="No shopping lists yet"
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: palette.text,
            }}
          />
          <TextWidget
            text="Tap to add a shopping list"
            style={{
              fontSize: 12,
              color: palette.secondaryText,
              marginTop: 4,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{ flex: 1, width: "match_parent", paddingBottom: 6 }}
        >
          <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
            {listRows}
          </ListWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
};
