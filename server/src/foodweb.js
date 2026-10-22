// Food web ("Beutenetz"): who hunts whom, in which order, and with how big a group.
//
// The curated source is data/reference/food-web.json. Per carnivore it lists the hunting setups
// (group sizes or situations that change the hunt ceiling), the ordered preferred-prey stages, the
// explicitly allowed, last-resort, special-situation and never rules, each with a verbatim profile
// quote. Everything the profile does not name is derived: a target is legal prey while its tier is
// within the setup ceiling and its habitat is reachable. Quotes that are not in the profile fail
// the build, so the web cannot drift from the profiles.

export const TIERS = ['Tiny', 'Small', 'Medium', 'Large', 'Apex', 'Giant'];
const RANK = Object.fromEntries(TIERS.map((tier, index) => [tier, index + 1]));
// Ordering of relationship kinds: a lower value is a stronger reason to hunt.
const KIND_ORDER = { priority: 0, allowed: 50, legal: 50, last: 60, special: 70, never: 90 };
export const HUNTABLE = new Set(['priority', 'allowed', 'legal', 'last', 'special']);

const normalize = text => text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function profileSegments(profile) {
  const segments = [{ section: 'Quick View', text: (profile.quickView || []).join(' ') }];
  for (const section of profile.sections || []) {
    segments.push({ section: section.title, text: section.blocks.map(block => block.type === 'list' ? block.items.join(' ') : block.text).join(' ') });
  }
  return segments.map(segment => ({ ...segment, text: normalize(segment.text) }));
}

// The section a quote comes from; a quote that is not verbatim in the profile is a data error.
function locate(profile, quote, where) {
  const needle = normalize(quote);
  const hit = profileSegments(profile).find(segment => segment.text.includes(needle));
  if (!hit) throw new Error(`food-web: quote for ${where} is not in the ${profile.id} profile: "${quote.slice(0, 90)}…"`);
  return hit.section;
}

const isAquatic = habitat => /^Aquatic/.test(habitat || '');
const isAerial = habitat => habitat === 'Aerial';
const isSemiAquatic = habitat => /Semi-Aquatic/.test(habitat || '');

// Can the hunter reach the target at all? 'ok', 'water' (only when the target swims or stands at
// the shore), 'ground' (an aerial target only once it has landed) or 'none'.
export function reach(hunter, target) {
  if (isAquatic(hunter.habitat)) return isAquatic(target.habitat) || isSemiAquatic(target.habitat) ? 'ok' : 'water';
  if (isAerial(hunter.habitat)) return isAquatic(target.habitat) ? 'none' : 'ok';
  if (isAquatic(target.habitat)) return isSemiAquatic(hunter.habitat) ? 'ok' : 'none';
  if (isAerial(target.habitat)) return 'ground';
  return 'ok';
}

const REACH_NOTE = { water: 'nur schwimmend oder direkt am Ufer', ground: 'nur, wenn es am Boden ist' };

function matchesFilter(node, filter) {
  if (!filter) return false;
  if (filter.minTier && RANK[node.tier] < RANK[filter.minTier]) return false;
  if (filter.maxTier && RANK[node.tier] > RANK[filter.maxTier]) return false;
  if (filter.diet && node.diet !== filter.diet) return false;
  if (filter.habitat && node.habitat !== filter.habitat) return false;
  return true;
}

// An entry names targets (ids or a variant family) and/or a filter; `except` removes ids.
function matches(entry, node, setupId) {
  if (entry.setups && !entry.setups.includes(setupId)) return false;
  if ((entry.except || []).includes(node.id)) return false;
  const named = (entry.targets || []).some(id => id === node.id || id === node.family);
  return named || matchesFilter(node, entry.filter);
}

const named = (entry, node) => (entry.targets || []).some(id => id === node.id || id === node.family);
const inCeiling = (setup, node) => RANK[node.tier] <= RANK[setup.tier] && (!setup.minTier || RANK[node.tier] >= RANK[setup.minTier]);

// One hunter × one target × one setup. Returns null when the target is not huntable with this setup.
function evaluate(spec, hunter, target, setup, skipYoung = false) {
  const young = entry => entry.young && !skipYoung;
  const usable = entry => !entry.young || young(entry);
  const result = (kind, entry, extra = {}) => ({ kind, entry, ...extra });

  if (setup.only && !setup.only.some(id => id === target.id || id === target.family)) return null;
  if ((setup.exclude || []).some(id => id === target.id || id === target.family)) return null;
  const special = spec.special.find(entry => usable(entry) && matches(entry, target, setup.id));
  if (special) return result('special', special, { young: Boolean(special.young) });
  const never = spec.never.find(entry => matches(entry, target, setup.id));
  if (never) return result('never', never);
  const free = entry => entry.young || entry.ignoreTier || inCeiling(setup, target);
  const stage = spec.priorities.find(entry => usable(entry) && matches(entry, target, setup.id));
  if (stage) return free(stage) ? result('priority', stage, { young: Boolean(stage.young) }) : null;
  const allowed = spec.allow.find(entry => matches(entry, target, setup.id));
  if (allowed) return free(allowed) ? result('allowed', allowed) : null;
  const last = spec.last.find(entry => matches(entry, target, setup.id));
  if (last) return free(last) ? result('last', last) : null;
  return inCeiling(setup, target) ? result('legal', null) : null;
}

const score = verdict => verdict ? KIND_ORDER[verdict.kind] + (verdict.kind === 'priority' ? verdict.entry.rank : 0) : 999;

export function buildFoodWeb(profiles, doc, ecosystemIndex = null) {
  if (!doc) return null;
  const levels = ecosystemIndex?.levels || [];
  const nodes = profiles.map(profile => ({
    id: profile.id, name: profile.name, family: profile.variant?.parentId || profile.id,
    variant: profile.variant ? { label: profile.variant.label, de: profile.variant.de, title: profile.variant.title || null } : null,
    tier: profile.classification?.tier || null, diet: profile.classification?.diet || null,
    habitat: profile.classification?.habitat || null, activity: profile.classification?.activity || null,
    combatWeight: profile.stats?.combatWeight ?? null,
    ecosystem: profile.ecosystem?.id || null, also: (profile.ecosystem?.also || []).map(item => item.id),
    level: profile.ecosystem?.foodChain?.level ?? null,
    regions: profile.habitat?.regions || [],
  }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const known = new Set([...nodes.map(node => node.id), ...nodes.map(node => node.family)]);
  const hunters = {};

  for (const node of nodes) {
    const profile = profileById.get(node.id);
    const curated = doc.hunters?.[node.id] || doc.hunters?.[node.family];
    const passive = doc.nonHunters?.[node.id] || doc.nonHunters?.[node.family];
    if (passive) {
      hunters[node.id] = { none: passive.note, noneSection: locate(profile, passive.quote, `${node.id} nonHunter`), noneQuote: passive.quote, setups: [], stages: [], notes: [], edges: [] };
      continue;
    }
    if (!curated) {
      if (node.diet === 'Carnivore') throw new Error(`food-web: carnivore ${node.id} has no curated hunting entry`);
      continue;
    }
    const quotes = [];
    const quoteIndex = new Map();
    const cite = (quote, where) => {
      if (!quoteIndex.has(quote)) { quoteIndex.set(quote, quotes.length); quotes.push({ text: quote, section: locate(profile, quote, where) }); }
      return quoteIndex.get(quote);
    };
    const setups = curated.setups.map(setup => ({ ...setup }));
    if (!setups.length) throw new Error(`food-web: ${node.id} needs at least one setup`);
    const setupIds = new Set(setups.map(setup => setup.id));
    const checkTargets = (entry, where) => {
      for (const id of [...(entry.targets || []), ...(entry.except || [])]) if (!known.has(id)) throw new Error(`food-web: ${where} names unknown playable ${id}`);
      for (const id of entry.setups || []) if (!setupIds.has(id)) throw new Error(`food-web: ${where} names unknown setup ${id}`);
      for (const tier of [entry.filter?.minTier, entry.filter?.maxTier]) if (tier && !RANK[tier]) throw new Error(`food-web: ${where} has unknown tier ${tier}`);
    };
    for (const setup of setups) {
      if (!RANK[setup.tier]) throw new Error(`food-web: ${node.id} setup ${setup.id} has unknown tier ${setup.tier}`);
      for (const id of [...(setup.only || []), ...(setup.exclude || [])]) if (!known.has(id)) throw new Error(`food-web: ${node.id} setup ${setup.id} names unknown playable ${id}`);
    }
    // Priority stages are numbered in order; a stage may share the rank of the one before it.
    let rank = 0;
    const priorities = (curated.priorities || []).map((entry, index) => {
      rank = entry.rank ?? rank + 1;
      checkTargets(entry, `${node.id} priority ${index + 1}`);
      return { ...entry, rank, kind: 'priority', q: cite(entry.quote, `${node.id} priority ${index + 1}`) };
    });
    const list = (key, kind) => (curated[key] || []).map((entry, index) => {
      checkTargets(entry, `${node.id} ${key} ${index + 1}`);
      return { ...entry, kind, q: cite(entry.quote, `${node.id} ${key} ${index + 1}`) };
    });
    const spec = { priorities, allow: list('allow', 'allowed'), last: list('last', 'last'), special: list('special', 'special'), never: list('never', 'never') };
    // Distinct stages (rank + label) become the branches of the mindmap.
    const stages = [];
    const stageKey = new Map();
    for (const entry of priorities) {
      const key = `${entry.rank}|${entry.label}`;
      if (!stageKey.has(key)) { stageKey.set(key, stages.length); stages.push({ rank: entry.rank, label: entry.label, setups: entry.setups || null }); }
      else if (stages[stageKey.get(key)].setups && entry.setups) stages[stageKey.get(key)].setups = [...new Set([...stages[stageKey.get(key)].setups, ...entry.setups])];
      else stages[stageKey.get(key)].setups = null;
      entry.stage = stageKey.get(key);
    }

    const edges = [];
    for (const target of nodes) {
      const ownKind = target.family === node.family;
      if (target.id === node.id) continue;
      const gate = reach(node, target);
      const per = setups.map(setup => {
        let verdict = evaluate(spec, node, target, setup);
        if (ownKind && !(verdict && verdict.entry && named(verdict.entry, target))) return null;
        if (!verdict) return null;
        const conditions = [];
        // A young-only rule never hides what applies to the adults: keep the stronger one, note the other.
        if (verdict.young) {
          const adult = evaluate(spec, node, target, setup, true);
          const youngText = verdict.entry.condition || 'nur Jungtiere';
          if (adult && HUNTABLE.has(adult.kind) && score(adult) < score(verdict)) {
            conditions.push(`Jungtiere: ${verdict.kind === 'priority' ? `Rang ${verdict.entry.rank}` : youngText}`);
            verdict = adult;
          } else if (adult?.kind === 'never') {
            conditions.push('Adulte: nie');
          } else if (adult && HUNTABLE.has(adult.kind)) {
            conditions.push(`Adulte: ${adult.kind === 'priority' ? `Rang ${adult.entry.rank}` : adult.kind === 'last' ? 'zuletzt' : adult.kind === 'special' ? 'Sondersituation' : 'freie Wahl'}`);
          }
        }
        const entry = verdict.entry;
        if (entry?.condition) conditions.unshift(entry.condition);
        if (entry?.conditions?.[target.id] || entry?.conditions?.[target.family]) conditions.unshift(entry.conditions[target.id] || entry.conditions[target.family]);
        const explicit = Boolean(entry && named(entry, target));
        if (gate === 'none' && !explicit) return null;
        let kind = verdict.kind;
        if ((gate === 'water' || gate === 'ground') && kind !== 'never') {
          const note = gate === 'water' && curated.shore ? curated.shore : REACH_NOTE[gate];
          if (kind === 'legal') { kind = 'special'; conditions.unshift(note); }
          else if (!conditions.length) conditions.push(note);
        }
        if (HUNTABLE.has(kind) && setup.single && matchesFilter(target, setup.single) && !entry?.young) conditions.push('nur einzelne Tiere');
        const out = { k: kind };
        if (kind === 'priority') { out.r = entry.rank; out.st = entry.stage; }
        if (entry && entry.kind !== 'priority' && entry.label) out.l = entry.label;
        if (entry) out.q = entry.q;
        if (conditions.length) out.c = [...new Set(conditions)];
        return out;
      });
      if (per.every(item => !item)) continue;
      // A setup that cannot take the target points at a setup that can: preferably one of at least
      // its size (a bigger group), otherwise another situation (from the water, with companions).
      // Special-purpose setups such as a sauropod mob simply do not hunt anything else ('out').
      const huntable = per.map(item => Boolean(item && HUNTABLE.has(item.k)));
      const resolved = per.map((item, index) => {
        if (item) return item;
        if (setups[index].only || setups[index].minTier) return { k: 'out' };
        const others = setups.map((setup, other) => ({ setup, other })).filter(({ other }) => other !== index && huntable[other]);
        const need = (others.find(({ setup }) => setup.size >= setups[index].size) || others[0])?.other ?? -1;
        return need >= 0 ? { k: 'locked', need } : { k: 'out' };
      });
      const shared = node.regions.filter(region => target.regions.includes(region)).length;
      edges.push({ t: target.id, per: resolved, contact: shared });
    }
    hunters[node.id] = {
      setups: setups.map(({ id, label, size, tier, with: companions, when, minTier, only }) => ({ id, label, size, tier, ...(companions ? { with: companions } : {}), ...(when ? { when } : {}), ...(minTier ? { minTier } : {}), ...(only ? { only } : {}) })),
      stages, notes: curated.notes || [], quotes, edges,
    };
  }

  for (const node of nodes) delete node.regions;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tiers: TIERS,
    levels,
    note: 'Ranks and exceptions come from verbatim profile quotes; every other edge is derived from the hunt ceiling of the setup and whether the habitat can be reached. Young-only rules are noted on the edge.',
    nodes: Object.fromEntries(nodes.map(node => [node.id, node])),
    hunters,
  };
}
