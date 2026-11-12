import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  applyGoalProgressDelta,
  clampGoalMoney,
  computeFocusedFieldScrollOffset,
  computeGoalDialogLayoutMetrics,
  getGoalProgressFraction,
  getGoalProgressPercent,
  getGoalRemainingMoney,
  getGoalStepAmount,
  getGoalTab,
  getWillClampCurrentNotice,
  GOALS_PAGE_SIZE,
  isGoalAchieved,
  roundGoalMoney,
  sortGoalsNewestFirst,
  validateGoalInput,
  validatePositiveGoalDeltaText,
} from "../src/lib/goalsUtils";

test("roundGoalMoney, clampGoalMoney, and applyGoalProgressDelta", async (t) => {
  await t.test("enforces [0, targetMoney] bounds strictly", () => {
    assert.strictEqual(clampGoalMoney(-50, 1000), 0);
    assert.strictEqual(clampGoalMoney(0, 1000), 0);
    assert.strictEqual(clampGoalMoney(450, 1000), 450);
    assert.strictEqual(clampGoalMoney(1250, 1000), 1000);
    assert.strictEqual(clampGoalMoney(Number.NaN, 1000), 0);
    assert.strictEqual(clampGoalMoney(100, 0), 0);
  });

  await t.test("increments and decrements with clamping and decimal precision", () => {
    assert.strictEqual(applyGoalProgressDelta(0, -100, 500), 0);
    assert.strictEqual(applyGoalProgressDelta(40, -100, 500), 0);
    assert.strictEqual(applyGoalProgressDelta(0, 100, 500), 100);
    assert.strictEqual(applyGoalProgressDelta(450, 100, 500), 500);
    assert.strictEqual(applyGoalProgressDelta(500, 100, 500), 500);
    assert.strictEqual(applyGoalProgressDelta(0.1, 0.2, 1), 0.3);
    assert.strictEqual(roundGoalMoney(-0), 0);
  });
});

test("goal validation and edit target-lower clamping", async (t) => {
  await t.test("rejects missing targetName or non-positive targetMoney", () => {
    const emptyName = validateGoalInput({
      targetName: "   ",
      targetMoney: "1000",
    });
    assert.strictEqual(emptyName.isValid, false);
    assert.ok(emptyName.errors.targetName);

    for (const badTarget of ["", "0", "-50", "abc"]) {
      const res = validateGoalInput({
        targetName: "Laptop",
        targetMoney: badTarget,
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.targetMoney);
    }
  });

  await t.test("defaults currentMoney to 0 and normalizes note and tags", () => {
    const valid = validateGoalInput({
      targetName: "  Emergency Fund  ",
      targetMoney: "50000",
      currentMoney: "",
      note: "   ",
      tags: ["Savings", " Priority ", "Savings"],
    });

    assert.strictEqual(valid.isValid, true);
    if (valid.isValid) {
      assert.strictEqual(valid.values.targetName, "Emergency Fund");
      assert.strictEqual(valid.values.targetMoney, 50000);
      assert.strictEqual(valid.values.currentMoney, 0);
      assert.strictEqual(valid.values.note, null);
      assert.deepStrictEqual(valid.values.tags, ["Savings", "Priority"]);
      assert.strictEqual(valid.wasCurrentClamped, false);
    }
  });

  await t.test("clamps currentMoney when targetMoney is lowered below currentMoney on edit", () => {
    const notice = getWillClampCurrentNotice("500", "800");
    assert.strictEqual(notice.willClamp, true);
    assert.strictEqual(notice.targetMoney, 500);
    assert.strictEqual(notice.currentMoney, 800);

    const edited = validateGoalInput({
      targetName: "Bike Gear",
      targetMoney: "500",
      currentMoney: "800",
      note: "Lowered target",
    });

    assert.strictEqual(edited.isValid, true);
    if (edited.isValid) {
      assert.strictEqual(edited.values.targetMoney, 500);
      assert.strictEqual(edited.values.currentMoney, 500);
      assert.strictEqual(edited.wasCurrentClamped, true);
      assert.strictEqual(isGoalAchieved(edited.values), true);
    }
  });

  await t.test("validates custom progress adjustment inputs", () => {
    assert.strictEqual(validatePositiveGoalDeltaText("").isValid, false);
    assert.strictEqual(validatePositiveGoalDeltaText("0").isValid, false);
    assert.strictEqual(validatePositiveGoalDeltaText("-10").isValid, false);

    const ok = validatePositiveGoalDeltaText("250.75");
    assert.strictEqual(ok.isValid, true);
    assert.strictEqual(ok.amount, 250.75);
  });
});

test("tab classification, progress math, and sorting", async (t) => {
  await t.test("transitions between Active and Achieved at 100% boundary", () => {
    const goal = { currentMoney: 900, targetMoney: 1000 };
    assert.strictEqual(isGoalAchieved(goal), false);
    assert.strictEqual(getGoalTab(goal), "active");
    assert.strictEqual(getGoalProgressFraction(goal), 0.9);
    assert.strictEqual(getGoalProgressPercent(goal), 90);
    assert.strictEqual(getGoalRemainingMoney(goal), 100);
    assert.strictEqual(getGoalStepAmount(1000), 100);

    const incremented = applyGoalProgressDelta(
      goal.currentMoney,
      100,
      goal.targetMoney,
    );
    const achievedGoal = { currentMoney: incremented, targetMoney: 1000 };
    assert.strictEqual(achievedGoal.currentMoney, 1000);
    assert.strictEqual(isGoalAchieved(achievedGoal), true);
    assert.strictEqual(getGoalTab(achievedGoal), "achieved");
    assert.strictEqual(getGoalProgressFraction(achievedGoal), 1);
    assert.strictEqual(getGoalProgressPercent(achievedGoal), 100);
    assert.strictEqual(getGoalRemainingMoney(achievedGoal), 0);

    const decremented = applyGoalProgressDelta(
      achievedGoal.currentMoney,
      -100,
      achievedGoal.targetMoney,
    );
    const activeAgainGoal = { currentMoney: decremented, targetMoney: 1000 };
    assert.strictEqual(activeAgainGoal.currentMoney, 900);
    assert.strictEqual(isGoalAchieved(activeAgainGoal), false);
    assert.strictEqual(getGoalTab(activeAgainGoal), "active");
  });

  await t.test("sorts goals newest first by createdAt desc then id desc", () => {
    const items = [
      { id: 1, createdAt: new Date(1700000100 * 1000) },
      { id: 2, createdAt: new Date(1700000200 * 1000) },
      { id: 3, createdAt: new Date(1700000200 * 1000) },
      { id: 4, createdAt: new Date(1700000050 * 1000) },
    ];
    const sorted = sortGoalsNewestFirst(items);
    assert.deepStrictEqual(
      sorted.map((item) => item.id),
      [3, 2, 1, 4],
    );
    assert.deepStrictEqual(
      items.map((item) => item.id),
      [1, 2, 3, 4],
    );
  });
});

test("SQLite goals migration, cursor pagination (batch of 10), and tab transitions", async (t) => {
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), "src/db/drizzle/0006_demonic_naoko.sql"),
    "utf8",
  );
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrationSql);

  const insertStmt = sqlite.prepare(`
    INSERT INTO goals (targetName, targetMoney, currentMoney, note, tags, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert 15 Active goals (include same-timestamp ties)
  for (let i = 1; i <= 15; i++) {
    const ts = i >= 13 ? 1700001500 : 1700000000 + i * 10;
    insertStmt.run(
      `Active Goal ${i}`,
      1000,
      i * 50,
      `Note ${i}`,
      JSON.stringify(["Savings"]),
      ts,
      ts,
    );
  }

  // Insert 12 Achieved goals
  for (let i = 1; i <= 12; i++) {
    const ts = 1700002000 + i * 10;
    insertStmt.run(
      `Achieved Goal ${i}`,
      500,
      500,
      null,
      JSON.stringify(["Done"]),
      ts,
      ts,
    );
  }

  const getCounts = () => {
    const row = sqlite
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN currentMoney < targetMoney THEN 1 ELSE 0 END), 0) AS active,
          COALESCE(SUM(CASE WHEN currentMoney >= targetMoney THEN 1 ELSE 0 END), 0) AS achieved
        FROM goals`,
      )
      .get() as { active: number; achieved: number };
    return {
      active: Number(row.active) || 0,
      achieved: Number(row.achieved) || 0,
    };
  };

  const queryPage = (
    tab: "active" | "achieved",
    cursor?: { createdAt: number; id: number },
  ) => {
    const op = tab === "achieved" ? ">=" : "<";
    if (!cursor) {
      return sqlite
        .prepare(
          `SELECT id, targetName, currentMoney, targetMoney, createdAt
           FROM goals
           WHERE currentMoney ${op} targetMoney
           ORDER BY createdAt DESC, id DESC
           LIMIT ?`,
        )
        .all(GOALS_PAGE_SIZE) as Array<{
        id: number;
        targetName: string;
        currentMoney: number;
        targetMoney: number;
        createdAt: number;
      }>;
    }

    return sqlite
      .prepare(
        `SELECT id, targetName, currentMoney, targetMoney, createdAt
         FROM goals
         WHERE currentMoney ${op} targetMoney
           AND (createdAt < ? OR (createdAt = ? AND id < ?))
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`,
      )
      .all(
        cursor.createdAt,
        cursor.createdAt,
        cursor.id,
        GOALS_PAGE_SIZE,
      ) as Array<{
      id: number;
      targetName: string;
      currentMoney: number;
      targetMoney: number;
      createdAt: number;
    }>;
  };

  await t.test("loads 10 newest items first and paginates remaining items cleanly", () => {
    assert.deepStrictEqual(getCounts(), { active: 15, achieved: 12 });

    const activePage1 = queryPage("active");
    assert.strictEqual(activePage1.length, 10);
    assert.deepStrictEqual(
      activePage1.map((g) => g.targetName),
      [
        "Active Goal 15",
        "Active Goal 14",
        "Active Goal 13",
        "Active Goal 12",
        "Active Goal 11",
        "Active Goal 10",
        "Active Goal 9",
        "Active Goal 8",
        "Active Goal 7",
        "Active Goal 6",
      ],
    );

    const last1 = activePage1.at(-1)!;
    const activePage2 = queryPage("active", {
      createdAt: last1.createdAt,
      id: last1.id,
    });
    assert.strictEqual(activePage2.length, 5);
    assert.deepStrictEqual(
      activePage2.map((g) => g.targetName),
      [
        "Active Goal 5",
        "Active Goal 4",
        "Active Goal 3",
        "Active Goal 2",
        "Active Goal 1",
      ],
    );

    const achievedPage1 = queryPage("achieved");
    assert.strictEqual(achievedPage1.length, 10);
    assert.strictEqual(achievedPage1[0].targetName, "Achieved Goal 12");

    const lastAchieved = achievedPage1.at(-1)!;
    const achievedPage2 = queryPage("achieved", {
      createdAt: lastAchieved.createdAt,
      id: lastAchieved.id,
    });
    assert.strictEqual(achievedPage2.length, 2);
    assert.deepStrictEqual(
      achievedPage2.map((g) => g.targetName),
      ["Achieved Goal 2", "Achieved Goal 1"],
    );
  });

  await t.test("moves goals between tabs on 100% increment, decrement, and edit clamping", () => {
    // Increment Active Goal 15 (750 / 1000) + 500 -> clamped to 1000 -> moves to Achieved
    const nextMoney = applyGoalProgressDelta(750, 500, 1000);
    assert.strictEqual(nextMoney, 1000);
    sqlite
      .prepare(`UPDATE goals SET currentMoney = ? WHERE targetName = ?`)
      .run(nextMoney, "Active Goal 15");

    assert.deepStrictEqual(getCounts(), { active: 14, achieved: 13 });
    assert.ok(
      !queryPage("active").some((g) => g.targetName === "Active Goal 15"),
    );

    // Decrement back by 100 -> 900 -> moves back to Active
    const revertedMoney = applyGoalProgressDelta(nextMoney, -100, 1000);
    sqlite
      .prepare(`UPDATE goals SET currentMoney = ? WHERE targetName = ?`)
      .run(revertedMoney, "Active Goal 15");
    assert.deepStrictEqual(getCounts(), { active: 15, achieved: 12 });

    // Edit Active Goal 14 (700 / 1000): lower targetMoney to 400 -> currentMoney clamped to 400 -> Achieved
    const clampedOnEdit = clampGoalMoney(700, 400);
    sqlite
      .prepare(
        `UPDATE goals SET targetMoney = ?, currentMoney = ? WHERE targetName = ?`,
      )
      .run(400, clampedOnEdit, "Active Goal 14");

    assert.deepStrictEqual(getCounts(), { active: 14, achieved: 13 });
  });

  await t.test("handles empty states for both tabs cleanly", () => {
    sqlite.exec(`DELETE FROM goals`);
    assert.deepStrictEqual(getCounts(), { active: 0, achieved: 0 });
    assert.deepStrictEqual(queryPage("active"), []);
    assert.deepStrictEqual(queryPage("achieved"), []);
  });

  sqlite.close();
});

test("goal form dialog dynamic viewport layout and focus scroll math", async (t) => {
  await t.test("computes safe max heights and zero offset when keyboard is closed", () => {
    const metrics = computeGoalDialogLayoutMetrics({
      windowHeight: 844,
      keyboardHeight: 336,
      isKeyboardVisible: false,
      topInset: 47,
      bottomInset: 34,
    });

    assert.strictEqual(metrics.effectiveKeyboardHeight, 0);
    assert.strictEqual(metrics.availableViewportHeight, 763); // 844 - 47 - 34
    assert.strictEqual(metrics.dialogMaxHeight, 731); // 763 - 16 - 16
    assert.strictEqual(metrics.extraKeyboardBottomMargin, 0);
    assert.strictEqual(metrics.scrollMaxHeight, 595); // 731 - (60 + 64 + 12)
  });

  await t.test("shifts dialog above keyboard without double-subtracting bottom safe inset", () => {
    // iOS Face ID / Android Edge-to-Edge where keyboard height covers bottomInset
    const metrics = computeGoalDialogLayoutMetrics({
      windowHeight: 844,
      keyboardHeight: 336,
      isKeyboardVisible: true,
      topInset: 47,
      bottomInset: 34,
      titleHeight: 52,
      actionsHeight: 58,
      contentBottomPadding: 10,
    });

    assert.strictEqual(metrics.effectiveKeyboardHeight, 336);
    assert.strictEqual(metrics.availableViewportHeight, 461); // 844 - 47 - 336
    assert.strictEqual(metrics.dialogMaxHeight, 429); // 461 - 16 - 16
    assert.strictEqual(metrics.extraKeyboardBottomMargin, 302); // 336 - 34
    assert.strictEqual(metrics.scrollMaxHeight, 309); // 429 - (52 + 58 + 10)
    // Verify total height inside Paper wrapper (wrapperHeight = 844 - 47 - 34 = 763)
    const totalUsedInsideWrapper =
      16 + metrics.dialogMaxHeight + 16 + metrics.extraKeyboardBottomMargin;
    assert.strictEqual(totalUsedInsideWrapper, 763);
  });

  await t.test("handles Android non-edge-to-edge (bottomInset = 0) and small screens without clipping chrome", () => {
    const smallPhone = computeGoalDialogLayoutMetrics({
      windowHeight: 640,
      keyboardHeight: 270,
      isKeyboardVisible: true,
      topInset: 24,
      bottomInset: 0,
      titleHeight: 52,
      actionsHeight: 58,
      contentBottomPadding: 10,
    });

    assert.strictEqual(smallPhone.availableViewportHeight, 346); // 640 - 24 - 270
    assert.strictEqual(smallPhone.dialogMaxHeight, 314);
    assert.strictEqual(smallPhone.extraKeyboardBottomMargin, 270);
    assert.strictEqual(smallPhone.scrollMaxHeight, 194);
    assert.ok(
      smallPhone.scrollMaxHeight + 52 + 58 + 10 <= smallPhone.dialogMaxHeight,
    );

    const tinyViewport = computeGoalDialogLayoutMetrics({
      windowHeight: 280,
      keyboardHeight: 260,
      isKeyboardVisible: true,
      topInset: 24,
      bottomInset: 0,
    });
    assert.strictEqual(tinyViewport.availableViewportHeight, 0);
    assert.strictEqual(tinyViewport.dialogMaxHeight, 0);
    assert.strictEqual(tinyViewport.scrollMaxHeight, 0);
  });

  await t.test("scrolls Note and obscured fields cleanly into view and avoids redundant jumps", () => {
    // Already visible Target Name at top
    assert.strictEqual(
      computeFocusedFieldScrollOffset({
        fieldY: 0,
        fieldHeight: 56,
        viewportHeight: 260,
        currentScrollY: 0,
      }),
      null,
    );

    // Bottom Note textarea partially/fully below shrunk ScrollView viewport
    const noteScroll = computeFocusedFieldScrollOffset({
      fieldY: 220,
      fieldHeight: 90,
      viewportHeight: 200,
      currentScrollY: 0,
    });
    assert.strictEqual(noteScroll, 122); // (220 + 90 + 12) - 200 = 122

    // Focusing back up on Target Name while scrolled down to Note
    const topScroll = computeFocusedFieldScrollOffset({
      fieldY: 64,
      fieldHeight: 56,
      viewportHeight: 200,
      currentScrollY: 122,
    });
    assert.strictEqual(topScroll, 56); // 64 - 8 = 56

    // Tall multiline Note taller than tiny ScrollView viewport
    const tallNoteScroll = computeFocusedFieldScrollOffset({
      fieldY: 200,
      fieldHeight: 160,
      viewportHeight: 120,
      currentScrollY: 0,
    });
    assert.strictEqual(tallNoteScroll, 252); // (200 + 160 + 12) - 120
  });
});
