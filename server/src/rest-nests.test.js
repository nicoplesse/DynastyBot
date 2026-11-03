import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRestNests } from './rest-nests.js';

// Control examples straight from the profiles (run npm run process after changing rest-nests.json).
const processed = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const index = JSON.parse(await readFile(join(processed, 'rest-nests.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(processed, 'index.json'), 'utf8'));
const row = id => index.playables.find(item => item.id === id);

test('every playable is rated and every quote cites its profile section', () => {
  assert.deepEqual(index.playables.map(item => item.id).sort(), catalog.profiles.map(item => item.id).sort());
  const verdicts = new Set(index.verdicts.map(verdict => verdict.id));
  for (const item of index.playables) {
    assert.ok(verdicts.has(item.verdict), `${item.id} has a known verdict`);
    assert.ok(item.hint && item.life && item.where, `${item.id} has German notes`);
    for (const quote of item.quotes) assert.ok(quote.section, `${item.id}: quote without section`);
  }
  assert.equal(index.verdicts.reduce((sum, verdict) => sum + verdict.count, 0), index.playables.length);
});

test('rule 9.8 allows resting nests and profiles override it', () => {
  const rule = number => index.rules.find(item => item.number === number);
  assert.match(rule('9.8').text, /vanilla nests/);
  assert.match(rule('1.1').text, /Profiles always override server rules/);
  assert.match(rule('6.8.1.1').text, /live offspring/);
});

test('control verdicts from the profiles', () => {
  assert.equal(row('latenivenatrix').verdict, 'profile', 'solitary Latenivenatrix still place a nest to rest in');
  assert.equal(row('latenivenatrix').quotes[0].section, 'Solitary Behavior');
  assert.equal(row('dilophosaurus').verdict, 'profile', 'vixens rest on decorative nests');
  assert.equal(row('pycnonemosaurus').verdict, 'against', 'they do not often build nests at resting locations');
  assert.equal(row('deinocheirus').verdict, 'check');
  assert.equal(row('megalania-arid').verdict, row('megalania-temperate').verdict, 'variants share the family entry');
});

test('a quote that is not in the profile fails the build', () => {
  const profile = { id: 'demo', name: 'Demo', quickView: ['Demo are nomadic.'], sections: [] };
  const doc = { verdicts: [{ id: 'brief' }], rules: [], playables: { demo: { verdict: 'brief', quotes: ['Demo sleep in nests.'] } } };
  assert.throws(() => buildRestNests([profile], doc, null), /not in the demo profile/);
  assert.equal(buildRestNests([profile], { ...doc, playables: { demo: { verdict: 'brief', quotes: ['Demo  are nomadic.'] } } }, null).playables[0].quotes[0].section, 'Quick View');
  assert.throws(() => buildRestNests([profile], { ...doc, rules: [{ number: '99.9' }] }, { sections: [] }), /rule 99.9 does not exist/);
});
