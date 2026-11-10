// Renders a Preferred POIs map for an Aquatic Update staging profile, in the style of the Dynasty
// profile maps: the clean base map, the water of each listed POI tinted in its layer colour, and
// the title block with the legend at the bottom left.
//
//   npm run staging:map -w server -- kaiwhekea
//
// Reads projects/aquatic-update/staging/maps/<id>.json and writes <id>.png next to it. Tinting is
// done here on the pixels (water.png says where open water is, regions.json where each POI is);
// the text is laid out as HTML and rendered by headless Chrome, which also takes the screenshot.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './lib/png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const id = process.argv[2];
if (!id) throw new Error('Usage: npm run staging:map -w server -- <profile id>');
const mapsDir = join(root, 'projects', 'aquatic-update', 'staging', 'maps');
const config = JSON.parse(await readFile(join(mapsDir, `${id}.json`), 'utf8'));
const layers = join(root, 'data', 'map', 'layers');
const base = decodePNG(await readFile(join(layers, 'base-clean.png')));
const water = decodePNG(await readFile(join(layers, 'water.png'))).alpha;
const regions = new Map(JSON.parse(await readFile(join(root, 'data', 'map', 'regions.json'), 'utf8')).regions.map(region => [region.id, region]));
const { W, H } = base;
const STRENGTH = 0.8;

function inside(x, y, points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The clean base map is a median of all profile maps, so labels that only some maps carry (newer
// POIs, shifted names) show as faint ghosts. Each ghost box is copied from the profile map that is
// untinted there and has the fewest bright (text) pixels in it.
const GHOSTS = [
  [305, 204, 396, 226], // Steep Run
  [362, 260, 418, 290], // Azure Crater
  [165, 348, 312, 380], // doubled Black Fern Hills
  [336, 418, 372, 446], // Steep Run fragment by Cliff Edge Falls
  [740, 54, 856, 71], // doubled Coastal Bluffs
];
const { readdir } = await import('node:fs/promises');
const donors = [];
for (const slug of await readdir(join(root, 'data', 'raw'))) {
  for (const file of ['image-2.png', 'image-3.png', 'image.png']) {
    const path = join(root, 'data', 'raw', slug, 'images', file);
    if (!existsSync(path)) continue;
    try {
      const image = decodePNG(await readFile(path));
      if (image.W === W && image.H === H) donors.push({ name: `${slug}/${file}`, data: image.data });
    } catch { /* not a map */ }
  }
}
for (const [x0, y0, x1, y1] of GHOSTS) {
  // Means over the water and the land pixels of the box apart, so a tinted sea cannot hide behind
  // a dark land average.
  const mean = (pixels, wet) => [0, 1, 2].map(c => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (Boolean(water[y * W + x]) !== wet) continue; s += pixels[(y * W + x) * 3 + c]; n++; } return n ? s / n : 0; });
  const target = [mean(base.data, true), mean(base.data, false)];
  let best = null, closest = null;
  for (const donor of donors) {
    const m = [mean(donor.data, true), mean(donor.data, false)];
    const diff = Math.max(...m.flatMap((part, i) => part.map((v, c) => Math.abs(v - target[i][c]))));
    if (!closest || diff < closest.diff) closest = { donor, diff, bright: -1 };
  }
  for (const limit of [15, 30]) {
  if (best) break;
  for (const donor of donors) {
    const m = [mean(donor.data, true), mean(donor.data, false)];
    if (m.some((part, i) => part.some((v, c) => Math.abs(v - target[i][c]) > limit))) continue;
    let bright = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * W + x) * 3; if (donor.data[p] > 170 && donor.data[p + 1] > 170 && donor.data[p + 2] > 170) bright++; }
    if (!best || bright < best.bright) best = { donor, bright };
  }
  }
  best ??= closest;
  if (!best) continue;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * W + x) * 3; for (let c = 0; c < 3; c++) base.data[p + c] = best.donor.data[p + c]; }
  if (process.env.DEBUG_MAP) console.log(`ghost ${x0},${y0}: ${best.donor.name} (${best.bright} bright px)`);
}

const hex = color => [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16));
const data = Buffer.from(base.data);
for (const layer of config.layers) {
  const [r, g, b] = hex(layer.color);
  for (const regionId of layer.regions) {
    const region = regions.get(regionId);
    if (!region || region.shape?.type !== 'polygon') throw new Error(`staging-map: unknown or untraced region ${regionId}`);
    const points = region.shape.points;
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) * W)), x1 = Math.min(W, Math.ceil(Math.max(...xs) * W));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) * H)), y1 = Math.min(H, Math.ceil(Math.max(...ys) * H));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = y * W + x;
        if (!water[p] || !inside((x + 0.5) / W, (y + 0.5) / H, points)) continue;
        const a = STRENGTH * (water[p] / 255);
        data[p * 3] = Math.round(base.data[p * 3] * (1 - a) + r * a);
        data[p * 3 + 1] = Math.round(base.data[p * 3 + 1] * (1 - a) + g * a);
        data[p * 3 + 2] = Math.round(base.data[p * 3 + 2] * (1 - a) + b * a);
      }
    }
  }
}

// "territories": true draws the borders between the territories of lebensraum.json (cut from their
// POI the same way as in the Aquatic tab) as a white line on the water, and marks each territory
// with the compass letter of its name (N, S, E, W) at its widest open water, or at "marks": { id: [x, y] }
// where that spot collides with a printed POI name.
const marks = [];
if (config.territories) {
  const { cutTerritory } = await import('../src/aquatic.js');
  const habitat = JSON.parse(await readFile(join(root, 'projects', 'aquatic-update', 'profile-entwuerfe', 'lebensraum.json'), 'utf8'));
  const owner = new Int16Array(W * H).fill(-1);
  const parentOf = [];
  habitat.territories.forEach((territory, index) => {
    const region = regions.get(territory.parent);
    if (!region || region.shape?.type !== 'polygon') throw new Error(`staging-map: unknown or untraced region ${territory.parent}`);
    const { points } = cutTerritory(region.shape.points, territory);
    parentOf[index] = territory.parent;
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) * W)), x1 = Math.min(W, Math.ceil(Math.max(...xs) * W));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) * H)), y1 = Math.min(H, Math.ceil(Math.max(...ys) * H));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = y * W + x;
      if (water[p] && inside((x + 0.5) / W, (y + 0.5) / H, points)) owner[p] = index;
    }
  });
  const border = new Uint8Array(W * H);
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const p = y * W + x, a = owner[p];
    if (a < 0) continue;
    for (const q of [p + 1, p + W]) {
      const b = owner[q];
      if (b >= 0 && b !== a && parentOf[a] === parentOf[b]) { border[p] = 1; border[q] = 1; }
    }
  }
  for (let p = 0; p < W * H; p++) {
    if (!border[p]) continue;
    for (let c = 0; c < 3; c++) data[p * 3 + c] = Math.round(data[p * 3 + c] * 0.1 + 255 * 0.9);
  }
  // Distance of every territory pixel to the nearest pixel outside its territory (chamfer, 2 passes).
  const dist = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) dist[p] = owner[p] < 0 ? 0 : Infinity;
  const pass = (from, to, step) => {
    for (let y = from; y !== to; y += step) for (let x = step > 0 ? 0 : W - 1; x >= 0 && x < W; x += step) {
      const p = y * W + x;
      if (!dist[p]) continue;
      for (const [dx, dy, cost] of [[-step, 0, 1], [0, -step, 1], [-step, -step, 1.4142], [step, -step, 1.4142]]) {
        const nx = x + dx, ny = y + dy;
        const q = ny * W + nx;
        const d = nx < 0 || nx >= W || ny < 0 || ny >= H || owner[q] !== owner[p] ? cost : dist[q] + cost;
        if (d < dist[p]) dist[p] = d;
      }
    }
  };
  pass(0, H, 1);
  pass(H - 1, -1, -1);
  const deepest = habitat.territories.map(() => ({ p: -1, d: 0 }));
  for (let p = 0; p < W * H; p++) if (owner[p] >= 0 && dist[p] > deepest[owner[p]].d) deepest[owner[p]] = { p, d: dist[p] };
  habitat.territories.forEach((territory, index) => {
    const letter = { Northern: 'N', Southern: 'S', Eastern: 'E', Western: 'W' }[territory.name.split(' ')[0]];
    const { p } = deepest[index];
    if (letter && p >= 0) marks.push({ letter, at: config.marks?.[territory.id] ?? [((p % W) + 0.5) / W, (Math.floor(p / W) + 0.5) / H] });
  });
}

const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const legend = config.layers.map(layer => `<li style="color:${layer.color}"><i style="background:${layer.color}"></i>${escape(layer.label)}</li>`).join('');
const notes = (config.notes || []).map(note => `<li class="note">${escape(note)}</li>`).join('');
const markup = marks.map(({ letter, at: [x, y] }) => `<b class="mark" style="left:${(x * W).toFixed(1)}px;top:${(y * H).toFixed(1)}px">${letter}</b>`).join('');
// The legend sits at the bottom left, the title block right above it; both grow upwards with the
// number of lines (two layers and two notes give the original 90 px).
const listHeight = 22 * config.layers.length + 19 * (config.notes || []).length + 8;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Michroma&family=Montserrat:wght@500&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
  .map { position: absolute; inset: 0; width: ${W}px; height: ${H}px; }
  .block { position: absolute; left: 32px; bottom: ${listHeight + 8}px; color: #fff; }
  .mark { position: absolute; transform: translate(-50%, -50%); font: 13px/1 Michroma, sans-serif; color: #fff; text-shadow: 0 0 3px #000, 0 0 3px #000, 0 1px 2px #000; }
  .card { font: 500 15px/1 Montserrat, sans-serif; position: absolute; left: 46px; top: -9px; padding: 0 4px; white-space: nowrap; }
  .name { font: 24px/1 Michroma, sans-serif; letter-spacing: 3px; padding: 11px 14px 7px 12px; border: 3px solid #fff; border-right: 0; border-bottom-width: 3px; white-space: nowrap;
          clip-path: polygon(0 0, 14px 0, 14px 3px, 100% 3px, 100% 100%, 0 100%); }
  ul { list-style: none; margin: 0; padding: 0; position: absolute; left: 32px; top: ${H - listHeight}px; }
  li { font: 14px/1 Michroma, sans-serif; letter-spacing: 2.5px; margin: 0 0 8px; white-space: nowrap; text-shadow: 0 1px 2px #000; }
  li i { display: inline-block; width: 11px; height: 11px; margin-right: 9px; border-radius: 2px; vertical-align: -1px; }
  li.note { color: #fff; font-size: 11px; letter-spacing: 2px; padding-left: 20px; opacity: .9; }
</style></head><body>
<img class="map" src="data:image/png;base64,${encodePNG(W, H, data).toString('base64')}" alt="">
<div class="block"><span class="card">${escape(config.card)}</span><div class="name">${escape(config.title)}</div></div>
${markup}
<ul>${legend}${notes}</ul>
</body></html>`;

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(path => path && existsSync(path));
if (!chrome) throw new Error('staging-map: no Chrome found, set CHROME_PATH');
const work = await mkdtemp(join(tmpdir(), 'staging-map-'));
try {
  const page = join(work, 'map.html');
  const shot = join(work, 'map.png');
  await writeFile(page, html);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${join(work, 'profile')}`,
    '--force-device-scale-factor=2', `--window-size=${W},${H}`, '--virtual-time-budget=8000', `--screenshot=${shot}`, `file:///${page.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  await writeFile(join(mapsDir, `${id}.png`), await readFile(shot));
  console.log(`Wrote projects/aquatic-update/staging/maps/${id}.png`);
} finally {
  await rm(work, { recursive: true, force: true });
}
