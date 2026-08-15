import Geofencing, { Events } from "@rn-org/react-native-geofencing";
import { triggerAlarmNotification } from "./triggerAlarmNotification";

export const setupGeofenceListeners = () => {
  // Triggered when entering the radius
  const enterSub = Geofencing.onEnter((ids) => {
    triggerAlarmNotification({
      title: "🚨 Geofence Alert!",
      body: "You have entered the specified zone.",
    });
  });

  // Triggered when exiting the radius
  const exitSub = Geofencing.onExit((ids) => {
    // console.log("Exited geofences:", ids);
    // if (ids.includes("hq-office")) {
    //   alert("Goodbye!");
    // }
  });

  return {
    removeListeners: () => {
      enterSub.remove();
      exitSub.remove();
    },
  };
};
