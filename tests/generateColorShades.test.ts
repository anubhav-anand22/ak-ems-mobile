import test from "node:test";
import assert from "node:assert/strict";
import { generateColorShades } from "../src/lib/generateColorShades";

test("generateColorShades", async (t) => {
  await t.test("generates the requested number of shades", () => {
    const shades = generateColorShades("#208AEF", 5);
    assert.strictEqual(shades.length, 5);
  });

  await t.test("provides accessible text colors (black or white)", () => {
    const shades = generateColorShades("#ffffff", 4);
    for (const shade of shades) {
      assert.ok(
        shade.textColor === "#000000" || shade.textColor === "#FFFFFF",
        `Expected #000000 or #FFFFFF but got ${shade.textColor}`,
      );
      assert.ok(typeof shade.color === "string" && shade.color.length > 0);
    }
  });

  await t.test("parses RGB strings correctly", () => {
    const shades = generateColorShades("rgb(100, 150, 200)", 3);
    assert.strictEqual(shades.length, 3);
  });

  await t.test("handles 3-digit shorthand hex", () => {
    const shades = generateColorShades("#abc", 2);
    assert.strictEqual(shades.length, 2);
  });
});
