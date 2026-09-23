import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareFoodChain, foodChainLevel } from './ecosystems.js';

const projectData = fileURLToPath(new URL('../../data/', import.meta.url));
const doc = JSON.parse(await readFile(join(projectData, 'reference', 'ecosystems.json'), 'utf8'));

async function playableIds() {
  const rawDir = join(projectData, 'raw');
  const ids = [];
  for (const entry of await readdir(rawDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'server-rules') continue;
    if (await access(join(rawDir, entry.name, 'manifest.json')).then(() => true, () => false)) ids.push(entry.name);
  }
  return ids;
}

test('every playable has exactly one curated home ecosystem with a reason', async () => {
  const known = new Set(doc.ecosystems.map(item => item.id));
  const ids = await playableIds();
  for (const id of ids) {
    const entry = doc.profiles[id];
    assert.ok(entry, `${id} has no ecosystem`);
    assert.ok(known.has(entry.ecosystem), `${id}: unknown ecosystem ${entry.ecosystem}`);
    assert.ok(entry.reason?.length > 20, `${id} explains its ecosystem`);
    for (const also of entry.also || []) {
      assert.ok(known.has(also), `${id}: unknown visited ecosystem ${also}`);
      assert.notEqual(also, entry.ecosystem, `${id}: home ecosystem repeated in also`);
    }
    if (entry.level) assert.ok(entry.levelReason, `${id}: a level override needs a reason`);
  }
  assert.deepEqual(Object.keys(doc.profiles).filter(id => !ids.includes(id)), [], 'no entries for unknown playables');
});

test('food-chain levels put predators above plant-eaters and size decides inside a group', () => {
  const profile = (diet, tier) => ({ classification: { diet, tier } });
  assert.equal(foodChainLevel(profile('Carnivore', 'Apex')).level, 1);
  assert.equal(foodChainLevel(profile('Carnivore', 'Large')).level, 2);
  assert.equal(foodChainLevel(profile('Carnivore', 'Tiny')).level, 4);
  assert.equal(foodChainLevel(profile('Herbivore', 'Giant')).level, 5);
  assert.equal(foodChainLevel(profile('Herbivore', 'Medium')).level, 6);
  assert.equal(foodChainLevel(profile('Herbivore', 'Small')).level, 7);
  assert.equal(foodChainLevel(profile('Carnivore', 'Apex'), { level: 5, levelReason: 'filter feeder' }).level, 5);
  const sorted = [
    { name: 'B', level: 3, combatWeight: 2000, maxHealth: 500 },
    { name: 'A', level: 1, combatWeight: 5000, maxHealth: 900 },
    { name: 'C', level: 3, combatWeight: 3000, maxHealth: 400 },
  ].sort(compareFoodChain).map(item => item.name);
  assert.deepEqual(sorted, ['A', 'C', 'B']);
});

test('the processed overview lists every playable once, from the top of the food chain down', async () => {
  const index = JSON.parse(await readFile(join(projectData, 'processed', 'ecosystems.json'), 'utf8'));
  const ids = await playableIds();
  const listed = index.ecosystems.flatMap(ecosystem => ecosystem.foodChain.map(member => member.id));
  assert.equal(listed.length, ids.length);
  assert.deepEqual([...listed].sort(), [...ids].sort());
  for (const ecosystem of index.ecosystems) {
    ecosystem.foodChain.forEach((member, position) => {
      assert.equal(member.rank, position + 1);
      if (position) assert.ok(compareFoodChain(ecosystem.foodChain[position - 1], member) <= 0, `${ecosystem.id}: ${member.name} out of order`);
    });
  }
  assert.equal(index.ecosystems.find(item => item.id === 'sea').foodChain.some(member => member.id === 'tropeognathus'), true);
});
