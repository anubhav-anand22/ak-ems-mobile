import type { SubExpenseType } from "@/constants/expense";
import type { TransactionType } from "@/db";
import { getTotalAmount } from "./getTotalAmount";
import { parseUnixTimestampSeconds } from "./userTransactionsUtils";

export type SubExpenseSummary = {
  totalAmount: number;
  count: number;
  percentageOfVolume: number;
};

export type ToFromSummaryItem = {
  name: string;
  phoneNumber: string | null;
  totalAmount: number;
  sendAmount: number;
  receiveAmount: number;
  lendAmount: number;
  borrowAmount: number;
  transactionCount: number;
  netBalance: number; // (receive + borrow) - (send + lend)
};

export type TimeDataPoint = {
  id: number;
  value: number; // amount
  date: Date;
  timeLabel: string;
  fullDateLabel: string;
  subExpenseType: SubExpenseType;
  toFrom: string;
  title: string;
};

export type TimeOfDayBucket = {
  period: "Morning" | "Afternoon" | "Evening" | "Night";
  label: string;
  count: number;
  totalAmount: number;
};

export type SelectedTransactionsAnalysis = {
  totalCount: number;
  totalGrossVolume: number;
  netCashFlow: number;
  averageAmount: number;
  highestTransaction: {
    amount: number;
    title: string;
    toFrom: string;
    subExpenseType: SubExpenseType;
  } | null;

  // 1. By SubExpenseType
  send: SubExpenseSummary;
  receive: SubExpenseSummary;
  lend: SubExpenseSummary;
  borrow: SubExpenseSummary;

  // 2. By ToFrom
  toFromCount: number;
  toFromList: ToFromSummaryItem[];

  // 3. Time Series & Distribution
  chronologicalTransactions: TimeDataPoint[];
  timeOfDayDistribution: TimeOfDayBucket[];
  oldestDate: Date | null;
  newestDate: Date | null;
};

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export function getTimeOfDayPeriod(hour: number): "Morning" | "Afternoon" | "Evening" | "Night" {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export function formatTimeShort(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours}:${minutes}${ampm}`;
}

export function formatDateShort(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function calculateSelectedTransactionsSummary(
  transactions: TransactionType[],
): SelectedTransactionsAnalysis {
  let sendTotal = 0;
  let sendCount = 0;
  let receiveTotal = 0;
  let receiveCount = 0;
  let lendTotal = 0;
  let lendCount = 0;
  let borrowTotal = 0;
  let borrowCount = 0;

  const toFromMap = new Map<
    string,
    {
      name: string;
      phoneNumber: string | null;
      sendAmount: number;
      receiveAmount: number;
      lendAmount: number;
      borrowAmount: number;
      transactionCount: number;
    }
  >();

  const morningBucket = { period: "Morning" as const, label: "Morning (5am-12pm)", count: 0, totalAmount: 0 };
  const afternoonBucket = { period: "Afternoon" as const, label: "Afternoon (12pm-5pm)", count: 0, totalAmount: 0 };
  const eveningBucket = { period: "Evening" as const, label: "Evening (5pm-9pm)", count: 0, totalAmount: 0 };
  const nightBucket = { period: "Night" as const, label: "Night (9pm-5am)", count: 0, totalAmount: 0 };

  let highestTx: {
    amount: number;
    title: string;
    toFrom: string;
    subExpenseType: SubExpenseType;
  } | null = null;

  const timeDataPoints: TimeDataPoint[] = [];

  for (const tx of transactions) {
    const amount = round2(getTotalAmount(tx));
    const subType = tx.subExpenseType;

    // Track highest transaction
    if (!highestTx || amount > highestTx.amount) {
      const firstItemTitle = tx.amount?.[0]?.title || tx.note || subType;
      highestTx = {
        amount,
        title: firstItemTitle,
        toFrom: tx.toFrom,
        subExpenseType: subType,
      };
    }

    // SubExpenseType aggregates
    switch (subType) {
      case "Send":
        sendTotal += amount;
        sendCount++;
        break;
      case "Receive":
        receiveTotal += amount;
        receiveCount++;
        break;
      case "Lend":
        lendTotal += amount;
        lendCount++;
        break;
      case "Borrow":
        borrowTotal += amount;
        borrowCount++;
        break;
    }

    // ToFrom grouping
    const personKey = (tx.toFrom || "Unknown").trim().toLowerCase();
    const displayName = (tx.toFrom || "Unknown").trim();
    const existing = toFromMap.get(personKey) || {
      name: displayName,
      phoneNumber: tx.toFromPhoneNumber || null,
      sendAmount: 0,
      receiveAmount: 0,
      lendAmount: 0,
      borrowAmount: 0,
      transactionCount: 0,
    };

    existing.transactionCount++;
    if (!existing.phoneNumber && tx.toFromPhoneNumber) {
      existing.phoneNumber = tx.toFromPhoneNumber;
    }

    switch (subType) {
      case "Send":
        existing.sendAmount += amount;
        break;
      case "Receive":
        existing.receiveAmount += amount;
        break;
      case "Lend":
        existing.lendAmount += amount;
        break;
      case "Borrow":
        existing.borrowAmount += amount;
        break;
    }
    toFromMap.set(personKey, existing);

    // Date & Time parsing
    const txDate = parseUnixTimestampSeconds(tx.createdAt);
    const hour = txDate.getHours();
    const period = getTimeOfDayPeriod(hour);

    switch (period) {
      case "Morning":
        morningBucket.count++;
        morningBucket.totalAmount += amount;
        break;
      case "Afternoon":
        afternoonBucket.count++;
        afternoonBucket.totalAmount += amount;
        break;
      case "Evening":
        eveningBucket.count++;
        eveningBucket.totalAmount += amount;
        break;
      case "Night":
        nightBucket.count++;
        nightBucket.totalAmount += amount;
        break;
    }

    const firstTitle = tx.amount?.[0]?.title || tx.note || `${subType} to ${tx.toFrom}`;
    timeDataPoints.push({
      id: tx.id,
      value: amount,
      date: txDate,
      timeLabel: formatTimeShort(txDate),
      fullDateLabel: `${formatDateShort(txDate)}, ${formatTimeShort(txDate)}`,
      subExpenseType: subType,
      toFrom: tx.toFrom,
      title: firstTitle,
    });
  }

  // Sort chronological data points ascending by date
  timeDataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

  sendTotal = round2(sendTotal);
  receiveTotal = round2(receiveTotal);
  lendTotal = round2(lendTotal);
  borrowTotal = round2(borrowTotal);

  const totalGrossVolume = round2(sendTotal + receiveTotal + lendTotal + borrowTotal);
  const netCashFlow = round2((receiveTotal + borrowTotal) - (sendTotal + lendTotal));
  const totalCount = transactions.length;
  const averageAmount = totalCount > 0 ? round2(totalGrossVolume / totalCount) : 0;

  const sendPercent = totalGrossVolume > 0 ? round2((sendTotal / totalGrossVolume) * 100) : 0;
  const receivePercent = totalGrossVolume > 0 ? round2((receiveTotal / totalGrossVolume) * 100) : 0;
  const lendPercent = totalGrossVolume > 0 ? round2((lendTotal / totalGrossVolume) * 100) : 0;
  const borrowPercent = totalGrossVolume > 0 ? round2((borrowTotal / totalGrossVolume) * 100) : 0;

  // Build sorted ToFrom list
  const toFromList: ToFromSummaryItem[] = Array.from(toFromMap.values())
    .map((item) => {
      const s = round2(item.sendAmount);
      const r = round2(item.receiveAmount);
      const l = round2(item.lendAmount);
      const b = round2(item.borrowAmount);
      const total = round2(s + r + l + b);
      const net = round2((r + b) - (s + l));
      return {
        name: item.name,
        phoneNumber: item.phoneNumber,
        totalAmount: total,
        sendAmount: s,
        receiveAmount: r,
        lendAmount: l,
        borrowAmount: b,
        transactionCount: item.transactionCount,
        netBalance: net,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const timeOfDayDistribution: TimeOfDayBucket[] = [
    { ...morningBucket, totalAmount: round2(morningBucket.totalAmount) },
    { ...afternoonBucket, totalAmount: round2(afternoonBucket.totalAmount) },
    { ...eveningBucket, totalAmount: round2(eveningBucket.totalAmount) },
    { ...nightBucket, totalAmount: round2(nightBucket.totalAmount) },
  ];

  const oldestDate = timeDataPoints.length > 0 ? timeDataPoints[0].date : null;
  const newestDate = timeDataPoints.length > 0 ? timeDataPoints[timeDataPoints.length - 1].date : null;

  return {
    totalCount,
    totalGrossVolume,
    netCashFlow,
    averageAmount,
    highestTransaction: highestTx,
    send: {
      totalAmount: sendTotal,
      count: sendCount,
      percentageOfVolume: sendPercent,
    },
    receive: {
      totalAmount: receiveTotal,
      count: receiveCount,
      percentageOfVolume: receivePercent,
    },
    lend: {
      totalAmount: lendTotal,
      count: lendCount,
      percentageOfVolume: lendPercent,
    },
    borrow: {
      totalAmount: borrowTotal,
      count: borrowCount,
      percentageOfVolume: borrowPercent,
    },
    toFromCount: toFromList.length,
    toFromList,
    chronologicalTransactions: timeDataPoints,
    timeOfDayDistribution,
    oldestDate,
    newestDate,
  };
}

/**
 * Calculates a round, visually pleasing maximum value for chart axes
 * with ~25% headroom so that top-of-bar labels/indicators are never clipped.
 */
export function getNiceMaxValue(maxVal: number, noOfSections: number = 4): number {
  if (maxVal <= 0) return 100;
  const rawTarget = maxVal * 1.25;
  const roughStep = rawTarget / noOfSections;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let niceNormalized = 1;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  const step = niceNormalized * magnitude;
  return Math.max(step * noOfSections, Math.ceil(rawTarget));
}

