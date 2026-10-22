import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canClamp, clampReach } from './clamps.js';

const processed = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const index = JSON.parse(await readFile(join(processed, 'clamps.json'), 'utf8'));
const clamper = id => index.clampers.find(item => item.id === id);
const prey = id => index.prey.find(item => item.id === id);

test('a target fits while its combat weight is below the carry capacity', () => {
  assert.equal(canClamp(3101, 3100), true);
  assert.equal(canClamp(2700, 2700), false);
  assert.equal(canClamp(0, 100), false, 'a capacity of 0 (hatchling Rex) cannot clamp');
});

test('reach reports the highest stage and heavier stages below it', () => {
  assert.deepEqual(clampReach(2700, [500, 1750, 2500, 3500, 6000]), { max: 2, gaps: [] });
  assert.deepEqual(clampReach(1200, [300, 750, 1100, 1400, 1050]), { max: 4, gaps: [3] });
  assert.deepEqual(clampReach(100, [500, 1000, 1500, 2000, 2500]), { max: -1, gaps: [] });
});

test('every clamping playable is listed with the Dynasty clamp weight applied (run npm run process)', () => {
  assert.deepEqual(index.clampers.map(item => item.id).sort(), ['austroraptor', 'citipati', 'deinosuchus-ocean', 'deinosuchus-shore', 'hatzegopteryx', 'sarcosuchus', 'tylosaurus', 'tyrannosaurus']);
  assert.equal(clamper('sarcosuchus').capacity.at(-1), 3101, 'Clamp Weight: Up to 3100');
  assert.equal(clamper('deinosuchus-shore').capacity.at(-1), 3901, 'Clamp Weight: Up to 3900');
  assert.equal(clamper('hatzegopteryx').ability, 'grab');
  assert.deepEqual(clamper('tylosaurus').buffs.map(buff => [buff.label, buff.bonus]), [['Wide Gape', 700]]);
  for (const item of index.clampers) assert.ok(item.notes.length, `${item.id} has curated profile notes`);
  assert.equal(clampReach(clamper('sarcosuchus').capacity.at(-1), prey('tyrannosaurus').combatWeight).max, 2, 'adult Sarco clamps a Rex up to Adolescent');
});
