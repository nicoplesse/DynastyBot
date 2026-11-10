import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { AQUATIC_SIDES, cutTerritory, defaultAquaticDir, loadAquatic, parseBlocks, parseDraft, polygonArea, splitHalf } from './aquatic.js';

test('parses the Markdown subset the drafts use', () => {
  const blocks = parseBlocks([
    '## Engagement Limits',
    '',
    'Up to **2** may hunt.',
    'Second line of the same paragraph.',
    '',
    '- **Tiers:**',
    '  - Medium in any party.',
    '  - Large with 4.',
    '- Flee from Livyatan.',
    '',
    '1. Find',
    '   - by sound',
    '2. Strike',
    '',
    '| Kampf | Ergebnis |',
    '| --- | --- |',
    '| 1 gegen 1 | gewinnt |',
  ].join('\n'));
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'paragraph', 'list', 'list', 'table']);
  assert.deepEqual(blocks[0], { type: 'heading', level: 2, text: 'Engagement Limits', id: 'engagement-limits' });
  assert.equal(blocks[1].text, 'Up to **2** may hunt. Second line of the same paragraph.');
  assert.equal(blocks[2].ordered, false);
  assert.deepEqual(blocks[2].items[0].children.items.map(item => item.text), ['Medium in any party.', 'Large with 4.']);
  assert.equal(blocks[2].items[1].text, 'Flee from Livyatan.');
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[3].items[0].children.items[0].text, 'by sound');
  assert.deepEqual(blocks[4], { type: 'table', header: ['Kampf', 'Ergebnis'], rows: [['1 gegen 1', 'gewinnt']] });
});

test('splits a draft into title, German overview and English profile', () => {
  const draft = parseDraft('# Entwurf: Test\n\nDeutsch.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---\n\nEnglish intro.\n\n## Overview\n\n- Line\n\n## Hunting\n\nText.\n');
  assert.equal(draft.title, 'Entwurf: Test');
  assert.deepEqual(draft.overview.map(block => block.type), ['paragraph', 'table']);
  assert.equal(draft.profile[0].text, 'English intro.');
  assert.deepEqual(draft.toc, [{ id: 'overview', title: 'Overview' }, { id: 'hunting', title: 'Hunting' }]);
});

test('every Aquatic Update draft has card facts and a readable profile', async () => {
  const files = (await readdir(defaultAquaticDir)).filter(file => file.endsWith('.md'));
  const { overview, profiles } = await loadAquatic();
  assert.equal(profiles.length, files.length, 'every draft is listed in index.json');
  assert.deepEqual(overview.sides.map(side => side.id), AQUATIC_SIDES);
  assert.equal(new Set(profiles.map(profile => profile.order)).size, profiles.length, 'order values must be unique');
  for (const profile of profiles) {
    const { id, stats, draft } = profile;
    assert.ok(AQUATIC_SIDES.includes(profile.side), `${id}: invalid side ${profile.side}`);
    assert.ok(['new', 'changed'].includes(profile.kind), `${id}: kind must be new or changed`);
    assert.equal(profile.kind === 'new', Boolean(profile.mod), `${id}: new profiles are mods, changed ones are not`);
    // A mod that is not downloaded yet has no UGC id and no speeds from the game files.
    if (profile.mod?.id !== undefined) assert.match(profile.mod.id, /^UGC_M_[A-Z0-9]{10}_SK$/, `${id}: mod id`);
    for (const key of ['cw', 'health', 'armor', 'heal', 'dps']) assert.equal(typeof stats[key], 'number', `${id}: stats.${key} must be a number`);
    for (const key of ['swim', 'sprint', 'accel']) assert.ok(typeof stats[key] === 'number' || (stats[key] === null && profile.mod && !profile.mod.id), `${id}: stats.${key} must be a number, or null for a mod not downloaded yet`);
    assert.ok(profile.role && profile.essence && profile.analog && profile.home, `${id}: card facts missing`);
    assert.ok(draft.title.startsWith('Entwurf:'), `${id}: draft title`);
    assert.ok(draft.overview.length >= 2, `${id}: German overview missing`);
    assert.ok(draft.toc.length >= 3, `${id}: English profile needs sections`);
  }
});

test('splits a POI outline into two equal-area halves', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const west = splitHalf(square, 'x', 'low');
  const east = splitHalf(square, 'x', 'high');
  assert.equal(west.cut, 0.5);
  assert.equal(polygonArea(west.points), 0.5);
  assert.equal(polygonArea(east.points), 0.5);
  // An L-shape: the cut moves to where the area, not the width, is halved.
  const ell = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
  const north = splitHalf(ell, 'y', 'low');
  assert.ok(Math.abs(polygonArea(north.points) - polygonArea(ell) / 2) < 1e-3);
  assert.ok(north.cut < 1.5, 'the wide bottom bar pulls the cut up');
});

test('cuts a POI into three segments with cuts in a row', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const east = cutTerritory(square, { cuts: [{ axis: 'x', side: 'high', share: 1 / 3 }] });
  const north = cutTerritory(square, { cuts: [{ axis: 'x', side: 'low', share: 2 / 3 }, { axis: 'y', side: 'low', share: 0.5 }] });
  const south = cutTerritory(square, { cuts: [{ axis: 'x', side: 'low', share: 2 / 3 }, { axis: 'y', side: 'high', share: 0.5 }] });
  for (const part of [east, north, south]) assert.ok(Math.abs(polygonArea(part.points) - 1 / 3) < 1e-3);
  assert.deepEqual(cutTerritory(square, { axis: 'x', half: 'low' }).points, splitHalf(square, 'x', 'low').points);
});

test('the habitat map covers every draft and splits each Sachicasaurus territory POI without gaps', async () => {
  const { profiles, habitat } = await loadAquatic();
  assert.deepEqual(habitat.species.map(species => species.id).sort(), profiles.map(profile => profile.id).sort(), 'one habitat entry per draft');
  const areaById = new Map(habitat.areas.map(area => [area.id, area]));
  for (const parent of new Set(habitat.territories.map(territory => territory.parent))) {
    const parts = habitat.territories.filter(territory => territory.parent === parent);
    assert.ok(parts.length >= 2, `${parent} is split`);
    assert.equal(new Set(parts.map(part => part.rank)).size, 1, `${parent} is either preferred or secondary`);
    const whole = polygonArea(areaById.get(parent).points);
    for (const part of parts) assert.ok(Math.abs(polygonArea(part.points) / whole - 1 / parts.length) < 0.01, `${part.id} holds an equal share of ${parent}`);
  }
  // Since 2026-11-10: ten preferred ocean halves, and five secondary territories in Volcano Islands (3) and Twisted Forest (2).
  const preferred = habitat.territories.filter(territory => territory.rank === 'preferred');
  const secondary = habitat.territories.filter(territory => territory.rank === 'secondary');
  assert.equal(preferred.length, 10);
  assert.ok(preferred.every(territory => areaById.get(territory.parent).zone === 'ocean'), 'preferred territories lie in the oceans');
  assert.deepEqual(secondary.map(territory => territory.parent).sort(), ['twisted-forest', 'twisted-forest', 'volcano-islands', 'volcano-islands', 'volcano-islands']);
  const sachi = habitat.species.find(species => species.id === 'sachicasaurus');
  assert.ok(sachi.territories);
  // Since 2026-11-05 the nursery lies at Tallbrush Coasts; besides it, only oceans and the secondary territory POIs.
  const secondaryParents = new Set(secondary.map(territory => territory.parent));
  assert.ok(sachi.areas.filter(area => !area.roles.includes('nest')).every(area => areaById.get(area.id).zone === 'ocean' || secondaryParents.has(area.id)), 'Sachicasaurus lives in the oceans and its secondary territories');
  // Since 2026-11-06 Sachicasaurus also holds halves of the Abyssal Depths, on the high rock ledges.
  assert.ok(habitat.territories.some(territory => territory.parent === 'abyssal-depths'), 'Sachicasaurus holds halves of the Abyssal Depths');
  const livy = habitat.species.find(species => species.id === 'livyatan');
  assert.ok(!livy.areas.some(area => area.id === 'palm-islands'), 'Livyatan never enters Palm Islands');
  const xiph = habitat.species.find(species => species.id === 'xiphactinus');
  assert.ok(xiph.areas.every(area => areaById.get(area.id).zone === 'channels'), 'Xiphactinus lives only in the channels');
});

test('the relations table covers every pair and matches the habitat rules', async () => {
  const { overview, profiles, relations } = await loadAquatic();
  const ids = [...profiles, ...overview.extras].map(entry => entry.id);
  assert.deepEqual([...relations.order].sort(), [...ids].sort());
  const kind = (actor, target) => relations.relations[actor][target][0];
  // Decisions of 2026-11-03 that the table must keep.
  assert.equal(kind('xiphactinus', 'spinosaurus'), 'ignore');
  assert.equal(kind('spinosaurus', 'xiphactinus'), 'ignore');
  assert.equal(kind('xiphactinus', 'tylosaurus'), 'flee');
  assert.equal(kind('deinosuchus', 'xiphactinus'), 'hunt');
  // Since 2026-11-06 Kaiwhekea and Leedsichthys no longer group; they only meet.
  assert.equal(kind('kaiwhekea', 'leedsichthys'), 'meet');
  assert.ok(['hunt', 'limited'].includes(kind('sachicasaurus', 'spinosaurus')));
  for (const id of ['xiphactinus', 'sarcosuchus']) assert.equal(kind('livyatan', id), 'none', `Livyatan never meets ${id}`);
  for (const extra of overview.extras) for (const key of ['swim', 'sprint', 'accel']) assert.equal(typeof extra.stats[key], 'number', `${extra.id}: stats.${key}`);
});

test('serves the Aquatic Update index and single drafts', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dynasty-bot-aquatic-'));
  const server = createApp({ dataDir, processedDir: join(dataDir, '.processed'), herdDir: join(dataDir, '.herd') }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(`${base}/api/aquatic`).then(response => response.json());
    assert.equal(index.count, index.profiles.length);
    assert.equal(index.profiles[0].id, 'kaiwhekea');
    assert.equal(index.profiles[0].draft, undefined, 'index carries summaries only');
    assert.equal(index.habitat.territories.length, 15, 'ten preferred ocean halves and five secondary territories');

    const livy = await fetch(`${base}/api/aquatic/livyatan`).then(response => response.json());
    assert.equal(livy.name, 'Livyatan');
    assert.equal(livy.next.id, index.profiles[(livy.position) % index.count].id);
    assert.ok(livy.draft.toc.some(entry => entry.title === 'Hunting Strategy'));

    assert.equal((await fetch(`${base}/api/aquatic/mosasaurus`)).status, 404);
    assert.equal((await fetch(`${base}/api/aquatic/Not_Valid`)).status, 400);
  } finally {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
