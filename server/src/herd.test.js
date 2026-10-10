import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

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
