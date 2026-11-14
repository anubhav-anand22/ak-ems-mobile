import "expo-router/entry";
import { widgetTaskHandler } from "@/widget/widget-task-handler";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { triggerAlarmNotification } from "@/lib/triggerAlarmNotification";
import { getGeofenceAlertNotification } from "@/lib/getGeofenceAlertDetails";
import { AppRegistry } from "react-native";

const GeofenceHeadlessTask = async (taskData: any) => {
  console.log("Headless JS triggered in background with data:", taskData);

  if (
    taskData &&
    (taskData.event === "onEnter" || taskData.event === "ENTER") &&
    Array.isArray(taskData.ids) &&
    taskData.ids.length > 0
  ) {
    const alert = await getGeofenceAlertNotification(taskData.ids);
    await triggerAlarmNotification({
      title: alert.title,
      body: alert.body,
    });
  }
};

// Register for the native event emitted by @rn-org/react-native-geofencing ("onGeofenceTransition")
AppRegistry.registerHeadlessTask(
  "onGeofenceTransition",
  () => GeofenceHeadlessTask,
);
// Retain fallback registration
AppRegistry.registerHeadlessTask("GeofenceTask", () => GeofenceHeadlessTask);

registerWidgetTaskHandler(widgetTaskHandler);
