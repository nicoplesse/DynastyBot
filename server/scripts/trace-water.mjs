// Writes data/map/layers/water.png: every open water pixel of the shared map, fresh and salt, as
// black with alpha (like freshwater.png). freshwater.png already holds the water outside the areas
// whose main landscape is the sea; this adds the sea itself, read from the clean base map with the
// same colour rule (dark, blue over red) inside those sea areas. The temperature map colours it
// per zone in its water view.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './lib/png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const layers = join(root, 'data', 'map', 'layers');
const base = decodePNG(await readFile(join(layers, 'base-clean.png')));
const fresh = await readFile(join(layers, 'freshwater.png'));
const { W, H } = base;
const N = W * H;
const regions = JSON.parse(await readFile(join(root, 'data', 'map', 'regions.json'), 'utf8')).regions;
const seaAreas = regions.filter(region => region.shape.type === 'polygon' && !region.within && region.ecosystems?.[0] === 'sea');

function inside(x, y, points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const freshAlpha = decodePNG(fresh).alpha;

const alpha = new Uint8Array(N);
const { data } = base;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    const r = data[p * 3], b = data[p * 3 + 2], m = Math.max(r, data[p * 3 + 1], b);
    const sea = m >= 12 && m < 110 && b > r + 10 && seaAreas.some(area => inside((x + 0.5) / W, (y + 0.5) / H, area.shape.points));
    alpha[p] = sea ? 255 : 0;
  }
}
const rgba = Buffer.alloc(N * 4);
for (let p = 0; p < N; p++) rgba[p * 4 + 3] = Math.max(alpha[p], freshAlpha[p]);
await writeFile(join(layers, 'water.png'), encodePNG(W, H, rgba, 4));
console.log(`Wrote data/map/layers/water.png (${seaAreas.length} sea areas + fresh water)`);
