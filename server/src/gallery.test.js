import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { createHerdStore } from './herd.js';
import { isGalleryName } from './gallery.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/YQAAAABJRU5ErkJggg==', 'base64');

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-gallery-test-'));
  const processedDir = join(root, 'processed');
  await mkdir(processedDir, { recursive: true });
  await writeFile(join(processedDir, 'index.json'), JSON.stringify({ profiles: [{ id: 'tylosaurus', name: 'Tylosaurus' }, { id: 'spinosaurus-freshwater', name: 'Spinosaurus' }] }));
  return { root, processedDir, herdDir: join(root, 'herd'), galleryDir: join(root, 'gallery') };
}

test('gallery: names that could leave the folder are refused, hand-saved names are fine', () => {
  assert.ok(isGalleryName('Path of Titans 2026.11.19 - 14.23.PNG'));
  assert.ok(isGalleryName('Allers Jagd (1).webp'));
  for (const bad of ['../dino.json', 'a/b.png', 'a\\b.png', '.hidden.png', 'gallery.json', 'bild.gif', ' x.png', '']) assert.equal(isGalleryName(bad), false, bad);
});

test('gallery: uploads and hand-saved files are listed, classified, used as dino photo and deleted', async () => {
  const { root, processedDir, herdDir, galleryDir } = await setup();
  const server = createApp({ dataDir: join(root, 'raw'), processedDir, herdDir }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const patch = (path, body) => fetch(`${base}${path}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const list = async () => (await (await fetch(`${base}/api/gallery`)).json()).images;
  try {
    const store = createHerdStore({ herdDir, processedDir });
    await store.addFiles({ name: 'Aller', playable: 'tylosaurus' });

    const form = new FormData();
    form.append('images', new Blob([png], { type: 'image/png' }), 'Allers Jagd.png');
    form.append('images', new Blob([png], { type: 'image/png' }), 'Allers Jagd.png');
    const added = await (await fetch(`${base}/api/gallery`, { method: 'POST', body: form })).json();
    assert.deepEqual(added.map(image => image.file), ['allers-jagd.png', 'allers-jagd-2.png']);
    assert.ok(added.every(image => !image.classified && image.originalFileName === 'Allers Jagd.png'));
    assert.equal((await fetch(`${base}/api/gallery`, { method: 'POST', body: new FormData() })).status, 400);

    // Saved into the folder by hand: shows up unclassified under its own name.
    await writeFile(join(galleryDir, 'Mein Screenshot (1).PNG'), png);
    await writeFile(join(galleryDir, 'notes.txt'), 'not an image');
    let images = await list();
    assert.equal(images.length, 3);
    const manual = images.find(image => image.file === 'Mein Screenshot (1).PNG');
    assert.equal(manual.classified, false);
    assert.equal((await fetch(`${base}/api/gallery/files/${encodeURIComponent(manual.file)}`)).status, 200);
    assert.equal((await fetch(`${base}/api/gallery/files/..%2Fherd%2Faller%2Fdino.json`)).status, 400);
    assert.equal((await fetch(`${base}/api/gallery/files/missing.png`)).status, 404);

    assert.equal((await patch('/api/gallery/allers-jagd.png', { dinos: ['nobody'] })).status, 400);
    assert.equal((await patch('/api/gallery/allers-jagd.png', { species: ['rex'] })).status, 400);
    assert.equal((await patch('/api/gallery/allers-jagd.png', { background: 'yes' })).status, 400);
    assert.equal((await patch('/api/gallery/missing.png', { background: true })).status, 404);
    const classified = await (await patch('/api/gallery/allers-jagd.png', { dinos: ['aller', 'aller'], species: ['tylosaurus', 'spinosaurus-freshwater'], caption: '  Allers Jagd auf den Spino ' })).json();
    assert.deepEqual(classified.dinos, ['aller']);
    assert.deepEqual(classified.species, ['tylosaurus', 'spinosaurus-freshwater']);
    assert.equal(classified.caption, 'Allers Jagd auf den Spino');
    assert.equal(classified.classified, true);
    const scenery = await (await patch(`/api/gallery/${encodeURIComponent(manual.file)}`, { background: true })).json();
    assert.equal(scenery.classified, true);
    const index = JSON.parse(await readFile(join(galleryDir, 'gallery.json'), 'utf8'));
    assert.equal(index.images['Mein Screenshot (1).PNG'].background, true);

    // Picking a gallery image as the dino's photo tags it with the dino and its species.
    assert.equal((await patch('/api/herd/aller', { photo: 'gallery/missing.png' })).status, 400);
    assert.equal((await patch('/api/herd/aller', { photo: 'photo-1.png' })).status, 400);
    const withPhoto = await (await patch('/api/herd/aller', { photo: 'gallery/allers-jagd-2.png' })).json();
    assert.equal(withPhoto.photo, 'gallery/allers-jagd-2.png');
    images = await list();
    const face = images.find(image => image.file === 'allers-jagd-2.png');
    assert.deepEqual(face.dinos, ['aller']);
    assert.deepEqual(face.species, ['tylosaurus']);
    assert.deepEqual(face.uses, [{ dinoId: 'aller', dinoName: 'Aller', kind: 'photo' }]);
    assert.equal((await fetch(`${base}/api/herd/aller/files/gallery/allers-jagd-2.png`)).status, 200);

    // Deleting it lets go of the dino first; the file is gone, the rest stays.
    const deleted = await (await fetch(`${base}/api/gallery/allers-jagd-2.png`, { method: 'DELETE' })).json();
    assert.deepEqual(deleted.unlinked, [{ dinoId: 'aller', dinoName: 'Aller', kind: 'photo' }]);
    assert.equal((await (await fetch(`${base}/api/herd/aller`)).json()).photo, null);
    assert.deepEqual((await readdir(galleryDir)).filter(name => name !== 'notes.txt').sort(), ['Mein Screenshot (1).PNG', 'allers-jagd.png', 'gallery.json']);
    assert.equal((await fetch(`${base}/api/gallery/allers-jagd-2.png`, { method: 'DELETE' })).status, 404);
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('gallery: older per-dino photos move into the gallery once, tagged with the dino', async () => {
  const { root, processedDir, herdDir, galleryDir } = await setup();
  try {
    const store = createHerdStore({ herdDir, processedDir });
    const dino = await store.addFiles({ name: 'Aller', playable: 'tylosaurus' });
    const folder = join(herdDir, dino.id);
    await mkdir(join(folder, 'events'), { recursive: true });
    await writeFile(join(folder, 'photo-20261115-234950.png'), png);
    await writeFile(join(folder, 'events', '20261115-235649.png'), png);
    const record = JSON.parse(await readFile(join(folder, 'dino.json'), 'utf8'));
    record.photo = 'photo-20261115-234950.png';
    record.family = { events: [{ date: '2026-11-16', kind: 'apex', subject: 'Deinosuchus', outcome: 'getötet', photo: 'events/20261115-235649.png' }], log: [], offspring: [] };
    await writeFile(join(folder, 'dino.json'), JSON.stringify(record));

    const moved = await store.moveImagesToGallery();
    assert.deepEqual(moved.map(item => item.to), ['aller-photo-20261115-234950.png', 'aller-deinosuchus-20261115-235649.png']);
    const after = await store.read('aller');
    assert.equal(after.photo, 'gallery/aller-photo-20261115-234950.png');
    assert.equal(after.family.events[0].photo, 'gallery/aller-deinosuchus-20261115-235649.png');
    assert.equal(after.updatedAt, record.updatedAt); // a move is no edit of the dino
    assert.deepEqual((await readdir(folder)).sort(), ['dino.json', 'screenshots']); // the empty events/ folder is gone

    const images = await store.gallery.list();
    const kill = images.find(image => image.file === 'aller-deinosuchus-20261115-235649.png');
    assert.equal(kill.caption, 'Aller: Deinosuchus getötet');
    assert.equal(kill.addedAt, '2026-11-15T23:56:49.000Z');
    assert.deepEqual(kill.dinos, ['aller']);
    assert.deepEqual(kill.species, ['tylosaurus']);
    assert.deepEqual(await readFile(join(galleryDir, 'aller-photo-20261115-234950.png')), png);
    assert.deepEqual(await store.moveImagesToGallery(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
