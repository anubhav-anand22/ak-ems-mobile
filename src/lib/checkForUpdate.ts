import { compareAppVersions } from "./compareAppVersions";
import getLatestAppData from "./getLatestAppData";
import Constants from "expo-constants";
import { useGlobalState } from "./gState";
import { getRandomStr } from "./getRandomStr";
import { openURL } from "expo-linking";
import { downloadFile } from "./downloadFile";
import {
  resolveApkFilename,
  formatDownloadSuccessMessage,
} from "./updateUtils";

const checkForUpdate = async () => {
  // Clear any previously downloaded update banner when a new check runs
  useGlobalState.getState().setDownloadedUpdate(null);

  const appVersion = Constants.expoConfig?.version;
  if (!appVersion) return;

  const data = await getLatestAppData(true);
  if (!data) return;

  const newVersion = data.releaseData?.tag_name;

  if (!newVersion) return;

  const result = compareAppVersions(appVersion, newVersion);
  if (result !== -1)
    return useGlobalState
      .getState()
      .setSnackbar({ message: "No update available." });

  useGlobalState.getState().addConfirm({
    id: getRandomStr(),
    title: "Update Available",
    body: `A new version (${newVersion}) is available.`,
    onConfirm: async () => {
      const d = data.apk.bestArch
        ? {
            url: data.apk.bestArch,
            sha256: data.sha256.bestArch,
          }
        : data.apk.universal
          ? {
              url: data.apk.universal,
              sha256: data.sha256.universal,
            }
          : null;

      if (!d) return;

      const filename = resolveApkFilename(
        d.url,
        data.releaseData?.name,
        newVersion,
      );

      const downloadResult = await downloadFile(d.url, filename, d.sha256);
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
      }
    },
    onCancel: () => {},
    aditionalBtns: [
      {
        id: getRandomStr(),
        txt: "Open link",
        onPress: () => {
          const appUrl = data.apk.bestArch || data.apk.universal;
          if (!appUrl) return;
          openURL(appUrl);
        },
        type: "DEFAULT",
      },
    ],
    confirmTxt: "DOWNLOAD",
  });
};

export default checkForUpdate;
