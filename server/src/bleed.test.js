import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../data/processed/profiles/', import.meta.url));
const profile = async id => JSON.parse(await readFile(join(dir, `${id}.json`), 'utf8'));

test('Allosaurus bleeds with Hatchet Bite and needs fewer hits than raw damage', async () => {
  const { bleed } = await profile('allosaurus');
  assert.deepEqual(bleed.attack, { label: 'Hatchet Bite', damage: 70, bleed: 0.45, cooldown: 4 });
  const tenonto = bleed.rows.find(row => row.id === 'tenontosaurus');
  assert.ok(tenonto.trot.hits < tenonto.direct, 'bleed saves hits when the prey runs');
  assert.ok(tenonto.sit.hits >= tenonto.trot.hits, 'a prey that sits heals faster and takes more hits');
  assert.equal(bleed.rows[0].rank, 1, 'profile ranks lead the table');
  assert.ok(!bleed.rows.some(row => row.id === 'quetzalcoatlus'), 'never-prey stays out');
});

test('only hunters with a real bleeding attack get a table', async () => {
  for (const file of await readdir(dir)) {
    const { id, bleed, classification } = JSON.parse(await readFile(join(dir, file), 'utf8'));
    if (!bleed) continue;
    assert.equal(classification.diet, 'Carnivore', id);
    assert.ok(bleed.attack.bleed > 0 && bleed.attack.bleed <= 2.5, `${id}: ${bleed.attack.label} ${bleed.attack.bleed}`);
  }
  assert.equal((await profile('tyrannosaurus')).bleed, null, 'Rex has no bleeding attack');
});
