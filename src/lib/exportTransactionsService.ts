import * as Sharing from "expo-sharing";
import {
  ExportFormat,
  generateExportFilename,
  transactionsToCsv,
  transactionsToExcelBase64,
  transactionsToJson,
} from "./exportTransactionsFormat";
import type { TransactionType } from "@/db";
import { log } from "./log";

export type ExportTransactionsOptions = {
  transactions: TransactionType[];
  format: ExportFormat;
  scope?: string;
  toFrom?: string;
  filenamePrefix?: string;
};

export type ExportResult =
  | {
      success: true;
      filename: string;
      filePath: string;
      shared: boolean;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Serializes transactions into the desired format (xlsx, csv, json),
 * saves the file into the internal cache directory, and invokes
 * the native system share sheet (expo-sharing).
 */
export async function exportTransactionsToFile(
  options: ExportTransactionsOptions,
): Promise<ExportResult> {
  const { transactions, format, scope, toFrom } = options;

  if (!transactions) {
    return { success: false, error: "No transactions provided for export" };
  }

  try {
    const filename = generateExportFilename({
      format,
      scope,
      toFrom,
    });

    // Lazy require RNFS to protect non-native test environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNFS = require("react-native-fs");
    const cacheDir = RNFS.CachesDirectoryPath;
    const filePath = `${cacheDir}/${filename}`;

    if (format === "xlsx") {
      const base64Data = transactionsToExcelBase64(transactions);
      await RNFS.writeFile(filePath, base64Data, "base64");
    } else if (format === "csv") {
      const csvData = transactionsToCsv(transactions);
      await RNFS.writeFile(filePath, csvData, "utf8");
    } else if (format === "json") {
      const jsonData = transactionsToJson(transactions, { scope });
      await RNFS.writeFile(filePath, jsonData, "utf8");
    }

    const mimeTypes: Record<ExportFormat, string> = {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
      json: "application/json",
    };

    let shared = false;
    const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);
    if (isSharingAvailable) {
      const fileUri = filePath.startsWith("file://")
        ? filePath
        : `file://${filePath}`;

      await Sharing.shareAsync(fileUri, {
        mimeType: mimeTypes[format],
        dialogTitle: `Export Transactions (${format.toUpperCase()})`,
        UTI: format === "xlsx" ? "com.microsoft.excel.xlsx" : undefined,
      });
      shared = true;
    }

    log.info(
      `Exported ${transactions.length} transactions as ${format} to ${filePath}`,
    );

    return {
      success: true,
      filename,
      filePath,
      shared,
    };
  } catch (err: any) {
    log.error("Failed to export transactions", err);
    return {
      success: false,
      error: err?.message || "Failed to export transactions",
    };
  }
}
