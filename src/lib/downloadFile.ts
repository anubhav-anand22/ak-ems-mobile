import notifee from "@notifee/react-native";
import { getRandomStr } from "./getRandomStr";
import { log } from "./log";
import RNFS from "react-native-fs";
import { Platform } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { requestStoragePermission } from "./requestStoragePermission";

export type DownloadFileResult = {
  path: string;
  publicUri: string;
  filename: string;
};

export const saveToPublicDownloads = async (
  sourcePath: string,
  filename: string,
): Promise<{ publicUri: string }> => {
  if (Platform.OS === "android") {
    // Attempt 1: MediaStore API via ReactNativeBlobUtil (Android 10+ standard)
    try {
      const mimeType = filename.toLowerCase().endsWith(".apk")
        ? "application/vnd.android.package-archive"
        : "application/octet-stream";

      const contentUri =
        await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
          {
            name: filename,
            parentFolder: "",
            mimeType,
          },
          "Download",
          sourcePath,
        );

      if (contentUri) {
        log.info("Successfully copied to MediaStore Downloads", {
          contentUri,
          filename,
        });
        // Delete internal copy to avoid duplicate storage
        await RNFS.unlink(sourcePath).catch((err) =>
          log.warn("Failed to delete temp internal file after MediaStore copy", err),
        );
        return { publicUri: contentUri };
      }
    } catch (mediaStoreError) {
      log.warn(
        "copyToMediaStore failed, falling back to direct DownloadDirectoryPath copy",
        mediaStoreError,
      );
    }

    // Attempt 2: Direct copy to RNFS.DownloadDirectoryPath
    try {
      const publicPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
      await RNFS.copyFile(sourcePath, publicPath);
      log.info("Successfully copied to RNFS.DownloadDirectoryPath", {
        publicPath,
      });
      await RNFS.unlink(sourcePath).catch((err) =>
        log.warn("Failed to delete temp internal file after RNFS copy", err),
      );
      return { publicUri: publicPath };
    } catch (rnfsError) {
      log.error("Failed to copy to RNFS.DownloadDirectoryPath", rnfsError);
    }
  }

  return { publicUri: sourcePath };
};

export const downloadFile = async (
  url: string,
  filename: string,
  fileHash?: string,
): Promise<DownloadFileResult | undefined> => {
  let channelId: string | null = null;
  const notificationId = `download-task-${getRandomStr()}`;
  try {
    await notifee.requestPermission();
    if (!(await requestStoragePermission())) return;

    filename = filename.replaceAll("/", "_").replaceAll("\\", "_");
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;

    channelId = await notifee.createChannel({
      id: "downloads",
      name: "File Downloads",
    });

    await notifee.displayNotification({
      id: notificationId,
      title: "Starting Download",
      body: "0% complete",
      android: {
        channelId,
        onlyAlertOnce: true,
        progress: { max: 100, current: 0 },
      },
    });

    const exists = await RNFS.exists(path);

    if (exists) {
      const computedFileHash = await RNFS.hash(path, "sha256");

      if (computedFileHash === fileHash?.toLowerCase()) {
        log.info("Download file hash matches, moving to Downloads", {
          fileHash,
          path,
          computedFileHash,
        });
        const publicResult = await saveToPublicDownloads(path, filename);
        await notifee.displayNotification({
          id: notificationId,
          title: "File Ready",
          body: `File is saved in Downloads as ${filename}.`,
          android: { channelId },
        });
        return {
          path: publicResult.publicUri,
          publicUri: publicResult.publicUri,
          filename,
        };
      } else {
        log.info(
          "Download file hash does not match, deleting and downloading again",
          { fileHash, path, computedFileHash },
        );
        await RNFS.unlink(path);
      }
    }

    let lastNotificationUpdate = 0;

    const downloadTask = RNFS.downloadFile({
      fromUrl: url,
      toFile: path,
      // Throttle progress events natively (Android only, but good practice)
      progressInterval: 1000,
      progress: async (res) => {
        const progress = Math.round(
          (res.bytesWritten / res.contentLength) * 100,
        );

        const now = Date.now();
        // Throttle notification updates so we don't crash the UI bridge
        if (now - lastNotificationUpdate > 1000 || progress === 100) {
          lastNotificationUpdate = now;

          if (channelId)
            await notifee.displayNotification({
              id: notificationId,
              title: "Downloading File...",
              body: `${progress}% complete`,
              android: {
                channelId,
                onlyAlertOnce: true,
                progress: { max: 100, current: progress },
              },
            });
        }
      },
    });

    const result = await downloadTask.promise;

    if (result.statusCode !== 200) {
      throw new Error(`Server returned status code ${result.statusCode}`);
    }

    // 5. Post-Download Verification
    if (fileHash) {
      const downloadedHash = await RNFS.hash(path, "sha256");
      if (downloadedHash.toLowerCase() !== fileHash.toLowerCase()) {
        // If it fails here, delete it so the user can try again cleanly later
        await RNFS.unlink(path);
        await notifee.displayNotification({
          id: notificationId,
          title: "Download Failed",
          body: "Downloaded file corrupted during transfer (SHA-256 mismatch).",
          android: { channelId },
        });
        log.error(
          "Downloaded file corrupted during transfer (SHA-256 mismatch).",
        );
        return;
      }
    }

    const publicResult = await saveToPublicDownloads(path, filename);

    await notifee.displayNotification({
      id: notificationId,
      title: "Download Complete",
      body: `Saved to Downloads as ${filename}.`,
      android: {
        channelId,
      },
    });

    return {
      path: publicResult.publicUri,
      publicUri: publicResult.publicUri,
      filename,
    };
  } catch (error) {
    log.error(error);
    if (channelId)
      await notifee.displayNotification({
        id: notificationId,
        title: "Download Failed",
        body: "There was an error downloading your file.",
        android: { channelId },
      });
  }
};
