import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDistanceInMeters,
  isLocationInsideGeofence,
  formatGeofenceStatus,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from "../src/lib/locationMath";

test("calculateDistanceInMeters", async (t) => {
  await t.test("returns 0 when coordinates are identical", () => {
    const dist = calculateDistanceInMeters(28.6139, 77.209, 28.6139, 77.209);
    assert.strictEqual(dist, 0);
  });

  await t.test("accurately calculates short distance (~100m - 200m)", () => {
    // Delhi Connaught Place inner circle (~150m offset)
    const lat1 = 28.6315;
    const lon1 = 77.2167;
    const lat2 = 28.6325;
    const lon2 = 77.2177;

    const dist = calculateDistanceInMeters(lat1, lon1, lat2, lon2);
    // Rough distance is around 146 meters
    assert.ok(dist > 130 && dist < 160, `Expected ~146m, got ${dist}`);
  });

  await t.test("accurately calculates ~500m distance", () => {
    // 0.0045 degree latitude is ~500 meters
    const lat1 = 28.6000;
    const lon1 = 77.2000;
    const lat2 = 28.6045;
    const lon2 = 77.2000;

    const dist = calculateDistanceInMeters(lat1, lon1, lat2, lon2);
    assert.ok(dist >= 490 && dist <= 510, `Expected ~500m, got ${dist}`);
  });
});

test("isLocationInsideGeofence", async (t) => {
  await t.test("returns true when coordinates match exactly", () => {
    assert.strictEqual(
      isLocationInsideGeofence(28.5, 77.5, 28.5, 77.5, 200),
      true,
    );
  });

  await t.test("returns true when within radius (e.g. 50m inside 200m radius)", () => {
    // ~0.0003 deg latitude is ~33 meters
    const isInside = isLocationInsideGeofence(28.5000, 77.5000, 28.5003, 77.5000, 200);
    assert.strictEqual(isInside, true);
  });

  await t.test("returns false when outside radius (e.g. 500m outside 200m radius)", () => {
    // ~0.0045 deg latitude is ~500 meters
    const isInside = isLocationInsideGeofence(28.5000, 77.5000, 28.5045, 77.5000, 200);
    assert.strictEqual(isInside, false);
  });

  await t.test("uses DEFAULT_GEOFENCE_RADIUS_METERS (200m) by default", () => {
    assert.strictEqual(DEFAULT_GEOFENCE_RADIUS_METERS, 200);
    // 150m is inside 200m
    const lat1 = 28.6315;
    const lon1 = 77.2167;
    const lat2 = 28.6325;
    const lon2 = 77.2177;
    assert.strictEqual(isLocationInsideGeofence(lat1, lon1, lat2, lon2), true);
  });
});

test("formatGeofenceStatus", async (t) => {
  await t.test("formats status when already inside geofence", () => {
    const res = formatGeofenceStatus({
      isInside: true,
      distanceInMeters: 45.2,
      radiusInMeters: 200,
      listNote: "Supermarket",
    });

    assert.strictEqual(res.title, "📍 Already at Supermarket");
    assert.ok(res.message.includes("inside the 200m reminder zone"));
    assert.ok(res.message.includes("45m from target"));
  });

  await t.test("formats status when outside geofence", () => {
    const res = formatGeofenceStatus({
      isInside: false,
      distanceInMeters: 512.8,
      radiusInMeters: 200,
      listNote: "Pharmacy",
    });

    assert.strictEqual(res.title, "📍 Geofence Set for Pharmacy");
    assert.ok(res.message.includes("~513m away"));
    assert.ok(res.message.includes("zone radius: 200m"));
  });
});
