// Pairwise fight maths shared by the processor (default verdicts) and the browser
// (any group size the reader picks). Kept dependency-free on purpose.
//
// Verified Path of Titans rules (pathoftitans.wiki: Dinosaur Stats, Status Effects):
//   hit     = damage × (attacker CW / victim CW) ÷ victim armour
//   status  = amount × (attacker CW / victim CW)        – bleed/venom ignore armour, stack without cap
// Bleed's health-per-second conversion is not documented. By default bleed is reported as
// build-up against the victim's heal rate only; the opt-in "assumed" model reads one point of
// bleed as 1% of max health per second (community reading, not an official number).

export const FIGHT_POINTS = { 'attacker-advantage': 18, close: 8, 'defender-advantage': -17 };
export const HIDE_BELOW_SCORE = 43;
export const MAX_PICKABLE_GROUP = 10;
const STEP_SECONDS = 0.25;
const MAX_SECONDS = 600;
const DECISIVE_HP_SHARE = 0.35;
export const ASSUMED_BLEED_SHARE = 0.01;

// A roster entry carries both group caps; the role picks which one applies.
export function combatSide(stats, role) {
  return {
    ...stats,
    limit: role === 'attacker' ? stats.huntLimit : stats.engagementLimit,
    unlimited: role === 'attacker' ? stats.huntUnlimited : stats.engagementUnlimited,
  };
}

export function hitOn(attacker, victim, damage) {
  if (!victim.cw || !victim.armor) return damage;
  return damage * (attacker.cw / victim.cw) / victim.armor;
}

export function dpsOn(attacker, victim) {
  return hitOn(attacker, victim, attacker.dps || 0);
}

export function bleedOn(attacker, victim) {
  return (attacker.bleedPerSecond || 0) * (victim.cw ? attacker.cw / victim.cw : 1);
}

// Focus fire: every living member of a side hits the same enemy until it drops, then the next.
// Both sides act simultaneously in small time steps.
export function simulateFight(attacker, attackers, defender, defenders, { bleed = 'off' } = {}) {
  const aHp = Array.from({ length: attackers }, () => attacker.hp);
  const dHp = Array.from({ length: defenders }, () => defender.hp);
  const aBleed = aHp.map(() => 0), dBleed = dHp.map(() => 0);
  const aDps = dpsOn(attacker, defender);
  const dDps = dpsOn(defender, attacker);
  const aBleedRate = bleed === 'assumed' ? bleedOn(attacker, defender) : 0;
  const dBleedRate = bleed === 'assumed' ? bleedOn(defender, attacker) : 0;
  const living = pool => pool.filter(hp => hp > 0).length;
  const strike = (pool, stacks, amount, bleedAmount) => {
    const focus = pool.findIndex(hp => hp > 0);
    if (focus >= 0) stacks[focus] += bleedAmount;
    for (let i = 0; i < pool.length && amount > 0; i++) {
      if (pool[i] <= 0) continue;
      const dealt = Math.min(pool[i], amount);
      pool[i] -= dealt;
      amount -= dealt;
    }
  };
  // Bleed ticks on everyone carrying stacks, then heals at the victim's own rate.
  const bleedTick = (pool, stacks, maxHp, healRate) => {
    for (let i = 0; i < pool.length; i++) {
      if (pool[i] <= 0 || stacks[i] <= 0) continue;
      pool[i] -= stacks[i] * ASSUMED_BLEED_SHARE * maxHp * STEP_SECONDS;
      stacks[i] = Math.max(0, stacks[i] - (healRate || 0) * STEP_SECONDS);
    }
  };
  let seconds = 0;
  let firstDown = null;
  while (seconds < MAX_SECONDS && living(aHp) && living(dHp)) {
    const aAlive = living(aHp), dAlive = living(dHp);
    strike(dHp, dBleed, aDps * aAlive * STEP_SECONDS, aBleedRate * aAlive * STEP_SECONDS);
    strike(aHp, aBleed, dDps * dAlive * STEP_SECONDS, dBleedRate * dAlive * STEP_SECONDS);
    if (bleed === 'assumed') {
      bleedTick(dHp, dBleed, defender.hp, defender.bleedHealRate);
      bleedTick(aHp, aBleed, attacker.hp, attacker.bleedHealRate);
    }
    seconds += STEP_SECONDS;
    if (!firstDown && living(dHp) < dAlive) firstDown = { side: 'defender', seconds };
    if (!firstDown && living(aHp) < aAlive) firstDown = { side: 'attacker', seconds };
  }
  const share = (pool, hp) => pool.reduce((sum, value) => sum + Math.max(0, value), 0) / (hp * pool.length || 1);
  const attackersLeft = living(aHp), defendersLeft = living(dHp);
  return {
    winner: attackersLeft && !defendersLeft ? 'attacker' : defendersLeft && !attackersLeft ? 'defender' : 'none',
    seconds: Math.round(seconds),
    attackersLeft, defendersLeft,
    attackerHpShare: Number(share(aHp, attacker.hp).toFixed(2)),
    defenderHpShare: Number(share(dHp, defender.hp).toFixed(2)),
    firstDown,
  };
}

// One-on-one numbers a player can check in game: what a single hit does, and how many it takes.
export function duelNumbers(attacker, defender) {
  const hit = side => side === 'a' ? hitOn(attacker, defender, attacker.primary.damage) : hitOn(defender, attacker, defender.primary.damage);
  const aHit = attacker.primary ? hit('a') : 0;
  const dHit = defender.primary ? hit('d') : 0;
  const aDps = dpsOn(attacker, defender), dDps = dpsOn(defender, attacker);
  return {
    attackerHit: Math.round(aHit), defenderHit: Math.round(dHit),
    attackerBurst: attacker.burst ? Math.round(hitOn(attacker, defender, attacker.burst.damage)) : 0,
    defenderBurst: defender.burst ? Math.round(hitOn(defender, attacker, defender.burst.damage)) : 0,
    attackerHitsToKill: aHit ? Math.ceil(defender.hp / aHit) : null,
    defenderHitsToKill: dHit ? Math.ceil(attacker.hp / dHit) : null,
    attackerDps: Number(aDps.toFixed(1)), defenderDps: Number(dDps.toFixed(1)),
    attackerTimeToKill: aDps ? Math.round(defender.hp / aDps) : null,
    defenderTimeToKill: dDps ? Math.round(attacker.hp / dDps) : null,
    attackerBleed: Number(bleedOn(attacker, defender).toFixed(3)),
    defenderBleed: Number(bleedOn(defender, attacker).toFixed(3)),
    attackerBleedOutpacesHeal: bleedOn(attacker, defender) > (defender.bleedHealRate || 0),
    defenderBleedOutpacesHeal: bleedOn(defender, attacker) > (attacker.bleedHealRate || 0),
  };
}

// "max" means the profile's legal cap. An unlimited side has no cap to simulate, so "max"
// stays a qualitative verdict there instead of an invented swarm size.
export function resolveCount(choice, side) {
  if (choice === 'max') return side.unlimited ? null : side.limit;
  const wanted = Math.max(1, Math.min(MAX_PICKABLE_GROUP, Number(choice) || 1));
  return side.unlimited ? wanted : Math.min(wanted, side.limit);
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function evaluateFight(attacker, defender, attackerChoice, defenderChoice, options = {}) {
  const attackers = resolveCount(attackerChoice, attacker);
  const defenders = resolveCount(defenderChoice, defender);
  const base = { attackers, defenders, attackerChoice, defenderChoice, bleed: options.bleed || 'off', duel: duelNumbers(attacker, defender) };
  if (attackers == null || defenders == null) {
    const verdict = attackers == null && defenders == null ? 'close' : attackers == null ? 'attacker-advantage' : 'defender-advantage';
    const who = attackers == null ? `${attacker.name} may bring an unlimited group` : `${defender.name} may defend with an unlimited group`;
    return { ...base, verdict, sim: null, label: `${who}; the profile sets no number to simulate, so pick a concrete group size to see the fight.` };
  }
  if (!attacker.dps && !defender.dps) return { ...base, verdict: 'close', sim: null, label: 'No damaging attacks are listed in the stat curves for either side.' };
  const sim = simulateFight(attacker, attackers, defender, defenders, options);
  const verdict = sim.winner === 'attacker' && sim.attackerHpShare >= DECISIVE_HP_SHARE ? 'attacker-advantage'
    : sim.winner === 'defender' && sim.defenderHpShare >= DECISIVE_HP_SHARE ? 'defender-advantage' : 'close';
  const setup = `${attackers} ${attacker.name} vs ${defenders} ${defender.name}`;
  const label = sim.winner === 'none'
    ? `${setup}: neither side drops the other within ${Math.round(MAX_SECONDS / 60)} minutes of trading blows.`
    : `${setup}: the ${sim.winner === 'attacker' ? attacker.name : defender.name} side wins in about ${sim.seconds} s with ${Math.round((sim.winner === 'attacker' ? sim.attackerHpShare : sim.defenderHpShare) * 100)}% of its health left${verdict === 'close' ? ', too narrow to call' : ''}.`;
  return { ...base, verdict, sim, label, detail: `${plural(attackers, 'attacker')} vs ${plural(defenders, 'defender')}` };
}

export function dangerBand(score, conditional) {
  if (conditional) return 'conditional';
  if (score >= 78) return 'severe';
  if (score >= 62) return 'high';
  if (score >= 47) return 'meaningful';
  return 'conditional';
}

// Everything on a card that depends on the fight, rebuilt from the fight-independent core.
export function presentEntry(core, fight) {
  const raw = core.baseScore + FIGHT_POINTS[fight.verdict];
  const score = core.scoreCap == null ? raw : Math.min(core.scoreCap, raw);
  // A fight the attacker loses can still matter (pursuit, profile rules), but never reads as a top band.
  const rawBand = dangerBand(score, core.conditional);
  const band = fight.verdict === 'defender-advantage' && (rawBand === 'severe' || rawBand === 'high') ? 'meaningful' : rawBand;
  const { attackerName, targetName, direction, chaseVerdict } = core;
  const headline = direction === 'threat'
    ? band === 'conditional' ? `${attackerName} matters only if it gets the right opening` : `${attackerName} can create a ${band === 'severe' ? 'very narrow escape window' : band === 'high' ? 'real pursuit problem' : 'credible fight'}`
    : fight.verdict === 'defender-advantage' ? `${targetName} is legal quarry, but not a comfortable fight` : chaseVerdict === 'target-can-disengage' ? `${targetName} can usually refuse the chase` : `${targetName} is a realistic hunting opportunity`;
  const kind = core.relationKind || (direction === 'threat' ? 'predator' : fight.verdict === 'defender-advantage' ? 'risky-quarry' : 'quarry');
  return {
    score: Math.round(score), band, headline, kind,
    summary: `${core.summaryLead} ${core.chaseLabel} ${fight.label}`,
    visible: core.explicit || score >= HIDE_BELOW_SCORE,
  };
}

// The headline read above the lists; `setup` names the group sizes it was computed for.
export function survivalSummary(name, threats, setup) {
  if (!threats.length) return `${name} has no routine direct counter in this setup. The remaining danger is conditional: a bad ambush, isolation from legal defenders, or a profile-specific territory rule.`;
  const severe = threats.filter(entry => entry.band === 'severe' || entry.band === 'high');
  const escape = threats.filter(entry => entry.chase.verdict === 'target-can-disengage');
  if (severe.length) {
    const escapeNote = escape.length
      ? ` Against ${escape.length} listed threat${escape.length === 1 ? '' : 's'}, speed still provides a reliable disengage option.`
      : ' None of those matchups offers a reliable speed-based disengage once contact is forced.';
    return `${setup}, ${name} has ${severe.length} high-priority matchup${severe.length === 1 ? '' : 's'} where fight maths, pursuit and profile intent align.${escapeNote}`;
  }
  return `${name}'s listed dangers are situational rather than automatic losses. Speed, stamina or low encounter overlap prevents raw combat weight from becoming a routine counter.`;
}
