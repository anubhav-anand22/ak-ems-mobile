import { getShoppingListsByGeofenceIds } from "@/db";
import { formatGeofenceNotification } from "./shoppingListUtils";
import { log } from "./log";

export { formatGeofenceNotification };

export const getGeofenceAlertNotification = async (
  ids: string[],
): Promise<{ title: string; body: string }> => {
  try {
    const matching = await getShoppingListsByGeofenceIds(ids);
    return formatGeofenceNotification(matching);
  } catch (error) {
    log.error("Failed to query shopping list for geofence alert:", error);
    return {
      title: "🚨 Geofence Alert!",
      body: "You have entered a shopping list reminder zone.",
    };
  }
};
