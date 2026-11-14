import Geofencing from "@rn-org/react-native-geofencing";
import notifee from "@notifee/react-native";
import { PermissionsAndroid, Platform } from "react-native";
import { log } from "./log";

export type GeofencePermissionFailureReason =
  | "LOCATION_SERVICES_DISABLED"
  | "BACKGROUND_PERMISSION_DENIED"
  | "PERMISSION_ERROR";

export type GeofencePermissionResult =
  | [string, false, null]
  | [string | null, true, GeofencePermissionFailureReason];

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
};

/**
 * Checks and requests required permissions for geofencing:
 * 1. Device Location Services switch (GPS)
 * 2. Notification permissions (Android 13+ & iOS)
 * 3. Background Location ("Allow all the time" / "Always")
 *
 * NOTE: On Android 11+ (API 30+), PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION)
 * cannot be requested from in-app dialogs and hangs the Promise if foreground location is
 * already granted. We therefore check authorization status non-blockingly via
 * PermissionsAndroid.check and direct the user to system settings if background permission
 * is missing.
 */
export const requestGeofencePermissions = async (): Promise<GeofencePermissionResult> => {
  try {
    // 1. Verify device location services (GPS) are enabled (with 1.5s timeout)
    try {
      const servicesEnabled = await withTimeout(
        Geofencing.isLocationServicesEnabled().catch(() => true),
        1500,
        true,
      );
      if (!servicesEnabled) {
        log.warn("Device location services are disabled");
        return [null, true, "LOCATION_SERVICES_DISABLED"];
      }
    } catch (svcErr) {
      log.info("Could not check isLocationServicesEnabled:", svcErr);
    }

    // 2. Request notification permission upfront (needed for Android 13+ & iOS, with 1.5s timeout)
    try {
      await withTimeout(notifee.requestPermission().catch(() => {}), 1500, null);
    } catch (notifErr) {
      log.error("Failed to request notification permission:", notifErr);
    }

    // 3. Check current location authorization status non-blockingly (without triggering system dialogs)
    const currentStatus = await withTimeout(
      Geofencing.getLocationAuthorizationStatus().catch(() => "Denied"),
      1500,
      "Denied",
    );

    log.info("Current geofencing location authorization status:", currentStatus);

    if (currentStatus === "Always") {
      return ["Always", false, null];
    }

    // On Android:
    // If the user already granted foreground location ("WhenInUse"), attempting to request
    // ACCESS_BACKGROUND_LOCATION via PermissionsAndroid.request hangs indefinitely on Android 11+
    // because the OS expects the user to be sent to app settings instead of an in-app prompt.
    if (Platform.OS === "android") {
      if (currentStatus === "WhenInUse") {
        log.warn("Location permission is 'WhenInUse'; background 'Always' permission is required");
        return ["WhenInUse", true, "BACKGROUND_PERMISSION_DENIED"];
      }

      // If denied or not yet requested, request foreground permission first (with 4s timeout)
      const fineGranted = await withTimeout(
        PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
        4000,
        PermissionsAndroid.RESULTS.DENIED,
      );

      if (fineGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        log.warn("ACCESS_FINE_LOCATION denied by user");
        return ["Denied", true, "BACKGROUND_PERMISSION_DENIED"];
      }

      // Check if background was already granted
      const isBgGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      ).catch(() => false);

      if (isBgGranted) {
        return ["Always", false, null];
      }

      return ["WhenInUse", true, "BACKGROUND_PERMISSION_DENIED"];
    }

    // On iOS:
    const iosResponse = await withTimeout(
      Geofencing.requestLocation({ allowAlways: true }).catch(() => ({
        success: false,
        location: "Denied",
      })),
      4000,
      { success: false, location: "Denied" },
    );

    if (iosResponse.success && iosResponse.location === "Always") {
      return ["Always", false, null];
    }

    return [
      iosResponse.location || null,
      true,
      "BACKGROUND_PERMISSION_DENIED",
    ];
  } catch (error) {
    log.error("Failed to request geofence permissions:", error);
    return [null, true, "PERMISSION_ERROR"];
  }
};
