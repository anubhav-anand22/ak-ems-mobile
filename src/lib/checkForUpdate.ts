import { compareAppVersions } from "./compareAppVersions";
import getLatestAppData from "./getLatestAppData";
import Constants from "expo-constants";
import { useGlobalState } from "./gState";
import { getRandomStr } from "./getRandomStr";
import { openURL } from "expo-linking";
import { performAppUpdate } from "./deltaUpdateService";

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
      await performAppUpdate({
        data,
        newVersion,
        currentVersion: appVersion,
      });
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
    confirmTxt: "UPDATE",
  });
};

export default checkForUpdate;
