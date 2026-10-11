// Split polygons at the date line before handing them to a planar renderer.
const crosses = (ring) =>
  ring.some((p, i) => i && Math.abs(p[0] - ring[i - 1][0]) > 180);
function unwrap(ring) {
  const out = [ring[0].slice()];
  for (const [longitude, latitude] of ring.slice(1)) {
    let x = longitude;
    while (x - out.at(-1)[0] > 180) x -= 360;
    while (x - out.at(-1)[0] < -180) x += 360;
    out.push([x, latitude]);
  }
  return out;
}
function clip(ring, edge, greater) {
  const points = ring.slice(0, -1),
    out = [];
  if (!points.length) return [];
  let previous = points.at(-1);
  const inside = (p) => (greater ? p[0] >= edge : p[0] <= edge);
  for (const current of points) {
    if (inside(current) !== inside(previous)) {
      const t = (edge - previous[0]) / (current[0] - previous[0]);
      out.push([edge, previous[1] + t * (current[1] - previous[1])]);
    }
    if (inside(current)) out.push(current);
    previous = current;
  }
  return out.length >= 3 ? [...out, out[0].slice()] : [];
}
export function cleanWorldGeometry(geojson) {
  return {
    ...geojson,
    features: geojson.features
      .filter((f) => f.properties.name !== "Antarctica")
      .map((f) => {
        const polygons =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates]
            : f.geometry.coordinates;
        if (!polygons.some((p) => p.some(crosses))) return f;
        const pieces = polygons.flatMap((polygon) => {
          if (!polygon.some(crosses)) return [polygon];
          const rings = polygon.map(unwrap),
            xs = rings[0].map((p) => p[0]);
          const start = Math.floor((Math.min(...xs) + 180) / 360),
            end = Math.floor((Math.max(...xs) + 180) / 360),
            out = [];
          for (let k = start; k <= end; k++) {
            const clipped = rings.map((ring) =>
              clip(clip(ring, -180 + k * 360, true), 180 + k * 360, false),
            );
            if (clipped[0].length < 4) continue;
            out.push(
              clipped
                .filter((ring) => ring.length >= 4)
                .map((ring) => ring.map(([x, y]) => [x - k * 360, y])),
            );
          }
          return out;
        });
        return {
          ...f,
          geometry: { type: "MultiPolygon", coordinates: pieces },
        };
      }),
  };
}
