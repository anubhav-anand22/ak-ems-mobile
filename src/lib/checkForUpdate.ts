import { compareAppVersions } from "./compareAppVersions";
import getLatestAppData from "./getLatestAppData";
import Constants from "expo-constants";
import { useGlobalState } from "./gState";
import { getRandomStr } from "./getRandomStr";
import { openURL } from "expo-linking";
import {} from "@notifee/react-native";
import { downloadFile } from "./downloadFile";

const checkForUpdate = async () => {
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
    onConfirm: () => {
      // const appUrl = data.apk.bestArch || data.apk.universal;
      // const sha256 = data.sha256.bestArch || data.sha256.universal;
      // const name = data.releaseData?.name;
      // if (!appUrl || !name || !sha256) return;
      // // openURL(appUrl);
      // downloadFile(appUrl, (obj) => obj.documentDirectory + name, sha256);
      const name = data.releaseData?.name;
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

      if (d && name) downloadFile(d.url, name, d.sha256);
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
