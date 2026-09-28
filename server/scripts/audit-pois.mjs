// Checks every profile's POI list against its own map image, using the traced POI outlines.
// For each POI area it measures how much of the area the profile's map tints (green territory,
// magenta nesting, yellow courtship, blue seasonal grounds ...) and reports
//   - POIs whose area is barely tinted (listed but not marked on the map),
//   - tinted areas that are missing from the POI list.
// With exact outlines a marked area reads 45-95 % tinted and an unmarked one 0-10 %.
// Read-only: it prints a report and changes nothing.
//
// Run: npm run audit:pois -w server   (optionally followed by profile ids)
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, resample } from './lib/png.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const W = 948, H = 874, N = W * H;
const LISTED_MIN = 0.15; // below this a listed POI area is not marked on the map
const MARKED_MIN = 0.35; // above this an area is clearly marked

const saturation = (d, p) => { const mx = Math.max(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]); return mx ? (mx - Math.min(d[p * 3], d[p * 3 + 1], d[p * 3 + 2])) / mx : 0; };
function colourName(r, g, b) {
  if (r > 150 && g > 150 && b < 130) return 'yellow';
  if (g >= r && g >= b && g - r > 20) return 'green';
  if (r > b && b > g + 10) return 'magenta';
  if (r > g + 30 && r > b + 30) return 'red';
  if (b > r + 20) return 'blue';
  return 'other';
}

function rasterize(points) {
  const pts = points.map(([x, y]) => [x * W, y * H]), pixels = [];
  for (let y = 0; y < H; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y + 0.5) !== (yj > y + 0.5)) xs.push(((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < xs[k + 1] - 0.5; x++) pixels.push(y * W + x);
  }
  return pixels;
}

const only = new Set(process.argv.slice(2));
const profiles = {}, images = {};
const dir = join(projectRoot, 'data', 'processed', 'profiles');
for (const file of await readdir(dir)) {
  const profile = JSON.parse(await readFile(join(dir, file), 'utf8'));
  if (!profile.map?.image) continue;
  // Variants (e.g. spinosaurus-saltwater) share their parent's map: audit it once with all their POIs.
  const id = profile.source?.rawId || profile.id;
  if (profiles[id]) { profiles[id].map.markers.push(...profile.map.markers); continue; }
  const img = decodePNG(await readFile(join(projectRoot, 'data', 'raw', id, profile.map.image)));
  if (Math.abs(img.W / img.H - W / H) > 0.01) continue;
  profiles[id] = { ...profile, id, name: profile.variant?.parentName || profile.name, map: { ...profile.map, markers: [...profile.map.markers] } };
  images[id] = resample(img, W, H).data;
}

// Untinted reference: per pixel, the map at the 25th percentile of saturation (tints are saturated).
const list = Object.values(images), order = list.map((_, i) => i), base = Buffer.alloc(N * 3);
for (let p = 0; p < N; p++) {
  order.sort((a, b) => saturation(list[a], p) - saturation(list[b], p));
  const pick = list[order[Math.floor(list.length * 0.25)]];
  base[p * 3] = pick[p * 3]; base[p * 3 + 1] = pick[p * 3 + 1]; base[p * 3 + 2] = pick[p * 3 + 2];
}

const gazetteer = JSON.parse(await readFile(join(projectRoot, 'data', 'map', 'regions.json'), 'utf8'));
const areas = gazetteer.regions.filter(region => region.shape?.type === 'polygon').map(region => ({ id: region.id, within: region.within || null, pixels: rasterize(region.shape.points) }));

let issues = 0;
for (const [id, img] of Object.entries(images)) {
  if (only.size && !only.has(id)) continue;
  const measured = new Map(areas.map(area => {
    let hit = 0; const colours = {};
    for (const p of area.pixels) {
      const d = Math.abs(img[p * 3] - base[p * 3]) + Math.abs(img[p * 3 + 1] - base[p * 3 + 1]) + Math.abs(img[p * 3 + 2] - base[p * 3 + 2]);
      if (d > 55 && saturation(img, p) > saturation(base, p) + 0.1) { hit++; const c = colourName(img[p * 3], img[p * 3 + 1], img[p * 3 + 2]); colours[c] = (colours[c] || 0) + 1; }
    }
    const colour = Object.entries(colours).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    return [area.id, { share: hit / area.pixels.length, colour }];
  }));
  const listed = new Set(profiles[id].map.markers.map(marker => marker.regionId).filter(Boolean));
  // Territories drawn inside a parent area (Tyrannosaurus) cover that parent.
  for (const area of areas) if (area.within && listed.has(area.id)) listed.add(area.within);
  const unmarked = [...listed].filter(regionId => measured.has(regionId) && !areas.find(a => a.id === regionId)?.within && measured.get(regionId).share < LISTED_MIN);
  const missing = [...measured].filter(([regionId, m]) => m.share >= MARKED_MIN && !listed.has(regionId) && !areas.find(a => a.id === regionId)?.within);
  if (process.env.AUDIT_VERBOSE) console.log(`
${id} tint per area:`, [...measured].filter(([, m]) => m.share >= 0.05).sort((a, b) => b[1].share - a[1].share).map(([regionId, m]) => `${regionId} ${Math.round(m.share * 100)}% ${m.colour}${listed.has(regionId) ? '' : ' (not listed)'}`).join(', '));
  if (!unmarked.length && !missing.length) continue;
  issues++;
  console.log(`\n${profiles[id].name} (${id}) — ${profiles[id].map.markers.length} POIs`);
  for (const regionId of unmarked) console.log(`  listed, not marked: ${regionId} (${Math.round(measured.get(regionId).share * 100)} % tinted)`);
  for (const [regionId, m] of missing) console.log(`  marked, not listed: ${regionId} (${m.colour}, ${Math.round(m.share * 100)} % tinted)`);
}
console.log(issues ? `\n${issues} profile(s) to review. Hand-authored files (Spinosaurus, Megalania, Leedsichthys) mark sub-areas and may legitimately differ.` : '\nEvery POI list matches its map.');
