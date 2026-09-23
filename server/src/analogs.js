// "Plays like" real-animal analogs. The curated source is data/raw/<slug>/analog.json
// (one or two real animals with a share, plus reasons and caveats); the controlled
// vocabulary (archetypes, moods, habitats with English and German synonyms) lives in
// data/reference/analog-vocabulary.json. This module resolves the curated block for a
// processed profile, attaches live stat facts, and builds a searchable index so a chatbot
// can answer "I feel like playing an ox" with a direct lookup.

export function normalizeTerm(value) {
  return String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function animalId(name) {
  return normalizeTerm(name).replace(/ /g, '-');
}

function officialInspiration(credits) {
  const line = (credits || []).find(credit => /^Profile inspired by/i.test(credit));
  if (!line) return null;
  return line.replace(/^Profile inspired by\s*/i, '').split(/(?<=\.)\s/)[0].replace(/\.$/, '').trim() || null;
}

function habitatTags(doc, vocabulary) {
  // Curated tags win; the keyword scan is only a fallback for analog files that predate them.
  if (Array.isArray(doc.setting?.habitats)) return doc.setting.habitats.filter(id => vocabulary?.habitats?.[id]);
  const text = normalizeTerm(doc.setting?.label || '');
  return Object.entries(vocabulary?.habitats || {})
    .filter(([, habitat]) => (habitat.match || []).some(word => new RegExp(`\\b${normalizeTerm(word)}(?:s|es)?\\b`).test(text)))
    .map(([id]) => id);
}

function statFacts(profile) {
  const curve = key => profile.fullStats?.curves?.find(item => item.key === key);
  const health = curve('Core.MaxHealth');
  const traits = profile.matchups?.traits || {};
  return {
    tier: profile.classification?.tier || null,
    diet: profile.classification?.diet || null,
    activity: profile.classification?.activity || null,
    habitat: profile.classification?.habitat || null,
    combatWeight: profile.stats?.combatWeight ?? null,
    maxHealth: health ? health.effectiveValues?.at(-1) ?? health.baseValues?.at(-1) ?? null : null,
    growthMinutes: profile.stats?.growthMinutes ?? null,
    landSprint: profile.speed?.land?.sprint ?? null,
    landSprintSeconds: profile.speed?.land?.sprintDurationSeconds ?? null,
    waterSprint: profile.speed?.water?.sprint ?? null,
    airSprint: profile.speed?.air?.sprint ?? null,
    huntTier: traits.huntTier || null,
    huntGroupSize: traits.huntGroupUnlimited ? 'unlimited' : traits.huntGroupSize || null,
    engagementLimit: traits.engagementUnlimited ? 'unlimited' : traits.engagementLimit || null,
    mapBiomes: profile.habitat?.biomes || [],
    isDry: Boolean(profile.habitat?.isDry),
    isAquatic: Boolean(profile.habitat?.isAquatic),
  };
}

export function resolveAnalog(doc, profile, vocabulary) {
  if (!doc || !Array.isArray(doc.analogs) || !doc.analogs.length) return null;
  const archetypes = vocabulary?.archetypes || {};
  const moods = vocabulary?.moods || {};
  const habitats = vocabulary?.habitats || {};
  const analogs = [...doc.analogs].sort((a, b) => (b.share || 0) - (a.share || 0)).map((analog, index) => ({
    id: animalId(analog.animal),
    animal: analog.animal,
    de: analog.de || null,
    scientific: analog.scientific || null,
    archetype: analog.archetype,
    archetypeLabel: archetypes[analog.archetype]?.label || analog.archetype,
    archetypeDe: archetypes[analog.archetype]?.de || null,
    share: analog.share ?? null,
    role: index === 0 ? 'primary' : 'secondary',
    covers: analog.covers || '',
  }));
  return {
    schemaVersion: 1,
    source: doc.source || 'curated',
    reviewedAt: doc.reviewedAt || null,
    label: analogs.map(analog => analog.animal).join(' + '),
    labelDe: analogs.map(analog => analog.de || analog.animal).join(' + '),
    headline: doc.headline || '',
    playsLike: doc.playsLike || '',
    setting: {
      label: doc.setting?.label || '',
      note: doc.setting?.note || '',
      habitats: habitatTags(doc, vocabulary).map(id => ({ id, label: habitats[id]?.label || id, de: habitats[id]?.de || null })),
    },
    analogs,
    why: Array.isArray(doc.why) ? doc.why : [],
    notLike: Array.isArray(doc.notLike) ? doc.notLike : [],
    twist: doc.twist || '',
    moods: (doc.moods || []).map(id => ({ id, label: moods[id]?.label || id, de: moods[id]?.de || null })),
    confidence: doc.confidence || 'medium',
    officialInspiration: officialInspiration(profile.credits),
    facts: statFacts(profile),
  };
}

// Links each analog animal to the other playables built on the same animal, so a profile can
// show how its "wolf" or "hyena" differs from the other ones on the roster.
export function attachAnalogRelatives(profiles) {
  const byAnimal = new Map();
  for (const profile of profiles) for (const analog of profile.analog?.analogs || []) {
    const key = analog.id.replace(/-(family-pack|bull|flock|troop|silverback-troop)$/, '');
    if (!byAnimal.has(key)) byAnimal.set(key, []);
    byAnimal.get(key).push({ id: profile.id, name: profile.name, role: analog.role, share: analog.share, headline: profile.analog.headline });
  }
  for (const profile of profiles) for (const analog of profile.analog?.analogs || []) {
    const key = analog.id.replace(/-(family-pack|bull|flock|troop|silverback-troop)$/, '');
    analog.relatives = byAnimal.get(key).filter(entry => entry.id !== profile.id);
  }
}

function addLookup(lookup, term, kind, id) {
  const key = normalizeTerm(term);
  if (!key) return;
  const entry = (lookup[key] ||= { archetypes: [], animals: [], moods: [], habitats: [] });
  if (!entry[kind].includes(id)) entry[kind].push(id);
}

export function buildAnalogIndex(profiles, vocabulary) {
  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Real-animal "plays like" analogs per playable. archetypes/animals/moods/habitats list the playables for each value (primary analogs first); lookup maps every normalized English/German synonym to archetype, animal, mood and habitat ids. GET /api/analogs/search?q=<words> ranks playables for free text such as "ochse" or "großkatze dschungel".',
    vocabulary: vocabulary || { archetypes: {}, moods: {}, habitats: {} },
    archetypes: {},
    animals: {},
    moods: {},
    habitats: {},
    dinos: {},
    lookup: {},
  };
  for (const [id, archetype] of Object.entries(vocabulary?.archetypes || {})) {
    index.archetypes[id] = { label: archetype.label, de: archetype.de, dinos: [] };
    for (const term of [archetype.label, archetype.de, ...(archetype.synonyms || [])]) addLookup(index.lookup, term, 'archetypes', id);
  }
  for (const [id, mood] of Object.entries(vocabulary?.moods || {})) {
    index.moods[id] = { label: mood.label, de: mood.de, dinoIds: [] };
    for (const term of [mood.label, mood.de, ...(mood.synonyms || [])]) addLookup(index.lookup, term, 'moods', id);
  }
  for (const [id, habitat] of Object.entries(vocabulary?.habitats || {})) {
    index.habitats[id] = { label: habitat.label, de: habitat.de, dinoIds: [] };
    for (const term of [habitat.label, habitat.de, ...(habitat.synonyms || [])]) addLookup(index.lookup, term, 'habitats', id);
  }
  for (const profile of profiles) {
    const analog = profile.analog;
    if (!analog) continue;
    index.dinos[profile.id] = {
      name: profile.name,
      label: analog.label,
      labelDe: analog.labelDe,
      headline: analog.headline,
      setting: analog.setting.label,
      habitats: analog.setting.habitats.map(habitat => habitat.id),
      analogs: analog.analogs.map(({ id, animal, de, archetype, share, role }) => ({ id, animal, de, archetype, share, role })),
      moods: analog.moods.map(mood => mood.id),
      tier: analog.facts.tier,
      diet: analog.facts.diet,
      activity: analog.facts.activity,
      classification: analog.facts.habitat,
    };
    for (const item of analog.analogs) {
      const family = (index.archetypes[item.archetype] ||= { label: item.archetypeLabel, de: item.archetypeDe, dinos: [] });
      // Both analogs can share a family (mountain goat + bighorn sheep): list the playable once with the combined share.
      const listed = family.dinos.find(entry => entry.id === profile.id);
      if (listed) { listed.animal = `${listed.animal} + ${item.animal}`; listed.share = (listed.share || 0) + (item.share || 0); }
      else family.dinos.push({ id: profile.id, name: profile.name, animal: item.animal, role: item.role, share: item.share, headline: analog.headline });
      const animal = (index.animals[item.id] ||= { animal: item.animal, de: item.de, scientific: item.scientific, archetype: item.archetype, dinos: [] });
      animal.dinos.push({ id: profile.id, name: profile.name, role: item.role, share: item.share });
      for (const term of [item.animal, item.de, item.animal.replace(/\s*\(.*\)$/, ''), (item.de || '').replace(/\s*\(.*\)$/, '')]) {
        addLookup(index.lookup, term, 'animals', item.id);
        addLookup(index.lookup, term, 'archetypes', item.archetype);
      }
    }
    for (const mood of analog.moods) (index.moods[mood.id] ||= { label: mood.label, de: mood.de, dinoIds: [] }).dinoIds.push(profile.id);
    for (const habitat of analog.setting.habitats) (index.habitats[habitat.id] ||= { label: habitat.label, de: habitat.de, dinoIds: [] }).dinoIds.push(profile.id);
  }
  const byRole = (a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1) || (b.share || 0) - (a.share || 0) || a.name.localeCompare(b.name);
  for (const archetype of Object.values(index.archetypes)) archetype.dinos.sort(byRole);
  for (const animal of Object.values(index.animals)) animal.dinos.sort(byRole);
  return index;
}

function matchTerms(index, query) {
  const phrase = ` ${normalizeTerm(query)} `;
  const words = phrase.trim().split(' ').filter(Boolean);
  const hits = { archetypes: new Map(), animals: new Map(), moods: new Map(), habitats: new Map() };
  const note = (kind, id, weight, term) => {
    const current = hits[kind].get(id) || { weight: 0, terms: new Set() };
    current.weight = Math.max(current.weight, weight);
    current.terms.add(term);
    hits[kind].set(id, current);
  };
  for (const [key, entry] of Object.entries(index.lookup)) {
    const exact = phrase.includes(` ${key} `);
    // Loose stem match for single German/English words ("ochsen" -> "ochse", "löwen" -> "löwe").
    const loose = !exact && !key.includes(' ') && words.some(word =>
      (key.length >= 3 && word.startsWith(key) && word.length - key.length <= 2) ||
      (word.length >= 4 && key.startsWith(word) && key.length - word.length <= 3));
    if (!exact && !loose) continue;
    const weight = (exact ? 1 : 0.7) * (1 + key.split(' ').length * 0.1);
    for (const kind of Object.keys(hits)) for (const id of entry[kind]) note(kind, id, weight, key);
  }
  return hits;
}

export function searchAnalogs(index, query, { limit = 12 } = {}) {
  const hits = matchTerms(index, query);
  // Once the query names an animal or family, habitat and mood words only rank those matches.
  const wantsAnimal = hits.archetypes.size > 0 || hits.animals.size > 0;
  const results = [];
  for (const [id, dino] of Object.entries(index.dinos)) {
    if (wantsAnimal && !dino.analogs.some(analog => hits.animals.has(analog.id) || hits.archetypes.has(analog.archetype))) continue;
    let score = 0;
    const reasons = [];
    const scoredArchetypes = new Set();
    for (const analog of dino.analogs) {
      const roleWeight = analog.role === 'primary' ? 1 : 0.6;
      const shareWeight = 0.5 + (analog.share || 50) / 200;
      const archetypeHit = hits.archetypes.get(analog.archetype);
      // A family word also names this exact animal when it is a whole word of its English or German
      // name ("lion" in "African lion", "Löwe" in "Asiatischer Löwe"). Whole words only: "Moschusochse"
      // is not an ox (musk oxen are goat-antelopes), and the family check keeps "Seelöwe" out of "Löwe".
      const nameTokens = normalizeTerm(`${analog.animal} ${analog.de || ''}`).split(' ');
      const namedByFamilyWord = archetypeHit && [...archetypeHit.terms].some(term => !term.includes(' ') && term.length >= 3 && nameTokens.includes(term));
      const animalHit = hits.animals.get(analog.id) || (namedByFamilyWord ? archetypeHit : null);
      if (scoredArchetypes.has(analog.archetype) && !hits.animals.get(analog.id)) continue;
      if (animalHit) { score += 6 * roleWeight * shareWeight * animalHit.weight; reasons.push(`${analog.role === 'primary' ? 'plays mostly like' : 'partly plays like'} ${analog.animal}`); }
      else if (archetypeHit) { score += 4 * roleWeight * shareWeight * archetypeHit.weight; reasons.push(`${analog.animal} (${index.archetypes[analog.archetype]?.label || analog.archetype})`); }
      if (animalHit || archetypeHit) scoredArchetypes.add(analog.archetype);
    }
    for (const mood of dino.moods) if (hits.moods.has(mood)) { score += 1.2; reasons.push(index.moods[mood]?.label || mood); }
    for (const habitat of dino.habitats) if (hits.habitats.has(habitat)) { score += 1.5; reasons.push(index.habitats[habitat]?.label || habitat); }
    if (normalizeTerm(query).includes(normalizeTerm(dino.name))) { score += 10; reasons.push('name match'); }
    if (score > 0) results.push({ id, name: dino.name, score: Math.round(score * 100) / 100, label: dino.label, labelDe: dino.labelDe, headline: dino.headline, setting: dino.setting, tier: dino.tier, diet: dino.diet, reasons: [...new Set(reasons)] });
  }
  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const matched = Object.fromEntries(Object.entries(hits).map(([kind, map]) => [kind, [...map.keys()]]));
  return { query, matched, results: results.slice(0, limit) };
}
