// Builds data/circuits.json from the bacinger/f1-circuits GeoJSON dataset
// (MIT — https://github.com/bacinger/f1-circuits, notice in data/CIRCUITS-LICENSE.md).
//
//   git clone --depth 1 https://github.com/bacinger/f1-circuits ../f1-circuits
//   npm run build:circuits -- ../f1-circuits
//
// Output is committed, so the API never fetches anything at runtime. Each
// circuit becomes one smoothed, closed SVG path in a 0-1000 coordinate space
// (longest side = 1000) plus its dimensions, so the renderer only has to
// wrap it in an <svg> and pick a stroke colour.
//
// To add a circuit: add a line to CIRCUITS below (our slug -> dataset id; ids
// are the file names in the dataset's circuits/ folder) and re-run.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// slug -> dataset id. Scope: every venue on the 2026 and 2027 F1 calendars.
const CIRCUITS = {
  "albert-park": "au-1953",
  "shanghai": "cn-2004",
  "suzuka": "jp-1962",
  "bahrain": "bh-2002",
  "jeddah": "sa-2021",
  "miami": "us-2022",
  "montreal": "ca-1978",
  "monaco": "mc-1929",
  "barcelona": "es-1991",
  "red-bull-ring": "at-1969",
  "silverstone": "gb-1948",
  "spa": "be-1925",
  "hungaroring": "hu-1986",
  "zandvoort": "nl-1948",
  "monza": "it-1922",
  "madring": "es-2026",
  "baku": "az-2016",
  "sepang": "my-1999",
  "singapore": "sg-2008",
  "cota": "us-2012",
  "mexico-city": "mx-1962",
  "interlagos": "br-1940",
  "las-vegas": "us-2023",
  "lusail": "qa-2004",
  "yas-marina": "ae-2009",
  "portimao": "pt-2008",
  "istanbul-park": "tr-2005",
};

const SIZE = 1000; // longest side of every outline, in path units

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-circuits.mjs <path to a bacinger/f1-circuits checkout>");
  process.exit(1);
}

// Equirectangular projection, corrected for latitude. Fine at circuit scale.
function project(coords) {
  const lat0 = coords.reduce((a, c) => a + c[1], 0) / coords.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lon, lat]) => [lon * k, -lat]);
}

// The dataset only has ~80-200 points per circuit, so a plain polyline looks
// angular. Closed Catmull-Rom -> cubic Bezier gives smooth curves through
// every original point.
function smoothClosedPath(pts) {
  const n = pts.length;
  const P = (i) => pts[((i % n) + n) % n];
  const f = (v) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + " Z";
}

const out = {};
for (const [slug, id] of Object.entries(CIRCUITS)) {
  const file = path.join(src, "circuits", `${id}.geojson`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const feature = raw.type === "FeatureCollection" ? raw.features[0] : raw;
  let coords = feature.geometry.coordinates;
  // Drop the duplicated closing point; the path closes itself.
  const [a, b] = [coords[0], coords[coords.length - 1]];
  if (a[0] === b[0] && a[1] === b[1]) coords = coords.slice(0, -1);

  const pts = project(coords);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = SIZE / Math.max(maxX - minX, maxY - minY);
  const norm = pts.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]);

  out[slug] = {
    name: feature.properties.Name,
    location: feature.properties.Location,
    lengthM: feature.properties.length,
    width: Math.round((maxX - minX) * scale * 10) / 10,
    height: Math.round((maxY - minY) * scale * 10) / 10,
    path: smoothClosedPath(norm),
  };
}

const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "circuits.json");
fs.writeFileSync(dest, JSON.stringify(out) + "\n");
console.log(`${Object.keys(out).length} circuits -> ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)}KB)`);
