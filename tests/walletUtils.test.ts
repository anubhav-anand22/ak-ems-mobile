import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGreedyWalletSplit,
  getTransactionLinkedWallets,
  resolveEffectiveDefaultWalletId,
  validateWalletAdjustmentInput,
  validateWalletAllocationsForTransaction,
  validateWalletInput,
  validateWalletTransferInput,
} from "../src/lib/walletUtils";

test("walletUtils - validateWalletInput", async (t) => {
  await t.test("requires non-empty wallet name and defaults blank currentBalance to 0", () => {
    const invalid = validateWalletInput({ name: "   " });
    assert.strictEqual(invalid.isValid, false);
    if (!invalid.isValid) {
      assert.ok(invalid.errors.name);
    }

    const valid = validateWalletInput({ name: "  Main Cash  " });
    assert.strictEqual(valid.isValid, true);
    if (valid.isValid) {
      assert.strictEqual(valid.values.name, "Main Cash");
      assert.strictEqual(valid.values.currentBalance, 0);
      assert.strictEqual(valid.values.minBalance, null);
      assert.strictEqual(valid.values.maxBalance, null);
      assert.deepStrictEqual(valid.warnings, []);
    }
  });

  await t.test("validates maxBalance >= minBalance and emits soft warning if current crosses bounds", () => {
    const badRange = validateWalletInput({
      name: "Bank",
      currentBalance: "500",
      minBalance: "1000",
      maxBalance: "800",
    });
    assert.strictEqual(badRange.isValid, false);
    if (!badRange.isValid) {
      assert.ok(badRange.errors.maxBalance);
    }

    const belowMin = validateWalletInput({
      name: "Bank",
      currentBalance: "200",
      minBalance: "500",
      maxBalance: "5000",
    });
    assert.strictEqual(belowMin.isValid, true);
    if (belowMin.isValid) {
      assert.strictEqual(belowMin.warnings.length, 1);
      assert.ok(belowMin.warnings[0].includes("below min limit"));
    }
  });
});

test("walletUtils - validateWalletAdjustmentInput", async (t) => {
  const wallet = {
    name: "Cash",
    currentBalance: 500,
    minBalance: 200,
    maxBalance: 1000,
  };

  await t.test("blocks subtract when amount exceeds current balance", () => {
    const res = validateWalletAdjustmentInput({
      amountText: "600",
      action: "subtract",
      wallet,
    });
    assert.strictEqual(res.isValid, false);
  });

  await t.test("allows add/subtract and returns soft warnings when crossing min/max", () => {
    const subWarn = validateWalletAdjustmentInput({
      amountText: "400",
      action: "subtract",
      wallet,
    });
    assert.strictEqual(subWarn.isValid, true);
    if (subWarn.isValid) {
      assert.strictEqual(subWarn.nextBalance, 100);
      assert.strictEqual(subWarn.warnings.length, 1);
    }

    const addWarn = validateWalletAdjustmentInput({
      amountText: "700",
      action: "add",
      wallet,
    });
    assert.strictEqual(addWarn.isValid, true);
    if (addWarn.isValid) {
      assert.strictEqual(addWarn.nextBalance, 1200);
      assert.strictEqual(addWarn.warnings.length, 1);
    }
  });
});

test("walletUtils - computeGreedyWalletSplit", async (t) => {
  await t.test("allocates greedily in selection order (example: A=500, B=300, XXX=700 -> 500, 200)", () => {
    const split = computeGreedyWalletSplit(
      [
        { id: 1, currentBalance: 500 },
        { id: 2, currentBalance: 300 },
        { id: 3, currentBalance: 1000 },
      ],
      700,
    );
    assert.deepStrictEqual(split, [
      { walletId: 1, amount: 500 },
      { walletId: 2, amount: 200 },
      { walletId: 3, amount: 0 },
    ]);
  });

  await t.test("gives 0 to second wallet if first wallet covers full amount", () => {
    const split = computeGreedyWalletSplit(
      [
        { id: 1, currentBalance: 1000 },
        { id: 2, currentBalance: 400 },
      ],
      600,
    );
    assert.deepStrictEqual(split, [
      { walletId: 1, amount: 600 },
      { walletId: 2, amount: 0 },
    ]);
  });
});

test("walletUtils - validateWalletAllocationsForTransaction", async (t) => {
  const wallets = [
    {
      id: 1,
      name: "Wallet A",
      currentBalance: 500,
      minBalance: 200,
      maxBalance: 2000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Wallet B",
      currentBalance: 300,
      minBalance: null,
      maxBalance: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await t.test("blocks single-wallet Send/Lend when balance is insufficient", () => {
    const res = validateWalletAllocationsForTransaction({
      wallets,
      selectedWalletIds: [2],
      isMultiWallet: false,
      splitAmountsById: {},
      totalAmount: 400,
      subExpenseType: "Send",
    });
    assert.strictEqual(res.isValid, false);
  });

  await t.test("blocks multi-wallet Send/Lend when combined or per-wallet split exceeds balance", () => {
    const combinedInsufficient = validateWalletAllocationsForTransaction({
      wallets,
      selectedWalletIds: [1, 2],
      isMultiWallet: true,
      splitAmountsById: { 1: "500", 2: "400" },
      totalAmount: 900,
      subExpenseType: "Lend",
    });
    assert.strictEqual(combinedInsufficient.isValid, false);

    const perWalletInsufficient = validateWalletAllocationsForTransaction({
      wallets,
      selectedWalletIds: [1, 2],
      isMultiWallet: true,
      splitAmountsById: { 1: "200", 2: "400" },
      totalAmount: 600,
      subExpenseType: "Send",
    });
    assert.strictEqual(perWalletInsufficient.isValid, false);
  });

  await t.test("blocks when multi-wallet split sum does not equal transaction total", () => {
    const mismatch = validateWalletAllocationsForTransaction({
      wallets,
      selectedWalletIds: [1, 2],
      isMultiWallet: true,
      splitAmountsById: { 1: "300", 2: "100" },
      totalAmount: 500,
      subExpenseType: "Send",
    });
    assert.strictEqual(mismatch.isValid, false);
  });

  await t.test("allows Receive/Borrow exceeding currentBalance and triggers maxBalance soft warning", () => {
    const res = validateWalletAllocationsForTransaction({
      wallets,
      selectedWalletIds: [1],
      isMultiWallet: false,
      splitAmountsById: {},
      totalAmount: 2000,
      subExpenseType: "Receive",
    });
    assert.strictEqual(res.isValid, true);
    if (res.isValid) {
      assert.deepStrictEqual(res.allocations, [{ walletId: 1, amount: 2000 }]);
      assert.strictEqual(res.warnings.length, 1);
    }
  });
});

test("walletUtils - linked wallet labels and effective default wallet", async (t) => {
  await t.test("resolves linked wallet names and ignores deleted/missing wallets", () => {
    const nameMap = new Map<number, string>([
      [1, "Cash"],
      [2, "HDFC"],
    ]);
    assert.deepStrictEqual(
      getTransactionLinkedWallets(
        [
          { walletId: 1, amount: 300 },
          { walletId: 99, amount: 100 },
          { walletId: 2, amount: 200 },
        ],
        nameMap,
      ),
      [
        { walletId: 1, amount: 300, name: "Cash" },
        { walletId: 2, amount: 200, name: "HDFC" },
      ],
    );
    assert.deepStrictEqual(getTransactionLinkedWallets(null, nameMap), []);
  });

  await t.test("resolveEffectiveDefaultWalletId returns ID only when >1 wallet exists and ID matches", () => {
    assert.strictEqual(resolveEffectiveDefaultWalletId([{ id: 1 }], 1), null);
    assert.strictEqual(
      resolveEffectiveDefaultWalletId([{ id: 1 }, { id: 2 }], 2),
      2,
    );
    assert.strictEqual(
      resolveEffectiveDefaultWalletId([{ id: 1 }, { id: 2 }], 99),
      null,
    );
    assert.strictEqual(
      resolveEffectiveDefaultWalletId([{ id: 1 }, { id: 2 }], null),
      null,
    );
  });
});

test("walletUtils - validateWalletTransferInput", async (t) => {
  const walletA = {
    id: 1,
    name: "Bank",
    currentBalance: 1000,
    minBalance: 300,
    maxBalance: 5000,
  };
  const walletB = {
    id: 2,
    name: "Cash",
    currentBalance: 400,
    minBalance: null,
    maxBalance: 1000,
  };

  await t.test("blocks same-wallet transfer, invalid amounts, and insufficient source balance", () => {
    const same = validateWalletTransferInput({
      fromWallet: walletA,
      toWallet: walletA,
      amountText: "100",
    });
    assert.strictEqual(same.isValid, false);

    const zero = validateWalletTransferInput({
      fromWallet: walletA,
      toWallet: walletB,
      amountText: "0",
    });
    assert.strictEqual(zero.isValid, false);

    const insufficient = validateWalletTransferInput({
      fromWallet: walletA,
      toWallet: walletB,
      amountText: "1200",
    });
    assert.strictEqual(insufficient.isValid, false);
  });

  await t.test("calculates next balances and emits soft warnings when crossing min/max bounds", () => {
    const valid = validateWalletTransferInput({
      fromWallet: walletA,
      toWallet: walletB,
      amountText: "800",
    });
    assert.strictEqual(valid.isValid, true);
    if (valid.isValid) {
      assert.strictEqual(valid.amount, 800);
      assert.strictEqual(valid.nextFromBalance, 200);
      assert.strictEqual(valid.nextToBalance, 1200);
      assert.strictEqual(valid.warnings.length, 2);
    }
  });
});
