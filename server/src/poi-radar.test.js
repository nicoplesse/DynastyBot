import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const radar = JSON.parse(await readFile(join(root, 'poi-radar.json'), 'utf8'));
const map = JSON.parse(await readFile(join(root, 'map.json'), 'utf8'));

test('the radar covers every POI area and every playable', () => {
  const areas = map.regions.filter(region => region.shape.type === 'polygon' && !region.within).map(region => region.id);
  assert.deepEqual(radar.areas.map(area => area.id).sort(), areas.sort());
  const ids = new Set(radar.areas.map(area => area.id));
  for (const [id, dino] of Object.entries(radar.dinos)) {
    assert.ok(dino.home.length, `${id}: no profile POI`);
    for (const poi of [...dino.home, ...dino.route]) assert.ok(ids.has(poi), `${id}: ${poi} is not a POI area`);
    assert.ok(radar.cards[id], `${id}: combat card`);
  }
});

test('home POIs come from the profile map, route POIs from the migration lines', () => {
  assert.ok(radar.dinos.allosaurus.home.includes('cedrus-forest'));
  assert.deepEqual(radar.dinos.allosaurus.route, []);
  // Tyrannosaurus territories drawn inside an area count for the area itself.
  assert.ok(radar.dinos.tyrannosaurus.home.includes('redwoods'));
  assert.ok(radar.dinos.amargasaurus.route.includes('cedrus-forest'), 'Amargasaurus passes Cedrus Forest on the sauropod route');
  assert.ok(!radar.dinos.amargasaurus.route.some(id => radar.dinos.amargasaurus.home.includes(id)), 'a POI is home or route, not both');
});

test('pairs hold the pursuit verdict for every pair and mark legal hunts', () => {
  assert.equal(Object.keys(radar.pairs.allosaurus).length, Object.keys(radar.dinos).length - 1);
  assert.equal(radar.pairs.allosaurus.tenontosaurus.a, 1);
  assert.equal(radar.pairs.allosaurus.stegosaurus.v, 'attacker-faster');
  assert.ok(!radar.pairs.tenontosaurus.allosaurus.a, 'a herbivore does not hunt');
});
