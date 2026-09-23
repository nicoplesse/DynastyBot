import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProcessedData } from './processor.js';
import { createApp } from './app.js';

const regions = {
  schemaVersion: 1,
  map: { id: 'test', name: 'Test', imageSize: { width: 948, height: 874 } },
  vocabulary: { moisture: ['arid', 'semi-arid', 'mesic', 'wet', 'aquatic'], dryMoisture: ['arid', 'semi-arid'] },
  regions: [
    { id: 'dust-basin', name: 'Dust Basin', shape: { type: 'point', x: 0.2, y: 0.3 }, biome: 'canyon', moisture: 'arid', water: { present: false, type: 'none' }, terrain: ['rock'], description: 'Dry basin.' },
    { id: 'green-lake', name: 'Green Lake', shape: { type: 'point', x: 0.7, y: 0.6 }, biome: 'freshwater', moisture: 'wet', water: { present: true, type: 'fresh', feature: 'lake' }, terrain: ['lake'], description: 'Wet lake.' },
  ],
};

async function writeProfile(rawDir, id, name, pois, opts = {}) {
  const diet = opts.diet || 'Carnivore';
  const dir = join(rawDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, id, name, importedAt: new Date().toISOString(), profileFile: 'profile.txt', images: [{ file: 'images/map.png', label: '', originalFileName: 'map.png' }] }));
  const stats = opts.cw ? `\nDynasty Adjusted Stats\nGrowth Time (minutes): 10-20-30-30 = 90 total\nCombat Weight: ${opts.cw}\n` : '';
  await writeFile(join(dir, 'profile.txt'), `${name}\nMedium Cathemeral Terrestrial ${diet}\nOverview\nA test playable.\n${stats}`);
  if (pois) await writeFile(join(dir, 'pois.json'), JSON.stringify(pois));
}

test('resolves POIs, derives habitat and builds an inverted map index for chatbot queries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-map-test-'));
  const dataDir = join(root, 'data');
  const rawDir = join(dataDir, 'raw');
  const processedDir = join(dataDir, 'processed');
  await mkdir(join(dataDir, 'map'), { recursive: true });
  await writeFile(join(dataDir, 'map', 'regions.json'), JSON.stringify(regions));
  await writeProfile(rawDir, 'sandlizard', 'Sandlizard', { schemaVersion: 1, mapImage: 'images/map.png', pois: [{ regionId: 'dust-basin', roles: ['territory', 'basking'], variant: 'arid', note: 'Dry home range.' }] }, { diet: 'Carnivore', cw: 3000 });
  await writeProfile(rawDir, 'pondnewt', 'Pondnewt', { schemaVersion: 1, mapImage: 'images/map.png', pois: [{ regionId: 'green-lake', roles: ['territory'] }] }, { diet: 'Herbivore', cw: 1000 });
  await writeProfile(rawDir, 'ghostmap', 'Ghostmap', null);
  await writeFile(join(rawDir, 'sandlizard', 'routes.json'), JSON.stringify({ schemaVersion: 1, routes: [{ id: 'r1', name: 'Test Route', role: 'migration', color: '#fff', via: ['dust-basin', 'green-lake'] }] }));

  try {
    await buildProcessedData({ rawDir, processedDir });

    const sand = JSON.parse(await readFile(join(processedDir, 'profiles', 'sandlizard.json'), 'utf8'));
    assert.equal(sand.map.image, 'images/map.png');
    assert.equal(sand.map.imageSize.width, 948);
    assert.equal(sand.map.markers[0].name, 'Dust Basin');
    assert.equal(sand.map.markers[0].moisture, 'arid');
    assert.equal(sand.map.markers[0].biome, 'canyon');
    assert.deepEqual(sand.map.markers[0].shape, { type: 'point', x: 0.2, y: 0.3 });
    assert.equal(sand.habitat.isDry, true);
    assert.ok(sand.habitat.moisture.includes('arid'));
    assert.equal(sand.map.routes.length, 1);
    assert.equal(sand.map.routes[0].name, 'Test Route');
    assert.equal(sand.map.routes[0].waypoints.length, 2);
    assert.deepEqual(sand.map.routes[0].via, ['dust-basin', 'green-lake']);
    assert.ok((sand.habitat.roles.migration || []).length >= 2);

    const ghost = JSON.parse(await readFile(join(processedDir, 'profiles', 'ghostmap.json'), 'utf8'));
    assert.equal(ghost.map, null);
    assert.equal(ghost.habitat.isDry, false);

    assert.equal(sand.matchups.traits.combatWeight, 3000);
    assert.equal(sand.matchups.schemaVersion, 2);
    assert.deepEqual(sand.matchups.opportunities, [], 'a test profile without an explicit hunt rule gets no invented prey');
    const newt = JSON.parse(await readFile(join(processedDir, 'profiles', 'pondnewt.json'), 'utf8'));
    assert.deepEqual(newt.matchups.threats, [], 'combat weight alone no longer invents a threat');

    const index = JSON.parse(await readFile(join(processedDir, 'map-index.json'), 'utf8'));
    assert.deepEqual(index.moisture.arid.dinoIds, ['sandlizard']);
    assert.deepEqual(index.moisture.wet.dinoIds, ['pondnewt']);
    assert.deepEqual(index.groups.dry, ['sandlizard']);
    assert.deepEqual(index.groups.migration, ['sandlizard']);
    assert.ok(index.regions['green-lake'].roles.migration.includes('sandlizard'));
    assert.deepEqual(index.regions['dust-basin'].dinoIds, ['sandlizard']);
    assert.deepEqual(index.regions['dust-basin'].roles.territory, ['sandlizard']);
    assert.equal(index.dinos.sandlizard.isDry, true);

    const catalog = JSON.parse(await readFile(join(processedDir, 'index.json'), 'utf8'));
    const sandItem = catalog.profiles.find(item => item.id === 'sandlizard');
    assert.equal(sandItem.habitat.isDry, true);
    assert.equal(sandItem.habitat.hasMap, true);

    const server = createApp({ dataDir: rawDir, processedDir }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const served = await fetch(`${base}/api/map-index`).then(response => response.json());
      assert.deepEqual(served.moisture.arid.dinoIds, ['sandlizard']);
      const map = await fetch(`${base}/api/map`).then(response => response.json());
      assert.equal(map.regions.length, 2);
      const mu = await fetch(`${base}/api/matchups`).then(response => response.json());
      assert.ok(mu.dinos.sandlizard && mu.dinos.pondnewt);
      assert.equal(mu.speedKnown, false);
    } finally {
      server.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
