import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { animalId, resolveModes } from './analogs.js';
import { listPlayables } from './playables.js';

const projectData = fileURLToPath(new URL('../../data/', import.meta.url));
const rawDir = join(projectData, 'raw');
const vocabulary = JSON.parse(await readFile(join(projectData, 'reference', 'analog-vocabulary.json'), 'utf8'));
const photos = JSON.parse(await readFile(join(projectData, 'reference', 'animal-photos.json'), 'utf8')).animals;
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
// "Grey wolf (family pack)" and "Grey wolf" are the same animal.
const species = analog => animalId(analog.animal.replace(/\s*\(.*\)$/, ''));
const squash = text => text.replace(/\s+/g, ' ');

test('every playable has a reviewed solo/group verdict', async () => {
  for (const { id, dir } of await listPlayables(rawDir)) {
    const doc = await readJson(join(dir, 'modes.json'));
    assert.equal(doc.source, 'curated', id);
    assert.ok(['same', 'rebalanced', 'different'].includes(doc.verdict), `${id}: verdict ${doc.verdict}`);
    assert.ok(['solo', 'group', 'both'].includes(doc.base), `${id}: base ${doc.base}`);
    assert.ok(doc.note?.length > 60, `${id}: the German note must explain the verdict`);
    const modes = ['solo', 'group'].filter(mode => doc[mode]);
    if (doc.verdict === 'same') { assert.deepEqual(modes, [], `${id}: "same" carries no own mode`); continue; }
    assert.notEqual(doc.base, 'both', `${id}: a changed mode needs a base mode`);
    assert.deepEqual(modes, [doc.base === 'solo' ? 'group' : 'solo'], `${id}: only the mode that is not the base is overridden`);
  }
});

test('changed modes are complete, use the vocabulary and quote the profile verbatim', async () => {
  for (const { id, rawId, dir } of await listPlayables(rawDir)) {
    const doc = await readJson(join(dir, 'modes.json'));
    if (doc.verdict === 'same') continue;
    const base = await readJson(join(dir, 'analog.json'));
    const own = doc[doc.base === 'solo' ? 'group' : 'solo'];
    assert.equal(own.analogs.reduce((sum, analog) => sum + analog.share, 0), 100, `${id}: shares add up to 100`);
    assert.ok(own.headline && own.playsLike && own.why?.length >= 3 && own.moods?.length, `${id}: headline, description, reasons and moods`);
    assert.ok(own.summary?.length > 150 && /[äöüß]/.test(own.summary), `${id}: German play guide summary for the mode`);
    for (const analog of own.analogs) {
      assert.ok(vocabulary.archetypes[analog.archetype], `${id}: unknown archetype ${analog.archetype}`);
      assert.ok(analog.animal && analog.de && analog.scientific && analog.covers, `${id}: incomplete analog ${analog.animal}`);
      assert.ok(photos[animalId(analog.animal)]?.image, `${id}: no photo for ${analog.animal}`);
    }
    for (const mood of own.moods) assert.ok(vocabulary.moods[mood], `${id}: unknown mood ${mood}`);
    for (const habitat of own.setting?.habitats || []) assert.ok(vocabulary.habitats[habitat], `${id}: unknown habitat ${habitat}`);
    const baseAnimals = new Set(base.analogs.map(species));
    const ownAnimals = own.analogs.map(species);
    if (doc.verdict === 'rebalanced') {
      assert.ok(ownAnimals.every(animal => baseAnimals.has(animal)), `${id}: rebalanced keeps the base animals`);
      const baseShare = new Map(base.analogs.map(analog => [species(analog), analog.share]));
      assert.ok(own.analogs.length < base.analogs.length || own.analogs.some(analog => baseShare.get(species(analog)) !== analog.share), `${id}: rebalanced changes the shares`);
    } else assert.ok(ownAnimals.some(animal => !baseAnimals.has(animal)), `${id}: different brings in another animal`);
    // Text inside typographic quotes must be copied from the official profile.
    const profile = squash(await readFile(join(rawDir, rawId, 'profile.txt'), 'utf8'));
    for (const reason of own.why) for (const [, quote] of reason.text.matchAll(/“([^”]+)”/g)) {
      assert.ok(profile.includes(squash(quote)), `${id}: “${quote}” is not in the profile`);
    }
  }
});

test('resolveModes lays the changed mode over the base analog and keeps the base mode', () => {
  const base = { analogs: [{ animal: 'Spotted hyena', archetype: 'hyena', share: 55 }, { animal: 'Dwarf mongoose', archetype: 'small-mammal', share: 45 }], headline: 'Clan', playsLike: 'Group', setting: { label: 'Open', habitats: ['open'] }, moods: ['pack'] };
  const doc = { base: 'group', verdict: 'different', note: 'Anderes Tier', solo: { analogs: [{ animal: 'Brown hyena', archetype: 'hyena', share: 100 }], headline: 'Loner', moods: ['solitary'], summary: 'Solo-Text' } };
  const modes = resolveModes(doc, base, { credits: [] }, vocabulary);
  assert.equal(modes.changes, 'solo');
  assert.equal(modes.group.own, false);
  assert.equal(modes.group.analog.label, 'Spotted hyena + Dwarf mongoose');
  assert.equal(modes.solo.own, true);
  assert.equal(modes.solo.analog.label, 'Brown hyena');
  assert.equal(modes.solo.analog.playsLike, 'Group', 'fields the mode leaves out come from the base');
  assert.equal(modes.solo.summary, 'Solo-Text');
  assert.notEqual(modes.solo.analog, modes.group.analog);
  const same = resolveModes({ base: 'both', verdict: 'same', note: 'Gleich' }, base, { credits: [] }, vocabulary);
  assert.equal(same.changes, null);
  assert.equal(same.solo.analog.label, same.group.analog.label);
});

test('processed profiles and the catalog carry both play modes', async () => {
  const processed = join(projectData, 'processed');
  const catalog = await readJson(join(processed, 'index.json'));
  for (const { id, dir } of await listPlayables(rawDir)) {
    const doc = await readJson(join(dir, 'modes.json'));
    const profile = await readJson(join(processed, 'profiles', `${id}.json`));
    assert.equal(profile.modes.verdict, doc.verdict, id);
    for (const mode of ['solo', 'group']) assert.ok(profile.modes[mode].analog.analogs.every(analog => analog.photo?.image), `${id}: ${mode} photos`);
    const item = catalog.profiles.find(entry => entry.id === id);
    assert.equal(Boolean(item.modes.solo || item.modes.group), doc.verdict !== 'same', `${id}: catalog carries only a changed mode`);
  }
  const solo = await readJson(join(processed, 'analogs.json'));
  const group = await readJson(join(processed, 'analogs-group.json'));
  assert.equal(solo.mode, 'solo');
  assert.equal(group.mode, 'group');
  assert.ok(solo.dinos.deinonychus.analogs.some(analog => analog.id === 'brown-hyena'));
  assert.ok(group.dinos.deinonychus.analogs.some(analog => analog.id === 'spotted-hyena'));
});
