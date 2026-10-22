// POI radar: for every POI area of the shared map, who lives there (the profile map's POIs) and
// who only passes through (migration routes), plus what each playable needs to judge a hunt or
// a threat on the spot: speeds, combat weights per stage, clamp capacity and the pair verdicts
// from the matchup model. Ranks and "never" stay in foodweb.json; the browser joins the two and
// runs the fights with shared/combat-sim.mjs for the chosen solo/group setup.

import { clampAbility } from './clamps.js';

function inside([x, y], points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function curveValues(profile, key) {
  const curve = profile.fullStats?.curves?.find(item => item.key === key);
  return (curve?.effectiveValues || []).map((value, index) => value ?? curve.baseValues?.[index] ?? null);
}

const speed = mode => mode?.sprint ? [mode.sprint, Math.round(mode.sprintDurationSeconds || 0)] : null;

export function buildPoiRadar(profiles, { regions, migration, hunts }) {
  const areas = regions.filter(region => region.shape.type === 'polygon' && !region.within);
  // Territories drawn inside an area count for it; landmarks (points) for the area around them.
  const areaOf = new Map();
  for (const region of regions) {
    if (region.shape.type === 'polygon') areaOf.set(region.id, region.within || region.id);
    else areaOf.set(region.id, areas.find(area => inside([region.shape.x, region.shape.y], area.shape.points))?.id || null);
  }
  const route = new Map();
  for (const item of migration?.routes || []) {
    for (const member of item.members) {
      const set = route.get(member.id) || route.set(member.id, new Set()).get(member.id);
      for (const id of [...member.regions, ...(member.usage === 'partial' ? [] : item.landmarks)]) if (areaOf.get(id)) set.add(areaOf.get(id));
    }
  }

  const dinos = {};
  for (const profile of profiles) {
    const home = new Set((profile.map?.markers || []).map(marker => marker.regionId && areaOf.get(marker.regionId)).filter(Boolean));
    const passes = [...(route.get(profile.id) || [])].filter(id => !home.has(id));
    const ability = clampAbility(profile);
    dinos[profile.id] = {
      name: profile.name, tier: profile.classification.tier, diet: profile.classification.diet,
      activity: profile.classification.activity, habitat: profile.classification.habitat,
      land: speed(profile.speed?.land), water: speed(profile.speed?.water), air: speed(profile.speed?.air),
      cw: curveValues(profile, 'Core.CombatWeight'),
      clamp: ability ? { ability, capacity: curveValues(profile, 'Core.CarryCapacity').at(-1) } : null,
      home: [...home], route: passes,
    };
  }
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    note: 'Home = the POIs on the profile map; route = POIs a migration route of the playable passes. Pairs: a = hunt legal, e = named by a profile rule, c = only under a condition, v = pursuit verdict, m = speed margin in %.',
    areas: areas.map(area => ({ id: area.id, name: area.name, ecosystems: area.ecosystems || [], landmarks: regions.filter(region => region.shape.type !== 'polygon' && areaOf.get(region.id) === area.id).map(region => region.name) })),
    dinos, pairs: hunts.pairs, cards: hunts.cards,
  };
}
