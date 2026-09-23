// Draft POI detector: reads each playable's shared-projection map image, samples the
// gazetteer coordinates for the green "preferred POI / territory" highlight (and yellow
// neutral grounds), and writes a draft data/raw/<slug>/pois.json marked source:"auto".
//
// It never overwrites a hand-authored pois.json (one without "source":"auto"), so the
// curated Spinosaurus / Megalania files are safe. Detection is best-effort: it is reliable
// for playables whose map fills whole regions with the highlight colour, and deliberately
// skips maps where nothing focused is found (marine / crocodilian water claims, or ranges
// drawn in a different colour) so a human can add those precisely.
//
// Run: node server/scripts/detect-pois.mjs   (or npm run detect:pois)
import zlib from 'node:zlib';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const rawDir = join(projectRoot, 'data', 'raw');
const MAP_RATIO = 948 / 874;
const GREEN_MIN = 0.16;   // fraction of a sampled patch that must be highlight-green
const WATER_GREEN_MIN = 0.18; // green over water, for aquatic species
const MAGENTA_MIN = 0.16; // magenta courtship / nesting grounds (ceratopsian-style maps)
const YELLOW_MIN = 0.14;  // yellow neutral grounds
const MIN_POIS = 3;       // below this a map has no readable highlight -> leave for a human

function pngSize(buf) { return [buf.readUInt32BE(16), buf.readUInt32BE(20), buf[25]]; }

// Decode an 8-bit truecolour (colour type 2), non-interlaced PNG to raw RGB.
function decodePNG(buf) {
  let p = 8, W = 0, H = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = W * bpp, out = Buffer.alloc(H * stride);
  let pos = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[pos++]; const o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0;
      const b = y > 0 ? out[o - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[o - stride + x - bpp] : 0;
      let v = raw[pos++];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      out[o + x] = v;
    }
  }
  return { W, H, data: out };
}

// Classify each pixel of a patch into the four highlight styles used across the maps:
//  greenLand  — bright green territory on land (r>=b-6 rejects the naturally green sea)
//  greenWater — bright green over water (for aquatic species; sea POIs read blue-green)
//  magenta    — courtship / nesting grounds on ceratopsian-style maps
//  yellow     — neutral grounds
function sample(img, cx, cy, rad) {
  const { W, H, data } = img, stride = W * 3;
  let tot = 0, gL = 0, gW = 0, mag = 0, yel = 0;
  for (let y = Math.max(0, cy - rad); y < Math.min(H, cy + rad); y++) {
    for (let x = Math.max(0, cx - rad); x < Math.min(W, cx + rad); x++) {
      const i = y * stride + x * 3, r = data[i], g = data[i + 1], b = data[i + 2]; tot++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, val = mx / 255;
      if (r > 150 && g > 150 && b < 130 && Math.abs(r - g) < 50) { yel++; continue; }
      if (val < 0.3 || sat < 0.34) continue;
      if (r > 130 && b > 105 && g < Math.min(r, b) - 25 && r - g >= 35 && b - g >= 20) { mag++; continue; }
      if (g === mx && g - r >= 24 && g - b >= 22) { gW++; if (r >= b - 6) gL++; }
    }
  }
  return { gL: gL / tot, gW: gW / tot, mag: mag / tot, yel: yel / tot };
}

const regionsDoc = JSON.parse(await readFile(join(projectRoot, 'data', 'map', 'regions.json'), 'utf8'));
const regions = regionsDoc.regions.filter(r => r.shape?.type === 'point');
const index = JSON.parse(await readFile(join(projectRoot, 'data', 'processed', 'index.json'), 'utf8'));
const diet = Object.fromEntries(index.profiles.map(p => [p.id, p.classification.diet]));
const habitatOf = Object.fromEntries(index.profiles.map(p => [p.id, p.classification.habitat || '']));

const dirs = (await readdir(rawDir, { withFileTypes: true })).filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'server-rules');
const written = [], skippedManual = [], keptCurated = [];

for (const dir of dirs) {
  const id = dir.name;
  let files = [];
  try { files = await readdir(join(rawDir, id, 'images')); } catch { continue; }
  const maps = [];
  for (const f of files) {
    if (!/\.png$/i.test(f)) continue;
    const buf = await readFile(join(rawDir, id, 'images', f));
    const [w, h, ct] = pngSize(buf);
    if (ct === 2 && Math.abs((w / h) / MAP_RATIO - 1) < 0.01) maps.push({ f, buf, area: w * h });
  }
  if (!maps.length) { skippedManual.push(`${id} (no map image)`); continue; }
  maps.sort((a, b) => b.area - a.area);
  const mapImage = `images/${maps[0].f}`;

  const existing = await readFile(join(rawDir, id, 'pois.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (existing && existing.source !== 'auto') { keptCurated.push(id); continue; }

  const img = decodePNG(maps[0].buf);
  const rad = Math.round(img.W * 0.028);
  const isAquatic = /Aquatic/i.test(habitatOf[id]);
  const territoryRoles = diet[id] === 'Carnivore' ? ['territory', 'hunting', 'nesting'] : ['territory', 'nesting'];
  const pois = [];
  for (const rg of regions) {
    const s = sample(img, Math.round(rg.shape.x * img.W), Math.round(rg.shape.y * img.H), rad);
    if (s.mag >= MAGENTA_MIN) pois.push({ regionId: rg.id, roles: ['courtship', 'nesting'] });
    else if (s.gL >= GREEN_MIN) pois.push({ regionId: rg.id, roles: territoryRoles });
    else if (isAquatic && s.gW >= WATER_GREEN_MIN) pois.push({ regionId: rg.id, roles: territoryRoles });
    else if (s.yel >= YELLOW_MIN) pois.push({ regionId: rg.id, roles: ['neutral', 'courtship'] });
  }
  if (pois.length < MIN_POIS) {
    skippedManual.push(`${id} (${pois.length} POIs — needs manual)`);
    continue;
  }
  const doc = {
    schemaVersion: 1,
    source: 'auto',
    mapImage,
    note: 'Preferred POIs auto-detected from the profile map (green = preferred POI / territory, yellow = neutral ground). Best-effort; refine as needed.',
    pois,
  };
  await writeFile(join(rawDir, id, 'pois.json'), JSON.stringify(doc, null, 2) + '\n');
  written.push(`${id} (${pois.length})`);
}

console.log(`Wrote ${written.length} auto pois.json:`);
console.log('  ' + written.join(', '));
console.log(`\nKept ${keptCurated.length} curated (hand-authored): ${keptCurated.join(', ')}`);
console.log(`\nNeeds manual (${skippedManual.length}):`);
skippedManual.forEach(s => console.log('  ' + s));
