// Temperature map: hourly air, feels-like, ground and wind for every POI area of the shared map,
// in the dry and the rainy season. The curated source data/reference/climate.json gives each area
// its daily air max/min (2 m, shade), dew point and mean wind; this module adds the physics:
// - air: the daily course after Parton & Logan (1981), a sine by day and exponential cooling by night;
// - ground surface: the air plus sun heating (less with wind, cloud and canopy) minus the night's
//   radiation loss, lagged by the surface's thermal inertia; 10 cm deep the same wave arrives
//   damped by e^(-z/d) and delayed (heat conduction);
// - humidity from the dew point (Magnus), feels-like after Steadman (1994) in the form of the
//   Australian Bureau of Meteorology (air, humidity, wind and, in the sun, radiation);
// - wind: the area's mean, shaped by daytime mixing or sea breeze and by calm or downslope nights.
// - water: each water body relaxes towards the air plus the sun with a lag set by its depth.

import { inside } from './poi-radar.js';

const STEP = 0.25;
const DEPTH = 10;
const LAG_PER_METRE = 38.7;
const WATER_SUN = 15;
const EVAPORATION = 0.15;
const HUMID_SPREAD = 6;
const SHALLOW_DEPTH = 0.3;
const SALT_DE = { salt: 'salzig', brackish: 'brackig', fresh: 'Süßwasser' };

// What the map shows about a water body besides its temperatures.
const describe = (body, de) => ({ de, salt: body.salt, saltDe: SALT_DE[body.salt], depth: body.depth, stagnant: Boolean(body.stagnant), deepDe: body.deep?.de || null, why: body.why || null });
const round = value => Math.round(value * 10) / 10;
const wrap = t => ((t % 24) + 24) % 24;
const hours = Array.from({ length: 24 }, (_, hour) => hour);

export const sunFraction = (t, { sunrise, sunset }) => {
  const h = wrap(t);
  return h > sunrise && h < sunset ? Math.sin(Math.PI * (h - sunrise) / (sunset - sunrise)) : 0;
};

// Parton & Logan: the air rises on a sine from sunrise to its peak (solar noon + peak hours) and
// falls exponentially through the night, reaching the minimum again at sunrise.
export function airAt(t, { max, min, peak, cool }, { sunrise, sunset }) {
  const day = sunset - sunrise;
  const dayTemp = m => min + (max - min) * Math.sin(Math.PI * m / (day + 2 * peak));
  const h = wrap(t);
  if (h >= sunrise && h <= sunset) return dayTemp(h - sunrise);
  const x = (h > sunset ? h - sunset : h + 24 - sunset) / (24 - day);
  return min + (dayTemp(day) - min) * (Math.exp(-cool * x) - Math.exp(-cool)) / (1 - Math.exp(-cool));
}

// Saturation vapour pressure in hPa (Magnus, the coefficients of the BoM apparent temperature).
const vapour = t => 6.105 * Math.exp(17.27 * t / (237.7 + t));

// Relative wind over the day: calm or downslope nights, mixing or sea breeze in the afternoon.
// Scaled so the day's mean is 1.
function windShape(exposure, { sunrise, sunset }) {
  const start = sunrise + 1.5, end = sunset + 1.5;
  const raw = t => {
    const h = wrap(t);
    const lift = h > start && h < end ? Math.sin(Math.PI * (h - start) / (end - start)) : 0;
    return exposure.wind.night + (exposure.wind.day - exposure.wind.night) * lift;
  };
  let sum = 0;
  for (let t = 0; t < 24; t += STEP) sum += raw(t);
  const mean = sum / (24 / STEP);
  return t => raw(t) / mean;
}

// Surface temperature: relaxes towards air + sun heating − radiation loss with the surface's
// thermal inertia; three days are run so the third is the settled daily cycle.
function surfaceSeries({ air, wind, surface, canopy, geothermal, season, frame }) {
  const follow = 1 - Math.exp(-STEP / surface.lag);
  const out = [];
  let temp = air(0);
  for (let t = 0; t < 72; t += STEP) {
    if (t >= 48 && Number.isInteger(t)) out.push(temp);
    const ms = wind(t) / 3.6;
    const sun = sunFraction(t, frame);
    const heat = sun * ((1 - canopy) * surface.sun * season.cloud.day * (4 / 3) / (1 + ms / 6) - canopy * 2);
    const dark = Math.max(0, 1 - sun * 3);
    const loss = dark * surface.night * (1 - 0.8 * canopy) * season.cloud.night * (4 / 3) / (1 + ms / 3);
    temp += (air(t) + heat - loss + geothermal - temp) * follow;
  }
  return out;
}

// The daily wave 10 cm down: damped by e^(-z/d) and late by z/d radians.
function deepSeries(series, damping) {
  const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
  const ratio = Math.exp(-DEPTH / damping);
  const lag = (DEPTH / damping) * 24 / (2 * Math.PI);
  const at = t => {
    const h = wrap(t), low = Math.floor(h), share = h - low;
    return series[low % 24] * (1 - share) + series[(low + 1) % 24] * share;
  };
  return hours.map(hour => mean + (at(hour - lag) - mean) * ratio);
}

// Everything for one place in one season; `shift` carries a spot's changes against its zone.
function place({ zone, exposure, season, seasonIndex, frame, doc, shift = null, body = null }) {
  const [max, min, dewPoint] = zone[season.id];
  const zoneAir = t => airAt(t, { max, min, peak: exposure.peak, cool: exposure.cool * season.cooling }, frame);
  const air = shift ? t => { const sun = sunFraction(t, frame); return zoneAir(t) + shift.air[0] * sun + shift.air[1] * (1 - sun); } : zoneAir;
  const shape = windShape(exposure, frame);
  const wind = t => zone.wind * season.windScale * (shift?.wind ?? 1) * shape(t);
  const canopy = shift?.canopy ?? zone.canopy ?? 0;
  const surfaces = shift ? [shift.surface] : zone.surfaces;
  const result = { air: [], dew: [], rh: [], feel: [], feelSun: [], wind: [], gust: [], fog: [] };
  for (const hour of hours) {
    const t = air(hour), ms = wind(hour) / 3.6;
    const dew = Math.min(dewPoint + (shift?.dew ?? 0), t);
    const e = vapour(dew);
    const q = season.sunLoad * sunFraction(hour, frame) * (1 - canopy);
    result.air.push(round(t));
    result.dew.push(round(dew));
    result.rh.push(Math.round(100 * e / vapour(t)));
    result.feel.push(round(t + 0.33 * e - 0.7 * ms - 4));
    result.feelSun.push(q > 0 ? round(t + 0.348 * e - 0.7 * ms + 0.7 * q / (ms + 10) - 4.25) : null);
    result.wind.push(round(wind(hour)));
    result.gust.push(round(wind(hour) * (exposure.gust + season.gustBonus)));
    // Fog or heavy dew: the air near its dew point and too little wind to mix it away.
    if (t - dew <= 1.5 && wind(hour) < 10) result.fog.push(hour);
  }
  result.ground = Object.fromEntries(surfaces.map(id => [id, surfaceSeries({ air, wind, surface: doc.surfaces[id], canopy, geothermal: zone.geothermal || 0, season, frame }).map(round)]));
  const first = surfaces[0];
  result.deep = first ? deepSeries(result.ground[first], doc.surfaces[first].damping).map(round) : null;
  if (!first) result.ground = null;
  result.water = body ? waterOf({ air, body, season, seasonIndex, canopy, frame, dew: dewPoint + (shift?.dew ?? 0) }) : null;
  return result;
}

// Water relaxes towards the air's daily wave plus the sun on its surface, around a daily mean of
// the air's mean plus the body's offset (sun, evaporation, inflow). The deeper, the slower:
// c·ρ·h / K with K ≈ 30 W/m²K is about 39 hours per metre, so a pond follows within hours and the
// sea within weeks. Eight days are run so the last one is the settled cycle.
function waterOf({ air, body, season, seasonIndex, canopy, frame, dew }) {
  const pick = value => Array.isArray(value) ? value[seasonIndex] : value;
  let airSum = 0, sunSum = 0;
  for (let t = 0; t < 24; t += STEP) { airSum += air(t); sunSum += sunFraction(t, frame); }
  const airMean = airSum / (24 / STEP), sunMean = sunSum / (24 / STEP);
  // Dry air draws heat out by evaporation: beyond a humid spread of 6 K every degree between air
  // and dew point cools the water by 0.15 K (a desert pond stays well below the air).
  const mean = airMean + pick(body.offset) - EVAPORATION * Math.max(0, airMean - dew - HUMID_SPREAD);
  const relax = depth => {
    const follow = 1 - Math.exp(-STEP / Math.max(0.5, depth * LAG_PER_METRE));
    const out = [];
    let temp = mean;
    for (let t = 0; t < 24 * 8; t += STEP) {
      if (t >= 24 * 7 && Number.isInteger(t)) out.push(temp);
      const force = air(t) - airMean + WATER_SUN * season.cloud.day * (1 - canopy) * (sunFraction(t, frame) - sunMean);
      temp += (mean + force - temp) * follow;
    }
    return out;
  };
  const surface = relax(body.depth);
  // The shallow edge (about 30 cm) of a deeper body: sun-warm by day, quick to cool at night.
  const shallow = body.depth > SHALLOW_DEPTH * 2 ? relax(SHALLOW_DEPTH).map(round) : null;
  const deep = body.deep ? round(body.deep.temp ? pick(body.deep.temp) : mean + body.deep.offset) : null;
  return { surface: surface.map(round), shallow, deep, oxygen: surface.map(value => round(oxygen(value, body.salt))) };
}

// Oxygen the water can hold at saturation (mg/l, the usual polynomial for fresh water at sea
// level); sea water holds about a fifth less, brackish water a tenth.
const oxygen = (t, salt) => (14.62 - 0.3898 * t + 0.006969 * t ** 2 - 0.00005897 * t ** 3) * (salt === 'salt' ? 0.81 : salt === 'brackish' ? 0.9 : 1);

function checkWater(body, id, fail) {
  if (!SALT_DE[body.salt]) fail(`${id}: water salt must be salt, brackish or fresh`);
  if (!(body.depth > 0)) fail(`${id}: water depth must be above 0`);
  if (body.deep && body.deep.temp == null && body.deep.offset == null) fail(`${id}: a deep layer needs temp or offset`);
}

function check(doc, areas, points) {
  const fail = message => { throw new Error(`climate: ${message}`); };
  for (const area of areas) if (!doc.zones[area.id]) fail(`POI area ${area.id} has no zone`);
  for (const [id, zone] of Object.entries(doc.zones)) {
    if (!areas.some(area => area.id === id)) fail(`zone ${id} is not a POI area`);
    if (!doc.exposures[zone.exposure]) fail(`${id}: unknown exposure ${zone.exposure}`);
    for (const surface of zone.surfaces) if (!doc.surfaces[surface]) fail(`${id}: unknown surface ${surface}`);
    for (const season of doc.seasons) {
      const [max, min, dew] = zone[season.id] || [];
      if (!(max > min)) fail(`${id}: ${season.id} max must be above min`);
      if (dew > min) fail(`${id}: ${season.id} dew point ${dew} is above the night minimum ${min}`);
    }
    if (zone.waterBody) checkWater(zone.waterBody, id, fail);
  }
  for (const [id, kind] of Object.entries(doc.spotKinds)) if (kind.water) checkWater({ salt: 'fresh', ...kind.water }, `spot kind ${id}`, fail);
  for (const point of points) if (!doc.spots[point.id]) fail(`landmark ${point.id} has no spot entry`);
  for (const [id, spot] of Object.entries(doc.spots)) {
    if (!points.some(point => point.id === id)) fail(`spot ${id} is not a landmark of the map`);
    if (!doc.spotKinds[spot.kind]) fail(`${id}: unknown spot kind ${spot.kind}`);
    if (spot.water && !doc.spotKinds[spot.kind].water) fail(`${id}: water override on a ${spot.kind} spot without water`);
    if (spot.water) checkWater({ salt: 'fresh', ...doc.spotKinds[spot.kind].water, ...spot.water }, id, fail);
  }
}

// Distance from a point to an area's outline (0 inside); landmarks just outside every outline
// (Dark Falls, Stonebed Shallows) belong to the nearest area.
function distance([x, y], points) {
  if (inside([x, y], points)) return 0;
  let best = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i];
    const length = (bx - ax) ** 2 + (by - ay) ** 2;
    const share = length ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length)) : 0;
    best = Math.min(best, Math.hypot(x - ax - share * (bx - ax), y - ay - share * (by - ay)));
  }
  return best;
}

export function buildClimate(regions, doc) {
  if (!doc) return null;
  const areas = regions.filter(region => region.shape.type === 'polygon' && !region.within);
  const points = regions.filter(region => region.shape.type === 'point');
  check(doc, areas, points);
  const home = new Map(points.map(point => {
    const at = [point.shape.x, point.shape.y];
    return [point.id, areas.reduce((best, area) => distance(at, area.shape.points) < distance(at, best.shape.points) ? area : best).id];
  }));
  const frame = doc.frame;
  const direction = (value, season) => value === 'prevailing' ? season.prevailing : value;
  const zones = areas.map(area => {
    const zone = doc.zones[area.id];
    const exposure = doc.exposures[zone.exposure];
    const spots = points.filter(point => home.get(point.id) === area.id).map(point => {
      const spot = doc.spots[point.id];
      const kind = doc.spotKinds[spot.kind];
      const shift = { air: kind.air, dew: kind.dew, wind: kind.wind, surface: kind.surface, canopy: kind.canopy };
      const body = kind.water ? { salt: 'fresh', ...kind.water, ...spot.water } : null;
      return {
        id: point.id, name: point.name, kind: spot.kind, kindDe: kind.de, surface: kind.surface, note: spot.note || kind.note, water: Boolean(body),
        body: body && describe(body, kind.de),
        seasons: Object.fromEntries(doc.seasons.map((season, seasonIndex) => {
          const values = place({ zone, exposure, season, seasonIndex, frame, doc, shift, body });
          return [season.id, { air: values.air, rh: values.rh, feel: values.feel, ground: values.ground[kind.surface], wind: values.wind, fog: values.fog, water: values.water }];
        })),
      };
    });
    const body = zone.waterBody || null;
    // Open water to cool off in: the area's own water body, a sea or freshwater landscape, or a
    // pond, lake, river or falls inside.
    const water = Boolean(body) || (area.ecosystems || []).some(id => id === 'sea' || id === 'freshwater') || spots.some(spot => spot.water);
    return {
      id: area.id, name: area.name, ecosystems: area.ecosystems || [], exposure: zone.exposure, exposureDe: exposure.de, water,
      body: body && describe(body, body.de),
      surfaces: zone.surfaces, canopy: zone.canopy || 0, geothermal: zone.geothermal || 0, why: zone.why,
      seasons: Object.fromEntries(doc.seasons.map((season, seasonIndex) => [season.id, {
        ...place({ zone, exposure, season, seasonIndex, frame, doc, body }),
        from: { day: direction(zone.from.day, season), night: direction(zone.from.night, season) },
      }])),
      spots,
    };
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Hourly values (index = hour 0–23) per POI area and season. air = 2 m shade air °C, feel/feelSun = apparent temperature in shade/sun (Steadman, BoM), ground = surface °C per surface type, deep = 10 cm under the first surface, rh = %, wind/gust = km/h, fog = hours with fog or heavy dew, from = wind direction by day/night, water = surface °C (the mixed body), shallow edge °C, deep layer °C and oxygen at saturation (mg/l) of the water body of the area or spot.',
    frame: { ...frame, windDay: [frame.sunrise + 2, frame.sunset + 1], depthCm: DEPTH },
    seasons: doc.seasons.map(season => ({ id: season.id, de: season.de, note: season.note, prevailing: season.prevailing })),
    surfaces: Object.fromEntries(Object.entries(doc.surfaces).map(([id, surface]) => [id, surface.de])),
    zones,
  };
}
