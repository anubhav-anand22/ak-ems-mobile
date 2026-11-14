import "expo-router/entry";
import { widgetTaskHandler } from "@/widget/widget-task-handler";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { triggerAlarmNotification } from "@/lib/triggerAlarmNotification";
import { getGeofenceAlertNotification } from "@/lib/getGeofenceAlertDetails";
import { AppRegistry } from "react-native";
import Geofencing from "@rn-org/react-native-geofencing";
import { log } from "@/lib/log";

const handleGeofenceIds = async (ids: string[], contextSource: string) => {
  const timestamp = new Date().toISOString();
  log.info(`[${timestamp}] [${contextSource}] Geofence transition detected for IDs:`, ids);

  if (!Array.isArray(ids) || ids.length === 0) {
    log.info(`[${timestamp}] [${contextSource}] No geofence IDs provided in event.`);
    return;
  }

  try {
    const alert = await getGeofenceAlertNotification(ids);
    log.info(`[${new Date().toISOString()}] [${contextSource}] Dispatching notification:`, alert);
    await triggerAlarmNotification({
      title: alert.title,
      body: alert.body,
    });
    log.info(`[${new Date().toISOString()}] [${contextSource}] Notification dispatch complete.`);
  } catch (error) {
    log.error(`[${new Date().toISOString()}] [${contextSource}] Error handling geofence alert:`, error);
  }
};

const GeofenceHeadlessTask = async (taskData: any) => {
  const timestamp = new Date().toISOString();
  log.info(`[${timestamp}] [HeadlessTask] Headless JS triggered in background with data:`, taskData);

  if (
    taskData &&
    (taskData.event === "onEnter" || taskData.event === "ENTER") &&
    Array.isArray(taskData.ids) &&
    taskData.ids.length > 0
  ) {
    await handleGeofenceIds(taskData.ids, "HeadlessTask");
  } else if (taskData && taskData.event === "onExit") {
    log.info(`[${timestamp}] [HeadlessTask] Exited geofence regions:`, taskData.ids);
  }
};

// Register for the native event emitted by @rn-org/react-native-geofencing ("onGeofenceTransition")
AppRegistry.registerHeadlessTask(
  "onGeofenceTransition",
  () => GeofenceHeadlessTask,
);
// Retain fallback registration
AppRegistry.registerHeadlessTask("GeofenceTask", () => GeofenceHeadlessTask);

// Register top-level module listener so that:
// 1. isOnEnterListenerAdded() in library returns true immediately without 5s delay
// 2. Foreground and event-emitter forwarded transitions trigger alarms reliably
Geofencing.onEnter(async (ids: string[]) => {
  await handleGeofenceIds(ids, "Geofencing.onEnter");
});

Geofencing.onExit((ids: string[]) => {
  log.info(`[${new Date().toISOString()}] [Geofencing.onExit] Exited geofence:`, ids);
});

registerWidgetTaskHandler(widgetTaskHandler);
