import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { feature } from "topojson-client";
import { cleanWorldGeometry } from "./map-geometry.mjs";
test("world map rings stay closed without edges across the date line", () => {
  const topology = JSON.parse(
    fs.readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"),
  );
  const original = feature(topology, topology.objects.countries),
    clean = cleanWorldGeometry(original);
  assert.equal(clean.features.length, original.features.length - 1);
  for (const f of clean.features) {
    const polys =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    for (const polygon of polys)
      for (const ring of polygon) {
        assert.deepEqual(ring[0], ring.at(-1));
        for (let i = 1; i < ring.length; i++)
          assert.ok(
            Math.abs(ring[i][0] - ring[i - 1][0]) <= 180,
            `${f.properties.name} has a crossing edge`,
          );
      }
  }
  assert.deepEqual(
    clean.features.find((f) => f.properties.name === "Australia"),
    original.features.find((f) => f.properties.name === "Australia"),
  );
});
