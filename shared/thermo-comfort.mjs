// How a playable fares at one place and hour, shared by the server tests and the temperature map.
// An active animal is out in the open: sun by day and the ground it stands or lies on. A resting
// animal lies in the best spot it has. Shade and water are refuges: they turn "too hot out there"
// into an ordinary midday rest, and only a place with no refuge at all is dangerous.

export const LEVELS = ['cold', 'cool', 'ok', 'warm', 'hot'];
const DISTANCE = { cold: 2, cool: 1, ok: 0, warm: 1, hot: 2 };

// band = [too cold below, cool below, warm above, too hot above] in °C.
export function levelOf(band, value) {
  const [tooCold, cool, warm, tooHot] = band;
  return value > tooHot ? 'hot' : value > warm ? 'warm' : value < tooCold ? 'cold' : value < cool ? 'cool' : 'ok';
}

// Temperatures the body meets. Endotherms are read on the felt temperature: they cool by panting
// or evaporation, so humidity and wind count. Ectotherms do not sweat and take on their
// surroundings, so they are read on the air plus the sun and far more of the ground they lie on.
export function bodyTemps({ air, feel, feelSun = null, ground = null }, ectotherm) {
  const sun = feelSun == null ? 0 : feelSun - feel;
  const contact = ground == null ? 0 : (ground - air) * (ectotherm ? 0.3 : 0.1);
  const base = ectotherm ? air : feel;
  return { open: base + sun + contact, shade: base };
}

// What lying in water of `temperature` feels like. An ectotherm takes on the water's temperature.
// For an endotherm water draws heat about 25 times faster than air, so neutral water is roughly
// 6 K warmer than neutral air: 28 °C water cools like 22 °C air.
export const inWater = (temperature, ectotherm) => ectotherm ? temperature : temperature - 6;

// level = what the animal meets now (in the open when active, its best spot when resting);
// best = the best it can reach here; refuge = what makes that better (shade, den or water).
// den = a burrow or rock crevice, about the ground's daily mean; only ectotherms use it (monitors
// and crocodiles dig dens against midday heat and cold nights).
// water = the coolest and the warmest water at hand, already as inWater() values, for those that
// use water: the coolest takes the heat off, the warmest keeps an ectotherm warm at night.
export function comfort(band, { open, shade, den = null, water = null, ectotherm = false, resting = false }) {
  const outside = levelOf(band, open);
  let best = outside;
  let refuge = null;
  const offer = (level, why) => { if (DISTANCE[level] < DISTANCE[best]) { best = level; refuge = why; } };
  const burrow = ectotherm && den != null;
  if (outside === 'hot' || outside === 'warm') {
    offer(levelOf(band, shade), 'shade');
    if (burrow) offer(levelOf(band, den), 'den');
    if (water) offer(levelOf(band, water.cool), 'water');
  } else if (outside === 'cold' || outside === 'cool') {
    if (burrow) offer(levelOf(band, den), 'den');
    if (water && ectotherm) offer(levelOf(band, water.warm), 'water');
  }
  const side = outside === 'hot' || outside === 'warm' ? 'heat' : outside === 'ok' ? null : 'cold';
  return { level: resting ? best : outside, best, refuge, resting, side };
}

// Hours a playable is up and about; outside them it rests (rule 1.4 limits hunting to these).
export const ACTIVE_HOURS = {
  Diurnal: [[6, 19.5]],
  Nocturnal: [[18, 24], [0, 7]],
  Crepuscular: [[4.5, 8.5], [16.5, 20.5]],
  Cathemeral: [[0, 24]],
};

export function isActive(activity, hour) {
  const h = ((hour % 24) + 24) % 24;
  return (ACTIVE_HOURS[activity] || ACTIVE_HOURS.Cathemeral).some(([from, to]) => h >= from && h < to);
}
