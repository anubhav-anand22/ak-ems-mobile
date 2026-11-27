import type { SplitParticipant, SplitType } from "@/db/schema";

export type SplitDistributionMode = "equal" | "custom";

export const SPLITS_PAGE_SIZE = 10;

const VALID_DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export const roundSplitMoney = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export type SplitParticipantDraft = {
  id: string;
  name: string;
  phoneNumber?: string | null;
  splitType: SplitType;
  splitValue: number;
  isMe: boolean;
};

/**
 * Recalculates calculatedMoney and calculatedPercentage for all participants
 * given the current totalAmount.
 * - `money`: fixed monetary share (`calculatedMoney = splitValue`)
 * - `percentage`: percentage of `totalAmount` (`calculatedMoney = totalAmount * splitValue / 100`)
 * - `part`: proportional share of the remaining pool (`totalAmount - nonPartAllocated`)
 */
export function recalculateSplitParticipants(
  totalAmount: number,
  participants: SplitParticipantDraft[],
): SplitParticipant[] {
  const safeTotal = Math.max(0, roundSplitMoney(totalAmount));
  if (participants.length === 0) return [];

  let nonPartMoney = 0;
  let totalParts = 0;

  const fixedResults = participants.map((p) => {
    const val = Math.max(0, roundSplitMoney(p.splitValue));
    if (p.splitType === "money") {
      nonPartMoney = roundSplitMoney(nonPartMoney + val);
      const pct = safeTotal > 0 ? roundSplitMoney((val / safeTotal) * 100) : 0;
      return { money: val, percentage: pct };
    }
    if (p.splitType === "percentage") {
      const money = safeTotal > 0 ? roundSplitMoney((safeTotal * val) / 100) : 0;
      nonPartMoney = roundSplitMoney(nonPartMoney + money);
      return { money, percentage: val };
    }
    totalParts += p.splitValue > 0 ? p.splitValue : 0;
    return { money: 0, percentage: 0 };
  });

  const remainingPool = Math.max(0, roundSplitMoney(safeTotal - nonPartMoney));

  return participants.map((p, index) => {
    if (p.splitType === "part") {
      const shareMoney =
        totalParts > 0 && p.splitValue > 0
          ? roundSplitMoney((remainingPool * p.splitValue) / totalParts)
          : 0;
      const sharePct =
        safeTotal > 0 ? roundSplitMoney((shareMoney / safeTotal) * 100) : 0;
      return {
        ...p,
        phoneNumber: p.phoneNumber ?? null,
        calculatedMoney: shareMoney,
        calculatedPercentage: sharePct,
      };
    }

    return {
      ...p,
      phoneNumber: p.phoneNumber ?? null,
      calculatedMoney: fixedResults[index].money,
      calculatedPercentage: fixedResults[index].percentage,
    };
  });
}

/**
 * Recalculates participant shares according to the selected distribution mode:
 * - `"equal"`: splits `totalAmount` equally across all participants
 * - `"custom"`: uses each participant's `splitType` and `splitValue`
 */
export function recalculateSplitParticipantsForMode(
  totalAmount: number,
  participants: SplitParticipantDraft[],
  distributionMode: SplitDistributionMode,
): SplitParticipant[] {
  if (distributionMode === "equal") {
    const equalDrafts: SplitParticipantDraft[] = participants.map((p) => ({
      ...p,
      splitType: "part",
      splitValue: 1,
    }));
    return recalculateSplitParticipants(totalAmount, equalDrafts);
  }
  return recalculateSplitParticipants(totalAmount, participants);
}

export type ParticipantValidationResult =
  | {
      isValid: true;
      participant: SplitParticipant;
      recalculatedList: SplitParticipant[];
    }
  | {
      isValid: false;
      error: string;
    };

export function validateParticipantInput(params: {
  totalAmount: number;
  name: string;
  isMe: boolean;
  phoneNumber?: string | null;
  distributionMode?: SplitDistributionMode;
  splitType: SplitType;
  splitValueText: string;
  existingParticipants: SplitParticipant[];
  editingParticipantId?: string | null;
  newId?: string;
}): ParticipantValidationResult {
  const safeTotal = roundSplitMoney(params.totalAmount);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
    return { isValid: false, error: "Total amount must be greater than 0." };
  }

  const resolvedName = params.isMe ? "me" : params.name.trim();
  if (!resolvedName) {
    return { isValid: false, error: "Participant name is required." };
  }

  const isEqualMode = params.distributionMode === "equal";
  const effectiveSplitType: SplitType = isEqualMode ? "part" : params.splitType;

  let splitValue = 1;
  if (!isEqualMode) {
    const trimmedVal = params.splitValueText.trim();
    if (!trimmedVal || !VALID_DECIMAL_PATTERN.test(trimmedVal)) {
      return { isValid: false, error: "Enter a valid positive value." };
    }
    splitValue = Number(trimmedVal);
    if (!Number.isFinite(splitValue) || splitValue <= 0) {
      return { isValid: false, error: "Value must be greater than 0." };
    }

    if (effectiveSplitType === "percentage" && splitValue > 100) {
      return { isValid: false, error: "Percentage cannot exceed 100%." };
    }

    if (effectiveSplitType === "money" && splitValue > safeTotal + 0.0001) {
      return {
        isValid: false,
        error: `Amount cannot exceed total (₹${safeTotal}).`,
      };
    }
  }

  const candidateId =
    params.editingParticipantId || params.newId || `p_${Date.now()}`;
  const candidateDraft: SplitParticipantDraft = {
    id: candidateId,
    name: resolvedName,
    phoneNumber: params.phoneNumber?.trim() || null,
    splitType: effectiveSplitType,
    splitValue: roundSplitMoney(splitValue),
    isMe: params.isMe,
  };

  const withoutTarget = params.existingParticipants.filter(
    (p) => p.id !== params.editingParticipantId,
  );
  const nextDrafts: SplitParticipantDraft[] = params.editingParticipantId
    ? params.existingParticipants.map((p) =>
        p.id === params.editingParticipantId ? candidateDraft : p,
      )
    : [...withoutTarget, candidateDraft];

  // Ensure fixed (money + percentage) allocations do not exceed totalAmount
  if (!isEqualMode) {
    const fixedSum = nextDrafts.reduce((sum, p) => {
      if (p.splitType === "money") return roundSplitMoney(sum + p.splitValue);
      if (p.splitType === "percentage") {
        return roundSplitMoney(
          sum + roundSplitMoney((safeTotal * p.splitValue) / 100),
        );
      }
      return sum;
    }, 0);

    if (fixedSum > safeTotal + 0.01) {
      return {
        isValid: false,
        error: `Allocated total (₹${fixedSum}) exceeds split total (₹${safeTotal}).`,
      };
    }
  }

  const recalculatedList = recalculateSplitParticipantsForMode(
    safeTotal,
    nextDrafts,
    params.distributionMode ?? "custom",
  );
  const participant =
    recalculatedList.find((p) => p.id === candidateId) ?? recalculatedList[0];

  return {
    isValid: true,
    participant,
    recalculatedList,
  };
}

export function validateSplitSubmission(params: {
  totalAmount: number;
  participants: SplitParticipant[];
}): { isValid: true } | { isValid: false; error: string } {
  const safeTotal = roundSplitMoney(params.totalAmount);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
    return { isValid: false, error: "Enter a total amount greater than 0." };
  }
  if (params.participants.length === 0) {
    return { isValid: false, error: "Add at least one participant." };
  }
  const allocated = roundSplitMoney(
    params.participants.reduce((sum, p) => sum + p.calculatedMoney, 0),
  );
  const hasPartParticipants = params.participants.some(
    (p) => p.splitType === "part",
  );
  const tolerance = hasPartParticipants
    ? Math.max(0.01, roundSplitMoney(params.participants.length * 0.005))
    : 0.01;
  const diff = roundSplitMoney(Math.abs(allocated - safeTotal));

  if (diff > tolerance) {
    if (allocated > safeTotal) {
      return {
        isValid: false,
        error: `Total allocated (₹${allocated}) exceeds total amount (₹${safeTotal}).`,
      };
    }
    const remaining = roundSplitMoney(safeTotal - allocated);
    return {
      isValid: false,
      error: `Participant contributions (₹${allocated}) do not add up to total amount (₹${safeTotal}). ₹${remaining} remaining.`,
    };
  }
  return { isValid: true };
}

export const hasMeParticipant = (participants: SplitParticipant[]): boolean =>
  participants.some((p) => p.isMe || p.name.trim().toLowerCase() === "me");

export const getMeParticipantMoney = (
  participants: SplitParticipant[],
): number | null => {
  const me = participants.find(
    (p) => p.isMe || p.name.trim().toLowerCase() === "me",
  );
  return me ? roundSplitMoney(me.calculatedMoney) : null;
};

export const hasContactParticipants = (
  participants: SplitParticipant[],
): boolean =>
  participants.some(
    (p) => typeof p.phoneNumber === "string" && p.phoneNumber.trim().length > 0,
  );

export function buildSplitSmsMessage(params: {
  totalAmount: number;
  participant: Pick<
    SplitParticipant,
    "name" | "calculatedMoney" | "calculatedPercentage"
  >;
}): string {
  const total = roundSplitMoney(params.totalAmount).toFixed(2);
  const share = roundSplitMoney(params.participant.calculatedMoney).toFixed(2);
  const pct = roundSplitMoney(params.participant.calculatedPercentage).toFixed(
    2,
  );
  return `AK EMS Money Split:\nTotal: ₹${total}\nYour Share (${params.participant.name}): ₹${share} (${pct}%)`;
}
