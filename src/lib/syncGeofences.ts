import { db } from "@/db/dbinit";
import { dbShoppingCart } from "@/db/schema";
import Geofencing from "@rn-org/react-native-geofencing";
import { getRandomStr } from "./getRandomStr";
import { log } from "./log";
import { eq } from "drizzle-orm";

export const syncActiveGeofences = async (): Promise<void> => {
  try {
    const lists = await db.select().from(dbShoppingCart);
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

        await Geofencing.addGeofence({
          id: geoFenceId,
          latitude: list.location.lat,
          longitude: list.location.lon,
          radius: 100,
        }).catch((err) => {
          log.info("Geofence sync note:", err?.message || err);
        });
      }
    }
  } catch (err) {
    log.error("syncActiveGeofences error:", err);
  }
};
