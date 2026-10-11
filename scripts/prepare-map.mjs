import fs from "node:fs";
import { feature } from "topojson-client";
const topology = JSON.parse(
  fs.readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"),
);
const geojson = feature(topology, topology.objects.countries);
fs.writeFileSync("public/data/world.geo.json", JSON.stringify(geojson));
fs.mkdirSync("public/licenses", { recursive: true });
fs.copyFileSync(
  "node_modules/world-atlas/LICENSE",
  "public/licenses/world-atlas.txt",
);
console.log(
  `Prepared ${geojson.features.length} country boundaries from Natural Earth via world-atlas.`,
);
