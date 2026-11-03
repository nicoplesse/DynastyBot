import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { airAt, buildClimate } from './climate.js';

const root = fileURLToPath(new URL('../../data/', import.meta.url));
const climate = JSON.parse(await readFile(join(root, 'processed', 'climate.json'), 'utf8'));
const map = JSON.parse(await readFile(join(root, 'processed', 'map.json'), 'utf8'));
const doc = JSON.parse(await readFile(join(root, 'reference', 'climate.json'), 'utf8'));
const zone = id => climate.zones.find(item => item.id === id);
const max = values => Math.max(...values);
const min = values => Math.min(...values);

test('every POI area is a zone and every landmark sits in one', () => {
  const areas = map.regions.filter(region => region.shape.type === 'polygon' && !region.within).map(region => region.id);
  assert.deepEqual(climate.zones.map(item => item.id).sort(), areas.sort());
  const points = map.regions.filter(region => region.shape.type === 'point').map(region => region.id);
  assert.deepEqual(climate.zones.flatMap(item => item.spots.map(spot => spot.id)).sort(), points.sort());
  assert.ok(zone('redwoods').spots.some(spot => spot.id === 'dark-falls'), 'a landmark just outside the outlines goes to the nearest area');
});

test('the air follows the curated daily max and min: lowest at sunrise, highest in the afternoon', () => {
  const frame = { sunrise: 6, sunset: 18.5 };
  const day = { max: 39, min: 18, peak: 2.5, cool: 2.2 };
  assert.equal(Math.round(airAt(6, day, frame) * 10) / 10, 18);
  assert.ok(Math.abs(airAt(12.25 + 2.5, day, frame) - 39) < 0.01, 'the peak comes 2.5 h after solar noon');
  assert.ok(airAt(22, day, frame) > airAt(4, day, frame), 'the night keeps cooling until sunrise');
  for (const item of climate.zones) {
    for (const season of climate.seasons) {
      const [top, low] = doc.zones[item.id][season.id];
      const air = item.seasons[season.id].air;
      assert.equal(air[6], low, `${item.id} ${season.id}: minimum at sunrise`);
      assert.ok(top - max(air) < 0.5, `${item.id} ${season.id}: maximum ${max(air)} near ${top}`);
      assert.ok(air.indexOf(max(air)) >= 13 && air.indexOf(max(air)) <= 15, `${item.id}: warmest hour in the afternoon`);
    }
  }
});

test('the rainy season swings less than the dry season', () => {
  for (const item of climate.zones) {
    const swing = season => max(item.seasons[season].air) - min(item.seasons[season].air);
    assert.ok(swing('rainy') <= swing('dry'), `${item.id}: rainy ${swing('rainy')} vs dry ${swing('dry')}`);
  }
});

test('ground: sand and lava rock get far hotter than the air, the forest floor stays near it', () => {
  const canyon = zone('dry-fang-canyon').seasons.dry;
  assert.ok(max(canyon.ground.sand) - max(canyon.air) > 15, 'open sand in the dry season');
  assert.ok(canyon.ground.rock[20] - canyon.air[20] > 5, 'rock gives its heat back in the evening');
  assert.ok(canyon.ground.sand[5] < canyon.air[5], 'sand cools below the air on a clear night');
  const lava = zone('volcano-islands').seasons.dry;
  assert.ok(max(lava.ground.basalt) > 50, 'dark lava rock in full sun');
  const redwoods = zone('redwoods').seasons.dry;
  const shade = redwoods.ground.litter[13] - redwoods.air[13];
  assert.ok(shade <= 0 && shade > -3, `deep shade keeps the redwood floor just below the air at midday (${shade})`);
  const deep = zone('dry-fang-canyon').seasons.dry.deep;
  assert.ok(max(deep) - min(deep) < max(canyon.ground.rock) - min(canyon.ground.rock), '10 cm down the daily wave is damped');
  assert.ok(deep.indexOf(max(deep)) > canyon.ground.rock.indexOf(max(canyon.ground.rock)), 'and arrives later');
  assert.equal(zone('abyssal-depths').seasons.dry.ground, null, 'open sea has no ground (water comes later)');
});

test('humidity, feels-like, wind and fog stay physical', () => {
  for (const item of climate.zones) {
    for (const season of climate.seasons) {
      const values = item.seasons[season.id];
      assert.ok(values.rh.every(value => value > 0 && value <= 100), `${item.id}: humidity in %`);
      assert.ok(values.wind.every(value => value > 0), `${item.id}: some wind`);
      const mean = values.wind.reduce((sum, value) => sum + value, 0) / 24;
      assert.ok(Math.abs(mean - doc.zones[item.id].wind * (season.id === 'rainy' ? 1.1 : 1)) < 1, `${item.id}: mean wind`);
      assert.ok(values.gust.every((gust, hour) => gust > values.wind[hour]), `${item.id}: gusts above the mean`);
      assert.ok(values.feelSun.every((sun, hour) => sun === null || sun >= values.feel[hour]), `${item.id}: sun feels warmer than shade`);
      assert.ok(values.feelSun.slice(0, 6).every(value => value === null), `${item.id}: no sun before sunrise`);
    }
  }
  assert.ok(zone('dry-fang-canyon').seasons.dry.feel[15] < zone('dry-fang-canyon').seasons.dry.air[15], 'dry heat feels cooler than it is');
  assert.ok(zone('twisted-forest').seasons.dry.feel[15] > zone('twisted-forest').seasons.dry.air[15], 'muggy forest air feels hotter');
  assert.ok(zone('stillwater-bog').seasons.dry.fog.includes(6), 'morning fog over the bog');
  assert.deepEqual(zone('dry-fang-canyon').seasons.dry.fog, [], 'no fog in the dry canyon');
  assert.equal(zone('kelp-vale').seasons.rainy.from.day, 'SE', 'the sea takes the season wind');
});

test('a zone without curated climate fails the build', () => {
  const regions = map.regions.filter(region => region.id !== 'helix-pond');
  const { ['dry-fang-canyon']: _, ...zones } = doc.zones;
  assert.throws(() => buildClimate(regions, { ...doc, zones, spots: Object.fromEntries(Object.entries(doc.spots).filter(([id]) => id !== 'helix-pond')) }), /dry-fang-canyon has no zone/);
  assert.throws(() => buildClimate(map.regions, { ...doc, zones: { ...doc.zones, redwoods: { ...doc.zones.redwoods, dry: [26, 15, 17] } } }), /dew point 17 is above/);
});

test('water follows the air the slower the deeper it is', () => {
  const swing = values => Math.max(...values) - Math.min(...values);
  const ocean = zone('abyssal-depths').seasons.dry.water;
  const pond = zone('dry-fang-canyon').spots.find(spot => spot.id === 'helix-pond').seasons.dry.water;
  assert.ok(swing(ocean.surface) < 0.5, `the open ocean barely moves (${swing(ocean.surface)})`);
  assert.ok(swing(pond.surface) > 3, `a shallow pond swings by several degrees (${swing(pond.surface)})`);
  assert.equal(ocean.deep, 15, 'Cretaceous deep water');
  const air = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const canyon = zone('dry-fang-canyon').seasons.dry;
  assert.ok(air(pond.surface) < air(canyon.air), 'evaporation keeps a desert pond below the air');
  const falls = zone('cliff-edge-falls').seasons.dry;
  assert.ok(air(falls.water.surface) < air(falls.air) - 2, 'falls bring cool water from above');
  const bog = zone('stillwater-bog');
  assert.equal(bog.body.stagnant, true);
  assert.ok(Math.max(...bog.seasons.dry.water.oxygen) < Math.max(...zone('redwoods').seasons.dry.water.oxygen), 'warm water holds less oxygen');
  assert.equal(zone('crag-bluffs').seasons.dry.water, null, 'no water body in the dry bluffs');
  assert.equal(zone('abyssal-depths').spots.find(spot => spot.id === 'scale-lake').body.salt, 'salt', 'a spot can override its water');
});

test('the shallow edge is warmer in the afternoon and colder at dawn than the deeper water', () => {
  const bog = zone('stillwater-bog').seasons.dry.water;
  assert.ok(bog.shallow[16] > bog.surface[16], 'afternoon: shallow water is the warm spot');
  assert.ok(bog.shallow[6] < bog.surface[6], 'dawn: the deeper water holds the warmth');
  assert.equal(zone('mudflats').seasons.dry.water.shallow, null, 'tidal water is shallow already');
});
