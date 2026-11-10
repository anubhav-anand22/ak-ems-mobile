import type { TransactionType } from "@/db/schema";
import { getTotalAmountWithExtraData } from "./getTotalAmount";

export type SqlUserExpenseAggregate = {
  totalCount: number;
  simpleSendTotal: number;
  simpleReceiveTotal: number;
};

export type UserSummaryStats = {
  totalCount: number;
  totalExpense: number;
  simpleReceiveTotal: number;
  totalCredit: number;
  creditLendTotal: number;
  creditBorrowTotal: number;
  remainingToReceive: number;
  remainingToPay: number;
  netCreditBalance: number;
};

export type TransactionAmountBreakdown = {
  principal: number;
  interestAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

const roundCurrency = (value: number): number =>
  Number((Number.isFinite(value) ? value : 0).toFixed(2));

export const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const parseUnixTimestampSeconds = (
  value: number | Date | string | null | undefined,
): Date => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0) : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return new Date(asNumber * 1000);
    }
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  return new Date(0);
};

export const summarizeUserCreditTransactions = (
  creditTxs: TransactionType[],
) => {
  let creditLendTotal = 0;
  let creditBorrowTotal = 0;
  let remainingToReceive = 0;
  let remainingToPay = 0;

  for (const tx of creditTxs) {
    if (tx.expenseType !== "Credit") continue;
    const { totalAmount } = getTotalAmountWithExtraData(tx);
    const paid = tx.creditPayment ?? 0;
    const remaining = Math.max(0, totalAmount - paid);

    if (tx.subExpenseType === "Lend") {
      creditLendTotal += totalAmount;
      remainingToReceive += remaining;
    } else if (tx.subExpenseType === "Borrow") {
      creditBorrowTotal += totalAmount;
      remainingToPay += remaining;
    }
  }

  return {
    creditLendTotal: roundCurrency(creditLendTotal),
    creditBorrowTotal: roundCurrency(creditBorrowTotal),
    remainingToReceive: roundCurrency(remainingToReceive),
    remainingToPay: roundCurrency(remainingToPay),
  };
};

export const buildUserSummaryStats = (
  sqlAggregate: SqlUserExpenseAggregate,
  creditTxs: TransactionType[],
): UserSummaryStats => {
  const creditSummary = summarizeUserCreditTransactions(creditTxs);
  const totalExpense = roundCurrency(sqlAggregate.simpleSendTotal);
  const simpleReceiveTotal = roundCurrency(sqlAggregate.simpleReceiveTotal);
  const totalCredit = roundCurrency(
    creditSummary.creditLendTotal + creditSummary.creditBorrowTotal,
  );
  const netCreditBalance = roundCurrency(
    creditSummary.remainingToReceive - creditSummary.remainingToPay,
  );

  return {
    totalCount: Math.max(0, Math.trunc(sqlAggregate.totalCount)),
    totalExpense,
    simpleReceiveTotal,
    totalCredit,
    creditLendTotal: creditSummary.creditLendTotal,
    creditBorrowTotal: creditSummary.creditBorrowTotal,
    remainingToReceive: creditSummary.remainingToReceive,
    remainingToPay: creditSummary.remainingToPay,
    netCreditBalance,
  };
};

export const getTransactionAmountBreakdown = (
  tx: TransactionType,
): TransactionAmountBreakdown => {
  const details = getTotalAmountWithExtraData(tx);
  const paidAmount =
    tx.expenseType === "Credit" ? roundCurrency(tx.creditPayment ?? 0) : 0;
  const remainingAmount =
    tx.expenseType === "Credit"
      ? roundCurrency(Math.max(0, details.totalAmount - paidAmount))
      : 0;

  return {
    principal: details.principal,
    interestAmount: details.interestAmount,
    totalAmount: details.totalAmount,
    paidAmount,
    remainingAmount,
  };
};

export const getTransactionDisplaySummary = (tx: TransactionType): string => {
  const titles = (tx.amount ?? [])
    .map((item) => item.title?.trim())
    .filter((title): title is string => Boolean(title));
  const note = tx.note?.trim();

  if (titles.length > 0 && note) {
    return `${titles.join(", ")} — ${note}`;
  }
  if (titles.length > 0) {
    return titles.join(", ");
  }
  if (note) {
    return note;
  }
  if (tx.tags && tx.tags.length > 0) {
    return tx.tags.join(", ");
  }
  return tx.subExpenseType;
};

const fullDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const formatFullDateTime = (date: Date): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return fullDateTimeFormatter.format(date);
};
