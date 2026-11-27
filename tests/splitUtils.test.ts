import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSplitSmsMessage,
  getMeParticipantMoney,
  hasContactParticipants,
  hasMeParticipant,
  recalculateSplitParticipants,
  recalculateSplitParticipantsForMode,
  validateParticipantInput,
  validateSplitSubmission,
} from "../src/lib/splitUtils";

test("splitUtils - recalculateSplitParticipants & split types", async (t) => {
  await t.test("calculates equal 1/3rd part shares accurately", () => {
    const res = recalculateSplitParticipants(300, [
      { id: "1", name: "me", splitType: "part", splitValue: 1, isMe: true },
      { id: "2", name: "Alice", splitType: "part", splitValue: 1, isMe: false },
      { id: "3", name: "Bob", splitType: "part", splitValue: 1, isMe: false },
    ]);
    assert.strictEqual(res.length, 3);
    assert.strictEqual(res[0].calculatedMoney, 100);
    assert.strictEqual(res[0].calculatedPercentage, 33.33);
    assert.strictEqual(getMeParticipantMoney(res), 100);
    assert.strictEqual(hasMeParticipant(res), true);
  });

  await t.test("recalculates mixed money, percentage, and part shares dynamically", () => {
    const res = recalculateSplitParticipants(1000, [
      { id: "1", name: "me", splitType: "money", splitValue: 400, isMe: true },
      { id: "2", name: "Alice", splitType: "percentage", splitValue: 20, isMe: false },
      { id: "3", name: "Bob", splitType: "part", splitValue: 1, isMe: false },
      { id: "4", name: "Carol", splitType: "part", splitValue: 1, isMe: false },
    ]);
    // Fixed: 400 + 200 (20% of 1000) = 600; remaining 400 split 1:1 = 200 each
    assert.strictEqual(res[0].calculatedMoney, 400);
    assert.strictEqual(res[0].calculatedPercentage, 40);
    assert.strictEqual(res[1].calculatedMoney, 200);
    assert.strictEqual(res[1].calculatedPercentage, 20);
    assert.strictEqual(res[2].calculatedMoney, 200);
    assert.strictEqual(res[3].calculatedMoney, 200);
  });
});

test("splitUtils - validateParticipantInput & validateSplitSubmission", async (t) => {
  await t.test("rejects money greater than totalAmount and percentage > 100", () => {
    const tooMuchMoney = validateParticipantInput({
      totalAmount: 500,
      name: "Alice",
      isMe: false,
      splitType: "money",
      splitValueText: "600",
      existingParticipants: [],
    });
    assert.strictEqual(tooMuchMoney.isValid, false);

    const tooMuchPct = validateParticipantInput({
      totalAmount: 500,
      name: "Alice",
      isMe: false,
      splitType: "percentage",
      splitValueText: "110",
      existingParticipants: [],
    });
    assert.strictEqual(tooMuchPct.isValid, false);
  });

  await t.test("locks name to 'me' for isMe and detects contact phone numbers + SMS text", () => {
    const added = validateParticipantInput({
      totalAmount: 600,
      name: "Ignored Name",
      isMe: true,
      phoneNumber: "+919876543210",
      splitType: "percentage",
      splitValueText: "50",
      existingParticipants: [],
      newId: "p1",
    });
    assert.strictEqual(added.isValid, true);
    if (added.isValid) {
      assert.strictEqual(added.participant.name, "me");
      assert.strictEqual(added.participant.calculatedMoney, 300);
      assert.strictEqual(hasContactParticipants(added.recalculatedList), true);
      const msg = buildSplitSmsMessage({
        totalAmount: 600,
        participant: added.participant,
      });
      assert.ok(msg.includes("Total: ₹600.00"));
      assert.ok(msg.includes("₹300.00 (50.00%)"));
    }

    assert.strictEqual(
      validateSplitSubmission({ totalAmount: 600, participants: [] }).isValid,
      false,
    );

    const underAllocated = validateSplitSubmission({
      totalAmount: 500,
      participants: recalculateSplitParticipants(500, [
        { id: "1", name: "Alice", splitType: "money", splitValue: 300, isMe: false },
      ]),
    });
    assert.strictEqual(underAllocated.isValid, false);
    if (!underAllocated.isValid) {
      assert.ok(underAllocated.error.includes("do not add up"));
    }

    // 100 / 3 = 33.33 * 3 = 99.99 is within part rounding tolerance
    const equalThree = validateSplitSubmission({
      totalAmount: 100,
      participants: recalculateSplitParticipants(100, [
        { id: "1", name: "A", splitType: "part", splitValue: 1, isMe: false },
        { id: "2", name: "B", splitType: "part", splitValue: 1, isMe: false },
        { id: "3", name: "C", splitType: "part", splitValue: 1, isMe: false },
      ]),
    });
    assert.strictEqual(equalThree.isValid, true);
  });

  await t.test("splits equally in equal distributionMode without requiring splitValueText", () => {
    const first = validateParticipantInput({
      totalAmount: 300,
      name: "me",
      isMe: true,
      distributionMode: "equal",
      splitType: "percentage",
      splitValueText: "",
      existingParticipants: [],
      newId: "p1",
    });
    assert.strictEqual(first.isValid, true);
    if (!first.isValid) return;
    assert.strictEqual(first.participant.calculatedMoney, 300);

    const second = validateParticipantInput({
      totalAmount: 300,
      name: "Alice",
      isMe: false,
      distributionMode: "equal",
      splitType: "percentage",
      splitValueText: "",
      existingParticipants: first.recalculatedList,
      newId: "p2",
    });
    assert.strictEqual(second.isValid, true);
    if (!second.isValid) return;
    assert.strictEqual(second.recalculatedList[0].calculatedMoney, 150);
    assert.strictEqual(second.recalculatedList[1].calculatedMoney, 150);

    // Switching custom -> equal distributes equally
    const customList = recalculateSplitParticipants(300, [
      { id: "1", name: "me", splitType: "money", splitValue: 200, isMe: true },
      { id: "2", name: "Bob", splitType: "money", splitValue: 100, isMe: false },
    ]);
    const switchedEqual = recalculateSplitParticipantsForMode(
      300,
      customList,
      "equal",
    );
    assert.strictEqual(switchedEqual[0].calculatedMoney, 150);
    assert.strictEqual(switchedEqual[1].calculatedMoney, 150);
  });
});
