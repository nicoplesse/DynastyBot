// Traces the real outline of every bold map POI from the profile map images and writes it
// back into the gazetteer (data/map/regions.json), replacing the hand-estimated polygons.
//
// Every playable's map is a re-render of the same base map: the region borders are the same
// thin black lines on all of them, while each profile tints different regions. So:
//   1. all map images are scaled to the shared 948x874 projection and stacked; the per-pixel
//      median is a clean base map (tints and white route lines vote themselves out),
//   2. the playable area is every pixel that some profile tints (tints stop at the mountains),
//   3. each region is flood-filled from its label position inside the black border lines,
//      with label lettering (grey/white text in a black outline) treated as passable,
//   4. the filled area is traced to a polygon and simplified.
// Region borders that only appear on some map versions (Steep Run, the Tyrannosaurus territory
// subdivisions) are traced from one image of that version instead of the median.
//
// It also writes data/map/layers/freshwater.png: open fresh water (rivers, lakes, ponds, bog
// channels) taken from the base map, outside the areas whose main landscape is the sea. The
// profile map's "Rivers & Swamps" landscape uses it to light water inside other areas.
//
// Run: npm run trace:regions -w server   (then npm run process)
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, resample } from './lib/png.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const regionsFile = join(projectRoot, 'data', 'map', 'regions.json');
const W = 948, H = 874, N = W * H;

// Label positions (pixels on the 948x874 base map) of the bold POI names. `source` is the image
// the borders are read from: the median of all maps, or one profile whose map shows extra lines.
const TRACES = [
  { source: 'median', seeds: {
    'dry-fang-canyon': [305, 104], 'tallbrush-coasts': [520, 56], 'kelp-vale': [715, 12], 'coastal-bluffs': [[820, 52], [800, 110]],
    'abyssal-depths': [905, 128], 'volcano-islands': [640, 200], 'big-tree-overlook': [515, 235], 'palm-islands': [[850, 230], [905, 262]],
    'stonebed-shoal': [900, 345], 'twisted-forest': [675, 323], 'mudflats': [800, 395], 'cedrus-forest': [425, 313],
    'black-fern-hills': [200, 371], 'stillwater-bog': [550, 409], 'cliff-edge-falls': [398, 467], 'coastland-swamp': [748, 497],
    'east-passage': [865, 537], 'crag-bluffs': [670, 549], 'wind-tunnels': [470, 562], 'redwoods': [320, 595],
    'hollow-hills': [550, 679], 'wollemi-forest': [832, 675],
  },
  // Places where the border has no black stroke on the image (a tint edge, or a line drawn
  // across dark water), closed by hand.
  cuts: [
    [[412, 127], [409, 150], [407, 172], [405, 193]], // west side of Cedrus Forest's northern lobe
    [[522, 325], [536, 338], [551, 356]],             // Big Tree Overlook / Stillwater Bog across the water
    [[551, 563], [568, 566], [585, 572], [604, 572], [620, 572]], // Crag Bluffs / Hollow Hills at Threehorns Meadow
    [[705, 663], [706, 676], [709, 687]],             // Hollow Hills / Wollemi Forest under the Star Ravine label
    [[690, 455], [720, 457], [752, 454], [775, 449]], // Mudflats / Coastland Swamp across the water
  ] },
  // Newer map version (e.g. Camptosaurus): Steep Run is its own narrow ravine between Dry Fang
  // Canyon, Black Fern Hills and Cedrus Forest. Its borders are broken by white route lines on
  // every map that shows it, so it is drawn by hand from that image and carved out of its neighbours.
  { source: 'manual', shapes: { 'steep-run': [
    [250, 192], [290, 187], [330, 196], [367, 192], [393, 200], [387, 230], [367, 253], [353, 277],
    [340, 277], [337, 250], [307, 223], [263, 203],
  ] }, anchor: { 'steep-run': [349, 214] } },
  // Tyrannosaurus splits Redwoods, Hollow Hills and Wollemi into six named territories. They are
  // traced inside the regions above; the Redwoods split follows the river, which has no stroke.
  { source: 'tyrannosaurus', separate: true, withinParents: true, seeds: {
    'rex-northern-redwoods': [200, 540], 'rex-southern-redwoods': [330, 640], 'rex-western-hills': [420, 700],
    'rex-eastern-hills': [590, 700], 'rex-upper-wollemi': [730, 700], 'rex-lower-wollemi': [870, 650],
  },
  cuts: [
    [[300, 573], [282, 605], [281, 635], [275, 660], [252, 688], [225, 698], [180, 705], [140, 712]],
  ] },
];

const lumMax = (d, p) => Math.max(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);
const lumMin = (d, p) => Math.min(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);

async function loadMaps() {
  const maps = new Map();
  const dir = join(projectRoot, 'data', 'processed', 'profiles');
  for (const file of await readdir(dir)) {
    const profile = JSON.parse(await readFile(join(dir, file), 'utf8'));
    if (!profile.map?.image) continue;
    const img = decodePNG(await readFile(join(projectRoot, 'data', 'raw', profile.id, profile.map.image)));
    if (Math.abs(img.W / img.H - W / H) > 0.01) continue;
    maps.set(profile.id, resample(img, W, H).data);
  }
  return maps;
}

function medianOf(maps) {
  const list = [...maps.values()], vals = new Uint8Array(list.length), out = Buffer.alloc(N * 3);
  for (let i = 0; i < N * 3; i++) {
    for (let k = 0; k < list.length; k++) vals[k] = list[k][i];
    vals.sort();
    out[i] = vals[vals.length >> 1];
  }
  return out;
}

// Playable area: pixels that at least a few profiles tint, smoothed and hole-filled.
function playableArea(maps, median) {
  const count = new Uint16Array(N);
  for (const img of maps.values()) {
    for (let p = 0; p < N; p++) {
      const r = img[p * 3], g = img[p * 3 + 1], b = img[p * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      const d = Math.abs(r - median[p * 3]) + Math.abs(g - median[p * 3 + 1]) + Math.abs(b - median[p * 3 + 2]);
      if (d > 60 && sat > 0.18 && !(mn > 150 && sat < 0.25)) count[p]++;
    }
  }
  const raw = new Uint8Array(N);
  for (let p = 0; p < N; p++) raw[p] = count[p] >= 3 ? 1 : 0;
  // The profile legend sits in the south-west mountains; never count it as land.
  for (let y = 700; y < H; y++) for (let x = 0; x < 260; x++) raw[y * W + x] = 0;
  const area = threshold(boxBlur(raw, 7), 0.45);
  return fillHoles(area);
}

function boxBlur(mask, r) {
  const tmp = new Float32Array(N), out = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += mask[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = s / (2 * r + 1);
      s += mask[y * W + Math.min(W - 1, x + r + 1)] - mask[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s / (2 * r + 1);
      s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}
const threshold = (values, t) => Uint8Array.from(values, v => (v >= t ? 1 : 0));

function flood(passable, seed, mark, label) {
  const stack = [seed]; mark[seed] = label; let n = 0;
  while (stack.length) {
    const p = stack.pop(), x = p % W, y = (p / W) | 0; n++;
    if (x > 0 && mark[p - 1] === -1 && passable(p - 1)) { mark[p - 1] = label; stack.push(p - 1); }
    if (x < W - 1 && mark[p + 1] === -1 && passable(p + 1)) { mark[p + 1] = label; stack.push(p + 1); }
    if (y > 0 && mark[p - W] === -1 && passable(p - W)) { mark[p - W] = label; stack.push(p - W); }
    if (y < H - 1 && mark[p + W] === -1 && passable(p + W)) { mark[p + W] = label; stack.push(p + W); }
  }
  return n;
}

function fillHoles(mask) {
  const outside = new Int16Array(N).fill(-1);
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!mask[y * W + x] && outside[y * W + x] === -1) flood(p => !mask[p], y * W + x, outside, 1);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!mask[y * W + x] && outside[y * W + x] === -1) flood(p => !mask[p], y * W + x, outside, 1);
  return Uint8Array.from(outside, v => (v === 1 ? 0 : 1));
}

// Label lettering: neutral grey/white glyphs in a black outline. Seeds are moved off it, and the
// letters left as holes in a region are filled when the region is traced.
function textZone(img) {
  const glyph = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (lumMin(img, p) > 140 && lumMax(img, p) - lumMin(img, p) < 14) glyph[p] = 1;
  return threshold(boxBlur(glyph, 4), 0.01);
}

// The open pixel closest to a label position (labels sit on their own lettering).
function nearestOpen([x0, y0], open) {
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && open(y * W + x)) return y * W + x;
    }
  }
  throw new Error(`No open pixel near ${x0},${y0}`);
}

// Segments one image; returns a label map (region index per pixel, -1 = none).
const seedPoints = seed => (Array.isArray(seed[0]) ? seed : [seed]);

function drawCuts(mask, cuts) {
  for (const line of cuts || []) {
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1], [x1, y1] = line[i], steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps), y = Math.round(y0 + ((y1 - y0) * s) / steps);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mask[(y + dy) * W + x + dx] = 1;
      }
    }
  }
}

// Pixels where two traced regions meet, so a later trace can split inside them.
function parentEdges(labels) {
  const edge = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const x = p % W;
    if ((x < W - 1 && labels[p] !== labels[p + 1]) || (p + W < N && labels[p] !== labels[p + W])) edge[p] = 1;
  }
  return edge;
}

async function segment(img, area, seeds, cuts, parents = null) {
  const text = textZone(img);
  // Border lines are near-black (open water is dark too, but blue). Antialiasing leaves
  // small gaps in places, so the lines are thickened by two pixels.
  const dark = new Uint8Array(N);
  for (let p = 0; p < N; p++) dark[p] = lumMax(img, p) < 34 && img[p * 3 + 2] < img[p * 3] + 14 ? 1 : 0;
  drawCuts(dark, cuts);
  if (parents) parentEdges(parents).forEach((v, p) => { if (v) dark[p] = 1; });
  const thick = threshold(boxBlur(dark, 2), 0.01);
  const border = Uint8Array.from(thick, (v, p) => (v || !area[p] ? 1 : 0));
  const ids = Object.keys(seeds), labels = new Int16Array(N).fill(-1), leaks = [];
  ids.forEach((id, k) => {
    for (const point of seedPoints(seeds[id])) {
      const seed = nearestOpen(point, p => !border[p] && !text[p]);
      if (labels[seed] !== -1) { leaks.push(`Seed for ${id} is inside ${ids[labels[seed]]}`); continue; }
      const size = flood(p => !border[p], seed, labels, k);
      if (size > N / 5) leaks.push(`${id} leaked across the map (${size} px); a border has a gap`);
    }
  });
  if (process.env.TRACE_DEBUG) await debugDump(img, border, labels, ids.length);
  if (leaks.length) throw new Error(leaks.join('; '));
  // Hand the border lines and leftover lettering to the neighbouring regions.
  for (let pass = 0; pass < 12; pass++) {
    const next = labels.slice();
    for (let p = 0; p < N; p++) {
      if (labels[p] !== -1 || !area[p]) continue;
      const x = p % W, y = (p / W) | 0;
      const around = [x > 0 && labels[p - 1], x < W - 1 && labels[p + 1], y > 0 && labels[p - W], y < H - 1 && labels[p + W]];
      const hit = around.find(v => v !== false && v !== -1);
      if (hit !== undefined) next[p] = hit;
    }
    labels.set(next);
  }
  return { ids, labels };
}

function debugDump(img, border, labels, count) {
  const out = Buffer.alloc(N * 3);
  for (let p = 0; p < N; p++) {
    const k = labels[p];
    const c = k >= 0 ? [(k * 97) % 200 + 40, (k * 57) % 200 + 40, (k * 151) % 200 + 40] : border[p] ? [255, 0, 0] : [img[p * 3] * 0.3, img[p * 3 + 1] * 0.3, img[p * 3 + 2] * 0.3];
    for (let j = 0; j < 3; j++) out[p * 3 + j] = k >= 0 ? c[j] * 0.6 + img[p * 3 + j] * 0.4 : c[j];
  }
  return writeFile(join(process.env.TRACE_DEBUG, `segment-${count}.png`), encodePNG(W, H, out));
}

function rasterize(points) {
  const mask = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      mask[y * W + x] = inside ? 1 : 0;
    }
  }
  return mask;
}

// Largest 4-connected component of a mask, hole-filled.
function mainComponent(mask) {
  const comp = new Int16Array(N).fill(-1); let best = -1, bestSize = 0, label = 0;
  for (let p = 0; p < N; p++) {
    if (!mask[p] || comp[p] !== -1) continue;
    const size = flood(q => mask[q] === 1, p, comp, label);
    if (size > bestSize) { bestSize = size; best = label; }
    label++;
  }
  return fillHoles(Uint8Array.from(comp, v => (v === best ? 1 : 0)));
}

// Outer outline of a mask as a closed loop of pixel corners (region kept on the right).
function traceOutline(mask) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  let start = -1;
  for (let p = 0; p < N && start === -1; p++) if (mask[p]) start = p;
  let x = start % W, y = (start / W) | 0, dir = 0; // walk along pixel edges, starting east on the top edge
  const sx = x, sy = y, points = [];
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  do {
    points.push([x, y]);
    // Pixels around corner (x,y): NW (x-1,y-1) NE (x,y-1) SW (x-1,y) SE (x,y)
    const nw = inside(x - 1, y - 1), ne = inside(x, y - 1), sw = inside(x - 1, y), se = inside(x, y);
    // Heading with the region on the right-hand side: prefer turning right, then straight, then left.
    const options = [(dir + 1) % 4, dir, (dir + 3) % 4];
    let moved = false;
    for (const d of options) {
      // An edge from corner (x,y) in direction d is a boundary edge with region on the right if:
      const ok = d === 0 ? (se && !ne) : d === 1 ? (sw && !se) : d === 2 ? (nw && !sw) : (ne && !nw);
      if (ok) { dir = d; x += DX[d]; y += DY[d]; moved = true; break; }
    }
    if (!moved) break;
  } while (x !== sx || y !== sy || points.length < 3);
  return points;
}

function simplify(points, eps) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); const [ax, ay] = points[a], [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1; let far = -1, dist = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len;
      if (d > dist) { dist = d; far = i; }
    }
    if (far !== -1) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function toPolygon(mask) {
  const outline = traceOutline(mainComponent(mask));
  // Split the closed loop at its farthest point so simplification keeps both halves.
  const [x0, y0] = outline[0]; let far = 0, dist = 0;
  outline.forEach(([x, y], i) => { const d = Math.hypot(x - x0, y - y0); if (d > dist) { dist = d; far = i; } });
  const first = simplify(outline.slice(0, far + 1), 1.1), second = simplify([...outline.slice(far), outline[0]], 1.1);
  const ring = [...first, ...second.slice(1, -1)];
  return ring.map(([x, y]) => [Number((x / W).toFixed(4)), Number((y / H).toFixed(4))]);
}

function waterLayer(median, area, sea) {
  const water = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const r = median[p * 3], b = median[p * 3 + 2], m = lumMax(median, p);
    water[p] = area[p] && !sea[p] && m >= 18 && m < 95 && b > r + 12 ? 1 : 0;
  }
  // Soft edge: blur slightly so the layer reads as water, not pixels.
  const soft = boxBlur(water, 1), rgba = Buffer.alloc(N * 4);
  // Black with alpha: dropped into an SVG luminance mask it cuts the water out of a veil.
  for (let p = 0; p < N; p++) rgba[p * 4 + 3] = Math.round(Math.min(1, soft[p] * 1.4) * 255);
  return encodePNG(W, H, rgba, 4);
}

const maps = await loadMaps();
console.log(`Stacked ${maps.size} map images`);
const median = medianOf(maps);
const area = playableArea(maps, median);

const doc = JSON.parse(await readFile(regionsFile, 'utf8'));
const byId = new Map(doc.regions.map(region => [region.id, region]));
const combined = new Int16Array(N).fill(-1), combinedIds = [];
const traced = {};

for (const trace of TRACES) {
  if (trace.source === 'manual') {
    for (const [id, points] of Object.entries(trace.shapes)) {
      const index = combinedIds.push(id) - 1, mask = rasterize(points);
      for (let p = 0; p < N; p++) if (mask[p]) combined[p] = index;
      traced[id] = { seed: trace.anchor[id] };
    }
    continue;
  }
  const img = trace.source === 'median' ? median : maps.get(trace.source);
  if (!img) throw new Error(`No map image for ${trace.source}`);
  const { ids, labels } = await segment(img, area, trace.seeds, trace.cuts, trace.withinParents ? combined : null);
  ids.forEach((id, k) => {
    const mask = Uint8Array.from(labels, v => (v === k ? 1 : 0));
    if (!trace.separate) {
      // Later traces carve their region out of the earlier ones (Steep Run out of Cedrus Forest).
      const index = combinedIds.push(id) - 1;
      for (let p = 0; p < N; p++) if (mask[p]) combined[p] = index;
    } else traced[id] = { mask, seed: trace.seeds[id] };
  });
  for (const id of ids) if (!trace.separate) traced[id] = { seed: trace.seeds[id] };
}
combinedIds.forEach((id, k) => { traced[id].mask = Uint8Array.from(combined, v => (v === k ? 1 : 0)); });

for (const [id, { mask, seed }] of Object.entries(traced)) {
  const region = byId.get(id);
  if (!region) throw new Error(`Gazetteer has no region ${id}`);
  const points = toPolygon(mask);
  region.shape = { type: 'polygon', points };
  const [ax, ay] = seedPoints(seed)[0];
  region.anchor = { x: Number((ax / W).toFixed(4)), y: Number((ay / H).toFixed(4)) };
  region.traced = true;
  console.log(`${id.padEnd(24)} ${String(points.length).padStart(4)} points`);
}

doc.map.coordinatesApproximate = false;
doc.map.tracing = 'Area outlines traced from the black POI borders of the stacked profile maps (server/scripts/trace-regions.mjs). Landmark points remain approximate.';
await writeFile(regionsFile, JSON.stringify(doc, null, 2) + '\n');
await mkdir(join(projectRoot, 'data', 'map', 'layers'), { recursive: true });
const sea = new Uint8Array(N);
for (const [id, { mask }] of Object.entries(traced)) if (byId.get(id).ecosystems?.[0] === 'sea') mask.forEach((v, p) => { if (v) sea[p] = 1; });
await writeFile(join(projectRoot, 'data', 'map', 'layers', 'freshwater.png'), waterLayer(median, area, sea));
console.log('Wrote data/map/regions.json and data/map/layers/freshwater.png');
