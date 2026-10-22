// Clamp overview: who can clamp (or grab) whom, and up to which growth stage. The clamp limit is
// the clamper's carry capacity: a target can be picked up while its combat weight is below it.
// Dynasty writes profile adjustments as "Clamp Weight: Up to 3900 Combat Weight", which the stats
// model already turns into carry capacity 3901, so the effective curves include them.

export const STAGES = ['Hatchling', 'Juvenile', 'Adolescent', 'Sub-Adult', 'Adult'];

// Ability buffs that raise the carry capacity while active (key → label).
const CAPACITY_BUFFS = { WideGapeCarryCapacityBuff: 'Wide Gape' };

function curve(profile, key) {
  return profile.fullStats?.curves?.find(item => item.key === key) || null;
}

function values(item) {
  return (item?.effectiveValues || []).map((value, index) => value ?? item.baseValues?.[index] ?? null);
}

// Clamp abilities carry Clamp*/LandGrab* stats; Citipati and Hatzegopteryx call theirs Grab.
// Latched* multipliers only describe damage against a clamped dino and do not count.
export function clampAbility(profile) {
  const keys = (profile.fullStats?.curves || []).map(item => item.key);
  if (!curve(profile, 'Core.CarryCapacity')) return null;
  if (keys.some(key => /^(Clamp|BiteClamp|LandGrab|NewBiteClamped)/.test(key))) return 'clamp';
  if (keys.some(key => /^Grab/.test(key))) return 'grab';
  return null;
}

export function canClamp(capacity, combatWeight) {
  return capacity > 0 && combatWeight != null && combatWeight < capacity;
}

// Highest clampable stage of a target plus any lower stages that are too heavy (combat weight is
// not always monotonic, e.g. Camptosaurus is heavier as Sub-Adult than as Adult).
export function clampReach(capacity, weights) {
  const fits = weights.map(weight => canClamp(capacity, weight));
  const max = fits.lastIndexOf(true);
  return { max, gaps: max < 0 ? [] : fits.slice(0, max).flatMap((fit, index) => fit ? [] : [index]) };
}

export function buildClampIndex(profiles, doc) {
  const curated = doc?.clampers || {};
  const clampers = profiles.filter(clampAbility).map(profile => {
    const capacity = curve(profile, 'Core.CarryCapacity');
    const buffs = Object.entries(CAPACITY_BUFFS).flatMap(([key, label]) => {
      const bonus = values(curve(profile, key)).at(-1);
      return bonus ? [{ key, label, bonus }] : [];
    });
    return {
      id: profile.id, name: profile.name, tier: profile.classification?.tier || null,
      habitat: profile.classification?.habitat || null, ability: clampAbility(profile),
      capacity: values(capacity), baseCapacity: capacity.baseValues,
      adjustments: [...new Set(capacity.adjustments.map(item => item.text))],
      buffs, notes: curated[profile.id]?.notes || [],
    };
  });
  const prey = profiles.map(profile => ({
    id: profile.id, name: profile.name, aliases: profile.aliases || [], tier: profile.classification?.tier || null,
    diet: profile.classification?.diet || null, habitat: profile.classification?.habitat || null,
    combatWeight: values(curve(profile, 'Core.CombatWeight')),
  })).filter(item => item.combatWeight.length === STAGES.length);
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), stages: STAGES,
    rule: 'A target can be clamped while its combat weight is below the clamper\'s carry capacity.',
    clampers, prey,
  };
}
