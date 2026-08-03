import { Expense, SubExpenseType } from "@/constants/expense";
import { CustomPaperTheme } from "@/constants/paperTheme";
import { db } from "@/db/dbinit";
import { dbTransaction } from "@/db/schema";
import { generateColorShades } from "@/lib/generateColorShades";
import { indianNumberFormatter } from "@/lib/numFormator";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, View } from "react-native";
import { BubbleChart, PieChart, pieDataItem } from "react-native-gifted-charts";
import { Appbar, Card, Text, useTheme } from "react-native-paper";
import { Dropdown, DropdownRef } from "react-native-paper-dropdown";
import Skeleton from "react-native-reanimated-skeleton";

const StatsTimePeriods = [
  "Today",
  "This Week",
  "This Month",
  "This Year",
  "All Time",
] as const;

type StatsTimePeriod = (typeof StatsTimePeriods)[number];

export default function StatsScreen() {
  const timePeriodDropdownRef = useRef<DropdownRef>(null);
  const dim = Dimensions.get("window");
  const theme = useTheme<CustomPaperTheme>();

  const [isLoading, setIsLoading] = useState(false);
  const [pieSubExpenseTxCount, setPieSubExpenseTxCount] = useState<
    pieDataItem[]
  >([]);
  const [pieSubExpenseAmount, setPieSubExpenseAmount] = useState<pieDataItem[]>(
    [],
  );
  const [receiveToFromStateData, setReceiveToFromStateData] = useState<
    bubbleDataItem[]
  >([]);
  const [sendToFromStateData, setSendToFromStateData] = useState<
    bubbleDataItem[]
  >([]);
  const [timePeriod, setTimePeriod] = useState<StatsTimePeriod>(
    StatsTimePeriods[0],
  );

  const getTopToFromStats = async (
    transactionType: Exclude<Exclude<SubExpenseType, "Lend">, "Borrow">,
    timePeriod: StatsTimePeriod,
    limitCount: number = 5,
  ) => {
    // 1. Calculate the start date based on the time period
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let startDate: Date | undefined;

    switch (timePeriod) {
      case "Today":
        startDate = now;
        break;
      case "This Week":
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        break;
      case "This Month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "This Year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "All Time":
        startDate = undefined;
        break;
    }

    // 2. Build the conditions array
    // Filter by whether this is money sent (Expense) or received (Income)
    const conditions = [eq(dbTransaction.subExpenseType, transactionType)];

    if (startDate) {
      conditions.push(gte(dbTransaction.updatedAt, startDate));
    }

    // 3. Execute the query with Grouping and Ordering
    const results = await db
      .select({
        // Select the name we are grouping by
        toFrom: dbTransaction.toFrom,

        // Count how many transactions belong to this name
        transactionCount: sql<number>`count(${dbTransaction.id})`,

        // Sum the nested JSON amounts for this name
        totalAmount: sql<number>`COALESCE(sum((
          SELECT sum(json_extract(value, '$.amount'))
          FROM json_each(${dbTransaction.amount})
        )), 0)`,
      })
      .from(dbTransaction)
      .where(and(...conditions))
      // Group all rows with the same name together
      .groupBy(dbTransaction.toFrom)
      // Order them by the highest frequency first
      .orderBy(desc(sql`count(${dbTransaction.id})`))
      // Limit to top X
      .limit(limitCount);

    return results;
  };

  const getStatsForSubtype = async (
    targetSubtype: SubExpenseType,
    timePeriod: StatsTimePeriod,
  ) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let startDate: Date | undefined;

    switch (timePeriod) {
      case "Today":
        startDate = now;
        break;
      case "This Week":
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        break;
      case "This Month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "This Year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "All Time":
        startDate = undefined;
        break;
    }
    const conditions = [eq(dbTransaction.subExpenseType, targetSubtype)];
    if (startDate) {
      conditions.push(gte(dbTransaction.createdAt, startDate));
    }
    const [result] = await db
      .select({
        transactionCount: sql<number>`count(${dbTransaction.id})`,
        totalAmount: sql<number>`COALESCE(sum((
          SELECT sum(json_extract(value, '$.amount'))
          FROM json_each(${dbTransaction.amount})
        )), 0)`,
      })
      .from(dbTransaction)
      .where(and(...conditions));

    return result;
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = (
        await Promise.allSettled(
          Expense.SubExpenseArr.map(async (e) => ({
            ...(await getStatsForSubtype(e, timePeriod)),
            subExpenseType: e,
          })),
        )
      )
        .filter((e) => e.status === "fulfilled")
        .map((e) => e.value);
      const subExpenseDataShades = generateColorShades(
        theme.colors.primaryContainer,
        results.length + 1,
      );
      subExpenseDataShades.shift();
      const labelPositions = ["mid", "outward"] as const;
      setPieSubExpenseTxCount(
        results.map((e, index) => ({
          value: e.transactionCount,
          text: `${e.subExpenseType} (${e.transactionCount})`,
          color: subExpenseDataShades[index].color,
          textColor: subExpenseDataShades[index].textColor,
          labelPosition: labelPositions[index % labelPositions.length],
        })),
      );
      setPieSubExpenseAmount(
        results.map((e, index) => ({
          value: e.totalAmount,
          text: `${e.subExpenseType} (₹${indianNumberFormatter.format(e.totalAmount)})`,
          color: subExpenseDataShades[index].color,
          textColor: subExpenseDataShades[index].textColor,
          labelPosition: labelPositions[index % labelPositions.length],
        })),
      );
      const [receiveToFromStateData, sendToFromStateData] = await Promise.all([
        getTopToFromStats("Receive", timePeriod, 5),
        getTopToFromStats("Send", timePeriod, 5),
      ]);
      // setReceiveToFromStateData(
      //   receiveToFromStateData.map((e) => ({
      //     value: e.transactionCount,
      //     label: e.toFrom,
      //   })),
      // );
      console.log(receiveToFromStateData);
      console.log(sendToFromStateData);
      const sendToFromBubbleColors = generateColorShades(
        theme.colors.primaryContainer,
        sendToFromStateData.length + 1,
      );
      const receiveToFromBubbleColors = generateColorShades(
        theme.colors.primaryContainer,
        receiveToFromStateData.length + 1,
      );
      sendToFromBubbleColors.shift();
      receiveToFromBubbleColors.shift();
      setReceiveToFromStateData(
        receiveToFromStateData.map((e, index) => ({
          y: e.totalAmount,
          x: e.transactionCount,
          customBubble: () => (
            <View
              style={{
                backgroundColor: receiveToFromBubbleColors[index].color,
                width: 15,
                height: 15,
                borderRadius: 10,
              }}
            />
          ),
          labelShiftX: 18,
          labelShiftY: -5,
          labelWidth: 300,
          labelComponent: () => <Text selectable>{e.toFrom}</Text>,
        })),
      );
      setSendToFromStateData(
        sendToFromStateData.map((e, index) => ({
          y: e.totalAmount,
          x: e.transactionCount,
          customBubble: () => (
            <View
              style={{
                backgroundColor: sendToFromBubbleColors[index].color,
                width: 15,
                height: 15,
                borderRadius: 10,
              }}
            />
          ),
          labelShiftX: 18,
          labelShiftY: -5,
          labelWidth: 300,
          labelComponent: () => <Text selectable>{e.toFrom}</Text>,
        })),
      );
      // await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsLoading(false), 200);
    }
  }, [timePeriod]);

  useEffect(() => {
    loadData();
  }, [theme.colors, loadData]);

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.Content title={`Stats (${timePeriod})`} />
        <Appbar.Action
          icon="filter"
          loading={isLoading}
          onPress={() => {
            if (isLoading) return;
            timePeriodDropdownRef.current?.focus();
          }}
        />
      </Appbar.Header>
      <View style={{ height: 1, overflow: "hidden", opacity: 0 }}>
        <Dropdown
          ref={timePeriodDropdownRef}
          options={StatsTimePeriods.map((period) => ({
            label: period,
            value: period,
          }))}
          onSelect={(value) => {
            setTimePeriod(value as StatsTimePeriod);
          }}
          value={timePeriod}
          hideMenuHeader
        />
      </View>
      <ScrollView>
        <View
          style={{
            flex: 1,
            minHeight: dim.height,
            padding: 10,
            alignItems: "center",
            gap: 20,
          }}
        >
          {/*<View
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >*/}
          {/*<Skeleton
            isLoading={isLoading}
            layout={[
              {
                width: dim.width - 40,
                height:
                  dim.width * 0.4 + dim.width * 0.08 + 10 + 16 * dim.fontScale,
              },
              {
                width: dim.width - 40,
                height:
                  dim.width * 0.4 + dim.width * 0.08 + 10 + 16 * dim.fontScale,
              },
            ]}

            boneColor={theme.colors.surface}
            highlightColor={theme.colors.surfaceVariant}
            containerStyle={{
              borderRadius: theme.roundness * 2,
              overflow: "hidden",
              gap: 20,
              elevation: 5,
            }}
          >*/}
          <View style={{ gap: 20, flex: 1 }}>
            <Card
              style={{
                paddingHorizontal: 10,
                paddingVertical: 20,
                width: dim.width - 40,
              }}
            >
              <View style={{ flexDirection: "row", gap: dim.width * 0.08 }}>
                <PieChart
                  data={pieSubExpenseTxCount}
                  // showText
                  donut
                  innerCircleColor={theme.colors.surface}
                  radius={dim.width * 0.2}
                />
                <View style={{ flex: 1, justifyContent: "space-evenly" }}>
                  {pieSubExpenseTxCount.map((item, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: item.color,
                        }}
                      />
                      <Text key={index}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text
                style={{
                  textAlign: "center",
                  wordWrap: "break-word",
                  marginTop: 10,
                  fontSize: 16 * dim.fontScale,
                }}
              >
                Sub expense transaction count
              </Text>
            </Card>
            <Card
              style={{
                paddingHorizontal: 10,
                paddingVertical: 20,
                width: dim.width - 40,
              }}
            >
              <View style={{ flexDirection: "row", gap: dim.width * 0.08 }}>
                <PieChart
                  data={pieSubExpenseAmount}
                  // showText
                  donut
                  innerCircleColor={theme.colors.surface}
                  radius={dim.width * 0.2}
                />
                <View style={{ flex: 1, justifyContent: "space-evenly" }}>
                  {pieSubExpenseAmount.map((item, index) => (
                    <View
                      key={item.text}
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: item.color,
                        }}
                      />
                      <Text>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text
                style={{
                  textAlign: "center",
                  wordWrap: "break-word",
                  marginTop: 10,
                  fontSize: 16 * dim.fontScale,
                }}
              >
                Sub expense transaction count
              </Text>
            </Card>
            <Card
              style={{
                paddingHorizontal: 10,
                paddingVertical: 20,
                width: dim.width - 40,
              }}
            >
              <BubbleChart
                data={sendToFromStateData}
                height={300}
                width={dim.width - 100}

                xAxisLabelTextStyle={{
                  color: theme.colors.onSurface,
                  fontSize: 12,
                }}
                yAxisTextStyle={{
                  color: theme.colors.onSurface,
                  fontSize: 12,
                }}
                xAxisColor={theme.colors.onSurfaceDisabled}
                yAxisColor={theme.colors.onSurfaceDisabled}
                rulesColor={theme.colors.surfaceDisabled}
              />
              <Text
                style={{
                  textAlign: "center",
                  wordWrap: "break-word",
                  marginTop: 10,
                  fontSize: 16 * dim.fontScale,
                }}
              >
                Money spend count + amount
              </Text>
            </Card>
            <Card
              style={{
                paddingHorizontal: 10,
                paddingVertical: 20,
                width: dim.width - 40,
              }}
            >
              <BubbleChart
                data={receiveToFromStateData}
                height={300}
                width={dim.width - 100}

                xAxisLabelTextStyle={{
                  color: theme.colors.onSurface,
                  fontSize: 12,
                }}
                yAxisTextStyle={{
                  color: theme.colors.onSurface,
                  fontSize: 12,
                }}

                xAxisColor={theme.colors.onSurfaceDisabled}
                yAxisColor={theme.colors.onSurfaceDisabled}
                rulesColor={theme.colors.surfaceDisabled}
              />
              <Text
                style={{
                  textAlign: "center",
                  wordWrap: "break-word",
                  marginTop: 10,
                  fontSize: 16 * dim.fontScale,
                }}
              >
                Money received count + amount
              </Text>
            </Card>
          </View>
          {/*</Skeleton>*/}

          {/*</View>*/}
        </View>
      </ScrollView>
    </View>
  );
}
