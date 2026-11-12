import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildForumPost, buildGuidePost, changeDegree, classifyNote, forumSequence, loadForumConfig, readiness, sortRawImages } from './forum.js';
import { DISCORD_LIMIT, defaultStagingDir, loadStaging, parseStagingFile } from './staging.js';

const rawDir = fileURLToPath(new URL('../../data/raw/', import.meta.url));

test('sorts staging notes into open points and plain hints', () => {
  assert.equal(classifyNote('Offen: Welche Skins der Mod hat.'), 'decision');
  assert.equal(classifyNote('Widerspruch im Entwurf: … Bitte entscheiden.'), 'decision');
  assert.equal(classifyNote('Im Spiel prüfen: welche Emotes der Kai hat.'), 'ingame');
  assert.equal(classifyNote('Wachstumszeit ist ein Vorschlag (wie Leedsichthys).'), 'proposal');
  assert.equal(classifyNote('Folge für den Archiv-Tab: … mit diesem Vorschlag wegfallen.'), 'info');
  assert.equal(classifyNote('Angepasst an den 06.11.: Kai und Leeds gruppieren nicht mehr.'), 'info');
});

test('tells map, dimorphism strip and title card apart by shape', () => {
  const roles = sortRawImages([
    { file: 'a.png', size: { width: 1355, height: 839 } },
    { file: 'b.png', size: { width: 2457, height: 1066 } },
    { file: 'c.png', size: { width: 2079, height: 1916 } },
  ]);
  assert.deepEqual(roles, { map: 'c.png', dimorphism: 'b.png', titlecard: ['a.png'] });
});

test('measures how far a profile moves from the live text', () => {
  const thread = parseStagingFile('x', '---\nname: X\n---\n# X\nX are large fish that swim in the sea.\nX never hunt other players at all.\n');
  const same = changeDegree(thread, 'X are large fish that swim in the sea.\nX never hunt other players at all.\n');
  assert.equal(same.percent, 0);
  const half = changeDegree(thread, 'X are large fish that swim in the sea.\nX hunt everything in their way today.\n');
  assert.ok(half.percent > 20 && half.percent < 80, `half changed, got ${half.percent}`);
  assert.equal(changeDegree(thread, null).percent, 100, 'a species without a live profile is new');
});

test('readiness loses points for open notes and missing images, unless set by hand', () => {
  const thread = { notes: ['Offen: A', 'Im Spiel prüfen: B', 'Angepasst: C'] };
  const images = [{ role: 'titlecard', status: 'pending', caption: 'T' }, { role: 'map', status: 'ready', caption: 'M' }];
  assert.equal(readiness(thread, images).percent, 100 - 8 - 5 - 10);
  assert.equal(readiness(thread, images, { override: 95 }).percent, 95);
});

test('banners and missing images become lines of the next message', () => {
  const thread = parseStagingFile('x', '---\nname: X\n---\n# X\n%% titlecard\n%% banner Overview\n**Medium Fish**\n');
  const steps = forumSequence(thread, thread.messages.map(message => (message.type === 'titlecard' ? { role: 'titlecard', caption: 'Profile: X', file: null, status: 'pending' } : null)));
  assert.equal(steps.length, 2);
  assert.match(steps[1].text, /^\*🖼 Image pending: Profile: X\*\n# Overview\n\*\*Medium Fish\*\*$/);
});

test('every staging profile exports as forum messages within Discord\'s limit', async () => {
  const config = await loadForumConfig(defaultStagingDir);
  for (const thread of await loadStaging()) {
    const post = await buildForumPost(thread, { stagingDir: defaultStagingDir, rawDir, config });
    assert.ok(post.status.length <= DISCORD_LIMIT, `${post.id}: status message too long`);
    assert.ok(post.title.length <= 100, `${post.id}: forum title too long`);
    assert.ok(post.ready.percent >= 0 && post.ready.percent <= 100);
    for (const step of post.steps) if (step.type === 'text') assert.ok(step.text.length <= DISCORD_LIMIT, `${post.id}: message of ${step.text.length} characters`);
    assert.ok(!post.steps.some(step => step.type === 'text' && /\{\+\}|^%%/m.test(step.text)), `${post.id}: staging markup leaked`);
  }
});

test('the ecosystem guide exports as forum messages and stays out of the profile list', async () => {
  const guide = await buildGuidePost(defaultStagingDir);
  assert.ok(guide, 'staging/guide/ecosystem.md exists');
  assert.ok(guide.steps.length > 3);
  for (const step of guide.steps) assert.ok(step.type === 'text' && step.text.length <= DISCORD_LIMIT, `guide message of ${step.text?.length} characters`);
  assert.ok(guide.steps.some(step => /^# Dictionary/m.test(step.text)));
  assert.ok(!(await loadStaging()).some(thread => thread.id === 'ecosystem-guide'), 'the guide is no staging profile');
});
