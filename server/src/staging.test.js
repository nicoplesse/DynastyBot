import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { DISCORD_LIMIT, checkRaster, defaultStagingDir, loadStaging, parseFrontMatter, parseStagingFile, parseThread, splitMessage } from './staging.js';

test('reads the front matter of a staging file', () => {
  const { meta, body } = parseFrontMatter('---\nname: Kaiwhekea\norder: 1\n---\n# Kaiwhekea\n');
  assert.deepEqual(meta, { name: 'Kaiwhekea', order: '1' });
  assert.equal(body, '# Kaiwhekea\n');
});

test('turns directives into banners, images, notes and message groups', () => {
  const thread = parseThread([
    '# Kai',
    '%% titlecard',
    '%% post',
    '%% banner Overview',
    '**Medium Diurnal Aquatic Piscivore**',
    'A line. {+}',
    '## Genetics',
    'Albino',
    '%% note Offen: Gruß',
    '%% banner Growing Up',
    '### ✦ Offspring Behavior (Nested)',
    'Calves.',
    '%% quicklinks',
  ].join('\n'));
  assert.deepEqual(thread.messages.map(message => message.type), ['text', 'titlecard', 'banner', 'text', 'note', 'banner', 'text', 'quicklinks']);
  assert.equal(thread.messages[0].header, true);
  assert.equal(thread.messages[1].header, false);
  assert.equal(thread.messages[2].header, true, '%% post starts a new author group');
  assert.equal(thread.messages[3].changed, true);
  assert.equal(thread.messages[3].copy.includes('{+}'), false, 'change markers never reach the Discord text');
  assert.deepEqual(thread.notes, ['Offen: Gruß']);
  assert.deepEqual(thread.links.map(link => link.title), ['Growing Up']);
  assert.deepEqual(thread.outline.map(entry => entry.title), ['Overview', 'Genetics', 'Growing Up', 'Offspring Behavior (Nested)']);
  assert.throws(() => parseThread('%% unknown thing'), /unknown directive/);
});

test('cuts long text into Discord messages, preferring a break before a heading', () => {
  const filler = 'x'.repeat(90);
  const lines = [...Array.from({ length: 15 }, () => filler), '### ✦ Next', ...Array.from({ length: 15 }, () => filler)];
  const parts = splitMessage(lines, 1500);
  assert.equal(parts.length, 2);
  assert.equal(parts[1][0], '### ✦ Next');
  assert.ok(parts.every(part => part.join('\n').length <= 1500));
});

test('checks a thread against the grid of the original profiles', () => {
  const thread = parseThread(['%% banner Overview', '## Genetics', '%% banner Elderly', '%% banner Growing Up'].join('\n'));
  const raster = checkRaster(thread);
  assert.equal(raster.inOrder, false, 'Growing Up must come before Elderly');
  assert.ok(raster.missing.includes('Nesting Limits'));
  assert.ok(!raster.missing.includes('Genetics'));
});

test('every staging profile fits the grid and Discord\'s message limit', async () => {
  const threads = await loadStaging(defaultStagingDir);
  assert.ok(threads.length >= 9);
  for (const thread of threads) {
    assert.equal(thread.overLimit, 0, `${thread.id} has a message over ${DISCORD_LIMIT} characters`);
    assert.equal(thread.raster.inOrder, true, `${thread.id}: banners out of order`);
    assert.ok(thread.classification, `${thread.id}: no classification under the Overview banner`);
    // Death is missing from the live Spinosaurus and Tropeognathus profiles as well.
    assert.deepEqual(thread.raster.missing.filter(label => label !== 'Death'), [], `${thread.id} misses ${thread.raster.missing}`);
  }
});

test('serves the staging threads over the API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'staging-'));
  try {
    await writeFile(join(dir, 'kai.md'), '---\nname: Kai\norder: 1\n---\n# Kai\n%% banner Overview\n**Medium Diurnal Aquatic Piscivore**\n');
    await writeFile(join(dir, 'README.md'), '# not a thread');
    const app = createApp({ stagingDir: dir });
    const server = app.listen(0);
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const index = await (await fetch(`${base}/api/staging`)).json();
      assert.equal(index.count, 1);
      assert.equal(index.threads[0].classification, 'Medium Diurnal Aquatic Piscivore');
      assert.equal(index.threads[0].messages, undefined, 'the index carries no message bodies');
      const thread = await (await fetch(`${base}/api/staging/kai`)).json();
      assert.equal(thread.messages[1].type, 'banner');
      assert.equal((await fetch(`${base}/api/staging/nope`)).status, 404);
    } finally { server.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('parses a whole staging file with its card facts', () => {
  const thread = parseStagingFile('kai', '---\nname: Kaiwhekea\ntitle: KAIWHEKEA\nkind: new\ndifficulty: 3 Moderate\ncover: kaiwhekea/images/image.png\n---\n# Kaiwhekea\n');
  assert.equal(thread.title, 'KAIWHEKEA');
  assert.equal(thread.difficulty, 3);
  assert.equal(thread.difficultyLabel, 'Moderate');
  assert.equal(thread.kind, 'new');
});

test('an image directive may point to a finished image in the staging folder', () => {
  const thread = parseThread('# Kai\n%% image [maps/kaiwhekea.png] Preferred POIs map\n%% image Dimorphism Examples\n');
  const images = thread.messages.filter(message => message.type === 'image');
  assert.deepEqual(images.map(({ caption, src }) => ({ caption, src })), [
    { caption: 'Preferred POIs map', src: 'maps/kaiwhekea.png' },
    { caption: 'Dimorphism Examples', src: undefined },
  ]);
});
