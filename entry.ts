import "expo-router/entry";
import { widgetTaskHandler } from "@/widget/widget-task-handler";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { triggerAlarmNotification } from "@/lib/triggerAlarmNotification";
import { AppRegistry } from "react-native";

const GeofenceHeadlessTask = async (taskData: any) => {
  console.log("Headless JS triggered in background with data:", taskData);

  // Example logic using the library you already have
  if (
    taskData &&
    taskData.event === "ENTER" &&
    taskData.ids.includes("hq-office")
  ) {
    await triggerAlarmNotification({
      title: "🚨 Geofence Alert!",
      body: "You have entered the specified zone.",
    });
  }
};

// 3. Register the task
// The ID string here MUST match the native event name broadcasted by your geofencing library
AppRegistry.registerHeadlessTask("GeofenceTask", () => GeofenceHeadlessTask);

registerWidgetTaskHandler(widgetTaskHandler);
