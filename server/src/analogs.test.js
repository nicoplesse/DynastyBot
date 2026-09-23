import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProcessedData } from './processor.js';
import { createApp } from './app.js';
import { buildAnalogIndex, normalizeTerm, resolveAnalog, searchAnalogs } from './analogs.js';

const projectData = fileURLToPath(new URL('../../data/', import.meta.url));
const vocabulary = JSON.parse(await readFile(join(projectData, 'reference', 'analog-vocabulary.json'), 'utf8'));

test('every real playable has a curated analog that uses the controlled vocabulary', async () => {
  const rawDir = join(projectData, 'raw');
  const ids = [];
  for (const entry of await readdir(rawDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'server-rules') continue;
    if (await access(join(rawDir, entry.name, 'manifest.json')).then(() => true, () => false)) ids.push(entry.name);
  }
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const doc = JSON.parse(await readFile(join(rawDir, id, 'analog.json'), 'utf8'));
    assert.equal(doc.source, 'curated', id);
    assert.ok(doc.analogs.length >= 1 && doc.analogs.length <= 2, `${id} has one or two animals`);
    assert.equal(doc.analogs.reduce((sum, analog) => sum + analog.share, 0), 100, `${id} shares add up to 100`);
    for (const analog of doc.analogs) {
      assert.ok(vocabulary.archetypes[analog.archetype], `${id}: unknown archetype ${analog.archetype}`);
      assert.ok(analog.animal && analog.de && analog.scientific && analog.covers, `${id}: incomplete analog ${analog.animal}`);
    }
    for (const mood of doc.moods) assert.ok(vocabulary.moods[mood], `${id}: unknown mood ${mood}`);
    assert.ok(doc.setting.habitats.length > 0, `${id} has habitats`);
    for (const habitat of doc.setting.habitats) assert.ok(vocabulary.habitats[habitat], `${id}: unknown habitat ${habitat}`);
    assert.ok(doc.headline && doc.playsLike && doc.setting.label, `${id} has headline, description and setting`);
    assert.ok(doc.why.length >= 4, `${id} explains why`);
  }
});

function fakeProfile(id, name, analogDoc, diet = 'Herbivore') {
  const profile = {
    id, name, credits: ['Profile inspired by test animals.'],
    classification: { tier: 'Large', activity: 'Diurnal', habitat: 'Terrestrial', diet },
    stats: { combatWeight: 4000, growthMinutes: 120 }, speed: { land: { sprint: 900, sprintDurationSeconds: 60 } },
    fullStats: { curves: [{ key: 'Core.MaxHealth', baseValues: [1, 2, 3, 4, 800], effectiveValues: [1, 2, 3, 4, 800] }] },
    habitat: { biomes: ['forest'], isDry: false, isAquatic: false }, matchups: { traits: {} },
  };
  profile.analog = resolveAnalog(analogDoc, profile, vocabulary);
  return profile;
}

const doc = (analogs, habitats = ['forest'], moods = ['herd']) => ({ source: 'curated', analogs, headline: 'h', playsLike: 'p', setting: { label: 'Somewhere', note: '', habitats }, why: [], notLike: [], moods });

test('search understands German and English, ranks the main animal first and keeps look-alike names apart', () => {
  const profiles = [
    fakeProfile('buffalo-dino', 'Buffalodon', doc([{ animal: 'Cape buffalo', de: 'Kaffernbüffel', scientific: 'x', archetype: 'cattle', share: 100, covers: '' }])),
    fakeProfile('muskox-dino', 'Muskodon', doc([{ animal: 'Musk ox', de: 'Moschusochse', scientific: 'x', archetype: 'cattle', share: 60, covers: '' }, { animal: 'Caribou', de: 'Karibu', scientific: 'x', archetype: 'deer-antelope', share: 40, covers: '' }], ['open'])),
    fakeProfile('lion-dino', 'Lionsaur', doc([{ animal: 'African lion', de: 'Afrikanischer Löwe', scientific: 'x', archetype: 'big-cat', share: 100, covers: '' }], ['open']), 'Carnivore'),
    fakeProfile('jaguar-dino', 'Jagosaur', doc([{ animal: 'Jaguar', de: 'Jaguar', scientific: 'x', archetype: 'big-cat', share: 100, covers: '' }], ['forest']), 'Carnivore'),
    fakeProfile('sealion-dino', 'Sealosaur', doc([{ animal: 'Sea lion', de: 'Seelöwe', scientific: 'x', archetype: 'seal', share: 100, covers: '' }], ['sea']), 'Carnivore'),
  ];
  const index = buildAnalogIndex(profiles, vocabulary);
  assert.equal(normalizeTerm('Großkatze'), 'grosskatze');
  assert.deepEqual(searchAnalogs(index, 'Ich will einen Ochsen spielen').results.map(result => result.id), ['buffalo-dino', 'muskox-dino']);
  assert.equal(searchAnalogs(index, 'Löwe').results[0].id, 'lion-dino');
  assert.ok(!searchAnalogs(index, 'Löwe').results.some(result => result.id === 'sealion-dino'), 'Seelöwe is not a lion');
  assert.equal(searchAnalogs(index, 'Seelöwe').results[0].id, 'sealion-dino');
  assert.equal(searchAnalogs(index, 'Großkatze im Dschungel').results[0].id, 'jaguar-dino');
  assert.equal(searchAnalogs(index, 'big cat savanna').results[0].id, 'lion-dino');
  assert.deepEqual(index.archetypes.cattle.dinos.map(dino => dino.id), ['buffalo-dino', 'muskox-dino']);
  assert.equal(profiles[0].analog.facts.maxHealth, 800);
  assert.equal(profiles[0].analog.officialInspiration, 'test animals');
});

test('processor writes analog blocks and the API serves the index and search', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-analog-test-'));
  const dataDir = join(root, 'data');
  const rawDir = join(dataDir, 'raw');
  const processedDir = join(dataDir, 'processed');
  await mkdir(join(dataDir, 'reference'), { recursive: true });
  await writeFile(join(dataDir, 'reference', 'analog-vocabulary.json'), JSON.stringify(vocabulary));
  const dir = join(rawDir, 'oxodon');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, id: 'oxodon', name: 'Oxodon', importedAt: new Date().toISOString(), profileFile: 'profile.txt', images: [] }));
  await writeFile(join(dir, 'profile.txt'), 'Oxodon\nProfile inspired by oxen.\nLarge Diurnal Terrestrial Herbivore\nOverview\nA test playable.\n');
  await writeFile(join(dir, 'analog.json'), JSON.stringify(doc([{ animal: 'Cape buffalo', de: 'Kaffernbüffel', scientific: 'Syncerus caffer', archetype: 'cattle', share: 100, covers: 'Everything' }])));
  try {
    const { profiles, catalog } = await buildProcessedData({ rawDir, processedDir });
    assert.equal(profiles[0].analog.label, 'Cape buffalo');
    assert.equal(profiles[0].analog.officialInspiration, 'oxen');
    assert.equal(catalog.profiles[0].analog.analogs[0].archetype, 'cattle');
    const index = JSON.parse(await readFile(join(processedDir, 'analogs.json'), 'utf8'));
    assert.deepEqual(index.archetypes.cattle.dinos.map(dino => dino.id), ['oxodon']);
    const server = createApp({ dataDir: rawDir, processedDir }).listen(0);
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      assert.equal((await fetch(`${base}/api/analogs`).then(response => response.json())).dinos.oxodon.label, 'Cape buffalo');
      const search = await fetch(`${base}/api/analogs/search?q=${encodeURIComponent('Büffel')}`).then(response => response.json());
      assert.equal(search.results[0].id, 'oxodon');
    } finally { server.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
