/**
 * Builds compact runtime data files from raw astronomical catalogs.
 *
 * Inputs (in scripts/):
 *   hyg.csv        — HYG v4.1 star database (CC BY-SA 4.0, astronexus.com)
 *   conlines.json  — d3-celestial constellation lines (BSD-3, Olaf Frohn)
 *   connames.json  — d3-celestial constellation names
 *
 * Outputs (in public/data/):
 *   stars.json          — packed arrays for all stars to mag 6.5 + every named star
 *   constellations.json — line segments (RA/Dec degrees) + localized names
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "data");

// ---------- Stars ----------
const MAG_LIMIT = 6.5;

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { fields.push(cur); cur = ""; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

const csv = readFileSync(join(here, "hyg.csv"), "utf8").split("\n");
const header = parseCsvLine(csv[0]).map((h) => h.replace(/"/g, ""));
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const ra = []; // hours -> stored as degrees
const dec = [];
const mag = [];
const ci = []; // B-V color index
const dist = []; // parsecs (100000 = "unknown/very far")
const names = {}; // index -> proper name
const bayer = {}; // index -> bayer/flamsteed + constellation (search aid)

let kept = 0;
for (let i = 1; i < csv.length; i++) {
  const line = csv[i];
  if (!line) continue;
  const f = parseCsvLine(line);
  const m = parseFloat(f[col.mag]);
  const proper = f[col.proper];
  if (!(m <= MAG_LIMIT) && !proper) continue;
  const id = f[col.id];
  if (id === "0") continue; // the Sun — handled as a solar-system body
  ra.push(Math.round(parseFloat(f[col.ra]) * 15 * 10000) / 10000); // hours→deg
  dec.push(Math.round(parseFloat(f[col.dec]) * 10000) / 10000);
  mag.push(Math.round(m * 100) / 100);
  const c = parseFloat(f[col.ci]);
  ci.push(Number.isFinite(c) ? Math.round(c * 100) / 100 : 0.5);
  const d = parseFloat(f[col.dist]);
  dist.push(Number.isFinite(d) ? Math.round(d * 100) / 100 : 100000);
  if (proper) names[kept] = proper;
  const bf = f[col.bf];
  if (bf) bayer[kept] = bf;
  kept++;
}

writeFileSync(
  join(out, "stars.json"),
  JSON.stringify({ count: kept, ra, dec, mag, ci, dist, names, bayer })
);
console.log(`stars.json: ${kept} stars, ${Object.keys(names).length} named`);

// ---------- Constellations ----------
const lines = JSON.parse(readFileSync(join(here, "conlines.json"), "utf8"));
const namesJson = JSON.parse(readFileSync(join(here, "connames.json"), "utf8"));

const nameById = {};
for (const ft of namesJson.features) {
  nameById[ft.id] = {
    name: ft.properties.name,
    gen: ft.properties.gen,
    // label position [ra, dec] in degrees
    pos: ft.geometry?.coordinates ?? null,
  };
}

const constellations = lines.features.map((ft) => ({
  id: ft.id,
  name: nameById[ft.id]?.name ?? ft.id,
  gen: nameById[ft.id]?.gen ?? "",
  label: nameById[ft.id]?.pos ?? null,
  // MultiLineString: array of polylines, each an array of [raDeg, decDeg]
  lines: ft.geometry.coordinates.map((poly) =>
    poly.map(([r, d]) => [Math.round(((r + 360) % 360) * 1000) / 1000, Math.round(d * 1000) / 1000])
  ),
}));

writeFileSync(join(out, "constellations.json"), JSON.stringify(constellations));
console.log(`constellations.json: ${constellations.length} constellations`);
