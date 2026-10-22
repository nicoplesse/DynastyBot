// Traces the white migration-route lines from every profile map into data/map/routes.json.
//
// All profile maps are re-renders of the same base map (see trace-regions.mjs), so:
//   1. every map is scaled to the shared 948x874 projection and the per-pixel median gives the
//      clean base map (route lines and tints vote themselves out, the white POI labels stay),
//   2. a route pixel is near-white on the profile map but not white on the base map,
//   3. small blobs (stray label letters of other map versions) are dropped, the rest is thinned
//      to a one-pixel skeleton and walked into polylines, which are simplified,
//   4. every POI area the lines cross, the small landmarks they pass and which areas follow each
//      other along the line are listed, plus how much of every other route layer each one covers.
// A layer is one map and line colour (white "Migration routes", or the light pink second route on
// the Parasaurolophus and Psittacosaurus maps). Names and members of the routes are curated in
// data/reference/migration-routes.json; the processor joins both.
//
// Run: npm run trace:routes -w server   (then npm run process)
// Debug: node scripts/trace-routes.mjs --debug <dir>  writes one overlay PNG per map.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, resample } from './lib/png.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const rawRoot = join(projectRoot, 'data', 'raw');
const W = 948, H = 874, N = W * H;
const MIN_BLOB = 110;      // pixels; a route stroke is ~5 px wide (label letters are smaller)
const MIN_ROUTE = 600;     // total route pixels before a map counts as having routes
const debugIndex = process.argv.indexOf('--debug');
const debugDir = debugIndex > 0 ? process.argv[debugIndex + 1] : null;

const lumMin = (d, p) => Math.min(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);
const lumMax = (d, p) => Math.max(d[p * 3], d[p * 3 + 1], d[p * 3 + 2]);

async function loadMaps() {
  const maps = new Map();
  for (const entry of await readdir(rawRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(rawRoot, entry.name);
    const doc = await readFile(join(dir, 'pois.json'), 'utf8').then(JSON.parse).catch(() => null)
      || await readFile(join(dir, 'routes.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (!doc?.mapImage) continue;
    const img = decodePNG(await readFile(join(dir, doc.mapImage)));
    if (Math.abs(img.W / img.H - W / H) > 0.01) continue;
    maps.set(entry.name, { image: doc.mapImage, data: resample(img, W, H).data });
  }
  return maps;
}

function medianOf(list) {
  const vals = new Uint8Array(list.length), out = Buffer.alloc(N * 3);
  for (let i = 0; i < N * 3; i++) {
    for (let k = 0; k < list.length; k++) vals[k] = list[k][i];
    vals.sort();
    out[i] = vals[vals.length >> 1];
  }
  return out;
}

// Background for the route overview: most profiles tint the same central areas, so the median
// keeps a green cast there. Per pixel, take the median of the least saturated third of the maps.
function untintedOf(list) {
  const out = Buffer.alloc(N * 3), keep = Math.max(3, Math.floor(list.length / 3));
  const cand = list.map(() => [0, 0, 0, 0]);
  for (let p = 0; p < N; p++) {
    for (let k = 0; k < list.length; k++) {
      const r = list[k][p * 3], g = list[k][p * 3 + 1], b = list[k][p * 3 + 2], mx = Math.max(r, g, b);
      const c = cand[k]; c[0] = mx ? (mx - Math.min(r, g, b)) / mx : 0; c[1] = r; c[2] = g; c[3] = b;
    }
    const low = cand.slice().sort((a, b) => a[0] - b[0]).slice(0, keep);
    for (let ch = 1; ch <= 3; ch++) { const v = low.map(c => c[ch]).sort((a, b) => a - b); out[p * 3 + ch - 1] = v[v.length >> 1]; }
    // Fade out the profile legend in the south-west mountains (outside the playable area).
    const x = p % W, y = (p / W) | 0, inset = Math.min(445 - x, y - 680);
    if (inset > -40) { const f = 0.1 + 0.9 * Math.min(1, Math.max(0, -inset / 40)); for (let ch = 0; ch < 3; ch++) out[p * 3 + ch] = Math.round(out[p * 3 + ch] * f); }
  }
  return out;
}

// The Dynasty logo (north-west) and the profile legend (south-west) carry white lettering.
const masked = (x, y) => (x < 190 && y < 150) || (x < 430 && y > 690);

// Route colours drawn on the profile maps: the common white "Migration routes" and the light
// salmon pink a few maps use for a second route (Parasaurolophus, Ceratopsian route).
const COLOURS = {
  white: (r, g, b) => Math.min(r, g, b) >= 205 && Math.max(r, g, b) - Math.min(r, g, b) <= 45,
  pink: (r, g, b) => r >= 215 && g >= 145 && g <= 200 && b >= 145 && b <= 200 && r - g >= 35 && Math.abs(g - b) <= 22,
};

function routeMask(img, median, colour) {
  const test = COLOURS[colour], mask = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p / W) | 0;
    if (masked(x, y)) continue;
    const r = img[p * 3], g = img[p * 3 + 1], b = img[p * 3 + 2];
    const d = Math.abs(r - median[p * 3]) + Math.abs(g - median[p * 3 + 1]) + Math.abs(b - median[p * 3 + 2]);
    if (test(r, g, b) && !test(median[p * 3], median[p * 3 + 1], median[p * 3 + 2]) && d > 60) mask[p] = 1;
  }
  return dropSmall(close(mask), MIN_BLOB);
}

function dilate(mask, r) {
  const out = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (!mask[p]) continue;
    const x = p % W, y = (p / W) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && dx * dx + dy * dy <= r * r) out[ny * W + nx] = 1;
    }
  }
  return out;
}

// Morphological closing (3x3) so a stroke crossing a thin border line stays in one piece.
function close(mask) {
  const grow = new Uint8Array(N), out = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let any = 0;
    for (let dy = -1; dy <= 1 && !any; dy++) for (let dx = -1; dx <= 1; dx++) if (mask[(y + dy) * W + x + dx]) { any = 1; break; }
    grow[y * W + x] = any;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let all = 1;
    for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!grow[(y + dy) * W + x + dx]) { all = 0; break; }
    out[y * W + x] = all;
  }
  return out;
}

function dropSmall(mask, min) {
  const seen = new Uint8Array(N), out = new Uint8Array(N), stack = [];
  for (let start = 0; start < N; start++) {
    if (!mask[start] || seen[start]) continue;
    const comp = [];
    stack.push(start); seen[start] = 1;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const x = p % W, y = (p / W) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, q = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    // Lines are long and thin: a blob that fills its box (lettering) is not a route.
    const span = Math.max(x1 - x0, y1 - y0);
    if (comp.length >= min && span >= 28) for (const p of comp) out[p] = 1;
  }
  return out;
}

// Zhang-Suen thinning to a one-pixel skeleton.
function thin(mask) {
  const m = Uint8Array.from(mask);
  let changed = true;
  const nb = p => { const x = p % W; return [m[p - W], m[p - W + 1], m[p + 1], m[p + W + 1], m[p + W], m[p + W - 1], m[p - 1], m[p - W - 1]]; };
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const remove = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        if (!m[p]) continue;
        const n = nb(p), b = n.reduce((s, v) => s + v, 0);
        if (b < 2 || b > 6) continue;
        let a = 0;
        for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) a++;
        if (a !== 1) continue;
        if (step === 0 ? (n[0] * n[2] * n[4] || n[2] * n[4] * n[6]) : (n[0] * n[2] * n[6] || n[0] * n[4] * n[6])) continue;
        remove.push(p);
      }
      for (const p of remove) m[p] = 0;
      if (remove.length) changed = true;
    }
  }
  return m;
}

const NEIGH = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
const neighbours = (skel, p) => NEIGH.map(d => p + d).filter(q => skel[q]);

// Thinning a 5 px wide stroke leaves short side spurs; each one would split the line at a fake
// junction. Remove dead-end branches shorter than `max` pixels (a few rounds).
function pruneSpurs(skel, max = 10, rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    let removed = 0;
    for (let p = 0; p < N; p++) {
      if (!skel[p] || neighbours(skel, p).length !== 1) continue;
      const path = [p];
      let prev = -1, cur = p;
      while (path.length <= max) {
        const next = neighbours(skel, cur).filter(q => q !== prev && !path.includes(q));
        if (next.length !== 1 || neighbours(skel, next[0]).length > 2) break;
        prev = cur; cur = next[0]; path.push(cur);
      }
      if (path.length <= max && neighbours(skel, cur).some(q => q !== prev && neighbours(skel, q).length > 2)) {
        for (const q of path) skel[q] = 0;
        removed++;
      }
    }
    if (!removed) break;
  }
  return skel;
}

// Walk the skeleton graph into polylines between end points and junctions.
function polylines(skel) {
  const degree = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (skel[p]) degree[p] = neighbours(skel, p).length;
  const node = p => degree[p] !== 2;
  const used = new Set(), lines = [];
  const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const walk = (start, next) => {
    const line = [start];
    let prev = start, cur = next;
    used.add(key(prev, cur));
    while (true) {
      line.push(cur);
      if (node(cur)) break;
      const step = neighbours(skel, cur).find(q => q !== prev && !used.has(key(cur, q)));
      if (step === undefined) break;
      used.add(key(cur, step)); prev = cur; cur = step;
    }
    return line;
  };
  for (let p = 0; p < N; p++) if (skel[p] && node(p)) for (const q of neighbours(skel, p)) if (!used.has(key(p, q))) lines.push(walk(p, q));
  // Closed loops without any node.
  for (let p = 0; p < N; p++) if (skel[p] && degree[p] === 2) for (const q of neighbours(skel, p)) if (!used.has(key(p, q))) lines.push(walk(p, q));
  return lines.map(line => line.map(p => [p % W, (p / W) | 0]));
}

const pathLength = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

function simplify(points, eps) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  let index = 0, max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const d = Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    if (d > max) { max = d; index = i; }
  }
  if (max <= eps) return [a, b];
  return [...simplify(points.slice(0, index + 1), eps).slice(0, -1), ...simplify(points.slice(index), eps)];
}

function insidePolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// POI area label of every pixel (main areas only, not the Rex sub-territories).
function areaLabels(areas) {
  const labels = new Int16Array(N).fill(-1);
  areas.forEach((area, index) => {
    const xs = area.points.map(p => p[0]), ys = area.points.map(p => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++)
        if (labels[y * W + x] < 0 && insidePolygon([x + 0.5, y + 0.5], area.points)) labels[y * W + x] = index;
  });
  return labels;
}

// Label lettering on the base map interrupts a route line; join loose ends that face each other.
// Short gaps are always closed; longer ones (a line passing under a whole label) only when both
// ends point at each other.
function bridges(skel, lines) {
  const ends = [];
  lines.forEach((line, index) => {
    for (const at of [0, line.length - 1]) {
      const [x, y] = line[at];
      if (neighbours(skel, y * W + x).length > 1) continue;
      const back = line[at === 0 ? Math.min(line.length - 1, 10) : Math.max(0, line.length - 11)];
      const len = Math.hypot(x - back[0], y - back[1]) || 1;
      ends.push({ index, at, x, y, dx: (x - back[0]) / len, dy: (y - back[1]) / len });
    }
  });
  const used = new Set(), out = [], pairs = [];
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const a = ends[i], b = ends[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (a.index === b.index && lines[a.index].length < 40) continue;
    const ux = (b.x - a.x) / (d || 1), uy = (b.y - a.y) / (d || 1);
    const facing = a.dx * ux + a.dy * uy > 0.6 && -(b.dx * ux + b.dy * uy) > 0.6;
    if (d <= 18 || (d <= 55 && facing)) pairs.push({ i, j, d: facing ? d * 0.8 : d });
  }
  for (const { i, j } of pairs.sort((a, b) => a.d - b.d)) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i); used.add(j);
    out.push([[ends[i].x, ends[i].y], [ends[j].x, ends[j].y]]);
  }
  return out;
}

function rasterLine(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i], steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= steps; s++) out.push([Math.round(x0 + (x1 - x0) * s / steps), Math.round(y0 + (y1 - y0) * s / steps)]);
  }
  return out;
}

function debugImage(img, mask, lines) {
  const out = Buffer.from(img);
  for (let p = 0; p < N; p++) if (mask[p]) { out[p * 3] = 255; out[p * 3 + 1] = 60; out[p * 3 + 2] = 220; }
  for (const line of lines) for (const [x, y] of rasterLine(line)) for (const q of [0, 1, W, W + 1]) {
    const p = y * W + x + q;
    out[p * 3] = 0; out[p * 3 + 1] = 255; out[p * 3 + 2] = 0;
  }
  return encodePNG(W, H, out);
}

const regionDoc = JSON.parse(await readFile(join(projectRoot, 'data', 'map', 'regions.json'), 'utf8'));
const areas = regionDoc.regions.filter(region => region.shape?.type === 'polygon' && !region.within)
  .map(region => ({ id: region.id, points: region.shape.points.map(([x, y]) => [x * W, y * H]) }));
const landmarks = regionDoc.regions.filter(region => region.shape?.type === 'point' || region.shape?.type === 'circle')
  .map(region => ({ id: region.id, x: region.shape.x * W, y: region.shape.y * H }));
const labels = areaLabels(areas);
const maps = await loadMaps();
const median = medianOf([...maps.values()].map(item => item.data));
if (debugDir) await mkdir(debugDir, { recursive: true });

// 1. Route layers: one per map and colour that shows a route.
const layers = [];
for (const [id, { image, data }] of maps) {
  for (const colour of Object.keys(COLOURS)) {
    const mask = routeMask(data, median, colour);
    const pixels = mask.reduce((s, v) => s + v, 0);
    if (pixels >= MIN_ROUTE) layers.push({ key: `${id}:${colour}`, profile: id, colour, image, mask, pixels, data });
  }
}

// 2. Per layer: polylines, crossed areas, passed landmarks and area neighbours along the line.
for (const layer of layers) {
  const skel = pruneSpurs(thin(layer.mask));
  const found = polylines(skel).filter(line => pathLength(line) >= 3);
  const joined = [...found, ...bridges(skel, found)];
  const pixels = joined.flatMap(rasterLine);
  const hits = new Map();
  for (const [x, y] of pixels) { const l = labels[y * W + x]; if (l >= 0) hits.set(l, (hits.get(l) || 0) + 1); }
  const crossed = new Set([...hits].filter(([, n]) => n >= 6).map(([l]) => l));
  // Two areas follow each other when the line runs from one into the other. Walk the route
  // pixels outward from every labelled pixel at once (unlabelled stretches: border strokes,
  // small unnamed gaps); where two fronts from different areas meet, those areas are linked.
  const onRoute = new Uint8Array(N), dist = new Int16Array(N).fill(-1), src = new Int16Array(N).fill(-1);
  for (const [x, y] of pixels) onRoute[y * W + x] = 1;
  let queue = [];
  for (let p = 0; p < N; p++) if (onRoute[p] && crossed.has(labels[p])) { dist[p] = 0; src[p] = labels[p]; queue.push(p); }
  const edges = new Set(), MAX_GAP = 45;
  while (queue.length) {
    const next = [];
    for (const p of queue) for (const d of NEIGH) {
      const q = p + d;
      if (!onRoute[q]) continue;
      if (dist[q] < 0) { dist[q] = dist[p] + 1; src[q] = src[p]; if (dist[q] < MAX_GAP) next.push(q); }
      else if (src[q] !== src[p] && dist[p] + dist[q] <= MAX_GAP) edges.add([areas[src[p]].id, areas[src[q]].id].sort().join('|'));
    }
    queue = next;
  }
  // Pieces of the line that do not touch (a gap no bridge closed) still link areas whose route
  // pixels come within a few pixels of each other.
  for (const [x, y] of pixels) {
    const a = onRoute[y * W + x] && crossed.has(labels[y * W + x]) ? labels[y * W + x] : -1;
    if (a < 0) continue;
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
      const q = (y + dy) * W + x + dx;
      if (q < 0 || q >= N || !onRoute[q]) continue;
      const b = labels[q];
      if (b >= 0 && b !== a && crossed.has(b)) edges.add([areas[a].id, areas[b].id].sort().join('|'));
    }
  }
  layer.lines = joined.map(line => simplify(line, 1.1));
  layer.regions = [...crossed].map(l => areas[l].id);
  layer.edges = [...edges].map(edge => edge.split('|'));
  layer.landmarks = landmarks.filter(item => pixels.some(([x, y]) => Math.hypot(x - item.x, y - item.y) <= 12)).map(item => item.id);
  layer.wide = dilate(layer.mask, 6);
  if (debugDir) await writeFile(join(debugDir, `${layer.key.replace(':', '-')}.png`), debugImage(layer.data, layer.mask, layer.lines));
}
// Each layer's stroke as a transparent PNG, so the overview can tint and draw it exactly as the
// profile map does (the polylines stay in routes.json for lookups).
for (const layer of layers) {
  const stroke = dilate(layer.mask, 1), rgba = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) if (stroke[p]) { rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = 255; rgba[p * 4 + 3] = layer.mask[p] ? 255 : 150; }
  layer.file = `layers/route-${layer.profile}-${layer.colour}.png`;
  await writeFile(join(projectRoot, 'data', 'map', layer.file), encodePNG(W, H, rgba, 4));
}
// 3. How much of every other layer each layer covers (same route drawn on another map).
for (const a of layers) {
  a.covers = {};
  for (const b of layers) {
    if (a === b) continue;
    let hit = 0;
    for (let p = 0; p < N; p++) if (b.mask[p] && a.wide[p]) hit++;
    a.covers[b.key] = +(hit / b.pixels).toFixed(2);
  }
  console.log(`${a.key}: ${a.lines.length} lines, ${a.regions.length} areas, ${a.landmarks.length} landmarks, ${a.edges.length} links`);
}
// The clean base map (no tints, no routes) is the background of the route overview.
await writeFile(join(projectRoot, 'data', 'map', 'layers', 'base.png'), encodePNG(W, H, untintedOf([...maps.values()].map(item => item.data))));
await writeFile(join(projectRoot, 'data', 'map', 'routes.json'), JSON.stringify({
  schemaVersion: 2,
  note: 'Generated by server/scripts/trace-routes.mjs from the route lines on each profile map. A layer is one map and line colour; `covers` is the share of another layer lying on this one. Coordinates are 0..1 of the shared map projection.',
  layers: layers.map(({ key, profile, colour, image, file, pixels, regions, landmarks, edges, covers, lines }) => ({
    key, profile, colour, image, file, pixels, regions, landmarks, edges, covers,
    lines: lines.map(line => line.map(([x, y]) => [+(x / W).toFixed(4), +(y / H).toFixed(4)])),
  })),
}, null, 2) + '\n');
console.log(`${layers.length} route layers on ${new Set(layers.map(l => l.profile)).size} maps.`);
