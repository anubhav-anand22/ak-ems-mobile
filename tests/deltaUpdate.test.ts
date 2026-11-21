import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeVersion,
  getDeltaPatchFilename,
  findDeltaPatchAsset,
  selectFallbackApk,
  determineTargetUpdateFlow,
} from "../src/lib/deltaUpdatePlan";
import type { ApkVariant } from "../modules/hdiff-patcher";

test("deltaUpdate - normalizeVersion", async (t) => {
  await t.test("strips leading 'v' and 'V'", () => {
    assert.strictEqual(normalizeVersion("v8.0.0"), "8.0.0");
    assert.strictEqual(normalizeVersion("V1.2.3"), "1.2.3");
  });

  await t.test("handles already normalized strings and trims whitespace", () => {
    assert.strictEqual(normalizeVersion("8.0.0"), "8.0.0");
    assert.strictEqual(normalizeVersion("  v0.9.2  "), "0.9.2");
  });

  await t.test("handles null, undefined, and empty string safely", () => {
    assert.strictEqual(normalizeVersion(null), "");
    assert.strictEqual(normalizeVersion(undefined), "");
    assert.strictEqual(normalizeVersion(""), "");
  });
});

test("deltaUpdate - getDeltaPatchFilename format", async (t) => {
  await t.test("formats arm64-v8a patch filename", () => {
    assert.strictEqual(
      getDeltaPatchFilename("arm64-v8a", "8.0.0"),
      "patch-arm64-v8a-8.0.0.hdiff",
    );
    assert.strictEqual(
      getDeltaPatchFilename("arm64-v8a", "v8.0.0"),
      "patch-arm64-v8a-8.0.0.hdiff",
    );
  });

  await t.test("formats armeabi-v7a patch filename", () => {
    assert.strictEqual(
      getDeltaPatchFilename("armeabi-v7a", "0.9.1"),
      "patch-armeabi-v7a-0.9.1.hdiff",
    );
  });

  await t.test("formats universal patch filename", () => {
    assert.strictEqual(
      getDeltaPatchFilename("universal", "v1.5.0"),
      "patch-universal-1.5.0.hdiff",
    );
  });
});

test("deltaUpdate - findDeltaPatchAsset matching", async (t) => {
  const sampleAssets = [
    {
      name: "app-arm64-v8a-release.apk",
      browser_download_url: "https://example.com/app-arm64-v8a-release.apk",
    },
    {
      name: "app-universal-release.apk",
      browser_download_url: "https://example.com/app-universal-release.apk",
    },
    {
      name: "patch-arm64-v8a-8.0.0.hdiff",
      browser_download_url: "https://example.com/patch-arm64-v8a-8.0.0.hdiff",
      size: 1542000,
    },
    {
      name: "patch-universal-8.0.0.hdiff",
      browser_download_url: "https://example.com/patch-universal-8.0.0.hdiff",
      size: 2400000,
    },
    {
      name: "patch-armeabi-v7a-8.0.0.hdiff",
      browser_download_url: "https://example.com/patch-armeabi-v7a-8.0.0.hdiff",
      size: 1490000,
    },
  ];

  await t.test("finds exact per-ABI patch asset for arm64-v8a", () => {
    const asset = findDeltaPatchAsset(sampleAssets, "arm64-v8a", "8.0.0");
    assert.ok(asset);
    assert.strictEqual(asset.name, "patch-arm64-v8a-8.0.0.hdiff");
    assert.strictEqual(
      asset.browser_download_url,
      "https://example.com/patch-arm64-v8a-8.0.0.hdiff",
    );
  });

  await t.test("finds per-ABI patch asset for armeabi-v7a", () => {
    const asset = findDeltaPatchAsset(sampleAssets, "armeabi-v7a", "v8.0.0");
    assert.ok(asset);
    assert.strictEqual(asset.name, "patch-armeabi-v7a-8.0.0.hdiff");
  });

  await t.test("finds universal patch asset when variant is universal", () => {
    const asset = findDeltaPatchAsset(sampleAssets, "universal", "8.0.0");
    assert.ok(asset);
    assert.strictEqual(asset.name, "patch-universal-8.0.0.hdiff");
  });

  await t.test("returns null if variant is unknown", () => {
    const asset = findDeltaPatchAsset(sampleAssets, "unknown", "8.0.0");
    assert.strictEqual(asset, null);
  });

  await t.test("returns null if version has no matching patch", () => {
    const asset = findDeltaPatchAsset(sampleAssets, "arm64-v8a", "7.5.0");
    assert.strictEqual(asset, null);
  });

  await t.test("returns null if assets array is empty or undefined", () => {
    assert.strictEqual(findDeltaPatchAsset([], "arm64-v8a", "8.0.0"), null);
    assert.strictEqual(findDeltaPatchAsset(undefined, "arm64-v8a", "8.0.0"), null);
  });
});

test("deltaUpdate - selectFallbackApk priority (ARM -> Universal)", async (t) => {
  await t.test("prefers bestArch (ARM) when both bestArch and universal exist", () => {
    const fallback = selectFallbackApk({
      apk: {
        bestArch: "https://example.com/app-arm64-v8a-release.apk",
        universal: "https://example.com/app-universal-release.apk",
      },
      sha256: {
        bestArch: "sha-arm64",
        universal: "sha-universal",
      },
    });

    assert.ok(fallback);
    assert.strictEqual(fallback.isArm, true);
    assert.strictEqual(
      fallback.url,
      "https://example.com/app-arm64-v8a-release.apk",
    );
    assert.strictEqual(fallback.sha256, "sha-arm64");
  });

  await t.test("falls back to universal when bestArch is missing", () => {
    const fallback = selectFallbackApk({
      apk: {
        bestArch: undefined,
        universal: "https://example.com/app-universal-release.apk",
      },
      sha256: {
        universal: "sha-universal",
      },
    });

    assert.ok(fallback);
    assert.strictEqual(fallback.isArm, false);
    assert.strictEqual(
      fallback.url,
      "https://example.com/app-universal-release.apk",
    );
    assert.strictEqual(fallback.sha256, "sha-universal");
  });

  await t.test("returns null when no APKs are available", () => {
    const fallback = selectFallbackApk({ apk: {} });
    assert.strictEqual(fallback, null);
  });
});

test("deltaUpdate - determineTargetUpdateFlow orchestration", async (t) => {
  const sampleData = {
    apk: {
      bestArch: "https://example.com/app-arm64-v8a-release.apk",
      universal: "https://example.com/app-universal-release.apk",
    },
    sha256: {
      bestArch: "sha256-arm",
      universal: "sha256-uni",
    },
    releaseData: {
      tag_name: "v8.1.0",
      assets: [
        {
          name: "app-arm64-v8a-release.apk",
          browser_download_url: "https://example.com/app-arm64-v8a-release.apk",
        },
        {
          name: "app-universal-release.apk",
          browser_download_url: "https://example.com/app-universal-release.apk",
        },
        {
          name: "patch-arm64-v8a-8.0.0.hdiff",
          browser_download_url: "https://example.com/patch-arm64-v8a-8.0.0.hdiff",
        },
      ],
    },
  };

  await t.test("selects Tier 1 DELTA_PATCH when patch matches installed variant", () => {
    const plan = determineTargetUpdateFlow({
      currentVersion: "8.0.0",
      installedVariant: "arm64-v8a",
      releaseAssets: sampleData.releaseData.assets,
      apkData: sampleData,
    });

    assert.strictEqual(plan.type, "DELTA_PATCH");
    if (plan.type === "DELTA_PATCH") {
      assert.strictEqual(plan.patchAsset.name, "patch-arm64-v8a-8.0.0.hdiff");
      assert.strictEqual(plan.apkVariant, "arm64-v8a");
      assert.strictEqual(plan.targetVersion, "8.1.0");
    }
  });

  await t.test("falls back to ARM APK when installed variant has no delta patch", () => {
    // Device has universal installed, but only arm64-v8a patch is present
    const plan = determineTargetUpdateFlow({
      currentVersion: "8.0.0",
      installedVariant: "universal",
      releaseAssets: sampleData.releaseData.assets,
      apkData: sampleData,
    });

    assert.strictEqual(plan.type, "FALLBACK_FULL_APK");
    if (plan.type === "FALLBACK_FULL_APK") {
      assert.strictEqual(plan.isArm, true);
      assert.strictEqual(plan.apkUrl, "https://example.com/app-arm64-v8a-release.apk");
      assert.match(plan.reason, /No delta patch asset found for variant 'universal'/);
    }
  });

  await t.test("falls back to ARM APK when installed variant is unknown", () => {
    const plan = determineTargetUpdateFlow({
      currentVersion: "8.0.0",
      installedVariant: "unknown",
      releaseAssets: sampleData.releaseData.assets,
      apkData: sampleData,
    });

    assert.strictEqual(plan.type, "FALLBACK_FULL_APK");
    if (plan.type === "FALLBACK_FULL_APK") {
      assert.strictEqual(plan.isArm, true);
      assert.match(plan.reason, /could not be determined/);
    }
  });

  await t.test("falls back to Universal APK when patch is missing and no ARM APK available", () => {
    const uniOnlyData = {
      apk: {
        universal: "https://example.com/app-universal-release.apk",
      },
      sha256: {
        universal: "sha256-uni",
      },
      releaseData: {
        tag_name: "8.1.0",
        assets: [
          {
            name: "app-universal-release.apk",
            browser_download_url: "https://example.com/app-universal-release.apk",
          },
        ],
      },
    };

    const plan = determineTargetUpdateFlow({
      currentVersion: "8.0.0",
      installedVariant: "arm64-v8a",
      releaseAssets: uniOnlyData.releaseData.assets,
      apkData: uniOnlyData,
    });

    assert.strictEqual(plan.type, "FALLBACK_FULL_APK");
    if (plan.type === "FALLBACK_FULL_APK") {
      assert.strictEqual(plan.isArm, false);
      assert.strictEqual(plan.apkUrl, "https://example.com/app-universal-release.apk");
    }
  });

  await t.test("returns NO_UPDATE_SOURCE when release has neither patch nor APKs", () => {
    const emptyData = {
      apk: {},
      releaseData: {
        tag_name: "8.1.0",
        assets: [],
      },
    };

    const plan = determineTargetUpdateFlow({
      currentVersion: "8.0.0",
      installedVariant: "arm64-v8a",
      releaseAssets: [],
      apkData: emptyData,
    });

    assert.strictEqual(plan.type, "NO_UPDATE_SOURCE");
  });
});
