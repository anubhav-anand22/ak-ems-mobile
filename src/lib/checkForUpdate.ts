import { compareAppVersions } from "./compareAppVersions";
import getLatestAppData from "./getLatestAppData";
import Constants from "expo-constants";
import { useGlobalState } from "./gState";
import { getRandomStr } from "./getRandomStr";
import { openURL } from "expo-linking";

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
      const appUrl = data.apk.bestArch || data.apk.universal;
      if (!appUrl) return;
      openURL(appUrl);
    },
    onCancel: () => {},
  });
};

export default checkForUpdate;
