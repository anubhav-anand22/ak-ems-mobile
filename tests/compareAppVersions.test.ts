import test from "node:test";
import assert from "node:assert/strict";
import { compareAppVersions } from "../src/lib/compareAppVersions";

test("compareAppVersions", async (t) => {
  await t.test("returns 0 for identical semver versions", () => {
    assert.strictEqual(compareAppVersions("0.6.7", "0.6.7"), 0);
    assert.strictEqual(compareAppVersions("1.0.0", "1.0.0"), 0);
  });

  await t.test("correctly handles leading 'v' in version strings", () => {
    assert.strictEqual(compareAppVersions("v0.6.7", "0.6.7"), 0);
    assert.strictEqual(compareAppVersions("0.6.7", "v0.6.7"), 0);
    assert.strictEqual(compareAppVersions("v1.2.3", "V1.2.3"), 0);
  });

  await t.test("identifies when new version is higher (return -1)", () => {
    assert.strictEqual(compareAppVersions("0.6.6", "0.6.7"), -1);
    assert.strictEqual(compareAppVersions("0.6.6", "v0.6.7"), -1);
    assert.strictEqual(compareAppVersions("v0.6.6", "v0.7.0"), -1);
    assert.strictEqual(compareAppVersions("0.6.7", "1.0.0"), -1);
  });

  await t.test("identifies when current version is higher (return 1)", () => {
    assert.strictEqual(compareAppVersions("0.6.7", "0.6.6"), 1);
    assert.strictEqual(compareAppVersions("v0.6.7", "0.6.6"), 1);
    assert.strictEqual(compareAppVersions("1.0.0", "v0.9.9"), 1);
  });

  await t.test("handles different segment lengths gracefully", () => {
    assert.strictEqual(compareAppVersions("1.0", "1.0.0"), 0);
    assert.strictEqual(compareAppVersions("1.0.1", "1.0"), 1);
    assert.strictEqual(compareAppVersions("1.0", "1.0.1"), -1);
  });
});
