import * as Location from "expo-location";
import { log } from "./log";

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
};

export const getCurrentLocation = async (): Promise<
  [Location.LocationObject, null] | [null, Error]
> => {
  try {
    const { status } = await withTimeout(
      Location.requestForegroundPermissionsAsync().catch(
        () => ({ status: Location.PermissionStatus.DENIED } as Location.LocationPermissionResponse),
      ),
      2500,
      { status: Location.PermissionStatus.DENIED } as Location.LocationPermissionResponse,
    );

    if (status !== "granted") {
      return [null, new Error("Permission not granted")];
    }

    // 1. Fast path: check cached last-known position first (instant)
    const cachedLocation = await withTimeout(
      Location.getLastKnownPositionAsync({}).catch(() => null),
      1000,
      null,
    );

    if (cachedLocation) {
      return [cachedLocation, null];
    }

    // 2. Active fix: Balanced accuracy (uses Wi-Fi / Cell / GPS, avoids slow GPS-only locks)
    const activeLocation = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null),
      3500,
      null,
    );

    if (activeLocation) {
      return [activeLocation, null];
    }

    // 3. Last fallback: try any known position
    const fallbackLocation = await Location.getLastKnownPositionAsync({}).catch(() => null);
    if (fallbackLocation) {
      return [fallbackLocation, null];
    }

    return [null, new Error("Location request timed out")];
  } catch (error) {
    log.error("getCurrentLocation error:", error);
    return [null, error as Error];
  }
};
