import type { GoalType } from "@/db/schema";

export const GOALS_PAGE_SIZE = 10;

export type GoalTabType = "active" | "achieved";

export type GoalCounts = {
  active: number;
  achieved: number;
};

export type GoalFormInput = {
  targetName: string;
  targetMoney: string;
  currentMoney?: string;
  note?: string;
  tags?: string[];
};

export type GoalFormErrors = {
  targetName?: string;
  targetMoney?: string;
  currentMoney?: string;
};

export type NormalizedGoalValues = {
  targetName: string;
  targetMoney: number;
  currentMoney: number;
  note: string | null;
  tags: string[];
};

export type GoalValidationResult =
  | {
      isValid: true;
      values: NormalizedGoalValues;
      wasCurrentClamped: boolean;
      errors: GoalFormErrors;
    }
  | {
      isValid: false;
      errors: GoalFormErrors;
    };

const VALID_DECIMAL_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export const roundGoalMoney = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const clampGoalMoney = (
  currentMoney: number,
  targetMoney: number,
): number => {
  if (!Number.isFinite(targetMoney) || targetMoney <= 0) {
    return 0;
  }
  const safeTarget = roundGoalMoney(targetMoney);
  if (!Number.isFinite(currentMoney) || currentMoney <= 0) {
    return 0;
  }
  return Math.min(safeTarget, roundGoalMoney(currentMoney));
};

export const applyGoalProgressDelta = (
  currentMoney: number,
  delta: number,
  targetMoney: number,
): number => {
  if (!Number.isFinite(targetMoney) || targetMoney <= 0) {
    return 0;
  }
  const safeCurrent = Number.isFinite(currentMoney)
    ? roundGoalMoney(currentMoney)
    : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  return clampGoalMoney(safeCurrent + safeDelta, targetMoney);
};

export const isGoalAchieved = (
  goal: Pick<GoalType, "currentMoney" | "targetMoney">,
): boolean =>
  Number.isFinite(goal.targetMoney) &&
  goal.targetMoney > 0 &&
  goal.currentMoney >= goal.targetMoney;

export const getGoalTab = (
  goal: Pick<GoalType, "currentMoney" | "targetMoney">,
): GoalTabType => (isGoalAchieved(goal) ? "achieved" : "active");

export const getGoalProgressFraction = (
  goal: Pick<GoalType, "currentMoney" | "targetMoney">,
): number => {
  if (!Number.isFinite(goal.targetMoney) || goal.targetMoney <= 0) {
    return 0;
  }
  const clamped = clampGoalMoney(goal.currentMoney, goal.targetMoney);
  return Math.min(1, Math.max(0, clamped / goal.targetMoney));
};

export const getGoalProgressPercent = (
  goal: Pick<GoalType, "currentMoney" | "targetMoney">,
): number =>
  Math.min(100, Math.max(0, Math.round(getGoalProgressFraction(goal) * 100)));

export const getGoalRemainingMoney = (
  goal: Pick<GoalType, "currentMoney" | "targetMoney">,
): number => {
  if (!Number.isFinite(goal.targetMoney) || goal.targetMoney <= 0) {
    return 0;
  }
  const clamped = clampGoalMoney(goal.currentMoney, goal.targetMoney);
  return roundGoalMoney(Math.max(0, goal.targetMoney - clamped));
};

export const getGoalStepAmount = (targetMoney: number): number => {
  if (!Number.isFinite(targetMoney) || targetMoney <= 0) return 1;
  if (targetMoney <= 20) return 1;
  if (targetMoney <= 100) return 10;
  if (targetMoney <= 1000) return 100;
  if (targetMoney <= 10000) return 500;
  if (targetMoney <= 100000) return 1000;
  return 5000;
};

export const getWillClampCurrentNotice = (
  targetMoneyText: string,
  currentMoneyText: string,
): { willClamp: boolean; targetMoney: number; currentMoney: number } => {
  const trimmedTarget = targetMoneyText.trim();
  const trimmedCurrent = currentMoneyText.trim();
  if (
    !VALID_DECIMAL_PATTERN.test(trimmedTarget) ||
    !VALID_DECIMAL_PATTERN.test(trimmedCurrent)
  ) {
    return { willClamp: false, targetMoney: 0, currentMoney: 0 };
  }
  const parsedTarget = roundGoalMoney(Number(trimmedTarget));
  const parsedCurrent = roundGoalMoney(Number(trimmedCurrent));
  if (
    !Number.isFinite(parsedTarget) ||
    parsedTarget <= 0 ||
    !Number.isFinite(parsedCurrent)
  ) {
    return { willClamp: false, targetMoney: 0, currentMoney: 0 };
  }
  return {
    willClamp: parsedCurrent > parsedTarget,
    targetMoney: parsedTarget,
    currentMoney: parsedCurrent,
  };
};

export const validateGoalInput = (
  input: GoalFormInput,
): GoalValidationResult => {
  const trimmedName = input.targetName.trim();
  const trimmedTarget = input.targetMoney.trim();
  const trimmedCurrent = (input.currentMoney ?? "").trim();
  const trimmedNote = (input.note ?? "").trim();
  const normalizedTags = Array.from(
    new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)),
  );

  const errors: GoalFormErrors = {};

  if (!trimmedName) {
    errors.targetName = "Target name is required.";
  }

  let parsedTarget = 0;
  if (!trimmedTarget) {
    errors.targetMoney = "Target amount is required.";
  } else {
    const numericTarget = Number(trimmedTarget);
    if (
      !VALID_DECIMAL_PATTERN.test(trimmedTarget) ||
      !Number.isFinite(numericTarget) ||
      numericTarget <= 0
    ) {
      errors.targetMoney = "Target amount must be greater than 0.";
    } else {
      parsedTarget = roundGoalMoney(numericTarget);
      if (parsedTarget <= 0) {
        errors.targetMoney = "Target amount must be greater than 0.";
      }
    }
  }

  let parsedCurrentRaw = 0;
  if (trimmedCurrent.length > 0) {
    const numericCurrent = Number(trimmedCurrent);
    if (
      !VALID_DECIMAL_PATTERN.test(trimmedCurrent) ||
      !Number.isFinite(numericCurrent) ||
      numericCurrent < 0
    ) {
      errors.currentMoney = "Current amount must be 0 or greater.";
    } else {
      parsedCurrentRaw = roundGoalMoney(numericCurrent);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  const clampedCurrent = clampGoalMoney(parsedCurrentRaw, parsedTarget);

  return {
    isValid: true,
    values: {
      targetName: trimmedName,
      targetMoney: parsedTarget,
      currentMoney: clampedCurrent,
      note: trimmedNote || null,
      tags: normalizedTags,
    },
    wasCurrentClamped: parsedCurrentRaw > parsedTarget,
    errors,
  };
};

export const validatePositiveGoalDeltaText = (
  text: string,
): { isValid: boolean; errMsg?: string; amount?: number } => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { isValid: false, errMsg: "Amount is required" };
  }
  const num = Number(trimmed);
  if (
    !VALID_DECIMAL_PATTERN.test(trimmed) ||
    !Number.isFinite(num) ||
    num <= 0
  ) {
    return { isValid: false, errMsg: "Enter an amount greater than 0" };
  }
  const rounded = roundGoalMoney(num);
  if (rounded <= 0) {
    return { isValid: false, errMsg: "Enter an amount greater than 0" };
  }
  return { isValid: true, amount: rounded };
};

const toEpochMs = (value: Date | number): number =>
  value instanceof Date ? value.getTime() : Number(value) * 1000;

export const sortGoalsNewestFirst = <
  T extends Pick<GoalType, "id" | "createdAt">,
>(
  goals: readonly T[],
): T[] =>
  [...goals].sort((a, b) => {
    const diff = toEpochMs(b.createdAt) - toEpochMs(a.createdAt);
    if (diff !== 0) return diff;
    return b.id - a.id;
  });

export type GoalDialogLayoutInput = {
  windowHeight: number;
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  topInset: number;
  bottomInset: number;
  topPadding?: number;
  bottomPadding?: number;
  titleHeight?: number;
  actionsHeight?: number;
  contentBottomPadding?: number;
};

export type GoalDialogLayoutMetrics = {
  effectiveKeyboardHeight: number;
  availableViewportHeight: number;
  dialogMaxHeight: number;
  scrollMaxHeight: number;
  extraKeyboardBottomMargin: number;
};

export const computeGoalDialogLayoutMetrics = ({
  windowHeight,
  keyboardHeight,
  isKeyboardVisible,
  topInset,
  bottomInset,
  topPadding = 16,
  bottomPadding = 16,
  titleHeight = 60,
  actionsHeight = 64,
  contentBottomPadding = 12,
}: GoalDialogLayoutInput): GoalDialogLayoutMetrics => {
  const safeWindowHeight =
    Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;
  const safeTopInset = Number.isFinite(topInset) && topInset > 0 ? topInset : 0;
  const safeBottomInset =
    Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;
  const effectiveKeyboardHeight =
    isKeyboardVisible && Number.isFinite(keyboardHeight) && keyboardHeight > 0
      ? keyboardHeight
      : 0;
  const safeTopPadding =
    Number.isFinite(topPadding) && topPadding > 0 ? topPadding : 0;
  const safeBottomPadding =
    Number.isFinite(bottomPadding) && bottomPadding > 0 ? bottomPadding : 0;
  const safeTitleHeight =
    Number.isFinite(titleHeight) && titleHeight > 0 ? titleHeight : 0;
  const safeActionsHeight =
    Number.isFinite(actionsHeight) && actionsHeight > 0 ? actionsHeight : 0;
  const safeContentBottomPadding =
    Number.isFinite(contentBottomPadding) && contentBottomPadding > 0
      ? contentBottomPadding
      : 0;

  // Paper's <Modal> wrapper already subtracts topInset and bottomInset.
  // When the keyboard is open above the bottom safe-area inset, we reserve
  // max(bottomInset, keyboardHeight) overall and shift Dialog upward by the
  // remaining overlap (keyboardHeight - bottomInset).
  const effectiveBottomReservation = Math.max(
    safeBottomInset,
    effectiveKeyboardHeight,
  );
  const availableViewportHeight = Math.max(
    0,
    safeWindowHeight - safeTopInset - effectiveBottomReservation,
  );
  const dialogMaxHeight = Math.max(
    0,
    availableViewportHeight - safeTopPadding - safeBottomPadding,
  );
  const extraKeyboardBottomMargin = Math.max(
    0,
    effectiveKeyboardHeight - safeBottomInset,
  );
  const chromeHeight =
    safeTitleHeight + safeActionsHeight + safeContentBottomPadding;
  const scrollMaxHeight = Math.max(0, dialogMaxHeight - chromeHeight);

  return {
    effectiveKeyboardHeight,
    availableViewportHeight,
    dialogMaxHeight,
    scrollMaxHeight,
    extraKeyboardBottomMargin,
  };
};

export const computeFocusedFieldScrollOffset = ({
  fieldY,
  fieldHeight,
  viewportHeight,
  currentScrollY,
  topMargin = 8,
  bottomMargin = 12,
}: {
  fieldY: number;
  fieldHeight: number;
  viewportHeight: number;
  currentScrollY: number;
  topMargin?: number;
  bottomMargin?: number;
}): number | null => {
  if (
    !Number.isFinite(fieldY) ||
    !Number.isFinite(fieldHeight) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(currentScrollY) ||
    viewportHeight <= 0
  ) {
    return null;
  }

  const safeScrollY = Math.max(0, currentScrollY);
  const fieldTop = Math.max(0, fieldY);
  const fieldBottom = Math.max(fieldTop, fieldTop + Math.max(0, fieldHeight));
  const safeTopMargin = Math.max(0, topMargin);
  const safeBottomMargin = Math.max(0, bottomMargin);

  if (fieldHeight + safeTopMargin + safeBottomMargin > viewportHeight) {
    const desiredY = Math.max(0, fieldBottom + safeBottomMargin - viewportHeight);
    return Math.abs(desiredY - safeScrollY) < 1 ? null : desiredY;
  }

  if (fieldBottom + safeBottomMargin > safeScrollY + viewportHeight) {
    const desiredY = Math.max(0, fieldBottom + safeBottomMargin - viewportHeight);
    return Math.abs(desiredY - safeScrollY) < 1 ? null : desiredY;
  }

  if (fieldTop - safeTopMargin < safeScrollY) {
    const desiredY = Math.max(0, fieldTop - safeTopMargin);
    return Math.abs(desiredY - safeScrollY) < 1 ? null : desiredY;
  }

  return null;
};
