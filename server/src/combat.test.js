import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { combatKit } from './combat.js';
import { combatSide, duelNumbers, evaluateFight, hitOn, presentEntry, resolveCount, simulateFight } from '../../shared/combat-sim.mjs';

const profileDir = fileURLToPath(new URL('../../data/processed/profiles/', import.meta.url));
const load = async id => JSON.parse(await readFile(`${profileDir}${id}.json`, 'utf8'));
const side = (kit, name, role, limits = {}) => combatSide({
  id: name, name, cw: kit.cw, hp: kit.hp, armor: kit.armor, dps: kit.rotation.dps, primary: kit.rotation.primary, burst: kit.rotation.burst,
  bleedPerSecond: kit.rotation.bleedPerSecond, bleedHealRate: kit.bleedHealRate,
  huntLimit: 2, huntUnlimited: false, engagementLimit: 2, engagementUnlimited: false, ...limits,
}, role);

test('hits follow the Path of Titans formula: damage × attacker CW ÷ victim CW ÷ armour', () => {
  assert.equal(hitOn({ cw: 4000 }, { cw: 2000, armor: 1 }, 30), 60, 'wiki example: 4000 CW bites 2000 CW for 30 → 60');
  assert.equal(Number(hitOn({ cw: 3000 }, { cw: 3500, armor: 1 }, 30).toFixed(1)), 25.7, 'wiki example: Alioramus on Albertaceratops');
  assert.equal(hitOn({ cw: 1000 }, { cw: 1000, armor: 2 }, 50), 25, 'armour divides the hit');
});

test('adult kits come from the stat curves with Dynasty overrides and sane rotations', async () => {
  const rex = combatKit(await load('tyrannosaurus'));
  assert.equal(rex.cw, 6000);
  assert.equal(rex.hp, 1000);
  assert.equal(rex.rotation.primary.label, 'Bite');
  assert.equal(rex.rotation.primary.damage, 70, 'Dynasty bite buff is applied');

  const titan = combatKit(await load('tyrannotitan'));
  assert.equal(titan.hp, 900, 'Dynasty health override');
  assert.ok(titan.rotation.bleedPerSecond > 0, 'the serrated bite builds bleed');
  assert.ok(titan.rotation.estimated, 'the unnumbered Dynasty bleed buff is flagged as an estimate');

  const argentino = combatKit(await load('argentinosaurus'));
  assert.equal(argentino.rotation.burst.label, 'Big Stomp');
  assert.ok(argentino.rotation.burst.situational, 'Big Stomp is a situational special');
  assert.ok(!argentino.rotation.attacks.includes('Big Stomp'), 'a 2000-damage special never inflates sustained damage');

  const achillo = combatKit(await load('achillobator'));
  assert.ok(!achillo.rotation.attacks.includes('Shred'), 'latched-only attacks stay out of the standing rotation');

  const pachy = combatKit(await load('pachyrhinosaurus'));
  assert.ok(pachy.rotation.dps <= 60, 'sub-second cooldowns are clamped to the animation floor');
});

test('group sizes are picked per side and clamped to the legal caps', async () => {
  const rexKit = combatKit(await load('tyrannosaurus'));
  const titanKit = combatKit(await load('tyrannotitan'));
  const rex = side(rexKit, 'Tyrannosaurus', 'attacker');
  const titan = side(titanKit, 'Tyrannotitan', 'defender');
  assert.equal(resolveCount('max', rex), 2);
  assert.equal(resolveCount(5, rex), 2, 'no pick exceeds the legal cap');
  assert.equal(resolveCount('max', { limit: 1, unlimited: true }), null, 'unlimited is never turned into a number');
  assert.equal(resolveCount(4, { limit: 1, unlimited: true }), 4);

  const duel = duelNumbers(rex, titan);
  assert.equal(duel.attackerHit, Math.round(70 * 6000 / 5500 / 1.1));
  assert.equal(duel.attackerHitsToKill, Math.ceil(900 / (70 * 6000 / 5500 / 1.1)));

  const solo = evaluateFight(rex, titan, 1, 1);
  const pair = evaluateFight(rex, titan, 2, 1);
  assert.equal(solo.attackers, 1);
  assert.ok(pair.sim.seconds < solo.sim.seconds, 'a second attacker ends the fight sooner');
  const outnumbered = evaluateFight(rex, titan, 1, 2);
  assert.ok(outnumbered.sim.attackerHpShare <= solo.sim.attackerHpShare, 'a second defender never makes it easier');
});

test('bleed stays out of the maths unless the assumed model is switched on', async () => {
  const titan = side(combatKit(await load('tyrannotitan')), 'Tyrannotitan', 'attacker');
  const rex = side(combatKit(await load('tyrannosaurus')), 'Tyrannosaurus', 'defender');
  const plain = simulateFight(titan, 1, rex, 1);
  const bleeding = simulateFight(titan, 1, rex, 1, { bleed: 'assumed' });
  assert.ok(bleeding.attackerHpShare >= plain.attackerHpShare, 'bleed only ever helps the bleeding side');
  assert.equal(evaluateFight(titan, rex, 1, 1).bleed, 'off');
});

test('cards re-rank from the fight-independent core', () => {
  const core = { direction: 'threat', attackerName: 'A', targetName: 'B', chaseVerdict: 'attacker-faster', chaseLabel: 'x', baseScore: 60, scoreCap: null, conditional: false, explicit: false, relationKind: null, summaryLead: 'y' };
  assert.equal(presentEntry(core, { verdict: 'attacker-advantage', label: 'z' }).band, 'severe');
  assert.equal(presentEntry(core, { verdict: 'defender-advantage', label: 'z' }).visible, true);
  assert.equal(presentEntry({ ...core, baseScore: 50 }, { verdict: 'defender-advantage', label: 'z' }).visible, false, 'a lost fight can drop a derived threat');
  assert.equal(presentEntry({ ...core, scoreCap: 44 }, { verdict: 'attacker-advantage', label: 'z' }).score, 44, 'sparse contact caps the score');
});
