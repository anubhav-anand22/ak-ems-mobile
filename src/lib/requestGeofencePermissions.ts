import Geofencing from "@rn-org/react-native-geofencing";
import notifee from "@notifee/react-native";
import { log } from "./log";

export const requestGeofencePermissions = async (): Promise<
  [string, false] | [null, true]
> => {
  try {
    // 1. Request notification permission upfront (needed for Android 13+ & iOS geofence alerts)
    try {
      await notifee.requestPermission();
    } catch (notifErr) {
      log.error("Failed to request notification permission:", notifErr);
    }

    // 2. Geofencing relies on background location tracking, so allowAlways is required
    const response = await Geofencing.requestLocation({ allowAlways: true });

    if (response.success) {
      console.log("Permission granted:", response.location); // Should return "Always"
      return [response.location, false];
    } else {
      console.log("Permission denied");
      return [null, true];
    }
  } catch (error) {
    console.error("Failed to request permissions:", error);
    log.error(error);
    return [null, true];
  }
};
