// Migration-route overview. Geometry comes from data/map/routes.json (route lines traced from
// every profile map, one layer per map and line colour); names, colours and the reference layer
// of each route from data/reference/migration-routes.json. Members are matched by overlap:
//   - full:    the playable's own map line covers the route's reference line,
//   - partial: the playable's line lies on part of the route (e.g. Argentinosaurus on the
//              western sauropod corridor),
//   - profile: named in the profile text only (`extra`).
// Per POI it lists the routes and the playables whose own line passes it, and for every
// carnivore the migrating playables its matchups count as prey, for the hunter view.

const TIER_RANK = { Tiny: 1, Small: 2, Medium: 3, Large: 4, Apex: 5, Giant: 6 };
const BAND_ORDER = ['severe', 'high', 'meaningful', 'moderate', 'conditional', 'low'];

function rawIdOf(profile) {
  return profile.variant?.parentId || profile.id;
}

export function routeMembers(route, layers, profilesByRaw, doc) {
  const reference = layers.find(layer => layer.key === route.layer);
  if (!reference) throw new Error(`migration route ${route.id}: unknown layer ${route.layer}`);
  const members = new Map();
  for (const layer of layers) {
    const full = layer.key === reference.key || (layer.covers?.[reference.key] ?? 0) >= doc.matchFull;
    const partial = !full && (reference.covers?.[layer.key] ?? 0) >= doc.matchPart;
    if (!full && !partial) continue;
    for (const profile of profilesByRaw.get(layer.profile) || []) {
      const usage = full ? 'full' : 'partial';
      const previous = members.get(profile.id);
      if (!previous || (previous.usage === 'partial' && usage === 'full')) members.set(profile.id, { id: profile.id, usage, layer: layer.key });
    }
  }
  for (const extra of route.extra || []) members.set(extra.id, { id: extra.id, usage: 'profile', layer: null, note: extra.note });
  return [...members.values()];
}

function playableSummary(profile) {
  const curve = profile.fullStats?.curves?.find(item => item.key === 'Core.CombatWeight');
  return {
    id: profile.id, name: profile.name, tier: profile.classification?.tier || null, diet: profile.classification?.diet || null,
    activity: profile.classification?.activity || null, habitat: profile.classification?.habitat || null,
    combatWeight: profile.stats?.combatWeight ?? curve?.effectiveValues?.at(-1) ?? null,
    animal: profile.analog?.analogs?.[0]?.animal || null,
  };
}

export function buildMigrationIndex(profiles, routeDoc, doc, regions) {
  if (!routeDoc?.layers?.length || !doc?.routes?.length) return null;
  const layers = routeDoc.layers;
  const byId = new Map(profiles.map(profile => [profile.id, profile]));
  const profilesByRaw = new Map();
  for (const profile of profiles) (profilesByRaw.get(rawIdOf(profile)) || profilesByRaw.set(rawIdOf(profile), []).get(rawIdOf(profile))).push(profile);
  const regionById = new Map(regions.map(region => [region.id, region]));
  const parentOf = id => regionById.get(id)?.within || id;

  const routes = doc.routes.map(route => {
    const reference = layers.find(layer => layer.key === route.layer);
    const members = routeMembers(route, layers, profilesByRaw, doc).filter(member => byId.has(member.id));
    return {
      id: route.id, name: route.name, de: route.de, color: route.color, note: route.note || '',
      source: { profile: reference.profile, image: reference.image, colour: reference.colour },
      layer: reference.file || null, lines: reference.lines, regions: reference.regions, landmarks: reference.landmarks, links: reference.edges,
      members: members.map(member => {
        const own = member.layer ? layers.find(layer => layer.key === member.layer) : null;
        // A partial member only passes the POIs its own line crosses.
        const passes = member.usage === 'partial' && own ? own.regions.filter(id => reference.regions.includes(id)) : reference.regions;
        return { ...member, name: byId.get(member.id).name, regions: passes, file: own?.file || null };
      }),
    };
  });

  // POI → routes and passing playables.
  const pois = {};
  for (const route of routes) {
    for (const id of route.regions) {
      const entry = pois[id] ||= { id, name: regionById.get(id)?.name || id, routes: [], playables: [] };
      entry.routes.push(route.id);
      for (const member of route.members) if (member.regions.includes(id) && !entry.playables.includes(member.id)) entry.playables.push(member.id);
    }
    for (const id of route.landmarks) {
      const entry = pois[id] ||= { id, name: regionById.get(id)?.name || id, routes: [], playables: [], landmark: true, within: null };
      if (!entry.routes.includes(route.id)) entry.routes.push(route.id);
    }
  }

  const migrants = new Set(routes.flatMap(route => route.members.map(member => member.id)));
  const playables = Object.fromEntries([...migrants].map(id => [id, { ...playableSummary(byId.get(id)), routes: routes.filter(route => route.members.some(member => member.id === id)).map(route => ({ id: route.id, usage: route.members.find(member => member.id === id).usage })) }]));

  // Hunter view: every carnivore with the migrating playables its matchups list as prey.
  const hunters = {};
  for (const profile of profiles) {
    if (profile.classification?.diet !== 'Carnivore') continue;
    // Legal prey by the profile's hunt tier (land hunters cannot reach the sea-going migrants);
    // the matchup assessment is added where the matchup lists name the pair.
    const huntTier = profile.matchups?.traits?.huntTier;
    if (!TIER_RANK[huntTier]) continue;
    const assessed = new Map([...(profile.matchups?.opportunities || []), ...(profile.matchups?.reserve?.opportunities || [])]
      .filter(item => item.intent?.allowed !== false).map(item => [item.id, item]));
    const reachesSea = /Aquatic|Aerial/.test(profile.classification?.habitat || '');
    const prey = [...migrants].filter(id => id !== profile.id).map(id => byId.get(id))
      .filter(target => TIER_RANK[target.classification?.tier] <= TIER_RANK[huntTier])
      .filter(target => reachesSea || !/^Aquatic/.test(target.classification?.habitat || ''))
      .map(target => ({ id: target.id, band: assessed.get(target.id)?.band || null, headline: assessed.get(target.id)?.headline || null }))
      .sort((a, b) => (a.band ? BAND_ORDER.indexOf(a.band) : 9) - (b.band ? BAND_ORDER.indexOf(b.band) : 9) || (byId.get(a.id).stats?.combatWeight ?? 0) - (byId.get(b.id).stats?.combatWeight ?? 0));
    const own = [...new Set((profile.map?.markers || []).filter(marker => marker.regionId && !marker.roles?.every(role => role === 'drinking' || role === 'neutral' || role === 'courtship'))
      .map(marker => parentOf(marker.regionId)))];
    hunters[profile.id] = { ...playableSummary(profile), huntTier, prey, pois: own };
  }

  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    note: 'Migration routes traced from the profile maps. Migrating, hunting and challenges are limited to active hours (server rule 1.4).',
    routes, pois, playables, hunters,
  };
}
