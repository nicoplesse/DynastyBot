import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/YQAAAABJRU5ErkJggg==', 'base64');

test('saves exact raw text and image bytes, loads, replaces only after confirmation, and deletes', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dynasty-bot-test-'));
  const processedDir = join(dataDir, '.processed-test');
  const server = createApp({ dataDir, processedDir }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const raw = '  Header\r\n\tÄlterer Text  \n' + 'Detailed Dynasty content.\n'.repeat(10000) + '\nDynasty Adjusted Stats\nGrowth Time (minutes):\nServer 1, 2 and 3: 10-20-30-30 = 90 total\nCombat Weight: 1950\nAdjusted Stats: Thirst adjusted from 0.04 to 0.01\nEnd  ';
  const request = (text, { replace = false, retained = [], image = true } = {}) => {
    const form = new FormData();
    form.append('name', 'Leedsichthys');
    form.append('profile', new Blob([text], { type: 'text/plain;charset=utf-8' }), 'profile.txt');
    form.append('replace', String(replace));
    form.append('sourceId', retained.length ? 'leedsichthys' : '');
    form.append('retainedImages', JSON.stringify(retained));
    form.append('imageMetadata', JSON.stringify(image ? [{ label: 'Preferred POIs' }] : []));
    if (image) form.append('images', new Blob([png], { type: 'image/png' }), 'image.png');
    return fetch(`${base}/api/profiles`, { method: 'POST', body: form });
  };
  try {
    const first = await request(raw);
    assert.equal(first.status, 201);
    const manifest = await first.json();
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.images[0].file, 'images/preferred-pois.png');
    assert.equal(manifest.images[0].originalFileName, 'image.png');
    assert.equal(await readFile(join(dataDir, 'leedsichthys', 'profile.txt'), 'utf8'), raw);
    assert.deepEqual(await readFile(join(dataDir, 'leedsichthys', manifest.images[0].file)), png);
    assert.deepEqual(await readFile(join(dataDir, 'leedsichthys', 'manifest.json'), 'utf8').then(JSON.parse), manifest);

    const list = await fetch(`${base}/api/profiles`).then(response => response.json());
    assert.equal(list.length, 1);
    assert.equal(list[0].imageCount, 1);
    const catalog = await fetch(`${base}/api/catalog`).then(response => response.json());
    assert.equal(catalog.count, 1);
    assert.equal(catalog.profiles[0].name, 'Leedsichthys');
    const processed = await fetch(`${base}/api/catalog/leedsichthys`).then(response => response.json());
    assert.equal(processed.source.profileFile, 'data/raw/leedsichthys/profile.txt');
    assert.equal(processed.name, 'Leedsichthys');
    assert.equal(processed.stats.growthMinutes, 90);
    assert.equal(processed.stats.combatWeight, 1950);
    assert.equal(processed.stats.changes[0].previous, '0.04');
    assert.equal(processed.stats.changes[0].current, '0.01');
    const loaded = await fetch(`${base}/api/profiles/leedsichthys`).then(response => response.json());
    assert.equal(loaded.profile, raw);
    assert.equal((await fetch(`${base}/api/profiles/leedsichthys/images/preferred-pois.png`).then(response => response.arrayBuffer())).byteLength, png.length);

    const duplicate = await request('Accidental replacement');
    assert.equal(duplicate.status, 409);
    assert.equal(await readFile(join(dataDir, 'leedsichthys', 'profile.txt'), 'utf8'), raw);

    const updatedText = raw + '\nNew line';
    const updated = await request(updatedText, { replace: true, retained: [{ file: manifest.images[0].file, label: 'Updated POIs' }], image: true });
    assert.equal(updated.status, 200);
    const updatedManifest = await updated.json();
    assert.equal(updatedManifest.images[0].label, 'Updated POIs');
    assert.equal(updatedManifest.images.length, 2);
    assert.equal(updatedManifest.images[1].file, 'images/preferred-pois-2.png');
    assert.equal(await readFile(join(dataDir, 'leedsichthys', 'profile.txt'), 'utf8'), updatedText);
    assert.deepEqual(await readFile(join(dataDir, 'leedsichthys', manifest.images[0].file)), png);
    assert.deepEqual(await readFile(join(dataDir, 'leedsichthys', updatedManifest.images[1].file)), png);

    const removedImage = await request(updatedText, { replace: true, image: false });
    assert.equal(removedImage.status, 200);
    assert.deepEqual((await removedImage.json()).images, []);
    assert.deepEqual(await readdir(join(dataDir, 'leedsichthys', 'images')), []);

    const deleted = await fetch(`${base}/api/profiles/leedsichthys`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.deepEqual(await fetch(`${base}/api/profiles`).then(response => response.json()), []);
  } finally {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
