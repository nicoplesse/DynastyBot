// Ecosystem overview. The curated source is data/reference/ecosystems.json: one home ecosystem
// per playable (plus places it visits) with the reason from its profile. The food-chain level is
// derived from diet and game tier so it stays in step with the profiles; a curated `level` (e.g.
// the filter-feeding Leedsichthys) overrides it. Inside an ecosystem the playables are ordered
// from the top of the food chain down: level, then combat weight, then adult health.

const PREDATOR_LEVEL = { Apex: 1, Giant: 1, Large: 2, Medium: 3, Small: 4, Tiny: 4 };
const HERBIVORE_LEVEL = { Apex: 5, Giant: 5, Large: 6, Medium: 6, Small: 7, Tiny: 7 };

export function foodChainLevel(profile, curated = {}) {
  if (curated.level) return { level: curated.level, derived: false, reason: curated.levelReason || null };
  const tier = profile.classification?.tier;
  const table = profile.classification?.diet === 'Herbivore' ? HERBIVORE_LEVEL : PREDATOR_LEVEL;
  return { level: table[tier] || (table === HERBIVORE_LEVEL ? 6 : 3), derived: true, reason: null };
}

function maxHealth(profile) {
  const curve = profile.fullStats?.curves?.find(item => item.key === 'Core.MaxHealth');
  return curve ? curve.effectiveValues?.at(-1) ?? curve.baseValues?.at(-1) ?? null : null;
}

export function compareFoodChain(a, b) {
  return a.level - b.level || (b.combatWeight ?? 0) - (a.combatWeight ?? 0) || (b.maxHealth ?? 0) - (a.maxHealth ?? 0) || a.name.localeCompare(b.name);
}

export function resolveEcosystem(doc, profile) {
  const curated = doc?.profiles?.[profile.id];
  if (!curated) return null;
  const byId = new Map((doc.ecosystems || []).map(item => [item.id, item]));
  const home = byId.get(curated.ecosystem);
  if (!home) throw new Error(`${profile.id}: unknown ecosystem ${curated.ecosystem}`);
  const { level, derived, reason } = foodChainLevel(profile, curated);
  const levelInfo = (doc.levels || []).find(item => item.level === level) || { label: `Level ${level}`, de: null };
  return {
    id: home.id, label: home.label, de: home.de, reason: curated.reason || '',
    also: (curated.also || []).map(id => byId.get(id)).filter(Boolean).map(item => ({ id: item.id, label: item.label, de: item.de })),
    foodChain: { level, label: levelInfo.label, de: levelInfo.de, derived, reason },
  };
}

// Ordered overview for the website and the chatbot: every ecosystem with its playables from the
// apex predators down to the smallest prey.
export function buildEcosystemIndex(profiles, doc) {
  const members = profiles.filter(profile => profile.ecosystem).map(profile => ({
    id: profile.id, name: profile.name, ecosystem: profile.ecosystem.id,
    level: profile.ecosystem.foodChain.level, combatWeight: profile.stats?.combatWeight ?? null, maxHealth: maxHealth(profile),
    tier: profile.classification?.tier || null, diet: profile.classification?.diet || null,
    also: profile.ecosystem.also.map(item => item.id), reason: profile.ecosystem.reason,
  }));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    levels: doc?.levels || [],
    ecosystems: (doc?.ecosystems || []).map(ecosystem => {
      const home = members.filter(member => member.ecosystem === ecosystem.id).sort(compareFoodChain);
      return {
        ...ecosystem,
        count: home.length,
        foodChain: home.map((member, index) => ({ rank: index + 1, ...member })),
        visitors: members.filter(member => member.ecosystem !== ecosystem.id && member.also.includes(ecosystem.id)).sort(compareFoodChain).map(({ id, name, level, ecosystem: homeId }) => ({ id, name, level, home: homeId })),
      };
    }),
  };
}
