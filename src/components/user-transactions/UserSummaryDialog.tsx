import { CustomPaperTheme } from "@/constants/paperTheme";
import { TransactionType } from "@/db/schema";
import { formatSmartDate } from "@/lib/formatSmartDate";
import { getTotalAmount } from "@/lib/getTotalAmount";
import { indianNumberFormatter } from "@/lib/numFormator";
import {
  getInitials,
  getTransactionDisplaySummary,
  UserSummaryStats,
} from "@/lib/userTransactionsUtils";
import { FlatList, useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  Divider,
  Icon,
  Portal,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

type UserSummaryDialogProps = {
  visible: boolean;
  userName: string | null;
  phoneNumber?: string | null;
  stats: UserSummaryStats;
  transactions: TransactionType[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onSelectTransaction: (transaction: TransactionType) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onBackToUsers: () => void;
  onDismiss: () => void;
};

export function UserSummaryDialog({
  visible,
  userName,
  phoneNumber,
  stats,
  transactions,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onSelectTransaction,
  onLoadMore,
  onRetry,
  onBackToUsers,
  onDismiss,
}: UserSummaryDialogProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { height } = useWindowDimensions();
  const feedHeight = Math.max(190, Math.min(height * 0.36, 300));
  const safeName = userName ?? "";

  const creditBreakdownParts: string[] = [];
  if (stats.creditLendTotal > 0) {
    creditBreakdownParts.push(
      `Lent ₹${indianNumberFormatter.format(stats.creditLendTotal)}`,
    );
  }
  if (stats.creditBorrowTotal > 0) {
    creditBreakdownParts.push(
      `Borrow ₹${indianNumberFormatter.format(stats.creditBorrowTotal)}`,
    );
  }

  return (
    <Portal>
      <Dialog
        testID="user-summary-dialog"
        visible={visible}
        onDismiss={onBackToUsers}
        style={{ marginHorizontal: 14, maxHeight: height * 0.88 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 10,
            gap: 12,
          }}
        >
          <Avatar.Text
            size={40}
            label={getInitials(safeName)}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleMedium" numberOfLines={1}>
              {safeName}
            </Text>
            <Text
              testID="user-summary-tx-count"
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
              numberOfLines={1}
            >
              {stats.totalCount}{" "}
              {stats.totalCount === 1 ? "Transaction" : "Transactions"}
              {phoneNumber ? ` • ${phoneNumber}` : ""}
            </Text>
          </View>
        </View>

        <Dialog.Content style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Surface
                testID="user-summary-total-expense"
                elevation={0}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: theme.roundness * 2,
                  backgroundColor: theme.colors.customErrorContainer,
                }}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.customOnErrorContainer }}
                >
                  Total Expense
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.customError,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  ₹{indianNumberFormatter.format(stats.totalExpense)}
                </Text>
                {stats.simpleReceiveTotal > 0 ? (
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={{
                      color: theme.colors.customOnErrorContainer,
                      opacity: 0.85,
                      marginTop: 2,
                    }}
                  >
                    Recv ₹{indianNumberFormatter.format(stats.simpleReceiveTotal)}
                  </Text>
                ) : null}
              </Surface>

              <Surface
                testID="user-summary-total-credit"
                elevation={0}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: theme.roundness * 2,
                  backgroundColor: theme.colors.customSuccessContainer,
                }}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.customOnSuccessContainer }}
                >
                  Total Credit
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.customSuccess,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  ₹{indianNumberFormatter.format(stats.totalCredit)}
                </Text>
                {creditBreakdownParts.length > 0 ? (
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={{
                      color: theme.colors.customOnSuccessContainer,
                      opacity: 0.85,
                      marginTop: 2,
                    }}
                  >
                    {creditBreakdownParts.join(" • ")}
                  </Text>
                ) : null}
              </Surface>
            </View>

            {stats.totalCredit > 0 ? (
              <Surface
                testID="user-summary-settlement-banner"
                elevation={0}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: theme.roundness * 1.5,
                  backgroundColor:
                    stats.netCreditBalance > 0
                      ? theme.colors.customSuccessContainer
                      : stats.netCreditBalance < 0
                        ? theme.colors.customErrorContainer
                        : theme.colors.surfaceVariant,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon
                  size={16}
                  source={
                    stats.netCreditBalance > 0
                      ? "arrow-bottom-left"
                      : stats.netCreditBalance < 0
                        ? "arrow-top-right"
                        : "check-circle-outline"
                  }
                  color={
                    stats.netCreditBalance > 0
                      ? theme.colors.customSuccess
                      : stats.netCreditBalance < 0
                        ? theme.colors.customError
                        : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  variant="labelMedium"
                  style={{
                    flex: 1,
                    color:
                      stats.netCreditBalance > 0
                        ? theme.colors.customOnSuccessContainer
                        : stats.netCreditBalance < 0
                          ? theme.colors.customOnErrorContainer
                          : theme.colors.onSurfaceVariant,
                  }}
                >
                  {stats.netCreditBalance > 0
                    ? `${safeName} owes you ₹${indianNumberFormatter.format(stats.netCreditBalance)}`
                    : stats.netCreditBalance < 0
                      ? `You owe ${safeName} ₹${indianNumberFormatter.format(Math.abs(stats.netCreditBalance))}`
                      : "All credit balances settled"}
                </Text>
              </Surface>
            ) : null}

            <Divider style={{ marginVertical: 2 }} />

            <View style={{ height: feedHeight }}>
              {isLoading && transactions.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ActivityIndicator size="small" />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Loading transactions...
                  </Text>
                </View>
              ) : error && transactions.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.customError,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </Text>
                  <Button mode="contained-tonal" compact onPress={onRetry}>
                    Retry
                  </Button>
                </View>
              ) : (
                <FlatList
                  testID="user-summary-tx-list"
                  data={transactions}
                  keyExtractor={(item) => item.id.toString()}
                  ItemSeparatorComponent={Divider}
                  onEndReachedThreshold={0.25}
                  onEndReached={() => {
                    if (hasMore && !isLoading && !isLoadingMore) {
                      onLoadMore();
                    }
                  }}
                  ListEmptyComponent={
                    <View
                      style={{
                        height: feedHeight - 16,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        No transactions found.
                      </Text>
                    </View>
                  }
                  ListFooterComponent={
                    isLoadingMore ? (
                      <View
                        style={{ paddingVertical: 12, alignItems: "center" }}
                      >
                        <ActivityIndicator size="small" />
                      </View>
                    ) : error && transactions.length > 0 ? (
                      <View
                        style={{ paddingVertical: 8, alignItems: "center" }}
                      >
                        <Button mode="text" compact onPress={onLoadMore}>
                          Load more failed • Retry
                        </Button>
                      </View>
                    ) : null
                  }
                  renderItem={({ item, index }) => {
                    const totalAmount = getTotalAmount(item);
                    const isCredit = item.expenseType === "Credit";
                    const typeColor = isCredit
                      ? theme.colors.customSuccess
                      : item.subExpenseType === "Receive"
                        ? theme.colors.customSuccess
                        : theme.colors.customError;

                    return (
                      <TouchableRipple
                        testID={`user-summary-tx-row-${index}`}
                        onPress={() => onSelectTransaction(item)}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            paddingHorizontal: 4,
                            gap: 10,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                variant="labelSmall"
                                style={{ color: typeColor, fontWeight: "700" }}
                              >
                                {isCredit ? "Credit" : "Expense"} •{" "}
                                {item.subExpenseType}
                              </Text>
                              <Text
                                variant="labelSmall"
                                style={{ color: theme.colors.onSurfaceVariant }}
                              >
                                {formatSmartDate(item.updatedAt)}
                              </Text>
                            </View>
                            <Text variant="bodyMedium" numberOfLines={1}>
                              {getTransactionDisplaySummary(item)}
                            </Text>
                          </View>
                          <View
                            style={{
                              alignItems: "flex-end",
                              flexDirection: "row",
                              gap: 4,
                            }}
                          >
                            <Text
                              variant="titleSmall"
                              style={{
                                color: typeColor,
                                fontWeight: "700",
                              }}
                            >
                              ₹{indianNumberFormatter.format(totalAmount)}
                            </Text>
                            <Icon
                              source="chevron-right"
                              size={16}
                              color={theme.colors.onSurfaceVariant}
                            />
                          </View>
                        </View>
                      </TouchableRipple>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Dialog.Content>

        <Dialog.Actions style={{ justifyContent: "space-between" }}>
          <Button
            testID="user-summary-back-btn"
            icon="arrow-left"
            onPress={onBackToUsers}
          >
            Contacts
          </Button>
          <Button testID="user-summary-close-btn" onPress={onDismiss}>
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
