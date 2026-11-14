import { startActivityAsync } from "expo-intent-launcher";
import { Platform } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { log } from "./log";

export const openFileExplorer = async (update: {
  publicUri: string;
  filename: string;
}): Promise<boolean> => {
  if (Platform.OS !== "android") {
    return false;
  }

  // Attempt 1: Standard Android intent to open the Downloads folder directly
  try {
    await startActivityAsync("android.intent.action.VIEW_DOWNLOADS", {
      flags: 0x10000000, // Intent.FLAG_ACTIVITY_NEW_TASK
    });
    return true;
  } catch (err1) {
    log.info("VIEW_DOWNLOADS intent failed, trying content URI intent", err1);
  }

  // Attempt 2: If publicUri is a content:// URI, open with ACTION_VIEW and APK MIME type
  if (update.publicUri && update.publicUri.startsWith("content://")) {
    try {
      await startActivityAsync("android.intent.action.VIEW", {
        data: update.publicUri,
        type: "application/vnd.android.package-archive",
        flags: 1 | 0x10000000, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
      });
      return true;
    } catch (err2) {
      log.info("ACTION_VIEW content URI intent failed", err2);
    }
  }

  // Attempt 3: Use react-native-blob-util actionViewIntent (safely wraps FileProvider/content URI)
  try {
    const res = await ReactNativeBlobUtil.android.actionViewIntent(
      update.publicUri,
      "application/vnd.android.package-archive",
    );
    if (res !== false) {
      return true;
    }
  } catch (err3) {
    log.info("ReactNativeBlobUtil actionViewIntent failed", err3);
  }

  // Attempt 4: Documents provider root intent for downloads
  try {
    await startActivityAsync("android.intent.action.VIEW", {
      data: "content://com.android.providers.downloads.documents/root/downloads",
      type: "*/*",
      flags: 1 | 0x10000000,
    });
    return true;
  } catch (err4) {
    log.info("Documents provider intent failed", err4);
  }

  return false;
};
