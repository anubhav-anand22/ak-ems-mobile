import Geofencing from "@rn-org/react-native-geofencing";
import notifee from "@notifee/react-native";
import { log } from "./log";

export type GeofencePermissionFailureReason =
  | "LOCATION_SERVICES_DISABLED"
  | "BACKGROUND_PERMISSION_DENIED"
  | "PERMISSION_ERROR";

export type GeofencePermissionResult =
  | [string, false, null]
  | [string | null, true, GeofencePermissionFailureReason];

/**
 * Checks and requests all required permissions for geofencing:
 * 1. Device Location Services (GPS switch)
 * 2. Notification permissions (Android 13+ & iOS)
 * 3. Background Location ("Allow all the time" / "Always")
 */
export const requestGeofencePermissions = async (): Promise<GeofencePermissionResult> => {
  try {
    // 1. Verify device location services (GPS) are enabled
    try {
      const servicesEnabled = await Geofencing.isLocationServicesEnabled();
      if (!servicesEnabled) {
        log.warn("Device location services are disabled");
        return [null, true, "LOCATION_SERVICES_DISABLED"];
      }
    } catch (svcErr) {
      log.info("Could not check isLocationServicesEnabled:", svcErr);
    }

    // 2. Request notification permission upfront (needed for Android 13+ & iOS)
    try {
      await notifee.requestPermission();
    } catch (notifErr) {
      log.error("Failed to request notification permission:", notifErr);
    }

    // 3. Request location permission with allowAlways: true
    const response = await Geofencing.requestLocation({ allowAlways: true });

    // Background geofencing strictly requires "Always" authorization
    const isAlwaysAuthorized = response.location === "Always";

    if (response.success && isAlwaysAuthorized) {
      log.info("Geofencing location permission granted: Always");
      return [response.location, false, null];
    }

    // If granted only "WhenInUse", background triggers will silently fail or reject on Android
    log.warn("Background location permission not granted:", response.location);
    return [
      response.location || null,
      true,
      "BACKGROUND_PERMISSION_DENIED",
    ];
  } catch (error) {
    log.error("Failed to request geofence permissions:", error);
    return [null, true, "PERMISSION_ERROR"];
  }
};
