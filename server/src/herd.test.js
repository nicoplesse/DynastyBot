import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { createHerdStore } from './herd.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/YQAAAABJRU5ErkJggg==', 'base64');

test('herd: imports raw screenshots, appends by name, stores genetics and links, serves and removes files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-herd-test-'));
  const processedDir = join(root, 'processed');
  const herdDir = join(root, 'herd');
  await mkdir(processedDir, { recursive: true });
  await writeFile(join(processedDir, 'index.json'), JSON.stringify({ profiles: [{ id: 'tyrannotitan', name: 'Tyrannotitan' }] }));
  const server = createApp({ dataDir: join(root, 'raw'), processedDir, herdDir }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (fields, files = []) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    for (const [field, name] of files) form.append(field, new Blob([png], { type: 'image/png' }), name);
    return fetch(`${base}/api/herd`, { method: 'POST', body: form });
  };
  const patch = (id, body) => fetch(`${base}/api/herd/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const created = await post({ name: 'Malekit', playableId: 'tyrannotitan' }, [['screenshots', 'clipboard.png']]);
    assert.equal(created.status, 201);
    const dino = await created.json();
    assert.equal(dino.id, 'malekit');
    assert.equal(dino.playableId, 'tyrannotitan');
    assert.equal(dino.screenshots.length, 1);
    assert.equal(dino.screenshots[0].processedAt, null);
    assert.deepEqual(await readFile(join(herdDir, 'malekit', dino.screenshots[0].file)), png);

    const appended = await (await post({ name: 'malekit' }, [['screenshots', 'a.png'], ['photo', 'b.png']])).json();
    assert.equal(appended.screenshots.length, 2);
    assert.match(appended.photo, /^photo-.+\.png$/);
    assert.equal((await post({ name: 'Rex', playableId: 'nope' })).status, 400);
    assert.equal((await post({ name: 'Rex', nestingProof: 'not a link' })).status, 400);
    assert.equal((await fetch(`${base}/api/herd/rex`)).status, 404);
    const linked = await (await post({ name: 'Malekit', nestingProof: 'https://discord.com/channels/4/5/6' })).json();
    assert.equal(linked.proofs.nesting, 'https://discord.com/channels/4/5/6');
    assert.equal(linked.screenshots.length, 2);

    const genetics = { bloodlines: ['Ashfang', 'Ashfang', ' '], skins: { dominant: ['Ember'], recessive: ['Albino'] }, mutations: ['Hemomania', { name: 'Featherweight', note: 'from nest' }] };
    const updated = await (await patch('malekit', { genetics, sex: 'female', proofs: { mutation: 'https://discord.com/channels/1/2/3' }, processed: 'pending', transcripts: { [dino.screenshots[0].file]: 'Bloodline: Ashfang' } })).json();
    assert.deepEqual(updated.genetics.bloodlines, ['Ashfang']);
    assert.deepEqual(updated.genetics.mutations, [{ name: 'Hemomania', note: '' }, { name: 'Featherweight', note: 'from nest' }]);
    assert.equal(updated.proofs.mutation, 'https://discord.com/channels/1/2/3');
    assert.equal(updated.proofs.nesting, 'https://discord.com/channels/4/5/6');
    assert.ok(updated.screenshots.every(shot => shot.processedAt));
    assert.equal(updated.screenshots[0].transcript, 'Bloodline: Ashfang');
    assert.equal((await patch('malekit', { proofs: { nesting: 'javascript:alert(1)' } })).status, 400);
    assert.equal((await patch('malekit', { sex: 'other' })).status, 400);
    assert.equal((await (await patch('malekit', { diedAt: '2026-10-30' })).json()).diedAt, '2026-10-30');
    assert.equal((await (await patch('malekit', { deathCause: '  Getötet von zwei Sarcosuchus ' })).json()).deathCause, 'Getötet von zwei Sarcosuchus');
    assert.equal((await (await patch('malekit', { diedAt: '' })).json()).diedAt, '');
    assert.equal((await patch('malekit', { diedAt: '30.10.2026' })).status, 400);

    assert.deepEqual(dino.bonds, []);
    assert.deepEqual(dino.character, { traits: [], text: '' });
    const bonded = await (await patch('malekit', { bonds: [{ name: ' Kamoda Fern ', sex: 'female', kind: 'Bindung', status: 'bondet gerade', bloodline: ' The Endless Depths ', note: 'grüner Skin' }, { name: ' ' }], character: { traits: ['ruhig', 'ruhig', 'wachsam'], text: 'Hält Abstand zu Fremden.' } })).json();
    assert.deepEqual(bonded.bonds, [{ name: 'Kamoda Fern', sex: 'female', kind: 'Bindung', status: 'bondet gerade', bloodline: 'The Endless Depths', note: 'grüner Skin' }]);
    assert.deepEqual(bonded.character, { traits: ['ruhig', 'wachsam'], text: 'Hält Abstand zu Fremden.' });
    assert.deepEqual(bonded.genetics.bloodlines, ['Ashfang']);
    assert.equal((await patch('malekit', { bonds: [{ name: 'X', sex: 'other' }] })).status, 400);
    assert.equal((await patch('malekit', { bonds: 'Kamoda' })).status, 400);
    assert.equal((await patch('malekit', { character: ['ruhig'] })).status, 400);

    assert.equal(bonded.family, undefined);
    const family = await (await patch('malekit', { family: {
      catalogId: ' TY-01 ', mother: 'Nerea', hatchedAt: '2026-10-20',
      siblings: [{ name: 'Barbossa', sex: 'male', note: 'selbes Nest' }, { name: ' ' }],
      offspring: [{ name: 'Brise', sex: 'female', mother: 'Kamoda Fern', clutch: '2', born: '2026-11-02', status: 'lebend' }, { name: 'Gischt' }, { name: ' ' }],
      log: [{ date: '2026-11-02', text: 'Erstes Kalb mit Kamoda.' }, { date: '2026-10-29', text: 'Ins Register aufgenommen.', place: 'Kelp Vale' }],
    } })).json();
    assert.equal(family.family.catalogId, 'TY-01');
    assert.equal(family.family.hatchedAt, '2026-10-20');
    assert.deepEqual(family.family.offspring, [
      { name: 'Brise', sex: 'female', mother: 'Kamoda Fern', clutch: 2, born: '2026-11-02', status: 'lebend', note: '' },
      { name: 'Gischt', sex: null, mother: '', clutch: null, born: '', status: '', note: '' },
    ]);
    assert.deepEqual(family.family.siblings, [{ name: 'Barbossa', sex: 'male', status: '', note: 'selbes Nest' }]);
    assert.deepEqual(family.family.log.map(item => item.date), ['2026-10-29', '2026-11-02']);
    assert.equal(family.family.log[0].place, 'Kelp Vale');
    assert.deepEqual(family.bonds, bonded.bonds);
    assert.equal((await patch('malekit', { family: { log: [{ date: '29.10.2026', text: 'x' }] } })).status, 400);
    assert.equal((await patch('malekit', { family: { offspring: [{ name: 'X', sex: 'calf' }] } })).status, 400);
    assert.equal((await patch('malekit', { family: { siblings: [{ name: 'X', sex: 'calf' }] } })).status, 400);
    assert.equal((await patch('malekit', { family: { hatchedAt: '20.10.2026' } })).status, 400);
    assert.equal((await patch('malekit', { family: { offspring: [{ name: 'X', clutch: 1.5 }] } })).status, 400);
    assert.equal((await patch('malekit', { family: { offspring: [{ name: 'X', clutch: 0 }] } })).status, 400);
    assert.equal((await patch('malekit', { family: [] })).status, 400);

    assert.equal((await fetch(`${base}/api/herd?playable=tyrannotitan`).then(response => response.json())).length, 1);
    assert.equal((await fetch(`${base}/api/herd?playable=spinosaurus`).then(response => response.json())).length, 0);
    const image = await fetch(`${base}/api/herd/malekit/files/${updated.screenshots[1].file}`);
    assert.equal(image.status, 200);
    assert.equal((await fetch(`${base}/api/herd/malekit/files/..%2Fdino.json`)).status, 400);

    const removed = await (await fetch(`${base}/api/herd/malekit/files/${updated.photo}`, { method: 'DELETE' })).json();
    assert.equal(removed.photo, null);
    assert.equal((await fetch(`${base}/api/herd/malekit`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/api/herd/malekit`)).status, 404);
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('herd: a dead dino keeps its folder and a new dino of the same name gets its own', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dynasty-herd-test-'));
  const processedDir = join(root, 'processed');
  const herdDir = join(root, 'herd');
  await mkdir(processedDir, { recursive: true });
  await writeFile(join(processedDir, 'index.json'), JSON.stringify({ profiles: [{ id: 'tyrannotitan', name: 'Tyrannotitan' }] }));
  const store = createHerdStore({ herdDir, processedDir });
  const shot = join(root, 'shot.png');
  await writeFile(shot, png);
  try {
    const first = await store.addFiles({ name: 'Malekith', playable: 'tyrannotitan', screenshots: [{ path: shot, originalname: 'a.png' }] });
    await store.update(first.id, { diedAt: '2026-10-30' });
    const second = await store.addFiles({ name: 'Malekith', playable: 'tyrannotitan' });
    assert.equal(second.id, 'malekith-2');
    assert.equal(second.screenshots.length, 0);
    assert.equal((await store.find('Malekith')).id, 'malekith-2');
    assert.equal((await store.find('malekith')).id, 'malekith-2');
    const appended = await store.addFiles({ name: 'malekith', screenshots: [{ path: shot, originalname: 'b.png' }] });
    assert.equal(appended.id, 'malekith-2');
    assert.equal((await store.find('malekith-2')).screenshots.length, 1);
    const dead = (await store.all()).find(dino => dino.id === 'malekith');
    assert.equal(dead.diedAt, '2026-10-30');
    assert.equal(dead.screenshots.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
