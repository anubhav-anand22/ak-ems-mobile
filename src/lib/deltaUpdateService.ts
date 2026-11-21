import { Platform } from "react-native";
import RNFS from "react-native-fs";
import notifee from "@notifee/react-native";
import {
  applyHdiffPatch,
  getInstalledApkInfo,
  ApkVariant,
  ApplyPatchResult,
} from "../../modules/hdiff-patcher";
import { downloadFile, saveToPublicDownloads } from "./downloadFile";
import { getRandomStr } from "./getRandomStr";
import { useGlobalState } from "./gState";
import { log } from "./log";
import { openFileExplorer } from "./openFileExplorer";
import {
  formatDownloadFallbackMessage,
  formatDownloadSuccessMessage,
  resolveApkFilename,
} from "./updateUtils";
import {
  TargetUpdatePlan,
  normalizeVersion,
  getDeltaPatchFilename,
  findDeltaPatchAsset,
  selectFallbackApk,
  determineTargetUpdateFlow,
} from "./deltaUpdatePlan";

export {
  TargetUpdatePlan,
  normalizeVersion,
  getDeltaPatchFilename,
  findDeltaPatchAsset,
  selectFallbackApk,
  determineTargetUpdateFlow,
};

/**
 * Deletes stale .hdiff or temporary .apk files from app cache.
 */
export async function cleanupStaleUpdateFiles(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const cacheDir = RNFS.CachesDirectoryPath;
    const items = await RNFS.readDir(cacheDir).catch(() => []);
    for (const item of items) {
      const lower = item.name.toLowerCase();
      if (
        lower.endsWith(".hdiff") ||
        (lower.startsWith("update-") && lower.endsWith(".apk")) ||
        lower === "update.hdiff" ||
        lower === "update.apk"
      ) {
        await RNFS.unlink(item.path).catch(() => {});
      }
    }
  } catch (err) {
    log.warn("Failed to cleanup stale update files", err);
  }
}

/**
 * Downloads a delta patch file into the internal cache directory with Notifee progress notification.
 */
export async function downloadPatchFile(
  url: string,
  destinationPath: string,
  notificationTitle: string = "Downloading Patch...",
): Promise<boolean> {
  let channelId: string | null = null;
  const notificationId = `patch-download-${getRandomStr()}`;

  try {
    await notifee.requestPermission().catch(() => {});
    channelId = await notifee.createChannel({
      id: "downloads",
      name: "File Downloads",
    });

    await notifee.displayNotification({
      id: notificationId,
      title: notificationTitle,
      body: "0% complete",
      android: {
        channelId,
        onlyAlertOnce: true,
        progress: { max: 100, current: 0 },
      },
    });

    let lastNotificationUpdate = 0;
    const downloadTask = RNFS.downloadFile({
      fromUrl: url,
      toFile: destinationPath,
      progressInterval: 500,
      progress: async (res) => {
        const progress = res.contentLength > 0
          ? Math.round((res.bytesWritten / res.contentLength) * 100)
          : 0;
        const now = Date.now();
        if (now - lastNotificationUpdate > 800 || progress === 100) {
          lastNotificationUpdate = now;
          if (channelId) {
            await notifee.displayNotification({
              id: notificationId,
              title: notificationTitle,
              body: `${progress}% complete`,
              android: {
                channelId,
                onlyAlertOnce: true,
                progress: { max: 100, current: progress },
              },
            });
          }
        }
      },
    });

    const result = await downloadTask.promise;
    if (result.statusCode !== 200) {
      log.warn(`Patch download failed with status ${result.statusCode}`);
      return false;
    }
    return true;
  } catch (error) {
    log.error("Failed to download patch file", error);
    return false;
  } finally {
    try {
      await notifee.cancelNotification(notificationId);
    } catch {}
  }
}

/**
 * Executes the full APK fallback flow seamlessly.
 */
async function executeFullApkFallback(options: {
  data: any;
  targetVersion: string;
  reason: string;
}): Promise<boolean> {
  const { data, targetVersion, reason } = options;
  log.info(`Falling back to full APK download: ${reason}`);

  useGlobalState.getState().setSnackbar({
    message: "Delta patch unavailable. Downloading full update...",
    type: "info",
    duration: 4000,
  });

  const fallback = selectFallbackApk(data);
  if (!fallback) {
    useGlobalState.getState().setSnackbar({
      message: "No APK download available for this release.",
      type: "error",
    });
    return false;
  }

  const filename = resolveApkFilename(
    fallback.url,
    data.releaseData?.name,
    targetVersion,
  );

  const downloadResult = await downloadFile(
    fallback.url,
    filename,
    fallback.sha256,
  );

  if (downloadResult) {
    useGlobalState.getState().setDownloadedUpdate({
      filename: downloadResult.filename,
      publicUri: downloadResult.publicUri,
      downloadedAt: new Date(),
    });
    useGlobalState.getState().setSnackbar({
      message: formatDownloadSuccessMessage(downloadResult.filename),
      type: "success",
    });
    // Launch installer
    await openFileExplorer(downloadResult);
    return true;
  }

  return false;
}

/**
 * Main update orchestration function:
 * 1. Checks installed variant and release assets for .hdiff patch.
 * 2. If available, downloads and applies patch.
 * 3. On any failure or absence, seamlessly falls back to ARM -> Universal full APK.
 */
export async function performAppUpdate(options: {
  data: any;
  newVersion: string;
  currentVersion: string;
}): Promise<boolean> {
  const { data, newVersion, currentVersion } = options;
  const targetVersion = normalizeVersion(newVersion);

  // Clean up any old update leftovers first
  await cleanupStaleUpdateFiles();

  if (Platform.OS !== "android") {
    // Non-Android fallback
    return executeFullApkFallback({
      data,
      targetVersion,
      reason: "Non-Android platform",
    });
  }

  // 1. Inspect installed APK variant
  const installedInfo = await getInstalledApkInfo();
  log.info("Installed APK Info:", installedInfo);

  // 2. Determine update plan
  const plan = determineTargetUpdateFlow({
    currentVersion,
    installedVariant: installedInfo.apkVariant,
    releaseAssets: data.releaseData?.assets,
    apkData: data,
  });

  if (plan.type === "NO_UPDATE_SOURCE") {
    log.error("No update source available:", plan.reason);
    useGlobalState.getState().setSnackbar({
      message: "No compatible update assets found in this release.",
      type: "error",
    });
    return false;
  }

  // If plan is fallback directly (e.g. no patch found for variant)
  if (plan.type === "FALLBACK_FULL_APK") {
    return executeFullApkFallback({
      data,
      targetVersion,
      reason: plan.reason,
    });
  }

  // 3. TIER 1: Execute Delta Patch Update
  log.info("Starting Tier 1 delta patch update", {
    patchAsset: plan.patchAsset.name,
    variant: plan.apkVariant,
  });

  const cacheDir = RNFS.CachesDirectoryPath;
  const patchDestPath = `${cacheDir}/update.hdiff`;
  const outputApkName = `update-${targetVersion}.apk`;
  const outputApkPath = `${cacheDir}/${outputApkName}`;

  useGlobalState.getState().setSnackbar({
    message: "Downloading delta update patch...",
    type: "info",
    duration: 3000,
  });

  // Download .hdiff
  const downloadSuccess = await downloadPatchFile(
    plan.patchAsset.browser_download_url,
    patchDestPath,
    "Downloading Update Patch...",
  );

  if (!downloadSuccess) {
    await cleanupStaleUpdateFiles();
    return executeFullApkFallback({
      data,
      targetVersion,
      reason: "Failed to download delta patch file",
    });
  }

  // Applying patch notification
  let channelId: string | null = null;
  const patchingNotificationId = `patch-applying-${getRandomStr()}`;
  try {
    channelId = await notifee.createChannel({
      id: "downloads",
      name: "File Downloads",
    });
    await notifee.displayNotification({
      id: patchingNotificationId,
      title: "Applying Update...",
      body: "Reconstructing update from patch. Please wait.",
      android: {
        channelId,
        ongoing: true,
      },
    });
  } catch {}

  useGlobalState.getState().setSnackbar({
    message: "Applying update patch...",
    type: "info",
    duration: 5000,
  });

  // Apply native patch
  const patchResult: ApplyPatchResult = await applyHdiffPatch(
    patchDestPath,
    outputApkPath,
  );

  // Clear patching notification
  try {
    await notifee.cancelNotification(patchingNotificationId);
  } catch {}

  // Delete temp patch file
  await RNFS.unlink(patchDestPath).catch(() => {});

  if (!patchResult.success) {
    log.warn("Delta patch application failed", patchResult);
    await cleanupStaleUpdateFiles();
    return executeFullApkFallback({
      data,
      targetVersion,
      reason: `Patching failed with code ${patchResult.errorCode || "UNKNOWN"}: ${patchResult.message || ""}`,
    });
  }

  log.info("Delta patch successfully applied, moving to public Downloads...");

  // Save generated APK to public Downloads folder for user installation
  const publicResult = await saveToPublicDownloads(
    outputApkPath,
    resolveApkFilename(null, data.releaseData?.name, targetVersion),
  );

  useGlobalState.getState().setDownloadedUpdate({
    filename: resolveApkFilename(null, data.releaseData?.name, targetVersion),
    publicUri: publicResult.publicUri,
    downloadedAt: new Date(),
  });

  useGlobalState.getState().setSnackbar({
    message: formatDownloadSuccessMessage(
      resolveApkFilename(null, data.releaseData?.name, targetVersion),
    ),
    type: "success",
  });

  // Launch APK installer intent
  const opened = await openFileExplorer({
    publicUri: publicResult.publicUri,
    filename: resolveApkFilename(null, data.releaseData?.name, targetVersion),
  });

  if (!opened) {
    useGlobalState.getState().setSnackbar({
      message: formatDownloadFallbackMessage(
        resolveApkFilename(null, data.releaseData?.name, targetVersion),
      ),
      type: "info",
      duration: 6000,
    });
  }

  return true;
}
