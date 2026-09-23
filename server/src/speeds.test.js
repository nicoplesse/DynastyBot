import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const speedFile = fileURLToPath(new URL('../../data/reference/speeds.json', import.meta.url));
const rawDir = fileURLToPath(new URL('../../data/raw/', import.meta.url));

const aquaticOrSemiAquatic = new Set([
  'austroraptor', 'concavenator', 'deinocheirus', 'deinosuchus', 'eurhinosaurus', 'halszkaraptor',
  'kaiwhekea', 'leedsichthys', 'lurdusaurus', 'megalania', 'sarcosuchus', 'spinosaurus', 'suchomimus', 'tylosaurus',
]);
const aerial = new Set(['hatzegopteryx', 'quetzalcoatlus', 'rhamphorhynchus', 'thalassodromeus', 'tropeognathus']);

test('every playable has sourced adult speed and sprint-duration data', async () => {
  const document = JSON.parse(await readFile(speedFile, 'utf8'));
  const profileIds = (await readdir(rawDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name !== 'server-rules')
    .map(entry => entry.name).sort();
  const speedIds = Object.keys(document.profiles).sort();

  assert.deepEqual(speedIds, profileIds, 'speed coverage must exactly match the playable catalog');
  assert.equal(speedIds.length, 61);
  assert.equal(document.unit, 'game-units-per-second');

  for (const [id, profile] of Object.entries(document.profiles)) {
    assert.ok(profile.land?.trot > 0, `${id}: land trot`);
    assert.ok(profile.land?.sprint > 0, `${id}: land sprint`);
    assert.ok(profile.land?.sprintDurationSeconds > 0, `${id}: land sprint duration`);
    assert.ok(profile.sourceRefs?.length, `${id}: source reference`);
    for (const sourceRef of profile.sourceRefs) assert.ok(document.sources[sourceRef], `${id}: known source ${sourceRef}`);

    assert.equal(Boolean(profile.water), aquaticOrSemiAquatic.has(id), `${id}: water data only for aquatic/semi-aquatic profiles`);
    if (profile.water) {
      assert.ok(profile.water.cruise > 0, `${id}: water cruise`);
      assert.ok(profile.water.sprint > 0, `${id}: water sprint`);
      assert.ok(profile.water.sprintDurationSeconds > 0, `${id}: water sprint duration`);
    }

    assert.equal(Boolean(profile.air), aerial.has(id), `${id}: air data only for aerial profiles`);
    if (profile.air) {
      assert.ok(profile.air.cruise > 0, `${id}: air cruise`);
      assert.ok(profile.air.sprint > 0, `${id}: air sprint`);
      assert.ok(profile.air.sprintDurationSeconds > 0, `${id}: air sprint duration`);
    }
  }
});
