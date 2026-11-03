// Thermo comfort per playable for the temperature map. The curated source data/reference/thermo.json
// gives each playable its thermophysiology tier (A endotherm … E ectotherm), its body cover and what
// its own profile says about heat and cold (verbatim quotes, checked here). From that this module
// sets a comfort band on the felt temperature: the tier's base band, moved by the cover (feathers
// keep warm), by size (a bigger body keeps heat, so the band moves down) and by the profile's leanings.
// The browser rates every zone and hour with shared/thermo-comfort.mjs.

import { quoteSection } from './rest-nests.js';

const round = value => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function buildThermo(profiles, doc, radarDinos = {}) {
  if (!doc) return null;
  const fail = message => { throw new Error(`thermo: ${message}`); };
  const { size } = doc;
  const playables = {};
  for (const profile of profiles) {
    const family = profile.variant?.parentId || profile.id;
    const entry = doc.playables[profile.id] || doc.playables[family];
    if (!entry) fail(`${profile.id} has no curated entry`);
    const tier = doc.tiers[entry.tier];
    const cover = doc.covers[entry.cover];
    if (!tier) fail(`${profile.id} has unknown tier ${entry.tier}`);
    if (!cover) fail(`${profile.id} has unknown cover ${entry.cover}`);
    const cw = profile.stats?.combatWeight || size.reference;
    const shift = clamp(-size.perDoubling * Math.log2(cw / size.reference), size.min, size.max) * (entry.tier === 'E' ? size.ectothermFactor : 1);
    const cold = shift - cover.cold - (entry.cold || 0);
    const heat = shift + cover.heat + (entry.heat || 0);
    const [tooCold, cool, warm, tooHot] = tier.band;
    const quotes = (entry.quotes || []).map(text => {
      const section = quoteSection(profile, text);
      if (!section) fail(`quote is not in the ${profile.id} profile: "${text.slice(0, 90)}…"`);
      return { text, section };
    });
    // Aquatic playables live in the water and are rated on it with a hand-set water band.
    if (entry.aquatic && !(entry.waterBand?.length === 4)) fail(`${profile.id} is aquatic but has no waterBand`);
    if (entry.tier === 'E' && !entry.aquatic && !(entry.ideal?.length === 2)) fail(`${profile.id} is a land ectotherm without an ideal body range`);
    playables[profile.id] = {
      name: profile.name, tier: entry.tier, cover: entry.cover, cw,
      band: entry.aquatic ? entry.waterBand : [tooCold + cold, cool + cold, warm + heat, tooHot + heat].map(round),
      water: Boolean(entry.water), aquatic: Boolean(entry.aquatic), gills: Boolean(entry.gills), aerial: profile.classification?.habitat === 'Aerial',
      // Land ectotherms: the body temperature they aim for (thermo compass) and whether small pools are off limits.
      ideal: entry.ideal || null, smallPools: entry.smallPools !== false, dens: entry.tier === 'E' && entry.dens !== false,
      activity: profile.classification?.activity || null, de: entry.de, quotes,
      home: radarDinos[profile.id]?.home || [], route: radarDinos[profile.id]?.route || [],
    };
  }
  return {
    note: 'band = [too cold below, cool below, warm above, too hot above] in °C: felt temperature for endotherms, body temperature (air, sun, ground) for ectotherms, water temperature for aquatic playables. Active animals meet the open, resting ones their best refuge (shade, den, water, the deep).',
    tiers: Object.fromEntries(Object.entries(doc.tiers).map(([id, tier]) => [id, { de: tier.de, text: tier.text }])),
    covers: Object.fromEntries(Object.entries(doc.covers).map(([id, cover]) => [id, cover.de])),
    playables,
  };
}
