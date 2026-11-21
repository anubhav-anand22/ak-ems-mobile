import type { ApkVariant } from "../../modules/hdiff-patcher";

export type TargetUpdatePlan =
  | {
      type: "DELTA_PATCH";
      patchAsset: {
        name: string;
        browser_download_url: string;
        size?: number;
      };
      apkVariant: ApkVariant;
      targetVersion: string;
    }
  | {
      type: "FALLBACK_FULL_APK";
      reason: string;
      apkUrl: string;
      sha256?: string;
      isArm: boolean;
      targetVersion: string;
    }
  | {
      type: "NO_UPDATE_SOURCE";
      reason: string;
    };

/**
 * Normalizes a version string by removing any leading 'v' or 'V' and trimming.
 * E.g., "v8.0.0" -> "8.0.0"
 */
export function normalizeVersion(version?: string | null): string {
  if (!version) return "";
  const trimmed = version.trim();
  if (trimmed.startsWith("v") || trimmed.startsWith("V")) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}

/**
 * Generates the expected delta patch asset filename for a given variant and version.
 * Format: patch-<abi>-<oldVersion>.hdiff
 */
export function getDeltaPatchFilename(
  apkVariant: string,
  currentVersion: string,
): string {
  const norm = normalizeVersion(currentVersion);
  return `patch-${apkVariant}-${norm}.hdiff`;
}

/**
 * Searches release assets for a matching delta patch.
 */
export function findDeltaPatchAsset<
  T extends { name: string; browser_download_url: string; [key: string]: any },
>(
  assets: T[] | undefined,
  apkVariant: ApkVariant,
  currentVersion: string,
): T | null {
  if (!assets || assets.length === 0) return null;
  if (apkVariant === "unknown") return null;

  const targetFilename = getDeltaPatchFilename(apkVariant, currentVersion).toLowerCase();
  const match = assets.find(
    (asset) => asset.name.trim().toLowerCase() === targetFilename,
  );
  return match || null;
}

/**
 * Selects the best full APK URL from the release data (ARM preferred, then Universal).
 */
export function selectFallbackApk(data: {
  apk?: { universal?: string; bestArch?: string };
  sha256?: { universal?: string; bestArch?: string };
}): { url: string; sha256?: string; isArm: boolean } | null {
  if (data.apk?.bestArch) {
    return {
      url: data.apk.bestArch,
      sha256: data.sha256?.bestArch,
      isArm: true,
    };
  }
  if (data.apk?.universal) {
    return {
      url: data.apk.universal,
      sha256: data.sha256?.universal,
      isArm: false,
    };
  }
  return null;
}

/**
 * Evaluates available assets and installed metadata to choose between DELTA_PATCH or FALLBACK_FULL_APK.
 */
export function determineTargetUpdateFlow(options: {
  currentVersion: string;
  installedVariant: ApkVariant;
  releaseAssets?: Array<{ name: string; browser_download_url: string; [key: string]: any }>;
  apkData: {
    apk?: { universal?: string; bestArch?: string };
    sha256?: { universal?: string; bestArch?: string };
    releaseData?: { tag_name?: string };
  };
}): TargetUpdatePlan {
  const { currentVersion, installedVariant, releaseAssets, apkData } = options;
  const targetVersion = normalizeVersion(apkData.releaseData?.tag_name || "");

  // 1. Try finding delta patch
  if (installedVariant !== "unknown" && releaseAssets && releaseAssets.length > 0) {
    const patchAsset = findDeltaPatchAsset(
      releaseAssets,
      installedVariant,
      currentVersion,
    );
    if (patchAsset) {
      return {
        type: "DELTA_PATCH",
        patchAsset,
        apkVariant: installedVariant,
        targetVersion,
      };
    }
  }

  // 2. Fallback to full APK
  const fallback = selectFallbackApk(apkData);
  if (fallback) {
    const reason =
      installedVariant === "unknown"
        ? "Installed APK variant could not be determined"
        : `No delta patch asset found for variant '${installedVariant}' and version '${normalizeVersion(currentVersion)}'`;
    return {
      type: "FALLBACK_FULL_APK",
      reason,
      apkUrl: fallback.url,
      sha256: fallback.sha256,
      isArm: fallback.isArm,
      targetVersion,
    };
  }

  return {
    type: "NO_UPDATE_SOURCE",
    reason: "No delta patch or fallback release APK available in latest release",
  };
}
