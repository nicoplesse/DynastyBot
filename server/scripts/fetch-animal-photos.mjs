import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { animalId } from '../src/analogs.js';

// One-time research import of the real-animal photos behind the "plays like" analogs.
// data/reference/animal-photos.json is the curated source: per animal id it names the English
// Wikipedia article (`wiki`) and may pin a specific Commons file (`file` plus `"pinned": true`)
// when the article's lead image is a map, skeleton or poor crop; `focus` is an optional CSS
// object-position for the crop. This script resolves each entry to a hotlinkable Wikimedia
// thumbnail plus author and licence for the on-page credit. The website never calls Wikipedia;
// it only loads the stored Wikimedia thumbnail URLs.
// Usage: node scripts/fetch-animal-photos.mjs [--refresh] [animal-id ...]
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const rawDir = join(projectRoot, 'data', 'raw');
const photoFile = join(projectRoot, 'data', 'reference', 'animal-photos.json');
const api = 'https://en.wikipedia.org/w/api.php';
const width = 1280;
const sleep = ms => new Promise(done => setTimeout(done, ms));

function plain(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

// Wikipedia throttles anonymous clients hard, so titles are batched and 429s back off.
async function query(params, attempt = 0) {
  const url = `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'DynastyBot/0.1 (local reference import)' } });
  if (response.status === 429 && attempt < 6) {
    await sleep((Number(response.headers.get('retry-after')) || 5 * (attempt + 1)) * 1000);
    return query(params, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await sleep(1000);
  return response.json();
}

function chunks(list, size = 20) {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, index * size + size));
}

// Follows normalisation and redirects back to the title that was asked for.
function requestedTitles(data) {
  const alias = new Map([...(data.query?.normalized || []), ...(data.query?.redirects || [])].map(step => [step.to, step.from]));
  return title => { while (alias.has(title)) title = alias.get(title); return title; };
}

async function leadImages(titles) {
  const result = new Map();
  for (const batch of chunks(titles)) {
    const data = await query({ action: 'query', titles: batch.join('|'), prop: 'pageimages', piprop: 'name', redirects: '1' });
    const requested = requestedTitles(data);
    for (const page of data.query?.pages || []) if (page.pageimage) result.set(requested(page.title), `File:${page.pageimage}`);
  }
  return result;
}

async function imageInfos(files) {
  const result = new Map();
  for (const batch of chunks(files)) {
    const data = await query({ action: 'query', titles: batch.join('|'), prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: String(width) });
    const requested = requestedTitles(data);
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      result.set(requested(page.title), {
        image: String(info.thumburl || info.url).replace(/\?utm_.*$/, ''),
        width: info.thumbwidth || info.width,
        height: info.thumbheight || info.height,
        page: info.descriptionurl,
        artist: plain(meta.Artist?.value) || 'Unknown author',
        license: plain(meta.LicenseShortName?.value) || 'see source',
      });
    }
  }
  return result;
}

async function analogAnimals() {
  const animals = new Map();
  for (const entry of await readdir(rawDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const doc = await readFile(join(rawDir, entry.name, 'analog.json'), 'utf8').then(JSON.parse).catch(() => null);
    for (const analog of doc?.analogs || []) animals.set(animalId(analog.animal), analog.animal);
  }
  return animals;
}

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = new Set(args.filter(arg => !arg.startsWith('--')));
const doc = await readFile(photoFile, 'utf8').then(JSON.parse).catch(() => ({ schemaVersion: 1, animals: {} }));
const animals = await analogAnimals();
const todo = [...animals].sort().filter(([id, name]) => {
  const entry = (doc.animals[id] ||= { wiki: name });
  return only.size ? only.has(id) : refresh || !entry.image;
}).map(([id]) => id);
const leads = await leadImages([...new Set(todo.filter(id => !doc.animals[id].pinned).map(id => doc.animals[id].wiki))]);
for (const id of todo) if (!doc.animals[id].pinned) doc.animals[id].file = leads.get(doc.animals[id].wiki) || null;
const infos = await imageInfos([...new Set(todo.map(id => doc.animals[id].file).filter(Boolean))]);
const failures = [];
for (const id of todo) {
  const entry = doc.animals[id];
  const info = entry.file && infos.get(entry.file);
  if (info) Object.assign(entry, info);
  else failures.push(id);
  console.log(`${info ? 'ok  ' : 'FAIL'} ${id.padEnd(26)} ${entry.file || `no lead image on "${entry.wiki}"`}`);
}
const unused = Object.keys(doc.animals).filter(id => !animals.has(id));
doc.schemaVersion = 1;
doc.source = 'Wikimedia Commons: lead image of the English Wikipedia article unless a pinned `file` overrides it';
doc.animals = Object.fromEntries(Object.entries(doc.animals).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(photoFile, JSON.stringify({ schemaVersion: doc.schemaVersion, source: doc.source, animals: doc.animals }, null, 2) + '\n');
console.log(`${animals.size} analog animals, ${todo.length} resolved now, ${failures.length} failed${unused.length ? `, unused entries: ${unused.join(', ')}` : ''}`);
if (failures.length) process.exitCode = 1;
