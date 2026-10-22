// Bleed table per hunter: how many hits of its strongest bleeding attack bring each prey down,
// hit and run. Status rules are verified (bleed = amount × attacker CW ÷ victim CW, ignores
// armour, stacks, blocks healing, heals off at the victim's bleed heal rate, trotting ×0.75,
// sitting ×2 from the curve multipliers). How much health one point of bleed drains per second
// is NOT documented; the table uses the same opt-in assumption as the fight sim (1 % of max
// health per point per second) and says so.

import { ASSUMED_BLEED_SHARE } from '../../shared/combat-sim.mjs';
import { attacksFromCurves, combatKit } from './combat.js';
import { HUNTABLE } from './foodweb.js';

const STEP = 0.1;
const MAX_HITS = 30;
const MAX_SECONDS = 900;
// Heal multipliers after the last hit: the prey runs (trot) or sits down to heal.
const AFTER = { trot: 0.75, sit: 2 };
const TIER_ORDER = { Tiny: 1, Small: 2, Medium: 3, Large: 4, Apex: 5, Giant: 6 };

// Some kits carry template curves with a placeholder bleed of 5 (DietScavenger, AmphibiousScales);
// no real attack comes close, the strongest real one is Stegosaurus' wind-up tail at 2.
const MAX_REAL_BLEED = 2.5;

export function bleedAttack(profile) {
  const attacks = attacksFromCurves(profile.fullStats?.curves || []).filter(attack => !attack.latched && attack.bleed > 0 && attack.bleed <= MAX_REAL_BLEED);
  if (!attacks.length) return null;
  const best = attacks.reduce((top, attack) => attack.bleed > top.bleed || (attack.bleed === top.bleed && attack.damage > top.damage) ? attack : top);
  return { label: best.label, damage: best.damage, bleed: best.bleed, cooldown: best.cycle };
}

// Seconds until the prey is down after `hits` hits spaced by the cooldown, or null if it survives.
function downAfter(attack, hunter, prey, hits, after) {
  const ratio = hunter.cw / prey.cw;
  const hit = attack.damage * ratio / (prey.armor || 1);
  const stack = attack.bleed * ratio;
  const contact = (hits - 1) * attack.cooldown;
  let hp = prey.hp, bleed = 0, done = 0;
  for (let t = 0; t <= MAX_SECONDS; t += STEP) {
    while (done < hits && t + 1e-9 >= done * attack.cooldown) { hp -= hit; bleed += stack; done++; }
    if (hp <= 0) return t;
    if (done >= hits && bleed <= 0) return null;
    hp -= ASSUMED_BLEED_SHARE * prey.hp * bleed * STEP;
    bleed = Math.max(0, bleed - (prey.bleedHealRate || 0) * (t < contact ? 1 : after) * STEP);
  }
  return null;
}

function hitsNeeded(attack, hunter, prey, after) {
  for (let hits = 1; hits <= MAX_HITS; hits++) {
    const seconds = downAfter(attack, hunter, prey, hits, after);
    if (seconds != null) return { hits, seconds: Math.round(seconds) };
  }
  return null;
}

export function buildBleedTables(profiles, foodWeb) {
  const kits = new Map(profiles.map(profile => [profile.id, combatKit(profile)]));
  const byId = new Map(profiles.map(profile => [profile.id, profile]));
  const tables = {};
  for (const profile of profiles) {
    const web = foodWeb?.hunters?.[profile.id];
    const attack = bleedAttack(profile);
    if (!web || web.none || !attack) continue;
    const hunter = kits.get(profile.id);
    const rows = [];
    for (const edge of web.edges) {
      const verdict = edge.per[0];
      const target = byId.get(edge.t);
      if (!HUNTABLE.has(verdict.k) || !target) continue;
      const prey = kits.get(edge.t);
      if (!prey.hp || !prey.cw) continue;
      const ratio = hunter.cw / prey.cw;
      rows.push({
        id: target.id, name: target.name, tier: target.classification.tier, rank: verdict.k === 'priority' ? verdict.r ?? 1 : null, kind: verdict.k,
        young: (verdict.c || []).some(text => /Jungtier/i.test(text)) && !(verdict.c || []).some(text => /Adult/i.test(text)),
        hp: prey.hp, bleedPerHit: Number((attack.bleed * ratio).toFixed(3)), healRate: prey.bleedHealRate,
        trot: hitsNeeded(attack, hunter, prey, AFTER.trot), sit: hitsNeeded(attack, hunter, prey, AFTER.sit),
        direct: Math.ceil(prey.hp / (attack.damage * ratio / (prey.armor || 1))),
      });
    }
    // Profile ranks first, then the bigger meals (tier down), quickest kill first inside a tier.
    rows.sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0) || (a.trot?.hits ?? 99) - (b.trot?.hits ?? 99) || b.hp - a.hp);
    tables[profile.id] = {
      attack, setup: web.setups[0]?.label || 'Solo', maxHits: MAX_HITS,
      assumption: 'Bleed drains 1 % of max health per point per second (community reading, not documented).',
      rows,
    };
  }
  return tables;
}
