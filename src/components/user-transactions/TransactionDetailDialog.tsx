import { CustomPaperTheme } from "@/constants/paperTheme";
import { TransactionType } from "@/db/schema";
import { indianNumberFormatter } from "@/lib/numFormator";
import {
  formatFullDateTime,
  getTransactionAmountBreakdown,
} from "@/lib/userTransactionsUtils";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Divider,
  Portal,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

type TransactionDetailDialogProps = {
  visible: boolean;
  transaction: TransactionType | null;
  onDismiss: () => void;
};

const DetailRow = ({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => {
  const theme = useTheme<CustomPaperTheme>();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 4,
      }}
    >
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, flexShrink: 0 }}
      >
        {label}
      </Text>
      <Text
        variant="bodySmall"
        selectable
        style={{
          color: valueColor ?? theme.colors.onSurface,
          textAlign: "right",
          flex: 1,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
};

export function TransactionDetailDialog({
  visible,
  transaction,
  onDismiss,
}: TransactionDetailDialogProps) {
  const theme = useTheme<CustomPaperTheme>();
  const { height } = useWindowDimensions();

  const breakdown = transaction
    ? getTransactionAmountBreakdown(transaction)
    : null;
  const isCredit = transaction?.expenseType === "Credit";
  const isPositiveFlow =
    isCredit || transaction?.subExpenseType === "Receive";
  const amountColor = isPositiveFlow
    ? theme.colors.customSuccess
    : theme.colors.customError;

  const locationSummary = transaction?.location
    ? [
        transaction.location.city,
        transaction.location.district,
        transaction.location.state,
        transaction.location.country,
        transaction.location.postalCode,
      ]
        .filter(Boolean)
        .join(", ") ||
      `${transaction.location.latitude.toFixed(4)}, ${transaction.location.longitude.toFixed(4)}`
    : null;

  return (
    <Portal>
      <Dialog
        testID="transaction-detail-dialog"
        visible={visible}
        onDismiss={onDismiss}
        style={{ marginHorizontal: 16, maxHeight: height * 0.88 }}
      >
        <Dialog.Title>Transaction Details</Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
          {transaction && breakdown ? (
            <ScrollView style={{ maxHeight: height * 0.6 }}>
              <View style={{ gap: 10, paddingBottom: 4 }}>
                <Surface
                  elevation={0}
                  style={{
                    padding: 12,
                    borderRadius: theme.roundness * 2,
                    backgroundColor: isPositiveFlow
                      ? theme.colors.customSuccessContainer
                      : theme.colors.customErrorContainer,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text
                    testID="transaction-detail-amount"
                    variant="headlineSmall"
                    style={{ color: amountColor, fontWeight: "700" }}
                  >
                    ₹{indianNumberFormatter.format(breakdown.totalAmount)}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={{
                      color: isPositiveFlow
                        ? theme.colors.customOnSuccessContainer
                        : theme.colors.customOnErrorContainer,
                    }}
                  >
                    {transaction.expenseType} • {transaction.subExpenseType}
                  </Text>
                </Surface>

                <View style={{ gap: 2 }}>
                  <DetailRow
                    label="Transaction ID"
                    value={`#${transaction.id}`}
                  />
                  <DetailRow label="Party" value={transaction.toFrom} />
                  {transaction.toFromPhoneNumber ? (
                    <DetailRow
                      label="Phone"
                      value={transaction.toFromPhoneNumber}
                    />
                  ) : null}
                  <DetailRow
                    label="Type"
                    value={`${transaction.expenseType} (${transaction.subExpenseType})`}
                  />
                  <DetailRow
                    label="Updated"
                    value={formatFullDateTime(transaction.updatedAt)}
                  />
                  <DetailRow
                    label="Created"
                    value={formatFullDateTime(transaction.createdAt)}
                  />
                  {locationSummary ? (
                    <DetailRow label="Location" value={locationSummary} />
                  ) : null}
                </View>

                {isCredit ? (
                  <>
                    <Divider />
                    <View style={{ gap: 2 }}>
                      <Text
                        variant="labelLarge"
                        style={{ marginBottom: 4, fontWeight: "700" }}
                      >
                        Credit & Interest Details
                      </Text>
                      <DetailRow
                        label="Principal"
                        value={`₹${indianNumberFormatter.format(breakdown.principal)}`}
                      />
                      <DetailRow
                        label="Interest Type"
                        value={
                          transaction.interestType &&
                          transaction.interestType !== "None"
                            ? `${transaction.interestType} (${transaction.interestRate ?? 0}% p.a., ${transaction.interestTime ?? 1}y${transaction.interestType === "Compound" && transaction.compoundingFrequency ? `, ${transaction.compoundingFrequency}` : ""})`
                            : "None"
                        }
                      />
                      {breakdown.interestAmount > 0 ? (
                        <DetailRow
                          label="Interest Amount"
                          value={`₹${indianNumberFormatter.format(breakdown.interestAmount)}`}
                        />
                      ) : null}
                      <DetailRow
                        label="Paid"
                        value={`₹${indianNumberFormatter.format(breakdown.paidAmount)}`}
                        valueColor={theme.colors.customSuccess}
                      />
                      <DetailRow
                        label="Remaining"
                        value={`₹${indianNumberFormatter.format(breakdown.remainingAmount)}`}
                        valueColor={
                          breakdown.remainingAmount > 0
                            ? theme.colors.customError
                            : theme.colors.customSuccess
                        }
                      />
                    </View>
                  </>
                ) : null}

                <Divider />
                <View style={{ gap: 6 }}>
                  <Text variant="labelLarge" style={{ fontWeight: "700" }}>
                    Items Breakdown ({transaction.amount.length})
                  </Text>
                  {transaction.amount.map((entry, idx) => (
                    <View
                      key={`${transaction.id}-entry-${idx}`}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <Text
                        variant="bodySmall"
                        style={{
                          flex: 1,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {entry.title || `Item ${idx + 1}`}
                      </Text>
                      <Text variant="bodySmall" style={{ fontWeight: "600" }}>
                        ₹{indianNumberFormatter.format(entry.amount)}
                      </Text>
                    </View>
                  ))}
                </View>

                <Divider />
                <View style={{ gap: 6 }}>
                  <Text variant="labelLarge" style={{ fontWeight: "700" }}>
                    Categories / Tags
                  </Text>
                  {transaction.tags && transaction.tags.length > 0 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {transaction.tags.map((tag) => (
                        <Chip key={tag} compact>
                          {tag}
                        </Chip>
                      ))}
                    </View>
                  ) : (
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      No categories/tags assigned
                    </Text>
                  )}
                </View>

                <Divider />
                <View style={{ gap: 4 }}>
                  <Text variant="labelLarge" style={{ fontWeight: "700" }}>
                    Notes
                  </Text>
                  <Text
                    testID="transaction-detail-note"
                    variant="bodySmall"
                    selectable
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {transaction.note?.trim() || "No notes provided"}
                  </Text>
                </View>
              </View>
            </ScrollView>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            testID="transaction-detail-dismiss-btn"
            mode="contained-tonal"
            icon="arrow-left"
            onPress={onDismiss}
          >
            Back to Summary
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
