import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { ISLE_NUTRIENTS, ISLE_STAGES, defaultIsleDir, loadIsle } from './isle.js';

const DIETS = ['carnivore', 'herbivore', 'omnivore'];
const prose = (text, min) => typeof text === 'string' && text.length > min && !/^\s*[-*•]/m.test(text);

test('every The Isle playable has a complete German short profile', async () => {
  const files = (await readdir(join(defaultIsleDir, 'playables'))).filter(file => file.endsWith('.json'));
  const { basics, playables } = await loadIsle();
  assert.equal(playables.length, files.length);
  assert.equal(basics.language, 'de');
  assert.deepEqual(basics.stages.map(stage => stage.id), ISLE_STAGES);
  assert.deepEqual(basics.nutrients.map(nutrient => nutrient.id), ISLE_NUTRIENTS);
  assert.equal(new Set(playables.map(playable => playable.order)).size, playables.length, 'order values must be unique');
  for (const playable of playables) {
    const { id } = playable;
    assert.ok(files.includes(`${id}.json`), `${id}: file name must match id`);
    assert.equal(playable.language, 'de', `${id}: must be German`);
    assert.ok(DIETS.includes(playable.diet), `${id}: invalid diet ${playable.diet}`);
    assert.ok(playable.role && playable.tagline, `${id}: role and tagline required`);
    assert.ok(prose(playable.summary, 150), `${id}: summary too short`);
    for (const key of ['adultWeightKg', 'sprintKmh', 'bite', 'groupLimit', 'eggs', 'hungerMinutes', 'thirstMinutes']) {
      assert.equal(typeof playable.stats[key], 'number', `${id}: stats.${key} must be a number`);
    }
    assert.ok(['mound', 'debris'].includes(playable.stats.nest), `${id}: nest must be mound or debris`);
    assert.deepEqual(Object.keys(playable.stats.growthMinutes), ISLE_STAGES, `${id}: growth minutes per stage`);
    for (const nutrient of ISLE_NUTRIENTS) assert.ok(playable.nutrients[nutrient]?.length, `${id}: ${nutrient} food missing`);
    assert.deepEqual(playable.life.map(part => part.id), ['habitat', 'social'], `${id}: life parts must be habitat, social`);
    for (const part of playable.life) assert.ok(part.title && prose(part.text, 150), `${id}: life part ${part.id} too thin`);
    assert.ok(playable.hunt.title && prose(playable.hunt.text, 300), `${id}: hunt section too thin`);
    assert.deepEqual(playable.growth.map(stage => stage.stage), ISLE_STAGES, `${id}: growth guide needs all four stages`);
    for (const stage of playable.growth) assert.ok(prose(stage.text, 80), `${id}: growth stage ${stage.stage} too thin`);
    assert.ok(playable.abilities.length >= 3, `${id}: at least three abilities`);
    for (const ability of playable.abilities) assert.ok(ability.keys && ability.name && ability.text?.length > 10, `${id}: incomplete ability ${ability.name}`);
    assert.ok(playable.tips.length >= 2 && playable.tips.length <= 4, `${id}: two to four tips`);
    assert.ok(playable.sources.length && playable.sources.every(source => source.label && /^https:\/\//.test(source.url)), `${id}: sources need https links`);
  }
});

test('predator nutrient lists link playables both ways', async () => {
  const { playables } = await loadIsle();
  const byId = Object.fromEntries(playables.map(playable => [playable.id, playable]));
  assert.ok(byId.stegosaurus.eatenBy.some(link => link.id === 'tyrannosaurus' && link.nutrient === 'alpha'));
  assert.ok(byId.tyrannosaurus.eats.some(link => link.id === 'triceratops' && link.nutrient === 'beta'));
  assert.deepEqual(byId.triceratops.eats, [], 'herbivores eat plants, not playables');
  assert.ok(!byId.ceratosaurus.eats.some(link => link.id === 'ceratosaurus'), 'cannibalism is not a cross-link');
  assert.equal(byId.hypsilophodon.growthTotalMinutes, 110);
  assert.equal(byId.austroraptor.growthTotalMinutes, null, 'unknown stage times give no total');
});

test('serves the The Isle index and single profiles', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dynasty-bot-isle-'));
  const server = createApp({ dataDir, processedDir: join(dataDir, '.processed'), herdDir: join(dataDir, '.herd') }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(`${base}/api/isle`).then(response => response.json());
    assert.equal(index.count, index.playables.length);
    assert.equal(index.basics.branch, 'Evrima');
    assert.equal(index.playables[0].id, 'tyrannosaurus');
    assert.equal(index.playables[0].life, undefined, 'index carries summaries only');

    const rex = await fetch(`${base}/api/isle/tyrannosaurus`).then(response => response.json());
    assert.equal(rex.name, 'Tyrannosaurus');
    assert.equal(rex.position, 1);
    assert.equal(rex.previous.id, index.playables.at(-1).id);
    assert.equal(rex.next.id, index.playables[1].id);
    assert.ok(rex.abilities.some(ability => ability.name === 'Crush'));

    assert.equal((await fetch(`${base}/api/isle/baryonyx`)).status, 404);
    assert.equal((await fetch(`${base}/api/isle/Not_Valid`)).status, 400);
  } finally {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
