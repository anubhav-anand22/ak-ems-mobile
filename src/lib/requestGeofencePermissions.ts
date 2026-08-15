import Geofencing from "@rn-org/react-native-geofencing";
import { log } from "./log";

export const requestGeofencePermissions = async (): Promise<
  [string, false] | [null, true]
> => {
  try {
    // Geofencing relies on background location tracking, so allowAlways is required
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
    log.error(error)
    return [null, true];
  }
};
