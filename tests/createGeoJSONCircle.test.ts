import test from "node:test";
import assert from "node:assert/strict";
import { createGeoJSONCircle } from "../src/lib/createGeoJSONCircle";

test("createGeoJSONCircle", async (t) => {
  await t.test("creates a valid FeatureCollection structure", () => {
    const geoJson = createGeoJSONCircle(77.209, 28.6139, 0.5);

    assert.strictEqual(geoJson.type, "FeatureCollection");
    assert.strictEqual(geoJson.features.length, 1);

    const feature = geoJson.features[0];
    assert.strictEqual(feature.type, "Feature");
    assert.strictEqual(feature.geometry.type, "Polygon");
  });

  await t.test("generates closed polygon coordinates (first === last)", () => {
    const geoJson = createGeoJSONCircle(77.209, 28.6139, 1.0);
    const coords = geoJson.features[0].geometry.coordinates[0];

    assert.ok(coords.length > 10, "Expected a smooth circle with multiple points");
    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];

    assert.strictEqual(firstPoint[0], lastPoint[0], "Longitude of first and last must match");
    assert.strictEqual(firstPoint[1], lastPoint[1], "Latitude of first and last must match");
  });
});
