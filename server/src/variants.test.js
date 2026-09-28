import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProcessedData } from './processor.js';
import { createApp } from './app.js';
import { listPlayables } from './playables.js';

const regions = {
  schemaVersion: 1,
  map: { id: 'test', name: 'Test', imageSize: { width: 948, height: 874 } },
  regions: [
    { id: 'red-rock', name: 'Red Rock', shape: { type: 'point', x: 0.2, y: 0.3 }, biome: 'canyon', moisture: 'arid' },
    { id: 'green-bog', name: 'Green Bog', shape: { type: 'point', x: 0.7, y: 0.6 }, biome: 'freshwater', moisture: 'wet' },
    { id: 'hot-springs', name: 'Hot Springs', shape: { type: 'point', x: 0.5, y: 0.5 }, biome: 'volcanic', moisture: 'mesic' },
  ],
};

const variant = (id, name, key) => ({ schemaVersion: 1, id, name, variant: key, label: `${key} variant`, title: `${key} title`, aliases: [`${key} lizard`] });

test('a profile with variants becomes one playable per variant with its own map, guide and analog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-variant-test-'));
  const rawDir = join(root, 'data', 'raw');
  const processedDir = join(root, 'data', 'processed');
  const dir = join(rawDir, 'lizzard');
  await mkdir(join(root, 'data', 'map'), { recursive: true });
  await writeFile(join(root, 'data', 'map', 'regions.json'), JSON.stringify(regions));
  await mkdir(join(dir, 'images'), { recursive: true });
  await writeFile(join(dir, 'images', 'card.png'), 'png');
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, id: 'lizzard', name: 'Lizzard', importedAt: new Date().toISOString(), profileFile: 'profile.txt', images: [{ file: 'images/card.png', label: '', originalFileName: 'card.png' }] }));
  await writeFile(join(dir, 'profile.txt'), 'Lizzard\nMedium Cathemeral Terrestrial Carnivore\nOverview\nA test playable with two variants.\n');
  await writeFile(join(dir, 'pois.json'), JSON.stringify({
    schemaVersion: 1, mapImage: 'images/card.png',
    legend: { dry: 'Dry range', wet: 'Wet range', courtship: 'Courtship' },
    variants: [{ id: 'dry', name: 'Dry', note: 'Dry note' }, { id: 'wet', name: 'Wet', note: 'Wet note' }],
    pois: [
      { regionId: 'red-rock', variant: 'dry', roles: ['territory'] },
      { regionId: 'green-bog', variant: 'wet', roles: ['territory'] },
      { regionId: 'hot-springs', variant: 'both', roles: ['courtship'] },
    ],
  }));
  for (const [id, name, key] of [['lizzard-dry', 'Lizzard (Dry)', 'dry'], ['lizzard-wet', 'Lizzard (Wet)', 'wet']]) {
    const variantDir = join(dir, 'variants', key);
    await mkdir(variantDir, { recursive: true });
    await writeFile(join(variantDir, 'variant.json'), JSON.stringify(variant(id, name, key)));
    await writeFile(join(variantDir, 'playstyle.json'), JSON.stringify({ language: 'de', summary: `${key} guide` }));
  }
  try {
    assert.deepEqual((await listPlayables(rawDir)).map(({ id, rawId, variant: key }) => [id, rawId, key]), [['lizzard-dry', 'lizzard', 'dry'], ['lizzard-wet', 'lizzard', 'wet']]);
    const { catalog } = await buildProcessedData({ rawDir, processedDir });
    assert.deepEqual(catalog.profiles.map(profile => profile.id), ['lizzard-dry', 'lizzard-wet'], 'the parent is replaced by its variants');
    const dry = JSON.parse(await readFile(join(processedDir, 'profiles', 'lizzard-dry.json'), 'utf8'));
    assert.equal(dry.name, 'Lizzard (Dry)');
    assert.deepEqual(dry.map.markers.map(marker => marker.regionId), ['red-rock', 'hot-springs'], 'only its own and the shared POIs');
    assert.deepEqual(Object.keys(dry.map.legend), ['dry', 'courtship']);
    assert.equal(dry.habitat.isDry, true);
    assert.ok(dry.aliases.includes('Lizzard') && dry.aliases.includes('dry lizard'), 'the parent name stays an alias');
    assert.equal(dry.playstyle.summary, 'dry guide');
    assert.deepEqual([dry.variant.parentId, dry.variant.note, dry.variant.siblings.map(item => item.id)], ['lizzard', 'Dry note', ['lizzard-wet']]);
    assert.equal(dry.source.rawId, 'lizzard');
    assert.equal(catalog.profiles[1].variant.title, 'wet title');

    const server = createApp({ dataDir: rawDir, processedDir }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const image = await fetch(`${base}/api/profiles/lizzard-wet/images/card.png`);
      assert.equal(image.status, 200, 'a variant serves the images of its parent profile');
      assert.equal((await fetch(`${base}/api/profiles/lizzard-none/images/card.png`)).status, 404);
    } finally { server.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Megalania is split into an arid and a temperate playable that treat each other as rivals', async () => {
  const processed = fileURLToPath(new URL('../../data/processed/', import.meta.url));
  const load = id => readFile(join(processed, 'profiles', `${id}.json`), 'utf8').then(JSON.parse);
  const arid = await load('megalania-arid');
  const temperate = await load('megalania-temperate');
  assert.ok(arid.map.markers.every(marker => ['arid', 'both'].includes(marker.variant)));
  assert.ok(temperate.map.markers.every(marker => ['temperate', 'both'].includes(marker.variant)));
  assert.equal(arid.ecosystem.id, 'arid');
  assert.equal(temperate.ecosystem.id, 'forest');
  assert.ok(temperate.analog.moods.some(mood => mood.id === 'climber'));
  assert.ok(arid.matchups.opportunities.some(entry => entry.id === 'megalania-temperate' && entry.intent.explicit), 'arid adults may hunt temperate adults');
  assert.ok(temperate.matchups.opportunities.some(entry => entry.id === 'megalania-arid' && entry.intent.explicit), 'and vice versa');
});
