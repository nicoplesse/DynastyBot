import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPlayables } from './playables.js';

const rawDir = fileURLToPath(new URL('../../data/raw/', import.meta.url));
const SOLO_FITS = ['solo', 'solo-possible', 'group'];


test('every playable has a curated German playstyle guide', async () => {
  for (const { id, dir } of await listPlayables(rawDir)) {
    const doc = JSON.parse(await readFile(join(dir, 'playstyle.json'), 'utf8'));
    assert.equal(doc.language, 'de', `${id}: playstyle must be German`);
    assert.ok(SOLO_FITS.includes(doc.solo?.fit), `${id}: invalid solo fit ${doc.solo?.fit}`);
    assert.ok(doc.solo.note?.length > 40, `${id}: solo note missing`);
    assert.ok(doc.summary?.length > 150, `${id}: summary too short`);
    assert.deepEqual(doc.parts.map(part => part.id), ['daily', 'hunt', 'courtship'], `${id}: parts must be daily, hunt, courtship`);
    for (const part of doc.parts) {
      assert.ok(part.title && part.text?.length > 150, `${id}: part ${part.id} is too thin`);
      assert.ok(!/^\s*[-*•]/m.test(part.text), `${id}: part ${part.id} must be prose, not bullets`);
    }
    assert.equal(doc.parts[2].fixed, true, `${id}: courtship follows the profile and must be marked fixed`);
  }
});
