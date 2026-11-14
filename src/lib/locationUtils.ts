import { Platform, Linking } from "react-native";
import { startActivityAsync, ActivityAction } from "expo-intent-launcher";
import Constants from "expo-constants";
import { log } from "./log";

export * from "./locationMath";

/**
 * Returns the Android package name from Expo config or fallback.
 */
export const getAndroidPackageName = (): string => {
  return (
    Constants.expoConfig?.android?.package ||
    "com.ak22git7488.akemsmobile"
  );
};

/**
 * Launches Android or iOS App Details Settings so the user can easily
 * change location permissions to "Allow all the time".
 */
export const openAppSettings = async (): Promise<boolean> => {
  if (Platform.OS === "android") {
    try {
      const pkg = getAndroidPackageName();
      await startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, {
        data: `package:${pkg}`,
      });
      return true;
    } catch (err) {
      log.info("startActivityAsync APPLICATION_DETAILS_SETTINGS failed", err);
    }
  }

  try {
    await Linking.openSettings();
    return true;
  } catch (err) {
    log.error("Failed to open app settings:", err);
    return false;
  }
};

/**
 * Launches Android Battery Optimization Settings so the user can exempt the app
 * from Doze mode / battery restrictions for real-time background geofencing.
 */
export const openBatteryOptimizationSettings = async (): Promise<boolean> => {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    await startActivityAsync("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
    return true;
  } catch (err) {
    log.info("IGNORE_BATTERY_OPTIMIZATION_SETTINGS intent failed", err);
  }

  // Fallback to app details settings
  return openAppSettings();
};
