import test from "node:test";
import assert from "node:assert/strict";
import { parseStrMath } from "../src/lib/parseStrMath";

test("parseStrMath", async (t) => {
  await t.test("evaluates simple addition and subtraction", () => {
    const [result, err] = parseStrMath("10 + 25 - 5");
    assert.strictEqual(err, null);
    assert.strictEqual(result, 30);
  });

  await t.test("respects operator precedence", () => {
    const [result, err] = parseStrMath("10 + 5 * 4");
    assert.strictEqual(err, null);
    assert.strictEqual(result, 30);
  });

  await t.test("evaluates parentheses properly", () => {
    const [result, err] = parseStrMath("(10 + 5) * 4");
    assert.strictEqual(err, null);
    assert.strictEqual(result, 60);
  });

  await t.test("handles decimals", () => {
    const [result, err] = parseStrMath("12.5 * 2 + 0.75");
    assert.strictEqual(err, null);
    assert.strictEqual(result, 25.75);
  });

  await t.test("returns error for invalid mathematical string", () => {
    const [result, err] = parseStrMath("invalid + math syntax **");
    assert.strictEqual(result, null);
    assert.ok(err instanceof Error);
  });
});
