export const createGeoJSONCircle = (
  longitude: number,
  latitude: number,
  radiusInKm: number,
) => {
  const points = 64;
  const ret: number[][] = []; // Added type for the array
  const distanceX =
    radiusInKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);
    ret.push([longitude + x, latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: "FeatureCollection" as const, // <-- Fixes the main error
    features: [
      {
        type: "Feature" as const, // <-- Fixes the feature error
        properties: {}, // <-- Required by strict GeoJSON types
        geometry: {
          type: "Polygon" as const, // <-- Fixes the geometry error
          coordinates: [ret],
        },
      },
    ],
  };
};
