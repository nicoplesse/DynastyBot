import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyTemps, comfort, inWater, isActive } from '../../shared/thermo-comfort.mjs';
import { buildThermo } from './thermo.js';

const root = fileURLToPath(new URL('../../data/', import.meta.url));
const climate = JSON.parse(await readFile(join(root, 'processed', 'climate.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(root, 'processed', 'index.json'), 'utf8'));
const doc = JSON.parse(await readFile(join(root, 'reference', 'thermo.json'), 'utf8'));
const { playables } = climate.thermo;
const zone = id => climate.zones.find(item => item.id === id);

test('every playable has a thermo tier, an ordered comfort band and real home POIs', () => {
  assert.deepEqual(Object.keys(playables).sort(), catalog.profiles.map(item => item.id).sort());
  const zones = new Set(climate.zones.map(item => item.id));
  for (const [id, item] of Object.entries(playables)) {
    const [tooCold, cool, warm, tooHot] = item.band;
    assert.ok(tooCold < cool && cool < warm && warm < tooHot, `${id}: band ${item.band} is ordered`);
    assert.ok(warm - cool >= 6, `${id}: a comfortable range of at least 6 K`);
    for (const poi of [...item.home, ...item.route]) assert.ok(zones.has(poi), `${id}: ${poi} is a zone`);
  }
});

test('the tiers and the profiles shape the band', () => {
  assert.equal(playables['deinosuchus-shore'].tier, 'E');
  assert.ok(playables['deinosuchus-shore'].band[1] > playables.tyrannosaurus.band[1] + 5, 'an ectotherm needs far more warmth than a tyrannosaur');
  assert.ok(playables.yutyrannus.band[3] < playables.torvosaurus.band[3], 'heat-shy Yutyrannus is too hot sooner than heat-loving Torvosaurus');
  assert.ok(playables.yutyrannus.band[0] < playables.torvosaurus.band[0], 'and copes with cold better');
  assert.ok(playables.compsognathus.band[1] > playables.argentinosaurus.band[1], 'a tiny body needs more warmth than a giant');
  assert.ok(playables['megalania-arid'].band[3] > playables['megalania-temperate'].band[3], 'the arid Megalania takes more heat');
  assert.equal(playables.tylosaurus.aquatic, true, 'Tylosaurus waits for water temperature');
  assert.ok(playables.tyrannotitan.quotes.length >= 1 && playables.tyrannotitan.quotes.every(quote => quote.section), 'quotes carry their profile section');
});

test('active animals meet the open, resting ones their best refuge; only no refuge is dangerous', () => {
  const band = [10, 16, 28, 34];
  assert.deepEqual(comfort(band, { open: 22, shade: 20 }), { level: 'ok', best: 'ok', refuge: null, resting: false, side: null });
  assert.deepEqual(comfort(band, { open: 38, shade: 26 }), { level: 'hot', best: 'ok', refuge: 'shade', resting: false, side: 'heat' }, 'too hot out there, fine in the shade');
  assert.deepEqual(comfort(band, { open: 38, shade: 26, resting: true }), { level: 'ok', best: 'ok', refuge: 'shade', resting: true, side: 'heat' }, 'a resting animal lies in the shade');
  assert.deepEqual(comfort(band, { open: 40, shade: 36 }), { level: 'hot', best: 'hot', refuge: null, resting: false, side: 'heat' }, 'no refuge: dangerous');
  // Water is passed as the coolest and warmest water at hand, already as felt in the water.
  assert.equal(comfort(band, { open: 40, shade: 36, water: { cool: inWater(26, false), warm: inWater(26, false) } }).best, 'ok', '26 °C water cools an endotherm like 20 °C air');
  assert.equal(comfort(band, { open: 40, shade: 36, water: { cool: inWater(36, false), warm: inWater(36, false) } }).best, 'warm', 'bath-warm water helps less');
  assert.deepEqual(comfort(band, { open: 8, shade: 8, water: { cool: 20, warm: 20 }, ectotherm: true }), { level: 'cold', best: 'ok', refuge: 'water', resting: false, side: 'cold' }, 'a crocodile stays warm in the water at night');
  assert.equal(comfort(band, { open: 8, shade: 8, water: { cool: 20, warm: 20 } }).best, 'cold', 'water only keeps ectotherms warm');
  assert.equal(comfort(band, { open: 8, shade: 8, den: 22 }).best, 'cold', 'only ectotherms use dens');
  assert.deepEqual(comfort(band, { open: 8, shade: 8, den: 22, ectotherm: true }), { level: 'cold', best: 'ok', refuge: 'den', resting: false, side: 'cold' });
});

test('ectotherms are read on air, sun and ground; endotherms on the felt temperature', () => {
  const noon = { air: 39, feel: 34.5, feelSun: 41.2, ground: 50.5 };
  const lizard = bodyTemps(noon, true), giant = bodyTemps(noon, false);
  assert.equal(lizard.shade, 39, 'dry air is no milder for an animal that does not sweat');
  assert.ok(Math.abs(lizard.open - (39 + 6.7 + 0.3 * 11.5)) < 0.01, 'sun plus lying on hot rock');
  assert.equal(giant.shade, 34.5);
  assert.ok(lizard.open - giant.open > 6);
});

// The same reading as the temperature map (TemperatureView rate()).
const rateAt = (id, zoneId, season, hour) => {
  const me = playables[id], area = zone(zoneId), series = area.seasons[season], ectotherm = me.tier === 'E';
  const resting = !isActive(me.activity, hour + 0.5);
  if (me.aquatic) {
    if (!series.water || area.body?.salt === 'fresh') return null;
    return comfort(me.band, { open: series.water.surface[hour], shade: series.water.deep ?? series.water.surface[hour], ectotherm, resting });
  }
  const temps = bodyTemps({ air: series.air[hour], feel: series.feel[hour], feelSun: series.feelSun[hour], ground: series.ground ? series.ground[area.surfaces[0]][hour] : null }, ectotherm);
  const den = me.dens && series.deep ? series.deep.reduce((sum, value) => sum + value, 0) / 24 : null;
  const waters = me.water ? [series.water?.surface[hour], ...area.spots.map(spot => spot.seasons[season].water?.surface[hour])].filter(value => value != null) : [];
  const water = waters.length ? { cool: inWater(Math.min(...waters), ectotherm), warm: inWater(Math.max(...waters), ectotherm) } : null;
  return comfort(me.band, { ...temps, den, water, ectotherm, resting });
};

test('on the real map: a desert monitor rests out the canyon noon, basks in the morning and dens at night', () => {
  assert.deepEqual(rateAt('megalania-arid', 'dry-fang-canyon', 'dry', 14), { level: 'hot', best: 'ok', refuge: 'den', resting: false, side: 'heat' }, 'too hot out on 50 °C rock, fine in a den');
  assert.equal(rateAt('megalania-arid', 'dry-fang-canyon', 'dry', 8).level, 'ok', 'morning basking');
  assert.equal(rateAt('megalania-arid', 'black-fern-hills', 'dry', 3).refuge, 'den', 'a cold night is spent in a den');
});

test('on the real map: no home POI of Tyrannotitan or Megalania is ever dangerous in the dry season', () => {
  for (const id of ['tyrannotitan', 'megalania-arid', 'megalania-temperate']) {
    for (const poi of playables[id].home) {
      for (let hour = 0; hour < 24; hour += 1) {
        const rating = rateAt(id, poi, 'dry', hour);
        assert.ok(rating.best !== 'hot' && rating.best !== 'cold', `${id} at ${poi} ${hour}:00 has a refuge`);
      }
    }
  }
  assert.equal(rateAt('tyrannotitan', 'cedrus-forest', 'dry', 14).resting, true, 'Tyrannotitan sleeps through the hot day');
});

test('sea animals are rated on the sea: the open ocean suits Tylosaurus, the deep cools the lagoons', () => {
  assert.equal(rateAt('tylosaurus', 'abyssal-depths', 'dry', 14).level, 'ok', '26 °C open ocean');
  assert.equal(rateAt('tylosaurus', 'redwoods', 'dry', 14), null, 'no sea in the redwoods');
  assert.ok(rateAt('tylosaurus', 'stillwater-bog', 'dry', 14), 'the brackish inland waters the profile map gives Tylosaurus count');
  assert.equal(playables.leedsichthys.gills, true);
  const lagoon = rateAt('leedsichthys', 'palm-islands', 'dry', 16);
  assert.ok(lagoon.level === 'hot' || lagoon.level === 'warm', `29 °C lagoon water is too warm for a gill breather (${lagoon.level})`);
  assert.equal(rateAt('leedsichthys', 'abyssal-depths', 'dry', 16).level, 'ok');
  for (const id of ['tylosaurus', 'kaiwhekea', 'eurhinosaurus', 'leedsichthys']) {
    const sea = [...playables[id].home, ...playables[id].route].map(poi => rateAt(id, poi, 'dry', 14)).filter(Boolean);
    assert.ok(sea.length, `${id} has sea among its POIs and routes`);
    assert.ok(sea.every(rating => rating.best !== 'cold'), `${id}: no home sea is dangerously cold`);
  }
});

test('active hours follow the activity pattern', () => {
  assert.ok(isActive('Nocturnal', 2) && !isActive('Nocturnal', 13));
  assert.ok(isActive('Diurnal', 13) && !isActive('Diurnal', 2));
  assert.ok(isActive('Cathemeral', 4) && isActive(null, 4));
});

test('a playable without a curated entry or with a made-up quote fails the build', () => {
  const profile = { id: 'testosaurus', name: 'Testosaurus', stats: { combatWeight: 3000 }, classification: {}, quickView: ['Loves the sun.'], sections: [] };
  assert.throws(() => buildThermo([profile], doc), /testosaurus has no curated entry/);
  const withEntry = { ...doc, playables: { testosaurus: { tier: 'D', cover: 'scales', quotes: ['Hates the sun.'] } } };
  assert.throws(() => buildThermo([profile], withEntry), /quote is not in the testosaurus profile/);
  const ok = buildThermo([profile], { ...doc, playables: { testosaurus: { tier: 'D', cover: 'scales', quotes: ['Loves the sun.'] } } });
  assert.deepEqual(ok.playables.testosaurus.band, doc.tiers.D.band, 'the reference size leaves the tier band as it is');
});

test('the thermo compass knows what each land ectotherm aims for and where it may go', () => {
  for (const [id, item] of Object.entries(playables)) {
    if (item.tier === 'E' && !item.aquatic) assert.ok(item.ideal && item.ideal[0] < item.ideal[1], `${id}: ideal body range`);
    if (item.ideal) assert.ok(item.ideal[0] >= item.band[1] && item.ideal[1] <= item.band[2], `${id}: the ideal sits inside the comfortable band`);
  }
  assert.deepEqual(playables['deinosuchus-shore'].ideal, [30, 33], 'crocodiles aim for about 30 to 33 °C');
  assert.equal(playables['deinosuchus-shore'].smallPools, false, 'Deinosuchus does not enter small pools');
  assert.equal(playables.sarcosuchus.smallPools, true);
  assert.equal(playables.sarcosuchus.dens, false, 'crocodiles take to the water, not to dens');
  assert.equal(playables['megalania-arid'].dens, true, 'monitors dig');
  assert.ok(playables['megalania-arid'].ideal[0] > playables.sarcosuchus.ideal[0], 'monitors run warmer than crocodiles');
});
