import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Avatar,
  Card,
  Chip,
  Divider,
  Icon,
  IconButton,
  ProgressBar,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart, PieChart, barDataItem, pieDataItem } from "react-native-gifted-charts";
import type { CustomPaperTheme } from "@/constants/paperTheme";
import type { SubExpenseType } from "@/constants/expense";
import type { TransactionType } from "@/db";
import { indianNumberFormatter } from "@/lib/numFormator";
import { getInitials } from "@/lib/userTransactionsUtils";
import {
  calculateSelectedTransactionsSummary,
  formatDateShort,
  formatTimeShort,
  SelectedTransactionsAnalysis,
  ToFromSummaryItem,
} from "@/lib/selectedTransactionsSummary";
import { ExportTransactionsModal } from "@/components/ui/ExportTransactionsModal";

export type SelectedTransactionsSummaryModalProps = {
  visible: boolean;
  transactions: TransactionType[];
  onClose: () => void;
};

type SummaryTab = "overview" | "people" | "graphs";

const SUB_EXPENSE_COLORS: Record<SubExpenseType, string> = {
  Send: "#E53935",
  Receive: "#43A047",
  Lend: "#1E88E5",
  Borrow: "#FB8C00",
};

const SUB_EXPENSE_ICONS: Record<SubExpenseType, string> = {
  Send: "arrow-top-right",
  Receive: "arrow-bottom-left",
  Lend: "arrow-up-circle-outline",
  Borrow: "arrow-down-circle-outline",
};

export function SelectedTransactionsSummaryModal({
  visible,
  transactions,
  onClose,
}: SelectedTransactionsSummaryModalProps) {
  const theme = useTheme<CustomPaperTheme>();
  const insets = useSafeAreaInsets();
  const screenDimensions = Dimensions.get("window");
  const [activeTab, setActiveTab] = useState<SummaryTab>("overview");
  const [peopleSearchQuery, setPeopleSearchQuery] = useState("");
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);

  const summary: SelectedTransactionsAnalysis = useMemo(
    () => calculateSelectedTransactionsSummary(transactions),
    [transactions],
  );

  // Filtered contacts in the People tab
  const filteredPeople = useMemo(() => {
    if (!peopleSearchQuery.trim()) return summary.toFromList;
    const q = peopleSearchQuery.toLowerCase().trim();
    return summary.toFromList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phoneNumber && p.phoneNumber.toLowerCase().includes(q)),
    );
  }, [summary.toFromList, peopleSearchQuery]);

  // Pie chart data for sub-expense breakdown
  const pieChartData: pieDataItem[] = useMemo(() => {
    const types: SubExpenseType[] = ["Send", "Receive", "Lend", "Borrow"];
    const hasAnyAmount = summary.totalGrossVolume > 0;

    return types
      .map((type) => {
        const val = hasAnyAmount
          ? summary[type.toLowerCase() as keyof Pick<
              SelectedTransactionsAnalysis,
              "send" | "receive" | "lend" | "borrow"
            >].totalAmount
          : summary[type.toLowerCase() as keyof Pick<
              SelectedTransactionsAnalysis,
              "send" | "receive" | "lend" | "borrow"
            >].count;

        return {
          value: val,
          color: SUB_EXPENSE_COLORS[type],
          text: `${type}`,
        };
      })
      .filter((item) => item.value > 0);
  }, [summary]);

  // Timeline bar chart data (chronological sequence of selected transactions)
  const timelineChartData: barDataItem[] = useMemo(() => {
    return summary.chronologicalTransactions.map((tx) => ({
      value: tx.value,
      label: tx.timeLabel,
      frontColor: SUB_EXPENSE_COLORS[tx.subExpenseType],
      topLabelComponent: () => (
        <Text
          style={{
            fontSize: 9,
            color: theme.colors.onSurfaceVariant,
            textAlign: "center",
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          ₹{indianNumberFormatter.format(tx.value)}
        </Text>
      ),
    }));
  }, [summary.chronologicalTransactions, theme.colors.onSurfaceVariant]);

  // Time of day bar chart data
  const timeOfDayChartData: barDataItem[] = useMemo(() => {
    return summary.timeOfDayDistribution.map((bucket) => ({
      value: bucket.totalAmount,
      label: bucket.period,
      frontColor: theme.colors.primary,
      topLabelComponent: () => (
        <Text
          style={{
            fontSize: 10,
            color: theme.colors.onSurfaceVariant,
            textAlign: "center",
            marginBottom: 2,
          }}
        >
          ₹{indianNumberFormatter.format(bucket.totalAmount)}
        </Text>
      ),
    }));
  }, [summary.timeOfDayDistribution, theme.colors.primary, theme.colors.onSurfaceVariant]);

  const dateRangeText = useMemo(() => {
    if (!summary.oldestDate || !summary.newestDate) return "N/A";
    const oldestStr = formatDateShort(summary.oldestDate);
    const newestStr = formatDateShort(summary.newestDate);
    return oldestStr === newestStr ? oldestStr : `${oldestStr} – ${newestStr}`;
  }, [summary.oldestDate, summary.newestDate]);

  const netCashFlowColor =
    summary.netCashFlow > 0
      ? theme.colors.customSuccess
      : summary.netCashFlow < 0
        ? theme.colors.error
        : theme.colors.onSurfaceVariant;

  const chartContainerWidth = Math.max(screenDimensions.width - 64, 280);
  const timelineChartWidth = Math.max(
    chartContainerWidth,
    timelineChartData.length * 56,
  );

  return (
    <Modal
      testID="selected-transactions-summary-modal"
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top || 16,
            paddingBottom: insets.bottom || 16,
          },
        ]}
      >
        {/* Modal Top Header */}
        <View style={styles.header}>
          <IconButton
            testID="summary-close-btn"
            icon="close"
            size={24}
            onPress={onClose}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                Selected Summary
              </Text>
              <Chip compact textStyle={{ fontSize: 11, marginVertical: 0 }}>
                {summary.totalCount} items
              </Chip>
            </View>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Gross: ₹{indianNumberFormatter.format(summary.totalGrossVolume)} •{" "}
              {dateRangeText}
            </Text>
          </View>
          <IconButton
            testID="summary-export-btn"
            icon="export-variant"
            size={24}
            accessibilityLabel="Export Selected"
            onPress={() => setIsExportModalVisible(true)}
          />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <SegmentedButtons<SummaryTab>
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={[
              {
                value: "overview",
                label: "Overview",
                icon: "view-dashboard-outline",
                testID: "summary-tab-overview",
              },
              {
                value: "people",
                label: `People (${summary.toFromCount})`,
                icon: "account-group-outline",
                testID: "summary-tab-people",
              },
              {
                value: "graphs",
                label: "Graphs",
                icon: "chart-timeline-variant-shimmer",
                testID: "summary-tab-graphs",
              },
            ]}
            theme={{ roundness: 2 }}
          />
        </View>

        <Divider />

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Net Cash Flow Banner */}
            <Card
              mode="elevated"
              style={[
                styles.card,
                {
                  borderColor: netCashFlowColor,
                  borderWidth: 1.5,
                  backgroundColor:
                    summary.netCashFlow > 0
                      ? theme.colors.customSuccessContainer
                      : summary.netCashFlow < 0
                        ? theme.colors.errorContainer
                        : theme.colors.surfaceVariant,
                },
              ]}
            >
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon
                      source={
                        summary.netCashFlow > 0
                          ? "trending-up"
                          : summary.netCashFlow < 0
                            ? "trending-down"
                            : "equal"
                      }
                      size={24}
                      color={netCashFlowColor}
                    />
                    <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                      Net Cash Flow
                    </Text>
                  </View>
                  <Text
                    variant="titleLarge"
                    style={{
                      fontWeight: "800",
                      color: netCashFlowColor,
                    }}
                  >
                    {summary.netCashFlow > 0 ? "+" : ""}
                    ₹{indianNumberFormatter.format(summary.netCashFlow)}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 6,
                  }}
                >
                  {summary.netCashFlow > 0
                    ? "Inflow: Received & Borrowed exceeded Sent & Lent"
                    : summary.netCashFlow < 0
                      ? "Outflow: Sent & Lent exceeded Received & Borrowed"
                      : "Even balance across selected items"}
                </Text>
              </Card.Content>
            </Card>

            {/* 2x2 Breakdown Grid: Send, Receive, Lend, Borrow */}
            <View style={styles.gridContainer}>
              {/* Send */}
              <Card
                mode="elevated"
                style={[styles.gridCard, { borderLeftColor: SUB_EXPENSE_COLORS.Send, borderLeftWidth: 4 }]}
              >
                <Card.Content style={styles.gridCardContent}>
                  <View style={styles.gridHeaderRow}>
                    <View style={styles.iconTitleRow}>
                      <Icon
                        source={SUB_EXPENSE_ICONS.Send}
                        size={18}
                        color={SUB_EXPENSE_COLORS.Send}
                      />
                      <Text variant="labelLarge" style={{ fontWeight: "700", color: SUB_EXPENSE_COLORS.Send }}>
                        Sent
                      </Text>
                    </View>
                    <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                      {summary.send.count} tx
                    </Chip>
                  </View>
                  <Text variant="titleMedium" style={{ fontWeight: "800", marginTop: 4 }}>
                    ₹{indianNumberFormatter.format(summary.send.totalAmount)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {summary.send.percentageOfVolume}% of volume
                  </Text>
                </Card.Content>
              </Card>

              {/* Receive */}
              <Card
                mode="elevated"
                style={[styles.gridCard, { borderLeftColor: SUB_EXPENSE_COLORS.Receive, borderLeftWidth: 4 }]}
              >
                <Card.Content style={styles.gridCardContent}>
                  <View style={styles.gridHeaderRow}>
                    <View style={styles.iconTitleRow}>
                      <Icon
                        source={SUB_EXPENSE_ICONS.Receive}
                        size={18}
                        color={SUB_EXPENSE_COLORS.Receive}
                      />
                      <Text variant="labelLarge" style={{ fontWeight: "700", color: SUB_EXPENSE_COLORS.Receive }}>
                        Received
                      </Text>
                    </View>
                    <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                      {summary.receive.count} tx
                    </Chip>
                  </View>
                  <Text variant="titleMedium" style={{ fontWeight: "800", marginTop: 4 }}>
                    ₹{indianNumberFormatter.format(summary.receive.totalAmount)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {summary.receive.percentageOfVolume}% of volume
                  </Text>
                </Card.Content>
              </Card>

              {/* Lend */}
              <Card
                mode="elevated"
                style={[styles.gridCard, { borderLeftColor: SUB_EXPENSE_COLORS.Lend, borderLeftWidth: 4 }]}
              >
                <Card.Content style={styles.gridCardContent}>
                  <View style={styles.gridHeaderRow}>
                    <View style={styles.iconTitleRow}>
                      <Icon
                        source={SUB_EXPENSE_ICONS.Lend}
                        size={18}
                        color={SUB_EXPENSE_COLORS.Lend}
                      />
                      <Text variant="labelLarge" style={{ fontWeight: "700", color: SUB_EXPENSE_COLORS.Lend }}>
                        Lent
                      </Text>
                    </View>
                    <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                      {summary.lend.count} tx
                    </Chip>
                  </View>
                  <Text variant="titleMedium" style={{ fontWeight: "800", marginTop: 4 }}>
                    ₹{indianNumberFormatter.format(summary.lend.totalAmount)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {summary.lend.percentageOfVolume}% of volume
                  </Text>
                </Card.Content>
              </Card>

              {/* Borrow */}
              <Card
                mode="elevated"
                style={[styles.gridCard, { borderLeftColor: SUB_EXPENSE_COLORS.Borrow, borderLeftWidth: 4 }]}
              >
                <Card.Content style={styles.gridCardContent}>
                  <View style={styles.gridHeaderRow}>
                    <View style={styles.iconTitleRow}>
                      <Icon
                        source={SUB_EXPENSE_ICONS.Borrow}
                        size={18}
                        color={SUB_EXPENSE_COLORS.Borrow}
                      />
                      <Text variant="labelLarge" style={{ fontWeight: "700", color: SUB_EXPENSE_COLORS.Borrow }}>
                        Borrowed
                      </Text>
                    </View>
                    <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                      {summary.borrow.count} tx
                    </Chip>
                  </View>
                  <Text variant="titleMedium" style={{ fontWeight: "800", marginTop: 4 }}>
                    ₹{indianNumberFormatter.format(summary.borrow.totalAmount)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {summary.borrow.percentageOfVolume}% of volume
                  </Text>
                </Card.Content>
              </Card>
            </View>

            {/* Quick Metrics Summary */}
            <Card mode="outlined" style={styles.card}>
              <Card.Content style={{ gap: 12 }}>
                <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                  Key Metrics
                </Text>

                <View style={styles.metricRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Average Amount
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: "700" }}>
                    ₹{indianNumberFormatter.format(summary.averageAmount)}
                  </Text>
                </View>

                <Divider />

                <View style={styles.metricRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Unique Contacts
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: "700" }}>
                    {summary.toFromCount}
                  </Text>
                </View>

                <Divider />

                <View style={styles.metricRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Date Range
                  </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: "700" }}>
                    {dateRangeText}
                  </Text>
                </View>

                {summary.highestTransaction && (
                  <>
                    <Divider />
                    <View style={{ gap: 4 }}>
                      <View style={styles.metricRow}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          Highest Transaction
                        </Text>
                        <Text
                          variant="bodyMedium"
                          style={{
                            fontWeight: "800",
                            color: SUB_EXPENSE_COLORS[summary.highestTransaction.subExpenseType],
                          }}
                        >
                          ₹{indianNumberFormatter.format(summary.highestTransaction.amount)}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {summary.highestTransaction.title} • {summary.highestTransaction.subExpenseType} to/from{" "}
                        {summary.highestTransaction.toFrom}
                      </Text>
                    </View>
                  </>
                )}
              </Card.Content>
            </Card>
          </ScrollView>
        )}

        {/* Tab 2: People / Contacts Breakdown */}
        {activeTab === "people" && (
          <View style={{ flex: 1 }}>
            {summary.toFromList.length > 4 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
                <Searchbar
                  placeholder="Search contacts..."
                  value={peopleSearchQuery}
                  onChangeText={setPeopleSearchQuery}
                  style={{ elevation: 0, height: 42 }}
                  inputStyle={{ minHeight: 0 }}
                />
              </View>
            )}

            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingTop: 12 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                  {filteredPeople.length} Contact{filteredPeople.length === 1 ? "" : "s"} Involved
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Breakdown by entity
                </Text>
              </View>

              {filteredPeople.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon source="account-search-outline" size={40} color={theme.colors.onSurfaceVariant} />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    No contacts found
                  </Text>
                </View>
              ) : (
                filteredPeople.map((person) => (
                  <PersonSummaryCard key={person.name} person={person} theme={theme} />
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Tab 3: Graphs */}
        {activeTab === "graphs" && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Graph 1: Chronological Timeline */}
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                      Chronological Timeline
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Selected transactions over time
                    </Text>
                  </View>
                  <Chip compact textStyle={{ fontSize: 10 }}>
                    {timelineChartData.length} pts
                  </Chip>
                </View>

                {/* SubExpense Color Legend */}
                <View style={styles.legendContainer}>
                  {(["Send", "Receive", "Lend", "Borrow"] as SubExpenseType[]).map((type) => (
                    <View key={type} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: SUB_EXPENSE_COLORS[type] }]} />
                      <Text variant="bodySmall">{type}</Text>
                    </View>
                  ))}
                </View>

                {timelineChartData.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    <BarChart
                      data={timelineChartData}
                      width={timelineChartWidth}
                      height={190}
                      barWidth={24}
                      spacing={20}
                      initialSpacing={12}
                      noOfSections={4}
                      xAxisThickness={1}
                      yAxisThickness={1}
                      xAxisColor={theme.colors.outlineVariant}
                      yAxisColor={theme.colors.outlineVariant}
                      yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                      isAnimated={false}
                    />
                  </ScrollView>
                ) : (
                  <Text variant="bodySmall" style={{ textAlign: "center", marginVertical: 20 }}>
                    No time data available
                  </Text>
                )}
              </Card.Content>
            </Card>

            {/* Graph 2: SubExpense Type Breakdown Donut Chart */}
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                  Volume Breakdown
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                  Proportions across Send, Receive, Lend, Borrow
                </Text>

                {pieChartData.length > 0 ? (
                  <View style={styles.pieChartContainer}>
                    <PieChart
                      data={pieChartData}
                      donut
                      radius={screenDimensions.width * 0.22}
                      innerRadius={screenDimensions.width * 0.13}
                      innerCircleColor={theme.colors.surface}
                      centerLabelComponent={() => (
                        <View style={{ alignItems: "center" }}>
                          <Text variant="titleSmall" style={{ fontWeight: "800" }}>
                            {summary.totalCount}
                          </Text>
                          <Text variant="bodySmall" style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>
                            Items
                          </Text>
                        </View>
                      )}
                    />

                    {/* Breakdown list on right side */}
                    <View style={styles.pieLegendContainer}>
                      {(["Send", "Receive", "Lend", "Borrow"] as SubExpenseType[]).map((type) => {
                        const item = summary[type.toLowerCase() as keyof Pick<
                          SelectedTransactionsAnalysis,
                          "send" | "receive" | "lend" | "borrow"
                        >];
                        if (item.count === 0 && item.totalAmount === 0) return null;
                        return (
                          <View key={type} style={styles.pieLegendRow}>
                            <View style={[styles.legendDot, { backgroundColor: SUB_EXPENSE_COLORS[type] }]} />
                            <View style={{ flex: 1 }}>
                              <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                                {type} ({item.percentageOfVolume}%)
                              </Text>
                              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                                ₹{indianNumberFormatter.format(item.totalAmount)} • {item.count} tx
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <Text variant="bodySmall" style={{ textAlign: "center", marginVertical: 20 }}>
                    No breakdown data available
                  </Text>
                )}
              </Card.Content>
            </Card>

            {/* Graph 3: Top Contacts Volume Ranking */}
            {summary.toFromList.length > 0 && (
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={{ gap: 12 }}>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    Top Contacts by Volume
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Entities with the highest transacted volume
                  </Text>

                  {summary.toFromList.slice(0, 5).map((contact, idx) => {
                    const ratio =
                      summary.totalGrossVolume > 0
                        ? Math.min(contact.totalAmount / summary.totalGrossVolume, 1)
                        : 0;

                    return (
                      <View key={contact.name} style={{ gap: 4 }}>
                        <View style={styles.metricRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                            <Text variant="labelMedium" style={{ fontWeight: "700" }}>
                              #{idx + 1}
                            </Text>
                            <Text variant="bodyMedium" style={{ fontWeight: "600" }} numberOfLines={1}>
                              {contact.name}
                            </Text>
                          </View>
                          <Text variant="bodyMedium" style={{ fontWeight: "700" }}>
                            ₹{indianNumberFormatter.format(contact.totalAmount)}
                          </Text>
                        </View>
                        <ProgressBar
                          progress={ratio}
                          color={theme.colors.primary}
                          style={{ height: 6, borderRadius: 3 }}
                        />
                      </View>
                    );
                  })}
                </Card.Content>
              </Card>
            )}

            {/* Graph 4: Time of Day Spending Distribution */}
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                  Time of Day Distribution
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                  Transactions by time period
                </Text>

                <BarChart
                  data={timeOfDayChartData}
                  width={chartContainerWidth}
                  height={170}
                  barWidth={36}
                  spacing={24}
                  initialSpacing={16}
                  noOfSections={3}
                  xAxisThickness={1}
                  yAxisThickness={1}
                  xAxisColor={theme.colors.outlineVariant}
                  yAxisColor={theme.colors.outlineVariant}
                  yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                  isAnimated={false}
                />
              </Card.Content>
            </Card>
          </ScrollView>
        )}
      </View>

      <ExportTransactionsModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        transactions={transactions}
        scope="selected"
        title={`Export Selected (${summary.totalCount})`}
      />
    </Modal>
  );
}

function PersonSummaryCard({
  person,
  theme,
}: {
  person: ToFromSummaryItem;
  theme: CustomPaperTheme;
}) {
  const netColor =
    person.netBalance > 0
      ? theme.colors.customSuccess
      : person.netBalance < 0
        ? theme.colors.error
        : theme.colors.onSurfaceVariant;

  return (
    <Card mode="outlined" style={styles.personCard}>
      <Card.Content style={{ gap: 10 }}>
        {/* Contact Header */}
        <View style={styles.personHeaderRow}>
          <Avatar.Text
            size={38}
            label={getInitials(person.name)}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleSmall" style={{ fontWeight: "700" }} numberOfLines={1}>
              {person.name}
            </Text>
            {person.phoneNumber ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                {person.phoneNumber}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="titleMedium" style={{ fontWeight: "800" }}>
              ₹{indianNumberFormatter.format(person.totalAmount)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              {person.transactionCount} tx{person.transactionCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Net Balance & Breakdown */}
        <View style={styles.personFooterRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Net Balance:
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: "800", color: netColor }}>
              {person.netBalance > 0 ? "+" : ""}
              ₹{indianNumberFormatter.format(person.netBalance)}
            </Text>
          </View>

          {/* Chips for active types */}
          <View style={styles.chipsRow}>
            {person.sendAmount > 0 && (
              <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                Sent ₹{indianNumberFormatter.format(person.sendAmount)}
              </Chip>
            )}
            {person.receiveAmount > 0 && (
              <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                Recv ₹{indianNumberFormatter.format(person.receiveAmount)}
              </Chip>
            )}
            {person.lendAmount > 0 && (
              <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                Lent ₹{indianNumberFormatter.format(person.lendAmount)}
              </Chip>
            )}
            {person.borrowAmount > 0 && (
              <Chip compact textStyle={{ fontSize: 10, marginVertical: 0 }}>
                Borrow ₹{indianNumberFormatter.format(person.borrowAmount)}
              </Chip>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    flex: 1,
    minWidth: "46%",
    borderRadius: 12,
  },
  gridCardContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  gridHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  personCard: {
    borderRadius: 14,
  },
  personHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  personFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pieChartContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 12,
    paddingVertical: 8,
  },
  pieLegendContainer: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  pieLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
