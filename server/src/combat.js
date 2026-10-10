// Adult combat kit from the Alderon stat curves (with Dynasty overrides already applied).
//
// Path of Titans resolves a hit as  damage × (attacker CW / victim CW) ÷ victim armour,
// and status build-up (bleed, venom, bone break) as  amount × (attacker CW / victim CW),
// ignoring armour. This module only reads the per-attack numbers; the pairwise maths lives in
// shared/combat-sim.mjs so the browser can re-run it for any group size.
//
// A curve counts as an attack when it is `<Name>Damage` and a matching `<Name>Cooldown`
// exists. That pairing filters out passive multipliers (`KillingBlowDamageBuff`), armour
// shred side effects (`PounceKickArmorDamage`) and clamp follow-ups without their own button.

const ADULT = 4;
const NOT_AN_ATTACK = /^(?:Core|Multiplier)\.|(?:Incoming|Fall|Piercing|Hide|Critter|Latched|Friendly)[A-Za-z]*Damage$|Damage(?:Buff|Debuff|Reduction|Multiplier)/;
const MIN_DAMAGE = 5;
// Attacks that only exist while latched onto a pounced victim; real, but not a standing-fight rotation.
const LATCHED = /Shred|Pounced|Latched/;
// No attack cycles faster than its animation; sub-second cooldowns are clamped to this.
const MIN_CYCLE_SECONDS = 1;
// A hit this many times the primary is a situational special (Argentinosaurus' Big Stomp), not rotation.
const SPECIAL_HIT_RATIO = 6;
// An ability press replaces one primary swing; the primary is spammed in between.
const MAX_WEAVED_ABILITIES = 2;

function adultValue(curve) {
  if (!curve) return null;
  const effective = curve.effectiveValues?.[ADULT];
  if (effective != null) return { value: effective, estimated: false };
  // Some Dynasty changes only say "increased" without a number; keep the last known value as a floor.
  const known = [...(curve.effectiveValues || []), ...(curve.baseValues || [])].filter(value => value != null);
  return known.length ? { value: known.at(-1), estimated: true } : null;
}

function humanLabel(name) {
  return name.replace(/V(\d)$/, ' v$1').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bAOE\b/, 'AoE');
}

function statusAmount(rows, name, kinds) {
  for (const kind of kinds) {
    const found = adultValue(rows.get(`${name}${kind}`));
    if (found && found.value > 0) return found;
  }
  return null;
}

export function attacksFromCurves(curves) {
  const rows = new Map((curves || []).map(curve => [curve.key, curve]));
  const attacks = [];
  for (const curve of curves || []) {
    const match = curve.key.match(/^(.+?)Damage$/);
    if (!match || NOT_AN_ATTACK.test(curve.key)) continue;
    const name = match[1];
    const damage = adultValue(curve);
    const cooldown = adultValue(rows.get(`${name}Cooldown`));
    if (!damage || !cooldown || damage.value < MIN_DAMAGE || cooldown.value <= 0) continue;
    const bleed = statusAmount(rows, name, ['BleedAmount', 'Bleed']);
    const venom = statusAmount(rows, name, ['VenomAmount', 'Venom']);
    const boneBreak = statusAmount(rows, name, ['BoneBreakAmount', 'BonebreakAmount']);
    attacks.push({
      key: name,
      label: humanLabel(name),
      damage: damage.value,
      cooldown: cooldown.value,
      cycle: Math.max(MIN_CYCLE_SECONDS, cooldown.value),
      dps: Number((damage.value / Math.max(MIN_CYCLE_SECONDS, cooldown.value)).toFixed(2)),
      latched: LATCHED.test(name),
      bleed: bleed?.value ?? 0,
      venom: venom?.value ?? 0,
      boneBreak: boneBreak?.value ?? 0,
      estimated: Boolean(damage.estimated || bleed?.estimated),
    });
  }
  return attacks;
}

// Sustained output of a sensible adult loadout: the best spammable attack plus up to two
// abilities whose hit is worth more than the primary swings it replaces. Latched-only attacks
// and outsized specials stay visible as burst, but never inflate the standing-fight rotation.
export function rotationFrom(attacks) {
  const standing = attacks.filter(attack => !attack.latched);
  if (!standing.length) return null;
  const spammable = standing.filter(attack => attack.cooldown <= 2);
  const primary = (spammable.length ? spammable : standing).reduce((best, attack) => attack.dps > best.dps ? attack : best);
  const primaryDps = primary.damage / primary.cycle;
  const candidates = standing
    .filter(attack => attack !== primary && attack.damage <= primary.damage * SPECIAL_HIT_RATIO)
    .map(attack => ({ attack, gain: (attack.damage - primary.damage) / attack.cycle }))
    .filter(candidate => candidate.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const weaved = [];
  let busy = 0;
  for (const { attack } of candidates) {
    const share = primary.cycle / attack.cycle;
    if (weaved.length >= MAX_WEAVED_ABILITIES || busy + share > 0.9) continue;
    weaved.push(attack);
    busy += share;
  }
  const used = [primary, ...weaved];
  const dps = primaryDps + weaved.reduce((sum, attack) => sum + (attack.damage - primary.damage) / attack.cycle, 0);
  // Status build-up per second over the same rotation (before the CW ratio).
  const perSecond = field => primary[field] / primary.cycle * (1 - busy) + weaved.reduce((sum, attack) => sum + attack[field] / attack.cycle, 0);
  const burst = attacks.reduce((best, attack) => attack.damage > best.damage ? attack : best);
  return {
    dps: Number(dps.toFixed(2)),
    primary: { label: primary.label, damage: primary.damage, cooldown: primary.cooldown },
    burst: { label: burst.label, damage: burst.damage, cooldown: burst.cooldown, situational: burst.latched || burst.damage > primary.damage * SPECIAL_HIT_RATIO },
    attacks: used.map(attack => attack.label),
    bleedPerSecond: Number(perSecond('bleed').toFixed(3)),
    venomPerSecond: Number(perSecond('venom').toFixed(3)),
    boneBreakPerSecond: Number(perSecond('boneBreak').toFixed(2)),
    estimated: used.some(attack => attack.estimated),
  };
}

export function combatKit(profile) {
  const curves = profile.fullStats?.curves || [];
  const stat = key => adultValue(curves.find(curve => curve.key === key))?.value ?? null;
  const attacks = attacksFromCurves(curves);
  return {
    cw: profile.stats?.combatWeight || stat('Core.CombatWeight') || 0,
    hp: stat('Core.MaxHealth') || 0,
    armor: stat('Core.Armor') || 1,
    bleedHealRate: stat('Core.BleedingHealRate') || 0,
    rotation: rotationFrom(attacks),
    attackCount: attacks.length,
  };
}
