import { db } from "@/db/dbinit";
import { dbShoppingCart } from "@/db/schema";
import { formatGeofenceNotification } from "./shoppingListUtils";
import { log } from "./log";

export { formatGeofenceNotification };

export const getGeofenceAlertNotification = async (
  ids: string[],
): Promise<{ title: string; body: string }> => {
  try {
    const allLists = await db.select().from(dbShoppingCart);
    const matching = allLists.filter((item) =>
      item.location?.geoFenceId ? ids.includes(item.location.geoFenceId) : false,
    );
    return formatGeofenceNotification(matching);
  } catch (error) {
    log.error("Failed to query shopping list for geofence alert:", error);
    return {
      title: "🚨 Geofence Alert!",
      body: "You have entered a shopping list reminder zone.",
    };
  }
};
