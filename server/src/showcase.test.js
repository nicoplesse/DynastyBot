import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { animalId } from './analogs.js';

const projectData = fileURLToPath(new URL('../../data/', import.meta.url));
const rawDir = join(projectData, 'raw');
const photos = JSON.parse(await readFile(join(projectData, 'reference', 'animal-photos.json'), 'utf8')).animals;
const covers = JSON.parse(await readFile(join(projectData, 'reference', 'ingame-covers.json'), 'utf8')).profiles;

async function playableIds() {
  const ids = [];
  for (const entry of await readdir(rawDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'server-rules') continue;
    if (await access(join(rawDir, entry.name, 'manifest.json')).then(() => true, () => false)) ids.push(entry.name);
  }
  return ids;
}

test('every analog animal has a credited Wikimedia photo', async () => {
  for (const id of await playableIds()) {
    const doc = JSON.parse(await readFile(join(rawDir, id, 'analog.json'), 'utf8'));
    for (const analog of doc.analogs) {
      const photo = photos[animalId(analog.animal)];
      assert.ok(photo?.image?.startsWith('https://') && /wikimedia\.org\//.test(photo.image), `${id}: no photo for ${analog.animal}`);
      assert.ok(photo.artist && photo.license && photo.page, `${id}: ${analog.animal} photo lacks credit`);
      assert.ok(!photo.image.includes('?'), `${id}: ${analog.animal} photo URL carries tracking parameters`);
    }
  }
});

test('every playable has a reviewed in-game cover that exists in its upload', async () => {
  for (const id of await playableIds()) {
    const cover = covers[id];
    assert.ok(cover, `${id} has no reviewed in-game cover`);
    const manifest = JSON.parse(await readFile(join(rawDir, id, 'manifest.json'), 'utf8'));
    if (cover.kind === 'missing') assert.equal(cover.file, null, `${id}: missing cover must not name a file`);
    else assert.ok(manifest.images.some(image => image.file === cover.file), `${id}: ${cover.file} is not one of its uploads`);
  }
});

test('processed profiles lead with the in-game cover and the highest-share animal', async () => {
  const processed = join(projectData, 'processed', 'profiles');
  for (const id of await playableIds()) {
    const profile = JSON.parse(await readFile(join(processed, `${id}.json`), 'utf8'));
    const cover = covers[id];
    assert.equal(profile.ingame.file, cover.file, `${id}: in-game cover`);
    if (cover.file) assert.deepEqual([profile.media[0].file, profile.media[0].role], [cover.file, 'cover'], `${id}: cover first`);
    const shares = profile.analog.analogs.map(analog => analog.share);
    assert.deepEqual(shares, [...shares].sort((a, b) => b - a), `${id}: animals ordered by share`);
    assert.ok(profile.analog.analogs.every(analog => analog.photo?.image), `${id}: every animal has a photo`);
  }
});
