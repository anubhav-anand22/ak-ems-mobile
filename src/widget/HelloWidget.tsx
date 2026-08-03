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
  const theme: { color?: ColorProp; backgroundColor?: ColorProp } =
    data.isDarkMode
      ? { color: "#fff", backgroundColor: "#1a1a1a" }
      : { color: "#000", backgroundColor: "#efefef" };

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
      clickAction="OPEN_URI"
      clickActionData={{
        uri: `${scheme}://add-expense?isFromWidget=true`,
      }}
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
        <FlexWidget>
          <TextWidget
            style={{
              fontWeight: "bold",
              fontSize: 16,
              paddingLeft: 10,
              color: theme.color,
            }}
            text={`Today: ₹${data.totalSpendAndReceive.recive - data.totalSpendAndReceive.spend}`}
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
        <FlexWidget style={{ width: "match_parent", paddingVertical: 10 }}>
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
              text={`Spend (Today):`}
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
              text={`Receive (Today):`}
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
        {data.transactions.map((tx) => {
          const totalAmount = tx.amount.reduce((p, c) => p + c.amount, 0);
          return (
            <FlexWidget
              style={{
                width: "match_parent",
                paddingHorizontal: 10,
                paddingBottom: 10,
              }}
            >
              <TextWidget
                text={`₹${indianNumberFormatter.format(totalAmount)}`}
                style={{ fontWeight: "600", fontSize: 24, color: theme.color }}
              />
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
                <TextWidget text={tx.toFrom} style={{ color: theme.color }} />
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
