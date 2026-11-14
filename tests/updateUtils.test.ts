import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveApkFilename,
  formatDownloadSuccessMessage,
  formatDownloadFallbackMessage,
} from "../src/lib/updateUtils";

test("resolveApkFilename", async (t) => {
  await t.test("extracts filename from URL ending with .apk", () => {
    const url =
      "https://github.com/anubhav-anand22/ak-ems-mobile/releases/download/v0.7.2/ak-ems-mobile-arm64-v8a.apk";
    const res = resolveApkFilename(url, "v0.7.2", "v0.7.2");
    assert.strictEqual(res, "ak-ems-mobile-arm64-v8a.apk");
  });

  await t.test("strips query parameters and fragments from URL", () => {
    const url =
      "https://example.com/downloads/ak-ems-mobile-universal.apk?token=123#hash";
    const res = resolveApkFilename(url, "Release", "v1.0.0");
    assert.strictEqual(res, "ak-ems-mobile-universal.apk");
  });

  await t.test("uses releaseName and appends .apk if URL has no apk name", () => {
    const url = "https://example.com/download/latest";
    const res = resolveApkFilename(url, "v0.7.3", "v0.7.3");
    assert.strictEqual(res, "v0.7.3.apk");
  });

  await t.test("sanitizes spaces, slashes and backslashes in releaseName", () => {
    const res = resolveApkFilename(null, "Release / Version 1.0.0", "v1.0.0");
    assert.strictEqual(res, "Release___Version_1.0.0.apk");
  });

  await t.test("falls back to tagName when releaseName is missing", () => {
    const res = resolveApkFilename(null, null, "v0.8.0");
    assert.strictEqual(res, "ak-ems-mobile-v0.8.0.apk");
  });

  await t.test("falls back to default name when all inputs are missing", () => {
    const res = resolveApkFilename(null, null, null);
    assert.strictEqual(res, "ak-ems-mobile-update.apk");
  });
});

test("formatDownloadMessages", async (t) => {
  await t.test("formats success message with filename", () => {
    const msg = formatDownloadSuccessMessage("app-v1.apk");
    assert.strictEqual(msg, 'Update saved to Downloads as "app-v1.apk".');
  });

  await t.test("formats fallback message with filename", () => {
    const msg = formatDownloadFallbackMessage("app-v1.apk");
    assert.strictEqual(
      msg,
      'APK is saved in your Downloads folder as "app-v1.apk". Please open your File Manager to install.',
    );
  });
});
