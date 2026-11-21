export type ApkVariant =
  | "arm64-v8a"
  | "armeabi-v7a"
  | "x86_64"
  | "x86"
  | "universal"
  | "unknown";

export type InstalledApkInfo = {
  apkPath: string;
  apkVariant: ApkVariant;
  apkSize: number;
};

export type ApplyPatchErrorCode =
  | "OLD_FILE_MISMATCH"
  | "LOW_STORAGE"
  | "PATCH_FAILED"
  | "INVALID_APK"
  | "IO_ERROR";

export type ApplyPatchResult = {
  success: boolean;
  errorCode?: ApplyPatchErrorCode;
  message?: string;
};

function getNativeModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("react-native");
    if (rn?.Platform?.OS !== "android") return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require("expo");
    if (typeof expo?.requireOptionalNativeModule === "function") {
      return expo.requireOptionalNativeModule("HDiffPatcher");
    }
    return null;
  } catch {
    return null;
  }
}

export async function getInstalledApkInfo(): Promise<InstalledApkInfo> {
  const native = getNativeModule();
  if (native?.getInstalledApkInfo) {
    try {
      const res = await native.getInstalledApkInfo();
      return {
        apkPath: res.apkPath || "",
        apkVariant: (res.apkVariant as ApkVariant) || "unknown",
        apkSize: Number(res.apkSize) || 0,
      };
    } catch (e) {
      console.warn("HDiffPatcher.getInstalledApkInfo failed:", e);
    }
  }
  return {
    apkPath: "",
    apkVariant: "unknown",
    apkSize: 0,
  };
}

export async function applyHdiffPatch(
  patchPath: string,
  outputApkPath: string,
): Promise<ApplyPatchResult> {
  const native = getNativeModule();
  if (native?.applyHdiffPatch) {
    try {
      const res = await native.applyHdiffPatch(patchPath, outputApkPath);
      return {
        success: Boolean(res.success),
        errorCode: res.errorCode as ApplyPatchErrorCode | undefined,
        message: res.message as string | undefined,
      };
    } catch (e: any) {
      return {
        success: false,
        errorCode: "PATCH_FAILED",
        message: e?.message || "Failed to execute applyHdiffPatch",
      };
    }
  }
  return {
    success: false,
    errorCode: "PATCH_FAILED",
    message: "HDiffPatcher native module is not available on this platform",
  };
}
