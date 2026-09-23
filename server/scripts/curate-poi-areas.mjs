// One-time curator for the profile maps that were originally sampled as landmark dots.
// The bold, black-outlined map regions are POIs; the smaller white labels are landmarks
// inside those POIs. This script collapses the landmark samples into their parent areas.
import zlib from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const rawDir = join(projectRoot, 'data', 'raw');

const batches = [
  ['tylosaurus', 'kaiwhekea', 'eurhinosaurus'],
  ['deinosuchus', 'suchomimus', 'sarcosuchus', 'austroraptor', 'concavenator'],
  ['deinocheirus', 'lurdusaurus', 'halszkaraptor'],
  ['hatzegopteryx', 'quetzalcoatlus', 'thalassodromeus', 'tropeognathus', 'rhamphorhynchus'],
  ['tyrannosaurus', 'giganotosaurus', 'tyrannotitan', 'torvosaurus', 'daspletosaurus', 'maip'],
  ['allosaurus', 'pycnonemosaurus', 'yutyrannus', 'metriacanthosaurus', 'ceratosaurus', 'alioramus', 'dilophosaurus'],
  ['achillobator', 'utahraptor', 'kelenken', 'latenivenatrix', 'deinonychus', 'compsognathus'],
  ['argentinosaurus', 'apatosaurus', 'amargasaurus', 'yunnanosaurus', 'therizinosaurus'],
  ['eotriceratops', 'pachyrhinosaurus', 'albertaceratops', 'styracosaurus', 'psittacosaurus'],
  ['parasaurolophus', 'lambeosaurus', 'iguanodon', 'tenontosaurus', 'camptosaurus', 'dryosaurus', 'barsboldia'],
  ['stegosaurus', 'kentrosaurus', 'anodontosaurus', 'pachycephalosaurus', 'struthiomimus', 'citipati'],
];

const AREA_ORDER = [
  'dry-fang-canyon', 'tallbrush-coasts', 'steep-run', 'kelp-vale', 'coastal-bluffs',
  'volcano-islands', 'abyssal-depths', 'palm-islands', 'big-tree-overlook', 'cedrus-forest',
  'twisted-forest', 'black-fern-hills', 'stillwater-bog', 'mudflats', 'stonebed-shoal',
  'cliff-edge-falls', 'coastland-swamp', 'crag-bluffs', 'east-passage', 'redwoods',
  'wind-tunnels', 'hollow-hills', 'wollemi-forest',
];

const parentGroups = {
  'dry-fang-canyon': ['triad-falls', 'sharptooth-oasis', 'dry-fang-canyon', 'helix-pond', 'rockfall-hill'],
  'tallbrush-coasts': ['tallbrush-coasts', 'twofalls-hollow'],
  'steep-run': ['steep-run'],
  'kelp-vale': ['kelp-vale'],
  'coastal-bluffs': ['coastal-bluffs', 'scale-lake'],
  'volcano-islands': ['rocky-lake', 'dark-pond', 'volcano-islands'],
  'abyssal-depths': ['abyssal-depths'],
  'palm-islands': ['palm-islands', 'castaway-isle'],
  'big-tree-overlook': ['big-tree-overlook', 'cedar-valley'],
  'cedrus-forest': ['cedrus-forest'],
  'twisted-forest': ['twisted-forest', 'roots-pond', 'hotsand-pass'],
  'black-fern-hills': ['swamp-reservoirs', 'rotwood-bog', 'black-fern-hills', 'mud-perch'],
  'stillwater-bog': ['pinnacle-hill', 'lillypad-pond', 'littleclaw-pond', 'stillwater-bog'],
  'mudflats': ['mudflats', 'stonebed-shallows', 'mudflats-venule'],
  'stonebed-shoal': ['stonebed-shoal'],
  'cliff-edge-falls': ['cliff-edge-falls'],
  'coastland-swamp': ['lakeside-meadow', 'coastland-swamp'],
  'crag-bluffs': ['crag-bluffs'],
  'east-passage': ['rock-maze', 'east-passage', 'grand-falls'],
  redwoods: ['redwoods-meander', 'redwood-wind', 'redwoods', 'frog-pond', 'dark-falls'],
  'wind-tunnels': ['wind-tunnels', 'crystal-overhang', 'threehorns-meadow'],
  'hollow-hills': ['dropoff-lake', 'dome', 'hollow-hills'],
  'wollemi-forest': ['star-ravine', 'longneck-pass', 'wollemi-forest'],
};

const parentByLandmark = new Map();
for (const [parent, landmarks] of Object.entries(parentGroups)) {
  for (const landmark of landmarks) parentByLandmark.set(landmark, parent);
}

const ROLE_ORDER = ['territory', 'hunting', 'nesting', 'basking', 'resting', 'courtship', 'neutral', 'migration', 'transit'];
const roleSort = (a, b) => {
  const ai = ROLE_ORDER.indexOf(a), bi = ROLE_ORDER.indexOf(b);
  return (ai < 0 ? ROLE_ORDER.length : ai) - (bi < 0 ? ROLE_ORDER.length : bi) || a.localeCompare(b);
};

function decodePNG(buf) {
  let p = 8, W = 0, H = 0, colourType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); colourType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (colourType !== 2) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = W * bpp, out = Buffer.alloc(H * stride);
  let pos = 0;
  for (let y = 0; y < H; y++) {
    const filter = raw[pos++], offset = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[offset + x - bpp] : 0;
      const b = y > 0 ? out[offset - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[offset - stride + x - bpp] : 0;
      let value = raw[pos++];
      if (filter === 1) value = (value + a) & 255;
      else if (filter === 2) value = (value + b) & 255;
      else if (filter === 3) value = (value + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        value = (value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      out[offset + x] = value;
    }
  }
  return { W, H, data: out };
}

function sampleHighlight(img, nx, ny) {
  if (!img) return null;
  const { W, H, data } = img, stride = W * 3;
  const cx = Math.round(nx * W), cy = Math.round(ny * H), radius = Math.round(W * 0.028);
  let total = 0, green = 0, magenta = 0, yellow = 0;
  for (let y = Math.max(0, cy - radius); y < Math.min(H, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(W, cx + radius); x++) {
      const i = y * stride + x * 3, r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b), saturation = max ? (max - min) / max : 0;
      total++;
      if (r > 150 && g > 150 && b < 130 && Math.abs(r - g) < 50) { yellow++; continue; }
      if (max / 255 < 0.3 || saturation < 0.34) continue;
      if (r > 130 && b > 105 && g < Math.min(r, b) - 25 && r - g >= 35 && b - g >= 20) { magenta++; continue; }
      if (g === max && g - r >= 24 && g - b >= 22 && r >= b - 6) green++;
    }
  }
  const scores = { green: green / total, magenta: magenta / total, yellow: yellow / total };
  if (scores.magenta >= 0.16) return 'magenta';
  if (scores.green >= 0.16) return 'green';
  if (scores.yellow >= 0.14) return 'yellow';
  return null;
}

function defaultTerritoryRoles(entries) {
  const preferred = entries.find(entry => entry.roles?.includes('territory'));
  return preferred?.roles || ['territory', 'nesting'];
}

async function curateProfile(id) {
  const path = join(rawDir, id, 'pois.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  const groups = new Map();
  for (const poi of original.pois || []) {
    const parent = parentByLandmark.get(poi.regionId);
    if (!parent) continue;
    const group = groups.get(parent) || { regionId: parent, roles: new Set() };
    for (const role of poi.roles || []) group.roles.add(role);
    groups.set(parent, group);
  }

  if (!groups.has('steep-run') && original.mapImage) {
    const image = decodePNG(await readFile(join(rawDir, id, original.mapImage)));
    const kind = sampleHighlight(image, 0.355, 0.265);
    if (kind) {
      const roles = kind === 'magenta' ? ['courtship', 'nesting']
        : kind === 'yellow' ? ['neutral', 'courtship']
          : defaultTerritoryRoles(original.pois || []);
      groups.set('steep-run', { regionId: 'steep-run', roles: new Set(roles) });
    }
  }

  let pois = AREA_ORDER.filter(area => groups.has(area)).map(area => ({
    regionId: area,
    roles: [...groups.get(area).roles].sort(roleSort),
  }));

  if (id === 'tyrannosaurus') {
    const roles = ['territory', 'hunting', 'nesting'];
    pois = [
      { regionId: 'rex-northern-redwoods', roles },
      { regionId: 'rex-southern-redwoods', roles },
      { regionId: 'rex-western-hills', roles },
      { regionId: 'rex-eastern-hills', roles },
      { regionId: 'rex-upper-wollemi', roles },
      { regionId: 'rex-lower-wollemi', roles },
    ];
  }

  const curated = {
    ...original,
    source: 'curated-areas',
    note: 'Preferred POI areas curated from the profile map. Small named landmarks are represented by their enclosing, black-outlined POI area.',
    pois,
  };
  await writeFile(path, `${JSON.stringify(curated, null, 2)}\n`);
  return { id, before: original.pois?.length || 0, after: pois.length };
}

for (let i = 0; i < batches.length; i++) {
  const results = [];
  for (const id of batches[i]) results.push(await curateProfile(id));
  console.log(`Batch ${i + 1}: ${results.map(item => `${item.id} ${item.before}->${item.after}`).join(', ')}`);
}
