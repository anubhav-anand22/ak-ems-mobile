import * as Location from "expo-location";

export const getCurrentLocation = async (): Promise<
  [Location.LocationObject, null] | [null, Error]
> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return [null, new Error("Permission not granted")];
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return [location, null];
  } catch (error) {
    return [null, error as Error];
  }
};
