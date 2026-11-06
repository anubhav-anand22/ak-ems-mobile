import test from "node:test";
import assert from "node:assert/strict";
import { formatSmartDate } from "../src/lib/formatSmartDate";

test("formatSmartDate", async (t) => {
  await t.test("formats current date as 'today, <time>'", () => {
    const now = new Date();
    const formatted = formatSmartDate(now);
    assert.ok(formatted.startsWith("today, "), `Expected prefix 'today, ' but got: ${formatted}`);
  });

  await t.test("formats yesterday date as 'yesterday, <time>'", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formatted = formatSmartDate(yesterday);
    assert.ok(formatted.startsWith("yesterday, "), `Expected prefix 'yesterday, ' but got: ${formatted}`);
  });

  await t.test("formats older dates in current year with day and month", () => {
    const earlierThisYear = new Date();
    earlierThisYear.setMonth(0, 15); // Jan 15th of current year
    const formatted = formatSmartDate(earlierThisYear);
    assert.ok(!formatted.startsWith("today"), "Should not be today");
    assert.ok(formatted.includes("jan"), `Expected month 'jan' in: ${formatted}`);
  });
});
