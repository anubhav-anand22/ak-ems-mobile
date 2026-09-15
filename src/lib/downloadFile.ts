import notifee from "@notifee/react-native";
import { getRandomStr } from "./getRandomStr";
import { log } from "./log";
import RNFS from "react-native-fs";
import { requestStoragePermission } from "./requestStoragePermission";

export const downloadFile = async (
  url: string,
  filename: string,
  fileHash?: string,
) => {
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
        log.info("Download file hash matches, skipping download", {
          fileHash,
          path,
          computedFileHash,
        });
        await notifee.displayNotification({
          id: notificationId,
          title: "File Ready",
          body: "The file was already completely downloaded.",
          android: { channelId },
        });
        return path;
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
              id: "download-task",
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

    await notifee.displayNotification({
      id: notificationId,
      title: "Download Complete",
      body: "Your file has been saved successfully.",
      android: {
        channelId,
      },
    });

    return path;
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
