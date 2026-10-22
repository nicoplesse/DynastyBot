import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeMembers } from './migration.js';

const root = fileURLToPath(new URL('../../data/', import.meta.url));
const index = JSON.parse(await readFile(join(root, 'processed', 'migration.json'), 'utf8'));
const trace = JSON.parse(await readFile(join(root, 'map', 'routes.json'), 'utf8'));
const doc = JSON.parse(await readFile(join(root, 'reference', 'migration-routes.json'), 'utf8'));
const route = id => index.routes.find(item => item.id === id);
const members = id => Object.fromEntries(route(id).members.map(member => [member.id, member.usage]));

test('every named route points at a traced layer with a stroke image', () => {
  for (const item of doc.routes) {
    const layer = trace.layers.find(entry => entry.key === item.layer);
    assert.ok(layer, `${item.id}: layer ${item.layer} was not traced (run npm run trace:routes -w server)`);
    assert.ok(layer.file && layer.regions.length >= 4, `${item.id}: stroke file and crossed POIs`);
  }
});

test('playables are matched to the routes their profile maps draw', () => {
  assert.deepEqual(members('ceratopsian'), { albertaceratops: 'full', pachyrhinosaurus: 'full', psittacosaurus: 'full', styracosaurus: 'full' });
  assert.deepEqual(members('mixed'), { camptosaurus: 'full', iguanodon: 'full', lambeosaurus: 'full', parasaurolophus: 'full' });
  assert.equal(members('sauropod').apatosaurus, 'full');
  assert.equal(members('sauropod').argentinosaurus, 'partial', 'Argentinosaurus only walks the western corridor');
  assert.equal(members('leedsichthys')['spinosaurus-saltwater'], 'profile');
});

test('a POI lists the routes and the playables whose own line passes it', () => {
  const redwoods = index.pois.redwoods;
  assert.ok(redwoods.routes.includes('ceratopsian') && redwoods.routes.includes('mixed'));
  assert.ok(redwoods.playables.includes('pachyrhinosaurus'));
  assert.ok(route('ceratopsian').links.some(pair => pair.includes('redwoods') && pair.includes('hollow-hills')), 'Redwoods leads on to Hollow Hills');
  assert.ok(!index.pois['kelp-vale']?.playables.includes('pachyrhinosaurus'));
});

test('hunters get the migrating prey their hunt tier allows', () => {
  const utah = index.hunters.utahraptor;
  assert.ok(utah.prey.some(item => item.id === 'pachyrhinosaurus'));
  assert.ok(!utah.prey.some(item => item.id === 'argentinosaurus'), 'Giant tier is above an Apex hunt limit');
  assert.ok(!index.hunters.tyrannosaurus.prey.some(item => item.id === 'leedsichthys'), 'land hunters cannot reach the sea migrant');
  assert.ok(utah.pois.includes('redwoods'));
});

test('membership needs the overlap thresholds', () => {
  const layers = [
    { key: 'a:white', profile: 'a', covers: { 'b:white': 0.9, 'c:white': 0.2 } },
    { key: 'b:white', profile: 'b', covers: { 'a:white': 0.95 } },
    { key: 'c:white', profile: 'c', covers: { 'a:white': 0.3 } },
  ];
  const byRaw = new Map(['a', 'b', 'c'].map(id => [id, [{ id }]]));
  const result = routeMembers({ id: 'r', layer: 'a:white' }, layers, byRaw, { matchFull: 0.85, matchPart: 0.85 });
  assert.deepEqual(result.map(item => [item.id, item.usage]), [['a', 'full'], ['b', 'full']]);
});
