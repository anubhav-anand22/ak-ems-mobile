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
import { WidgetData } from "./getWidgetData";
import { Color } from "expo-router";
import { indianNumberFormatter } from "@/lib/numFormator";
import { formatSmartDate } from "@/lib/formatSmartDate";

type HelloWidgetProps = {
  data: WidgetData;
  info?: WidgetInfo;
  isDev?: boolean;
};

export function HelloWidget({ data, info, isDev }: HelloWidgetProps) {
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
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingRight: 10,
          flexGap: 5,
          paddingTop: 5,
        }}
      >
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            style={{
              fontWeight: "bold",
              fontSize: 16,
              paddingLeft: 10,
              color: theme.color,
            }}
            text={`${data.widgetDataSummaryTimePeriod}: ₹${(data.totalSpendAndReceive.recive - data.totalSpendAndReceive.spend).toFixed(2)}`}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            justifyContent: "flex-end",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <SvgWidget
            svg={
              data.isDarkMode
                ? require("@/assets/svg/refresh-dark.svg")
                : require("@/assets/svg/refresh.svg")
            }
            style={{ height: 22, width: 22 }}
            clickAction="WIDGET_UPDATE"
          />
          <SvgWidget
            svg={
              data.isDarkMode
                ? require("@/assets/svg/add-dark.svg")
                : require("@/assets/svg/add.svg")
            }
            style={{ height: 28, width: 28, borderColor: theme.color }}
            clickAction="OPEN_URI"
            clickActionData={{
              uri: `${scheme}://add-expense?isFromWidget=true`,
            }}
          />
        </FlexWidget>
      </FlexWidget>
      <ListWidget style={{ width: "match_parent" }}>
        <FlexWidget
          style={{ width: "match_parent", paddingVertical: 10 }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: `${scheme}://(tabs)/stats?isFromWidget=true`,
          }}
        >
          <FlexWidget
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "match_parent",
              paddingRight: 10,
            }}
          >
            <TextWidget
              text={`Spend (${data.widgetDataSummaryTimePeriod}):`}
              style={{
                fontWeight: "bold",
                fontSize: 16,
                paddingLeft: 10,
                color: theme.color,
              }}
            />
            <TextWidget
              text={`₹${indianNumberFormatter.format(data.totalSpendAndReceive.spend)}`}
              style={{
                fontWeight: "bold",
                fontSize: 16,
                paddingLeft: 10,
                color: theme.color,
              }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "match_parent",
              paddingRight: 10,
            }}
          >
            <TextWidget
              text={`Receive (${data.widgetDataSummaryTimePeriod}):`}
              style={{
                fontWeight: "bold",
                fontSize: 16,
                paddingLeft: 10,
                color: theme.color,
              }}
            />
            <TextWidget
              text={`₹${indianNumberFormatter.format(data.totalSpendAndReceive.recive)}`}
              style={{
                fontWeight: "bold",
                fontSize: 16,
                paddingLeft: 10,
                color: theme.color,
              }}
            />
          </FlexWidget>
        </FlexWidget>
        {data.transactions.map(({ tx, total }) => {
          // const totalAmount = tx.amount.reduce((p, c) => p + c.amount, 0);
          return (
            <FlexWidget
              key={tx.id.toString() + "tx-list-item"}
              style={{
                width: "match_parent",
                paddingHorizontal: 10,
                paddingBottom: 10,
              }}
              clickAction="OPEN_URI"
              clickActionData={{
                uri: `${scheme}://(tabs)?isFromWidget=true&txId=${tx.id}`,
              }}
            >
              <FlexWidget
                style={{ flexDirection: "row", alignItems: "flex-end" }}
              >
                <TextWidget
                  text={`₹${indianNumberFormatter.format(total - (tx.creditPayment || 0))}`}
                  style={{
                    fontWeight: "600",
                    fontSize: 24,
                    color: theme.color,
                  }}
                />
                {tx.expenseType === "Credit" ? (
                  <TextWidget
                    text={` (₹${indianNumberFormatter.format(total)} - ₹${indianNumberFormatter.format(tx.creditPayment || 0)})`}
                    style={{
                      fontSize: 16,
                      color: theme.color,
                    }}
                  />
                ) : null}
              </FlexWidget>
              <FlexWidget
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <TextWidget
                  text={tx.subExpenseType}
                  style={{ color: theme.color }}
                />
                <SvgWidget
                  svg={
                    data.isDarkMode
                      ? require("@/assets/svg/dot-dark.svg")
                      : require("@/assets/svg/dot.svg")
                  }
                  style={{
                    height: 4,
                    width: 4,
                    marginHorizontal: 4,
                    marginTop: 2,
                  }}
                />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    maxLines={1}
                    truncate="END"
                    text={tx.toFrom}
                    style={{ color: theme.color }}
                  />
                </FlexWidget>
                <SvgWidget
                  svg={
                    data.isDarkMode
                      ? require("@/assets/svg/dot-dark.svg")
                      : require("@/assets/svg/dot.svg")
                  }
                  style={{
                    height: 4,
                    width: 4,
                    marginHorizontal: 4,
                    marginTop: 2,
                  }}
                />
                <TextWidget
                  text={formatSmartDate(tx.updatedAt)}
                  style={{ color: theme.color }}
                />
              </FlexWidget>
            </FlexWidget>
          );
        })}
      </ListWidget>
      {/*<TextWidget
        text={`Haaaelssssssslo ${data?.isDarkMode ? "🌙" : "☀️"} ${data?.transactions?.length} transactions`}
        style={{
          fontSize: 32,
          fontFamily: "Inter",
          color: "#000000",
        }}
      />*/}
    </FlexWidget>
  );
}
