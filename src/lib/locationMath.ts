export const DEFAULT_GEOFENCE_RADIUS_METERS = 200;
export const DEFAULT_GEOFENCE_RADIUS_KM = 0.2;

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula (returns distance in meters).
 */
export const calculateDistanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Determines whether the user's current coordinates fall within
 * a geofence's circular perimeter.
 */
export const isLocationInsideGeofence = (
  userLat: number,
  userLon: number,
  fenceLat: number,
  fenceLon: number,
  radiusInMeters: number = DEFAULT_GEOFENCE_RADIUS_METERS,
): boolean => {
  const distance = calculateDistanceInMeters(userLat, userLon, fenceLat, fenceLon);
  return distance <= radiusInMeters;
};

/**
 * Formats a user-friendly geofence prompt or status message.
 */
export const formatGeofenceStatus = (params: {
  isInside: boolean;
  distanceInMeters: number;
  radiusInMeters?: number;
  listNote?: string | null;
}): { title: string; message: string } => {
  const note = params.listNote?.trim() || "Shopping List";
  const radius = params.radiusInMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;

  if (params.isInside) {
    return {
      title: `📍 Already at ${note}`,
      message: `You are currently inside the ${Math.round(radius)}m reminder zone (${Math.round(params.distanceInMeters)}m from target).`,
    };
  }

  return {
    title: `📍 Geofence Set for ${note}`,
    message: `Reminder active. You are ~${Math.round(params.distanceInMeters)}m away (zone radius: ${Math.round(radius)}m).`,
  };
};
