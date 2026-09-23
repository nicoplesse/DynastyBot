import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildMatchups } from './matchups.js';

const profileDir = fileURLToPath(new URL('../../data/processed/profiles/', import.meta.url));

async function loadProfiles() {
  const files = (await readdir(profileDir)).filter(file => file.endsWith('.json'));
  return Promise.all(files.map(file => readFile(join(profileDir, file), 'utf8').then(JSON.parse)));
}

test('organic matchup map covers every profile with inspectable evidence and bounded lists', async () => {
  const profiles = await loadProfiles();
  const map = buildMatchups(profiles);
  const ids = new Set(profiles.map(profile => profile.id));

  assert.equal(profiles.length, 61);
  assert.deepEqual(Object.keys(map).sort(), [...ids].sort());

  for (const profile of profiles) {
    const dossier = map[profile.id];
    assert.equal(dossier.schemaVersion, 2, `${profile.id}: schema`);
    assert.ok(dossier.summary.length > 60, `${profile.id}: organic summary`);
    assert.ok(dossier.threats.length <= 8, `${profile.id}: concise threats`);
    assert.ok(dossier.opportunities.length <= 8, `${profile.id}: concise opportunities`);
    assert.ok(dossier.traits.sprintSpeed > 0, `${profile.id}: speed is part of the dossier`);
    assert.ok(dossier.traits.sprintDurationSeconds > 0, `${profile.id}: stamina window is part of the dossier`);

    for (const entry of [...dossier.threats, ...dossier.opportunities]) {
      assert.ok(ids.has(entry.id), `${profile.id}: known counterpart ${entry.id}`);
      assert.notEqual(entry.id, profile.id, `${profile.id}: pairwise entries do not fake a self matchup`);
      assert.ok(entry.headline && entry.summary, `${profile.id}/${entry.id}: narrative`);
      assert.ok(entry.facts.length >= 4, `${profile.id}/${entry.id}: intent, chase, groups and contact`);
      assert.ok(Number.isFinite(entry.chase.attackerSpeed), `${profile.id}/${entry.id}: chase speed`);
      assert.ok(entry.fight.attackerGroupLimit >= 1, `${profile.id}/${entry.id}: legal attacker group`);
      assert.ok(entry.fight.targetDefenderLimit >= 1, `${profile.id}/${entry.id}: legal defender group`);
      assert.ok(['frequent', 'possible', 'rare'].includes(entry.encounter.level), `${profile.id}/${entry.id}: encounter relevance`);
      if (entry.intent.explicit) assert.ok(entry.evidence.length > 0, `${profile.id}/${entry.id}: profile-specific claim retains its source text`);
      if (entry.encounter.level === 'rare') assert.equal(entry.band, 'conditional', `${profile.id}/${entry.id}: sparse contact cannot be an automatic counter`);
    }
  }
});

test('known edge cases follow profile intent, speed, stamina, habitat and group limits', async () => {
  const profiles = await loadProfiles();
  const map = buildMatchups(profiles);
  const has = (id, side, other) => map[id][side].find(entry => entry.id === other);

  assert.equal(map.deinonychus.traits.huntGroupSize, 8, 'Deinonychus uses its legal group cap, not an arbitrary swarm');
  assert.equal(map.compsognathus.traits.huntGroupSize, 10);
  assert.equal(map.tyrannosaurus.traits.huntGroupSize, 2);
  assert.equal(has('deinonychus', 'threats', 'tyrannosaurus'), undefined, 'Rex cannot force a chase against Deinonychus');

  const kelenken = has('deinonychus', 'threats', 'kelenken');
  assert.ok(kelenken?.intent.explicit, 'Kelenken specifically prioritises Deinonychus');
  assert.equal(kelenken.chase.verdict, 'target-can-disengage', 'the narrow speed/endurance escape remains visible');

  for (const prey of ['iguanodon', 'parasaurolophus', 'pachyrhinosaurus', 'eotriceratops']) {
    assert.ok(has('achillobator', 'opportunities', prey)?.intent.explicit, `Achillobator preferred prey: ${prey}`);
  }
  assert.equal(has('achillobator', 'opportunities', 'latenivenatrix'), undefined, 'a hunting companion is not prey');
  assert.ok(has('achillobator', 'threats', 'kelenken')?.intent.explicit, 'Achillobator sees its named Kelenken danger');

  assert.ok(has('tyrannosaurus', 'opportunities', 'eotriceratops'), 'Eotriceratops is legal but risky Rex quarry');
  assert.equal(has('tyrannosaurus', 'opportunities', 'eotriceratops').fight.verdict, 'close');
  assert.ok(map.tyrannosaurus.specialRisks.some(risk => /Albino/i.test(risk.summary)), 'Albino Rex cannibalism exception is preserved');
  const rexRival = has('tyrannosaurus', 'threats', 'tyrannotitan') || has('tyrannosaurus', 'threats', 'giganotosaurus');
  assert.equal(rexRival?.band, 'conditional', 'rare Apex rival contact is not presented as a routine loss');

  for (const prey of ['kaiwhekea', 'eurhinosaurus', 'leedsichthys', 'parasaurolophus', 'lambeosaurus']) {
    assert.ok(has('tylosaurus', 'opportunities', prey)?.intent.explicit, `Tylosaurus priority prey: ${prey}`);
  }
  assert.equal(has('tylosaurus', 'opportunities', 'kaiwhekea').chase.mode, 'water');
  assert.ok(has('spinosaurus', 'opportunities', 'deinosuchus')?.intent.explicit);
  assert.ok(has('spinosaurus', 'opportunities', 'sarcosuchus')?.intent.explicit);
  assert.ok(has('deinosuchus', 'opportunities', 'sarcosuchus')?.intent.explicit);
  assert.equal(has('torvosaurus', 'opportunities', 'thalassodromeus'), undefined, 'a tolerated ally is not prey');
});
