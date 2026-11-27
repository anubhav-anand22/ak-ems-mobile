import type { SubExpenseType } from "@/constants/expense";
import type { WalletAllocation, WalletType } from "@/db/schema";

const VALID_DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export const roundWalletMoney = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const isOutgoingSubExpense = (subExpenseType: SubExpenseType): boolean =>
  subExpenseType === "Send" || subExpenseType === "Lend";

export const getWalletDeltaSign = (subExpenseType: SubExpenseType): 1 | -1 =>
  isOutgoingSubExpense(subExpenseType) ? -1 : 1;

export type WalletFormInput = {
  name: string;
  currentBalance?: string;
  minBalance?: string;
  maxBalance?: string;
};

export type WalletFormErrors = {
  name?: string;
  currentBalance?: string;
  minBalance?: string;
  maxBalance?: string;
};

export type NormalizedWalletValues = {
  name: string;
  currentBalance: number;
  minBalance: number | null;
  maxBalance: number | null;
};

export type WalletValidationResult =
  | {
      isValid: true;
      values: NormalizedWalletValues;
      warnings: string[];
      errors: WalletFormErrors;
    }
  | {
      isValid: false;
      errors: WalletFormErrors;
    };

export const getWalletBoundsWarnings = (params: {
  walletName: string;
  balance: number;
  minBalance: number | null;
  maxBalance: number | null;
}): string[] => {
  const warnings: string[] = [];
  const safeBalance = roundWalletMoney(params.balance);
  if (
    params.minBalance !== null &&
    Number.isFinite(params.minBalance) &&
    safeBalance < params.minBalance
  ) {
    warnings.push(
      `${params.walletName}: balance (₹${safeBalance}) is below min limit (₹${params.minBalance}).`,
    );
  }
  if (
    params.maxBalance !== null &&
    Number.isFinite(params.maxBalance) &&
    safeBalance > params.maxBalance
  ) {
    warnings.push(
      `${params.walletName}: balance (₹${safeBalance}) exceeds max limit (₹${params.maxBalance}).`,
    );
  }
  return warnings;
};

const parseOptionalNonNegativeDecimal = (
  raw: string | undefined,
): { provided: boolean; value: number | null; valid: boolean } => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { provided: false, value: null, valid: true };
  }
  if (!VALID_DECIMAL_PATTERN.test(trimmed)) {
    return { provided: true, value: null, valid: false };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    return { provided: true, value: null, valid: false };
  }
  return { provided: true, value: roundWalletMoney(num), valid: true };
};

export const validateWalletInput = (
  input: WalletFormInput,
): WalletValidationResult => {
  const errors: WalletFormErrors = {};
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    errors.name = "Wallet name is required.";
  }

  const parsedCurrent = parseOptionalNonNegativeDecimal(input.currentBalance);
  if (!parsedCurrent.valid) {
    errors.currentBalance = "Enter a valid non-negative balance.";
  }

  const parsedMin = parseOptionalNonNegativeDecimal(input.minBalance);
  if (!parsedMin.valid) {
    errors.minBalance = "Enter a valid non-negative minimum balance.";
  }

  const parsedMax = parseOptionalNonNegativeDecimal(input.maxBalance);
  if (!parsedMax.valid) {
    errors.maxBalance = "Enter a valid non-negative maximum balance.";
  }

  const currentBalance = parsedCurrent.provided
    ? (parsedCurrent.value ?? 0)
    : 0;
  const minBalance = parsedMin.value;
  const maxBalance = parsedMax.value;

  if (
    parsedMin.valid &&
    parsedMax.valid &&
    minBalance !== null &&
    maxBalance !== null &&
    maxBalance < minBalance
  ) {
    errors.maxBalance =
      "Max balance must be greater than or equal to min balance.";
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  const warnings = getWalletBoundsWarnings({
    walletName: trimmedName,
    balance: currentBalance,
    minBalance,
    maxBalance,
  });

  return {
    isValid: true,
    values: {
      name: trimmedName,
      currentBalance,
      minBalance,
      maxBalance,
    },
    warnings,
    errors: {},
  };
};

export type WalletAdjustmentAction = "add" | "subtract";

export type WalletAdjustmentValidationResult =
  | {
      isValid: true;
      amount: number;
      nextBalance: number;
      warnings: string[];
    }
  | {
      isValid: false;
      error: string;
    };

export const validateWalletAdjustmentInput = (params: {
  amountText: string;
  action: WalletAdjustmentAction;
  wallet: Pick<WalletType, "name" | "currentBalance" | "minBalance" | "maxBalance">;
}): WalletAdjustmentValidationResult => {
  const trimmed = params.amountText.trim();
  if (!trimmed || !VALID_DECIMAL_PATTERN.test(trimmed)) {
    return { isValid: false, error: "Enter a valid amount greater than 0." };
  }
  const amount = roundWalletMoney(Number(trimmed));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { isValid: false, error: "Amount must be greater than 0." };
  }

  const currentBalance = roundWalletMoney(params.wallet.currentBalance);
  if (params.action === "subtract" && amount > currentBalance) {
    return {
      isValid: false,
      error: `Insufficient balance in ${params.wallet.name} (Available: ₹${currentBalance}).`,
    };
  }

  const nextBalance = roundWalletMoney(
    currentBalance + (params.action === "add" ? amount : -amount),
  );
  const warnings = getWalletBoundsWarnings({
    walletName: params.wallet.name,
    balance: nextBalance,
    minBalance: params.wallet.minBalance ?? null,
    maxBalance: params.wallet.maxBalance ?? null,
  });

  return {
    isValid: true,
    amount,
    nextBalance,
    warnings,
  };
};

export type WalletTransferValidationResult =
  | {
      isValid: true;
      amount: number;
      nextFromBalance: number;
      nextToBalance: number;
      warnings: string[];
    }
  | {
      isValid: false;
      error: string;
    };

export const validateWalletTransferInput = (params: {
  fromWallet: Pick<
    WalletType,
    "id" | "name" | "currentBalance" | "minBalance" | "maxBalance"
  > | null;
  toWallet: Pick<
    WalletType,
    "id" | "name" | "currentBalance" | "minBalance" | "maxBalance"
  > | null;
  amountText: string;
}): WalletTransferValidationResult => {
  if (!params.fromWallet) {
    return { isValid: false, error: "Select a source wallet." };
  }
  if (!params.toWallet) {
    return { isValid: false, error: "Select a destination wallet." };
  }
  if (params.fromWallet.id === params.toWallet.id) {
    return {
      isValid: false,
      error: "Source and destination wallets must be different.",
    };
  }

  const trimmed = params.amountText.trim();
  if (!trimmed || !VALID_DECIMAL_PATTERN.test(trimmed)) {
    return { isValid: false, error: "Enter a valid amount greater than 0." };
  }
  const amount = roundWalletMoney(Number(trimmed));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { isValid: false, error: "Amount must be greater than 0." };
  }

  const fromCurrent = roundWalletMoney(params.fromWallet.currentBalance);
  if (amount > fromCurrent) {
    return {
      isValid: false,
      error: `Insufficient balance in ${params.fromWallet.name} (Available: ₹${fromCurrent}).`,
    };
  }

  const nextFromBalance = roundWalletMoney(fromCurrent - amount);
  const nextToBalance = roundWalletMoney(
    roundWalletMoney(params.toWallet.currentBalance) + amount,
  );

  const warnings = [
    ...getWalletBoundsWarnings({
      walletName: params.fromWallet.name,
      balance: nextFromBalance,
      minBalance: params.fromWallet.minBalance ?? null,
      maxBalance: params.fromWallet.maxBalance ?? null,
    }),
    ...getWalletBoundsWarnings({
      walletName: params.toWallet.name,
      balance: nextToBalance,
      minBalance: params.toWallet.minBalance ?? null,
      maxBalance: params.toWallet.maxBalance ?? null,
    }),
  ];

  return {
    isValid: true,
    amount,
    nextFromBalance,
    nextToBalance,
    warnings,
  };
};

/**
 * Computes greedy auto-split amounts across selected wallets in selection order:
 * - First wallet: Min(currentBalance_A, totalAmount)
 * - Next wallet: Min(currentBalance_B, remaining)
 */
export const computeGreedyWalletSplit = (
  selectedWallets: Pick<WalletType, "id" | "currentBalance">[],
  totalAmount: number,
): WalletAllocation[] => {
  let remaining = Math.max(0, roundWalletMoney(totalAmount));
  return selectedWallets.map((wallet) => {
    const available = Math.max(0, roundWalletMoney(wallet.currentBalance));
    const allocated = roundWalletMoney(Math.min(available, remaining));
    remaining = roundWalletMoney(Math.max(0, remaining - allocated));
    return {
      walletId: wallet.id,
      amount: allocated,
    };
  });
};

export type WalletTransactionValidationResult =
  | {
      isValid: true;
      allocations: WalletAllocation[];
      warnings: string[];
    }
  | {
      isValid: false;
      error: string;
    };

export const validateWalletAllocationsForTransaction = (params: {
  wallets: WalletType[];
  selectedWalletIds: number[];
  isMultiWallet: boolean;
  splitAmountsById: Record<number, string>;
  totalAmount: number;
  subExpenseType: SubExpenseType;
}): WalletTransactionValidationResult => {
  const {
    wallets,
    selectedWalletIds,
    isMultiWallet,
    splitAmountsById,
    totalAmount,
    subExpenseType,
  } = params;

  if (selectedWalletIds.length === 0) {
    return { isValid: true, allocations: [], warnings: [] };
  }

  const targetTotal = roundWalletMoney(totalAmount);
  if (targetTotal <= 0) {
    return {
      isValid: false,
      error: "Transaction amount must be greater than 0 to allocate to a wallet.",
    };
  }

  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const outgoing = isOutgoingSubExpense(subExpenseType);
  const sign = getWalletDeltaSign(subExpenseType);

  let rawAllocations: WalletAllocation[] = [];

  if (!isMultiWallet) {
    const walletId = selectedWalletIds[0];
    const wallet = walletMap.get(walletId);
    if (!wallet) {
      return { isValid: false, error: "Selected wallet no longer exists." };
    }
    rawAllocations = [{ walletId, amount: targetTotal }];
  } else {
    for (const walletId of selectedWalletIds) {
      if (!walletMap.has(walletId)) {
        return { isValid: false, error: "One of the selected wallets no longer exists." };
      }
      const raw = (splitAmountsById[walletId] ?? "").trim();
      if (raw === "") {
        rawAllocations.push({ walletId, amount: 0 });
        continue;
      }
      if (!VALID_DECIMAL_PATTERN.test(raw)) {
        const w = walletMap.get(walletId)!;
        return { isValid: false, error: `Invalid split amount for ${w.name}.` };
      }
      const parsed = roundWalletMoney(Number(raw));
      if (!Number.isFinite(parsed) || parsed < 0) {
        const w = walletMap.get(walletId)!;
        return { isValid: false, error: `Invalid split amount for ${w.name}.` };
      }
      rawAllocations.push({ walletId, amount: parsed });
    }

    const splitSum = roundWalletMoney(
      rawAllocations.reduce((acc, item) => acc + item.amount, 0),
    );
    if (Math.abs(splitSum - targetTotal) > 0.01) {
      return {
        isValid: false,
        error: `Split amounts total (₹${splitSum}) must equal transaction total (₹${targetTotal}).`,
      };
    }
  }

  const activeAllocations = rawAllocations.filter((a) => a.amount > 0);
  if (activeAllocations.length === 0) {
    return {
      isValid: false,
      error: "At least one selected wallet must have an amount greater than 0.",
    };
  }

  const warnings: string[] = [];

  if (outgoing) {
    const combinedAvailable = roundWalletMoney(
      selectedWalletIds.reduce((sum, id) => {
        const w = walletMap.get(id);
        return sum + Math.max(0, roundWalletMoney(w?.currentBalance ?? 0));
      }, 0),
    );
    if (combinedAvailable + 0.0001 < targetTotal) {
      return {
        isValid: false,
        error: `Insufficient wallet balance (Available: ₹${combinedAvailable}, Required: ₹${targetTotal}).`,
      };
    }
  }

  for (const alloc of activeAllocations) {
    const wallet = walletMap.get(alloc.walletId)!;
    const current = roundWalletMoney(wallet.currentBalance);
    if (outgoing && alloc.amount > current + 0.0001) {
      return {
        isValid: false,
        error: `Insufficient balance in ${wallet.name} (Available: ₹${current}, Required: ₹${alloc.amount}).`,
      };
    }
    const projected = roundWalletMoney(current + sign * alloc.amount);
    warnings.push(
      ...getWalletBoundsWarnings({
        walletName: wallet.name,
        balance: projected,
        minBalance: wallet.minBalance ?? null,
        maxBalance: wallet.maxBalance ?? null,
      }),
    );
  }

  return {
    isValid: true,
    allocations: activeAllocations,
    warnings,
  };
};

export type LinkedWalletDisplayItem = {
  walletId: number;
  amount: number;
  name: string;
};

/**
 * Resolves wallet names for a transaction's wallet allocations.
 */
export const getTransactionLinkedWallets = (
  walletAllocations: WalletAllocation[] | null | undefined,
  walletNameMap: ReadonlyMap<number, string>,
): LinkedWalletDisplayItem[] => {
  if (!Array.isArray(walletAllocations) || walletAllocations.length === 0) {
    return [];
  }
  return walletAllocations
    .map((alloc) => {
      const name = walletNameMap.get(alloc.walletId);
      if (!name) return null;
      return {
        walletId: alloc.walletId,
        amount: roundWalletMoney(alloc.amount),
        name,
      };
    })
    .filter((item): item is LinkedWalletDisplayItem => item !== null);
};

/**
 * Resolves the active default wallet ID when multiple wallets exist.
 * Returns null if fewer than 2 wallets exist or the configured ID is absent.
 */
export const resolveEffectiveDefaultWalletId = (
  wallets: Pick<WalletType, "id">[],
  storedDefaultWalletId: number | null | undefined,
): number | null => {
  if (wallets.length <= 1 || storedDefaultWalletId == null) {
    return null;
  }
  return wallets.some((w) => w.id === storedDefaultWalletId)
    ? storedDefaultWalletId
    : null;
};
