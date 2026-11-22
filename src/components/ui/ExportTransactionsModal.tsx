import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Icon,
  Portal,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import type { CustomPaperTheme } from "@/constants/paperTheme";
import type { TransactionType } from "@/db";
import {
  ExportFormat,
  sanitizeFilenamePart,
} from "@/lib/exportTransactionsFormat";
import { exportTransactionsToFile } from "@/lib/exportTransactionsService";
import { useGlobalState } from "@/lib/gState";

export type ExportTransactionsModalProps = {
  visible: boolean;
  onClose: () => void;
  transactions?: TransactionType[] | (() => Promise<TransactionType[]>);
  toFrom?: string | null;
  scope?: "all" | "selected" | "user" | string;
  title?: string;
};

type FormatOption = {
  format: ExportFormat;
  title: string;
  extension: string;
  description: string;
  icon: string;
  iconColor: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: "xlsx",
    title: "Excel Spreadsheet",
    extension: ".xlsx",
    description: "Formatted table with headers and financial breakdowns",
    icon: "file-excel",
    iconColor: "#2E7D32",
  },
  {
    format: "csv",
    title: "CSV Document",
    extension: ".csv",
    description: "Universal comma-separated format for Sheets & Excel",
    icon: "file-delimited",
    iconColor: "#1565C0",
  },
  {
    format: "json",
    title: "JSON Data File",
    extension: ".json",
    description: "Raw structured data compatible with app backup & import",
    icon: "code-json",
    iconColor: "#E65100",
  },
];

export function ExportTransactionsModal({
  visible,
  onClose,
  transactions,
  toFrom,
  scope = "all",
  title,
}: ExportTransactionsModalProps) {
  const theme = useTheme<CustomPaperTheme>();
  const setSnackbar = useGlobalState((s) => s.setSnackbar);

  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [txCount, setTxCount] = useState<number | null>(
    Array.isArray(transactions) ? transactions.length : null,
  );

  useEffect(() => {
    if (visible) {
      if (Array.isArray(transactions)) {
        setTxCount(transactions.length);
      } else if (typeof transactions === "function") {
        transactions()
          .then((res) => setTxCount(res.length))
          .catch(() => setTxCount(null));
      }
    } else {
      setLoadingFormat(null);
    }
  }, [visible, transactions]);

  const modalTitle =
    title ||
    (toFrom
      ? `Export: ${toFrom}`
      : scope === "selected"
        ? "Export Selected"
        : "Export Transactions");

  const subtitle = toFrom
    ? `Export transactions for ${toFrom}${txCount != null ? ` (${txCount} items)` : ""}`
    : scope === "selected"
      ? `Export ${txCount != null ? txCount : ""} selected transaction${txCount !== 1 ? "s" : ""}`
      : `Export all transactions${txCount != null ? ` (${txCount} items)` : ""}`;

  const handleSelectFormat = async (format: ExportFormat) => {
    if (loadingFormat) return;

    try {
      setLoadingFormat(format);

      let txList: TransactionType[] = [];
      if (Array.isArray(transactions)) {
        txList = transactions;
      } else if (typeof transactions === "function") {
        txList = await transactions();
      }

      if (!txList || txList.length === 0) {
        setSnackbar({
          message: "No transactions available to export.",
          type: "info",
        });
        onClose();
        return;
      }

      const result = await exportTransactionsToFile({
        transactions: txList,
        format,
        scope,
        toFrom: toFrom || undefined,
      });

      if (result.success) {
        setSnackbar({
          message: `Exported as ${result.filename}`,
          type: "success",
        });
        onClose();
      } else {
        setSnackbar({
          message: result.error || "Failed to export transactions.",
          type: "error",
        });
      }
    } catch (err: any) {
      setSnackbar({
        message: err?.message || "An unexpected error occurred during export.",
        type: "error",
      });
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <Portal>
      <Dialog
        testID="export-transactions-dialog"
        visible={visible}
        onDismiss={loadingFormat ? undefined : onClose}
        style={styles.dialog}
      >
        <Dialog.Title style={styles.title}>{modalTitle}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text
            variant="bodySmall"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>

          <View style={styles.optionsContainer}>
            {FORMAT_OPTIONS.map((opt) => {
              const isLoading = loadingFormat === opt.format;
              return (
                <Surface
                  key={opt.format}
                  elevation={1}
                  style={[
                    styles.optionSurface,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <TouchableRipple
                    testID={`export-option-${opt.format}`}
                    onPress={() => handleSelectFormat(opt.format)}
                    disabled={loadingFormat !== null}
                    style={styles.optionRipple}
                  >
                    <View style={styles.optionRow}>
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: `${opt.iconColor}18` },
                        ]}
                      >
                        <Icon source={opt.icon} size={28} color={opt.iconColor} />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <View style={styles.optionTitleRow}>
                          <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                            {opt.title}
                          </Text>
                          <Text
                            variant="labelSmall"
                            style={{
                              color: theme.colors.primary,
                              fontWeight: "600",
                            }}
                          >
                            {opt.extension}
                          </Text>
                        </View>
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                          numberOfLines={2}
                        >
                          {opt.description}
                        </Text>
                      </View>
                      {isLoading ? (
                        <ActivityIndicator
                          size={20}
                          color={theme.colors.primary}
                        />
                      ) : (
                        <Icon
                          source="chevron-right"
                          size={20}
                          color={theme.colors.onSurfaceVariant}
                        />
                      )}
                    </View>
                  </TouchableRipple>
                </Surface>
              );
            })}
          </View>
        </Dialog.Content>

        <Dialog.Actions>
          <Button
            testID="export-cancel-btn"
            onPress={onClose}
            disabled={loadingFormat !== null}
          >
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    marginHorizontal: 20,
  },
  title: {
    paddingBottom: 4,
    fontSize: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
  },
  optionSurface: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRipple: {
    padding: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
