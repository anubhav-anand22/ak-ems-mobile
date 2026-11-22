import * as XLSX from "xlsx";
import type { TransactionType } from "@/db";
import { getTotalAmountWithExtraData } from "./getTotalAmount";

export type ExportFormat = "xlsx" | "csv" | "json";

export type FormattedTransactionRow = {
  ID: number;
  Date: string;
  Type: string;
  "Sub Type": string;
  "To / From": string;
  "Phone Number": string;
  "Total Amount": number;
  "Principal Amount": number;
  "Interest Amount": number;
  "Interest Type": string;
  "Interest Rate (%)": number;
  "Interest Time (Years)": number;
  "Compounding Frequency": string;
  Note: string;
  Tags: string;
  "Items Breakdown": string;
  "Credit Payment ID": string;
  Location: string;
  "Created At": string;
  "Updated At": string;
};

/**
 * Transforms a single TransactionType entity into a structured flat object
 * suitable for spreadsheets, tabular viewers, and reporting.
 */
export function formatTransactionRow(t: TransactionType): FormattedTransactionRow {
  const amountData = getTotalAmountWithExtraData(t);

  const dateStr =
    t.updatedAt instanceof Date
      ? t.updatedAt.toISOString().replace("T", " ").substring(0, 19)
      : String(t.updatedAt || "");

  const createdStr =
    t.createdAt instanceof Date
      ? t.createdAt.toISOString()
      : String(t.createdAt || "");

  const updatedStr =
    t.updatedAt instanceof Date
      ? t.updatedAt.toISOString()
      : String(t.updatedAt || "");

  const itemsBreakdown = Array.isArray(t.amount)
    ? t.amount
        .map((a) => `${a.title ? a.title + ": " : ""}₹${a.amount}`)
        .join("; ")
    : "";

  const locAny = t.location as any;
  const locationStr = t.location
    ? `${locAny.latitude ?? locAny.lat ?? ""}, ${locAny.longitude ?? locAny.lon ?? ""}${t.location.city ? ` (${t.location.city})` : ""}`.trim()
    : "";

  return {
    ID: t.id,
    Date: dateStr,
    Type: t.expenseType,
    "Sub Type": t.subExpenseType,
    "To / From": t.toFrom || "",
    "Phone Number": t.toFromPhoneNumber || "",
    "Total Amount": amountData.totalAmount,
    "Principal Amount": amountData.principal,
    "Interest Amount": amountData.interestAmount,
    "Interest Type": t.interestType || "None",
    "Interest Rate (%)": t.interestRate ?? 0,
    "Interest Time (Years)": t.interestTime ?? 0,
    "Compounding Frequency": t.compoundingFrequency || "",
    Note: t.note || "",
    Tags: Array.isArray(t.tags) ? t.tags.join(", ") : "",
    "Items Breakdown": itemsBreakdown,
    "Credit Payment ID": t.creditPayment != null ? String(t.creditPayment) : "",
    Location: locationStr,
    "Created At": createdStr,
    "Updated At": updatedStr,
  };
}

/**
 * Converts transactions into RFC 4180 standard CSV text with escaped strings.
 */
export function transactionsToCsv(transactions: TransactionType[]): string {
  if (!transactions || transactions.length === 0) {
    return "";
  }
  const rows = transactions.map(formatTransactionRow);
  const headers = Object.keys(rows[0]) as (keyof FormattedTransactionRow)[];

  const escapeCsvCell = (val: any): string => {
    if (val == null) return "";
    const str = String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCsvCell).join(","));

  for (const row of rows) {
    csvLines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }

  return csvLines.join("\r\n");
}

/**
 * Converts transactions into a structured JSON string with metadata.
 * Compatible with the app's backup & import format.
 */
export function transactionsToJson(
  transactions: TransactionType[],
  options?: { scope?: string },
): string {
  const exportPayload = {
    timestamp: new Date().toISOString(),
    count: transactions.length,
    scope: options?.scope || "transactions",
    transactions,
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Converts transactions into an Excel (.xlsx) file encoded as a base64 string.
 */
export function transactionsToExcelBase64(
  transactions: TransactionType[],
): string {
  const rows =
    transactions && transactions.length > 0
      ? transactions.map(formatTransactionRow)
      : [
          {
            ID: 0,
            Date: "",
            Type: "",
            "Sub Type": "",
            "To / From": "",
            "Phone Number": "",
            "Total Amount": 0,
            "Principal Amount": 0,
            "Interest Amount": 0,
            "Interest Type": "",
            "Interest Rate (%)": 0,
            "Interest Time (Years)": 0,
            "Compounding Frequency": "",
            Note: "",
            Tags: "",
            "Items Breakdown": "",
            "Credit Payment ID": "",
            Location: "",
            "Created At": "",
            "Updated At": "",
          },
        ];

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-calculate column widths
  const headers = Object.keys(rows[0]);
  const colWidths = headers.map((key) => {
    let maxLen = key.length;
    for (const r of rows) {
      const cellVal = String((r as any)[key] ?? "");
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

/**
 * Sanitizes characters in a string for safe filesystem filename generation.
 */
export function sanitizeFilenamePart(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").trim();
}

/**
 * Generates human-readable, timestamped filenames for exports.
 */
export function generateExportFilename(options: {
  format: ExportFormat;
  scope?: string;
  toFrom?: string;
  date?: Date;
}): string {
  const { format, scope, toFrom, date = new Date() } = options;
  const dateStr = date.toISOString().split("T")[0];
  let prefix = "transactions";

  if (toFrom) {
    const safeToFrom = sanitizeFilenamePart(toFrom) || "person";
    prefix = `transactions_${safeToFrom}`;
  } else if (scope) {
    const safeScope = sanitizeFilenamePart(scope) || "export";
    prefix = `transactions_${safeScope}`;
  }

  return `${prefix}_${dateStr}.${format}`;
}
