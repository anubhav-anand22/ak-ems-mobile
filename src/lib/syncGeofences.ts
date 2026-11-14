import { db } from "@/db/dbinit";
import { dbShoppingCart } from "@/db/schema";
import Geofencing from "@rn-org/react-native-geofencing";
import { getRandomStr } from "./getRandomStr";
import { DEFAULT_GEOFENCE_RADIUS_METERS } from "./locationMath";
import { log } from "./log";
import { eq } from "drizzle-orm";

export const syncActiveGeofences = async (): Promise<void> => {
  const timestamp = new Date().toISOString();
  try {
    const lists = await db.select().from(dbShoppingCart);
    log.info(`[${timestamp}] syncActiveGeofences started for ${lists.length} lists`);

    for (const list of lists) {
      if (!list.location?.lat || !list.location?.lon) continue;

      const completedSet = new Set(list.completedItems || []);
      const hasPendingItems =
        list.products.length === 0 ||
        list.products.some((p) => !completedSet.has(p.productName));

      if (hasPendingItems) {
        let geoFenceId = list.location.geoFenceId;
        if (!geoFenceId) {
          geoFenceId = getRandomStr();
          await db
            .update(dbShoppingCart)
            .set({
              location: {
                lat: list.location.lat,
                lon: list.location.lon,
                geoFenceId,
              },
            })
            .where(eq(dbShoppingCart.id, list.id));
        }

        try {
          await Geofencing.addGeofence({
            id: geoFenceId,
            latitude: list.location.lat,
            longitude: list.location.lon,
            radius: DEFAULT_GEOFENCE_RADIUS_METERS,
          });
          log.info(`[${new Date().toISOString()}] Synced geofence: ${geoFenceId} (radius: ${DEFAULT_GEOFENCE_RADIUS_METERS}m)`);
        } catch (err: any) {
          log.warn(`[${new Date().toISOString()}] Geofence add failed for ${geoFenceId}:`, err?.message || err);
        }
      } else if (list.location.geoFenceId) {
        // List is completed, remove the geofence from the OS to save battery
        try {
          await Geofencing.removeGeofence(list.location.geoFenceId);
          log.info(`[${new Date().toISOString()}] Removed geofence for completed list: ${list.location.geoFenceId}`);
        } catch (err: any) {
          log.info(`[${new Date().toISOString()}] Geofence removal note:`, err?.message || err);
        }
      }
    }
  } catch (err) {
    log.error(`[${new Date().toISOString()}] syncActiveGeofences error:`, err);
  }
};
