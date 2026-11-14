import Geofencing from "@rn-org/react-native-geofencing";
import { triggerAlarmNotification } from "./triggerAlarmNotification";
import { getGeofenceAlertNotification } from "./getGeofenceAlertDetails";
import { log } from "./log";

export const setupGeofenceListeners = () => {
  // Triggered when entering the radius (on iOS or when listeners are registered)
  const enterSub = Geofencing.onEnter(async (ids) => {
    try {
      const alert = await getGeofenceAlertNotification(ids);
      await triggerAlarmNotification({
        title: alert.title,
        body: alert.body,
      });
    } catch (e) {
      log.error("Error in geofence enter listener:", e);
      await triggerAlarmNotification({
        title: "🚨 Geofence Alert!",
        body: "You have entered a shopping list reminder zone.",
      });
    }
  });

  // Triggered when exiting the radius
  const exitSub = Geofencing.onExit((ids) => {
    log.info("Exited geofence:", ids);
  });

  return {
    removeListeners: () => {
      enterSub.remove();
      exitSub.remove();
    },
  };
};
