import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { gameHour, realTimeOf } from '../../shared/game-clock.mjs';
import { bodyTemps, comfort, inWater, isActive, levelOf, type Comfort, type ComfortLevel } from '../../shared/thermo-comfort.mjs';
import { api, type Catalog, type CatalogItem, type ClimateIndex, type ClimateSeries, type ClimateZone, type MapRegion, type PlayMode, type ThermoPlayable, type WorldMap } from './api';
import { DinoAvatar as Avatar } from './DinoAvatar';
import { herdApi, isDeceased, type HerdDino } from './herd';
import { usePlayMode } from './PlayMode';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './temperature.css';

// Temperature map: every POI area is a climate zone with hourly air, feels-like, ground and wind
// for the dry and the rainy season (server/src/climate.js). The time of day runs on the timeline,
// with the mouse wheel over the map or as a time lapse; hover a zone for the details, the 24-hour
// course and its microclimates. The wind is estimated, not set by the user.
// Pick a playable and the map rates every zone for it (server/src/thermo.js +
// shared/thermo-comfort.mjs): too cold … too hot, with a day strip for its own POIs.

type Metric = 'air' | 'feel' | 'ground' | 'wind' | 'water' | 'comfort';
type Area = MapRegion & { shape: Extract<MapRegion['shape'], { type: 'polygon' }> };
type Frame = ClimateIndex['frame'];
type Rating = (Comfort & { open: number; shade: number; den: number | null; waterCool: number | null; waterWarm: number | null; where: 'land' | 'sea' }) | null;

const SEASON_KEY = 'dynasty.temperature.season';
const METRIC_KEY = 'dynasty.temperature.metric';
const TINT_KEY = 'dynasty.temperature.tint';
const ME_KEY = 'dynasty.temperature.me';
const HERE_KEY = 'dynasty.temperature.here';
const LIVE_KEY = 'dynasty.temperature.live';
const STEP = 0.25;
const WHEEL_PX = 50;

const METRICS: { id: Metric; de: string; title: string }[] = [
  { id: 'air', de: 'Luft', title: 'Lufttemperatur in 2 m Höhe im Schatten' },
  { id: 'feel', de: 'Gefühlt', title: 'Gefühlte Temperatur im Schatten: Luft, Feuchte und Wind' },
  { id: 'ground', de: 'Boden', title: 'Oberfläche des Hauptuntergrunds der Zone' },
  { id: 'wind', de: 'Wind', title: 'Mittlerer Wind in km/h, von uns geschätzt' },
  { id: 'water', de: 'Wasser', title: 'Wassertemperatur an der Oberfläche' },
  { id: 'comfort', de: 'Komfort', title: 'Wie sich die Zone für dein Playable anfühlt' },
];
const QUICK: { label: string; time: number }[] = [
  { label: 'Morgengrauen', time: 5.5 }, { label: 'Vormittag', time: 10 }, { label: 'Mittag', time: 14 }, { label: 'Abend', time: 19.5 }, { label: 'Mitternacht', time: 0 },
];
// Diverging around a comfortable 22 °C: blue arm for cool, red arm for heat (ground reaches 60+).
const HEAT: [number, string][] = [[8, '#184f95'], [14, '#3987e5'], [19, '#86b6ef'], [22, '#9a9a92'], [27, '#f2b38f'], [33, '#e8794f'], [40, '#d4423a'], [50, '#a3202e'], [62, '#6e1238']];
// One hue for wind: calm recedes into the dark map, strong wind stands out.
const BREEZE: [number, string][] = [[0, '#2a2550'], [10, '#4a3fa8'], [20, '#6250d6'], [30, '#9085e9'], [45, '#d6d0fb']];
// Comfort: the same blue/red poles; "angenehm" leaves the map as it is.
const LEVEL: Record<ComfortLevel, { de: string; glyph: string; colour: string }> = {
  cold: { de: 'zu kalt', glyph: '▼▼', colour: '#256abf' },
  cool: { de: 'kühl', glyph: '▼', colour: '#86b6ef' },
  ok: { de: 'angenehm', glyph: '✓', colour: '#3f5243' },
  warm: { de: 'warm', glyph: '▲', colour: '#eda100' },
  hot: { de: 'zu heiß', glyph: '▲▲', colour: '#e34948' },
};
const LEVEL_ORDER: ComfortLevel[] = ['cold', 'cool', 'ok', 'warm', 'hot'];
const REFUGE_DE: Record<string, string> = { shade: 'Schatten', den: 'Bau oder Felsspalte', water: 'Wasser' };
type Look = { key: string; de: string; glyph: string; colour: string; strength: 'none' | 'mild' | 'refuge' | 'danger' };
// How a rating shows: too hot or cold out in the open with a refuge at hand is an ordinary rest
// (orange/blue); only a place with no refuge at all is dangerous (strong red/blue).
function look(rating: NonNullable<Rating>): Look {
  const { level, best } = rating;
  if (level === 'ok') return { key: 'ok', de: 'angenehm', glyph: '✓', colour: LEVEL.ok.colour, strength: 'none' };
  if (level === 'warm' || level === 'cool') return { key: level, de: LEVEL[level].de, glyph: LEVEL[level].glyph, colour: LEVEL[level].colour, strength: 'mild' };
  if (best === level) return level === 'hot'
    ? { key: 'hot', de: 'gefährlich heiß', glyph: '▲▲', colour: '#e34948', strength: 'danger' }
    : { key: 'cold', de: 'gefährlich kalt', glyph: '▼▼', colour: '#184f95', strength: 'danger' };
  return level === 'hot'
    ? { key: 'hot-refuge', de: rating.where === 'sea' ? 'oben zu warm' : 'zu heiß draußen', glyph: '▲⌂', colour: '#e8794f', strength: 'refuge' }
    : { key: 'cold-refuge', de: 'zu kalt draußen', glyph: '▼⌂', colour: '#3987e5', strength: 'refuge' };
}
const LOOK_KEY: Look[] = [
  { key: 'ok', de: 'angenehm', glyph: '✓', colour: LEVEL.ok.colour, strength: 'none' },
  { key: 'warm', de: 'warm / kühl', glyph: '▲', colour: LEVEL.warm.colour, strength: 'mild' },
  { key: 'hot-refuge', de: 'zu heiß / kalt draußen, Rückzug hilft', glyph: '▲⌂', colour: '#e8794f', strength: 'refuge' },
  { key: 'hot', de: 'gefährlich, kein Rückzug', glyph: '▲▲', colour: '#e34948', strength: 'danger' },
];
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const ACTIVITY_DE: Record<string, string> = { Diurnal: 'tagaktiv', Nocturnal: 'nachtaktiv', Cathemeral: 'tag & nacht aktiv', Crepuscular: 'dämmerungsaktiv' };
const COMPASS: Record<string, { de: string; angle: number }> = {
  N: { de: 'Nord', angle: 0 }, NE: { de: 'Nordost', angle: 45 }, E: { de: 'Ost', angle: 90 }, SE: { de: 'Südost', angle: 135 },
  S: { de: 'Süd', angle: 180 }, SW: { de: 'Südwest', angle: 225 }, W: { de: 'West', angle: 270 }, NW: { de: 'Nordwest', angle: 315 },
};
const BEAUFORT: [number, string][] = [[1, 'Windstille'], [6, 'leiser Zug'], [12, 'leichte Brise'], [20, 'schwache Brise'], [29, 'mäßige Brise'], [39, 'frische Brise'], [50, 'starker Wind'], [62, 'steifer Wind'], [75, 'stürmischer Wind'], [89, 'Sturm'], [Infinity, 'schwerer Sturm']];

function readStore<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* per-viewer convenience only */ }
}

const wrap = (t: number) => ((t % 24) + 24) % 24;
const polygon = (area: Area) => area.shape.points.map(([x, y]) => `${x},${y}`).join(' ');
const anchorOf = (area: Area) => area.anchor || { x: area.shape.points.reduce((s, p) => s + p[0], 0) / area.shape.points.length, y: area.shape.points.reduce((s, p) => s + p[1], 0) / area.shape.points.length };
const clock = (t: number) => { const minutes = Math.round(wrap(t) * 60) % 1440; return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
const deg = (value: number | null) => value == null ? '–' : `${Math.round(value)}°`;
const decimal = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const kmh = (value: number | null) => value == null ? '–' : `${Math.round(value)} km/h`;
const beaufort = (value: number) => { const index = BEAUFORT.findIndex(([limit]) => value < limit); return { force: index, de: BEAUFORT[index][1] }; };

// Linear between the hourly values, wrapping over midnight.
function at(series: (number | null)[], t: number): number | null {
  const h = wrap(t), low = Math.floor(h), share = h - low;
  const a = series[low % 24], b = series[(low + 1) % 24];
  if (a == null || b == null) return share < 0.5 ? a : b;
  return a + (b - a) * share;
}

function colour(stops: [number, string][], value: number) {
  if (value <= stops[0][0]) return stops[0][1];
  const index = stops.findIndex(([limit]) => value < limit);
  if (index < 0) return stops[stops.length - 1][1];
  const [lo, from] = stops[index - 1], [hi, to] = stops[index];
  const share = (value - lo) / (hi - lo);
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map(i => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * share)).join(',')})`;
}
const tone = (metric: Metric, value: number) => colour(metric === 'wind' ? BREEZE : HEAT, value);

// Sun height as a sine: 1 at solar noon, 0 at sunrise/sunset, negative through the night.
function elevation(t: number, { sunrise, sunset }: Frame) {
  const h = wrap(t), day = sunset - sunrise;
  if (h >= sunrise && h <= sunset) return Math.sin(Math.PI * (h - sunrise) / day);
  return -Math.sin(Math.PI * (h > sunset ? h - sunset : h + 24 - sunset) / (24 - day));
}
function phase(t: number, frame: Frame) {
  const e = elevation(t, frame);
  if (e > 0.3) return { de: 'Tag', sun: true };
  if (e > 0) return { de: wrap(t) < 12 ? 'Morgen' : 'Abend', sun: true };
  if (e > -0.2) return { de: 'Dämmerung', sun: false };
  return { de: 'Nacht', sun: false };
}

// Water at hand in a zone: its own water body and every pond, lake, river or falls in it.
function watersAt(zone: ClimateZone, season: string, t: number) {
  const own = zone.seasons[season].water;
  const spots = zone.spots.flatMap(spot => { const water = spot.seasons[season].water; return water ? [at(water.surface, t)!] : []; });
  return { own: own ? at(own.surface, t)! : null, spots };
}

function valueOf(zone: ClimateZone, season: string, metric: Metric, t: number) {
  const series = zone.seasons[season];
  if (metric === 'ground') return series.ground && zone.surfaces[0] ? at(series.ground[zone.surfaces[0]], t) : null;
  if (metric === 'water') { const { own, spots } = watersAt(zone, season, t); return own ?? (spots.length ? mean(spots) : null); }
  return at(series[metric === 'comfort' ? 'feel' : metric], t);
}
const windFrom = (series: ClimateSeries, frame: Frame, t: number) => {
  const h = wrap(t);
  return h >= frame.windDay[0] && h < frame.windDay[1] ? series.from.day : series.from.night;
};

// How the zone treats the playable: out in the open while it is active, in its best spot (shade,
// den, water) while it rests. Aquatic playables live in the sea: rated on the surface water, the
// deep layer is their refuge. Open sea is no place to rate a land animal.
function rate(me: ThermoPlayable, zone: ClimateZone, season: string, t: number): Rating {
  const resting = !isActive(me.activity, t);
  const series = zone.seasons[season];
  const ectotherm = me.tier === 'E';
  if (me.aquatic) {
    if (!series.water || !zone.body || zone.body.salt === 'fresh') return null;
    const surface = at(series.water.surface, t)!, deep = series.water.deep ?? surface;
    return { ...comfort(me.band, { open: surface, shade: deep, ectotherm, resting }), open: surface, shade: deep, den: null, waterCool: null, waterWarm: null, where: 'sea' };
  }
  if (zone.exposure === 'sea' && !me.water && !me.aerial) return null;
  const air = at(series.air, t)!;
  const ground = series.ground && zone.surfaces[0] ? at(series.ground[zone.surfaces[0]], t) : null;
  const temps = bodyTemps({ air, feel: at(series.feel, t)!, feelSun: at(series.feelSun, t), ground }, ectotherm);
  const den = me.dens && series.deep ? mean(series.deep) : null;
  const { own, spots } = me.water ? watersAt(zone, season, t) : { own: null, spots: [] };
  const waters = own == null ? spots : [own, ...spots];
  const waterCool = waters.length ? Math.min(...waters) : null, waterWarm = waters.length ? Math.max(...waters) : null;
  const water = waterCool != null && waterWarm != null ? { cool: inWater(waterCool, ectotherm), warm: inWater(waterWarm, ectotherm) } : null;
  return { ...comfort(me.band, { ...temps, den, water, ectotherm, resting }), ...temps, den, waterCool, waterWarm, where: 'land' };
}
// The temperature of the refuge: the warmest water against cold, the coolest against heat.
function refugeValue(rating: NonNullable<Rating>) {
  if (rating.refuge === 'den') return rating.den;
  if (rating.refuge === 'water') return rating.side === 'cold' ? rating.waterWarm : rating.waterCool;
  return rating.refuge === 'shade' ? rating.shade : null;
}
// The map label always shows the open, so the number follows the day and does not jump when a
// nocturnal playable wakes at 18:00; a rest in shade, den or water is marked ⌂ with its own value.
function restLabel(me: ThermoPlayable, rating: NonNullable<Rating>) {
  if (!rating.resting) return null;
  if (!rating.refuge) return `${me.name} ruht jetzt`;
  const value = refugeValue(rating);
  return `${me.name} ruht jetzt: ${rating.where === 'sea' && rating.refuge === 'shade' ? 'in der Tiefe' : REFUGE_DE[rating.refuge]}${value != null ? ` ${deg(value)}` : ''}`;
}

interface Signal { tone: 'hot' | 'warm' | 'cool' | 'wind' | 'fog'; de: string; title: string }
function signals(zone: ClimateZone, series: ClimateSeries, t: number): Signal[] {
  const out: Signal[] = [];
  const air = at(series.air, t)!, feel = at(series.feel, t)!, rh = at(series.rh, t)!, gust = at(series.gust, t)!;
  const ground = series.ground ? Math.max(...zone.surfaces.map(id => at(series.ground![id], t)!)) : null;
  if (ground != null && ground >= 50) out.push({ tone: 'hot', de: 'Boden glühend heiß', title: 'Über 50 °C an der Oberfläche: in der Sonne nicht liegen, nicht lange stehen.' });
  else if (ground != null && ground >= 40) out.push({ tone: 'warm', de: 'Boden heiß', title: 'Über 40 °C an der Oberfläche.' });
  if (air >= 35) out.push({ tone: 'hot', de: 'Hitze', title: 'Über 35 °C Luft im Schatten: Schatten und Wasser suchen.' });
  if (rh >= 60 && feel >= 30) out.push({ tone: 'warm', de: 'schwül', title: 'Feuchte Luft: Es fühlt sich heißer an, als es ist.' });
  if (series.fog.includes(Math.round(wrap(t)) % 24)) out.push({ tone: 'fog', de: 'Nebel / Tau', title: 'Die Luft liegt am Taupunkt und es ist fast windstill.' });
  if (gust >= 50) out.push({ tone: 'wind', de: 'stürmische Böen', title: `Böen um ${Math.round(gust)} km/h.` });
  if (air <= 16) out.push({ tone: 'cool', de: 'kühl', title: 'Unter 16 °C Luft.' });
  return out;
}

export function TemperaturePage({ route }: { route: string }) {
  const [data, setData] = useState<{ climate: ClimateIndex; world: WorldMap; catalog: Catalog } | null>(null);
  const [herd, setHerd] = useState<HerdDino[]>([]);
  const [error, setError] = useState('');
  const [season, setSeason] = useState(() => readStore(SEASON_KEY, 'dry'));
  const [metric, setMetric] = useState<Metric>(() => readStore<Metric>(METRIC_KEY, 'air'));
  const [tint, setTint] = useState(() => readStore(TINT_KEY, true));
  const [live, setLive] = useState(() => readStore(LIVE_KEY, true));
  const [time, setTime] = useState(() => live ? gameHour(new Date()) : 14);
  const [realNow, setRealNow] = useState(() => new Date());
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  // The POI the player is in for the thermo compass; clicking a zone on the map sets it.
  const [here, setHere] = useState<string | null>(() => readStore<string | null>(HERE_KEY, null));
  useEffect(() => { if (pinned) { setHere(pinned); writeStore(HERE_KEY, pinned); } }, [pinned]);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const mode = usePlayMode();
  const fromRoute = decodeURIComponent(route.split('/')[2] || '') || null;
  const meId = fromRoute || readStore<string>(ME_KEY, '') || null;

  useEffect(() => {
    let alive = true;
    Promise.all([api.climate(), api.worldMap(), api.catalog()]).then(([climate, world, catalog]) => { if (alive) setData({ climate, world, catalog }); }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : String(cause)); });
    herdApi.list().then(list => { if (alive) setHerd(list); }).catch(() => { if (alive) setHerd([]); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (fromRoute) writeStore(ME_KEY, fromRoute); }, [fromRoute]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPinned(null); setHover(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setTime(value => wrap(value + STEP)), 90);
    return () => window.clearInterval(timer);
  }, [playing]);
  // Live: the map follows the game clock (one real hour = one game day, full hour = 06:00).
  useEffect(() => {
    if (!live) return;
    const tick = () => { const moment = new Date(); setRealNow(moment); setTime(gameHour(moment)); };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [live]);
  // The mouse wheel over the map or the timeline scrolls the time of day (two steps per notch).
  useEffect(() => {
    const nodes = [stageRef.current, timeRef.current].filter((node): node is HTMLDivElement => Boolean(node));
    let pending = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      pending += event.deltaY || event.deltaX;
      const steps = Math.trunc(pending / WHEEL_PX);
      if (!steps) return;
      pending -= steps * WHEEL_PX;
      setPlaying(false);
      setLive(false);
      setTime(value => wrap(value + steps * STEP));
    };
    nodes.forEach(node => node.addEventListener('wheel', onWheel, { passive: false }));
    return () => nodes.forEach(node => node.removeEventListener('wheel', onWheel));
  }, [data]);

  const areas = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.world.regions.map(region => [region.id, region]));
    return data.climate.zones.map(zone => ({ zone, area: byId.get(zone.id) as Area | undefined })).filter((item): item is { zone: ClimateZone; area: Area } => item.area?.shape.type === 'polygon');
  }, [data]);
  const items = useMemo(() => new Map((data?.catalog.profiles || []).map(item => [item.id, item])), [data]);

  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading label="Loading temperature map…" />;
  const { climate } = data;
  const frame = climate.frame;
  const thermo = climate.thermo;
  const me = meId && thermo?.playables[meId] ? thermo.playables[meId] : null;
  const rated = Boolean(me);
  const view: Metric = metric === 'comfort' && !rated ? 'feel' : metric;
  const seasonInfo = climate.seasons.find(item => item.id === season) || climate.seasons[0];
  const chooseSeason = (id: string) => { setSeason(id); writeStore(SEASON_KEY, id); };
  const chooseMetric = (id: Metric) => { setMetric(id); writeStore(METRIC_KEY, id); };
  const choosePlayable = (id: string) => {
    writeStore(ME_KEY, id);
    setPinned(null);
    if (id && thermo?.playables[id] && !thermo.playables[id].aquatic) chooseMetric('comfort');
    go(id ? `/temperature/${id}` : '/temperature');
  };
  const toggleTint = () => setTint(value => { writeStore(TINT_KEY, !value); return !value; });
  const toggleLive = () => { setPlaying(false); setLive(!live); writeStore(LIVE_KEY, !live); };
  // Any hand on the time (slider, buttons, chart, strip) leaves Live for this visit.
  const setManual = (value: number) => { setPlaying(false); setLive(false); setTime(value); };
  const now = phase(time, frame);
  const sunEvent = wrap(time) >= frame.sunrise && wrap(time) < frame.sunset ? { de: 'Sonnenuntergang', at: realTimeOf(frame.sunset, realNow) } : { de: 'Sonnenaufgang', at: realTimeOf(frame.sunrise, realNow) };
  const realClock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const light = Math.max(0, Math.min(1, (elevation(time, frame) + 0.2) / 0.45));
  const values = new Map(areas.map(({ zone }) => [zone.id, valueOf(zone, seasonInfo.id, view, time)]));
  const ratings = new Map(areas.map(({ zone }) => [zone.id, me ? rate(me, zone, seasonInfo.id, time) : null]));
  const mine = new Set([...(me?.home || []), ...(me?.route || [])]);
  const fill = (id: string) => {
    if (view !== 'comfort') { const value = values.get(id); return value == null ? null : { colour: tone(view, value), strength: 'full' }; }
    const rating = ratings.get(id);
    if (!rating) return null;
    const shown = look(rating);
    return shown.strength === 'none' ? null : shown;
  };
  const comfortRank = (id: string) => {
    const rating = ratings.get(id);
    if (!rating) return 9;
    const shown = look(rating);
    return shown.strength === 'danger' ? 4 : shown.strength === 'refuge' ? 3 : Math.abs(LEVEL_ORDER.indexOf(rating.level) - 2);
  };
  const ranked = view === 'comfort'
    ? [...areas].sort((a, b) => Number(mine.has(b.zone.id)) - Number(mine.has(a.zone.id)) || comfortRank(a.zone.id) - comfortRank(b.zone.id) || (values.get(a.zone.id) ?? 99) - (values.get(b.zone.id) ?? 99))
    : [...areas].sort((a, b) => (values.get(b.zone.id) ?? -99) - (values.get(a.zone.id) ?? -99));
  const active = hover || pinned;
  const activeItem = active ? areas.find(item => item.zone.id === active) || null : null;
  const pct = (hour: number) => `${(hour / 24) * 100}%`;
  const sky = `linear-gradient(90deg, #111a2b 0%, #111a2b ${pct(frame.sunrise - 0.75)}, #b57a45 ${pct(frame.sunrise)}, #d8c27c ${pct(frame.sunrise + 1.5)}, #eadc93 50%, #d8c27c ${pct(frame.sunset - 1.5)}, #b8653f ${pct(frame.sunset)}, #111a2b ${pct(frame.sunset + 0.75)}, #111a2b 100%)`;
  const legendStops = view === 'wind' ? BREEZE : view === 'ground' ? HEAT : HEAT.slice(0, 7);
  const legendMin = legendStops[0][0], legendMax = legendStops[legendStops.length - 1][0];
  const legendTicks = view === 'wind' ? [0, 10, 20, 30, 45] : view === 'ground' ? [10, 20, 30, 40, 50, 60] : [10, 15, 20, 25, 30, 35, 40];
  const pin = (id: string) => setPinned(value => value === id ? null : id);

  return <>
    <ExplorerTopline section="PROFILES / TEMPERATUR-MAP" count={`${areas.length} ZONEN · ${climate.zones.reduce((sum, zone) => sum + zone.spots.length, 0)} KLEINKLIMA-SPOTS`} />
    <header className="directory-head temp-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · TEMPERATUR-MAP</div>
        <h1>Temperatur-Map</h1>
        <p lang="de">Luft, gefühlte Temperatur, Boden und Wind für jede Zone der Karte. Scroll durch den Tag, vergleich Trocken- und Regenzeit, und wähle ein Playable, um zu sehen, wo es ihm zu heiß oder zu kalt wird. Wassertemperatur folgt später.</p>
      </div>
    </header>

    {thermo && <MePicker me={meId} thermo={thermo} herd={herd} items={items} mode={mode} onChoose={choosePlayable} />}

    <div className="temp-bar">
      <div className="temp-seg" role="group" aria-label="Jahreszeit">
        {climate.seasons.map(item => <button type="button" key={item.id} className={item.id === seasonInfo.id ? 'on' : ''} aria-pressed={item.id === seasonInfo.id} title={item.note} onClick={() => chooseSeason(item.id)}>{item.id === 'dry' ? '☀ ' : '☂ '}{item.de}</button>)}
      </div>
      <div className="temp-seg" role="group" aria-label="Messgröße">
        {METRICS.map(item => <button type="button" key={item.id} className={item.id === view ? 'on' : ''} aria-pressed={item.id === view} disabled={item.id === 'comfort' && !rated} title={item.id === 'comfort' && !rated ? 'Erst oben ein Playable wählen' : item.title} onClick={() => chooseMetric(item.id)}>{item.id === 'comfort' && me ? `Für ${me.name}` : item.de}</button>)}
      </div>
      <button type="button" className={`temp-toggle ${tint ? 'on' : ''}`} aria-pressed={tint} onClick={toggleTint} title="Zonen farbig hinterlegen oder nur die Zahlen zeigen">{tint ? 'Farbflächen an' : 'Nur Zahlen'}</button>
    </div>

    <div className="temp-time" ref={timeRef}>
      <div className="temp-controls">
        <button type="button" className={`temp-live ${live ? 'on' : ''}`} aria-pressed={live} onClick={toggleLive} title="Live: Die Karte läuft mit der Spielzeit mit. Eine echte Stunde ist ein Spieltag, zur vollen Stunde ist es 06:00 im Spiel, um halb 18:00."><i aria-hidden="true" />Live</button>
        <button type="button" className="temp-play" onClick={() => { setLive(false); setPlaying(value => !value); }} aria-label={playing ? 'Zeitraffer anhalten' : 'Zeitraffer abspielen'} title={playing ? 'Anhalten' : 'Zeitraffer: ein Tag in gut 8 Sekunden'}>{playing ? '❚❚' : '▶'}</button>
      </div>
      <div className="temp-clock" aria-live="off"><b>{clock(time)}</b><span className={now.sun ? 'sun' : 'moon'}>{now.sun ? '☀' : '☾'} {now.de}{me && !me.aquatic ? ` · ${isActive(me.activity, time) ? 'aktiv' : 'ruht'}` : ''}</span>{live && <small title="Echte Uhrzeit und wann im Spiel die Sonne als Nächstes auf- oder untergeht">Spielzeit · echt {realClock(realNow)} · {sunEvent.de} {realClock(sunEvent.at)}</small>}</div>
      <div className="temp-track">
        <input type="range" min={0} max={24 - STEP} step={STEP} value={time} style={{ background: sky }} aria-label="Uhrzeit" aria-valuetext={`${clock(time)} Uhr, ${now.de}`} onChange={event => setManual(Number(event.target.value))} />
        <div className="temp-ticks" aria-hidden="true">{[0, 3, 6, 9, 12, 15, 18, 21].map(hour => <span key={hour} style={{ left: pct(hour) }}>{String(hour).padStart(2, '0')}</span>)}</div>
      </div>
      <div className="temp-quick">{QUICK.map(item => <button type="button" key={item.label} className={Math.abs(time - item.time) < STEP / 2 ? 'on' : ''} onClick={() => setManual(item.time)}>{item.label}</button>)}</div>
    </div>

    <div className="temp-layout">
      <div className="temp-map-wrap">
        <div className="temp-stage" ref={stageRef} onMouseLeave={() => setHover(null)}>
          <div className="temp-map">
            <img src={`${api.mapLayerUrl('layers/base-clean.png')}?v=${encodeURIComponent(climate.generatedAt)}`} alt="Karte der Insel mit allen POIs" />
            <svg className="temp-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              <rect className="temp-night" width="1" height="1" style={{ opacity: 0.58 * (1 - light) }} />
              {view === 'water' && <defs><mask id="temp-water-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1" style={{ maskType: 'alpha' }}><image href={api.mapLayerUrl('layers/water.png')} x="0" y="0" width="1" height="1" preserveAspectRatio="none" /></mask></defs>}
              {/* In the water view only the water itself is coloured: the zones clipped to the traced water layer. */}
              {tint && <g mask={view === 'water' ? 'url(#temp-water-mask)' : undefined}>{areas.map(({ zone, area }) => {
                const shown = fill(zone.id);
                return shown ? <polygon key={zone.id} className={`temp-zone s-${view === 'water' ? 'water' : shown.strength}`} points={polygon(area)} style={{ fill: shown.colour }} /> : null;
              })}</g>}
              {view === 'comfort' && areas.filter(({ zone }) => !ratings.get(zone.id)).map(({ zone, area }) => <polygon key={zone.id} className="temp-unrated" points={polygon(area)} />)}
              {view === 'comfort' && areas.filter(({ zone }) => mine.has(zone.id)).map(({ zone, area }) => <polygon key={zone.id} className="temp-mine" points={polygon(area)} />)}
              {pinned && pinned !== hover && (() => { const item = areas.find(entry => entry.zone.id === pinned); return item ? <polygon className="temp-outline pinned" points={polygon(item.area)} /> : null; })()}
              {activeItem && <polygon className="temp-outline" points={polygon(activeItem.area)} />}
            </svg>
            <div className="temp-labels" aria-hidden="true">
              {areas.map(({ zone, area }) => {
                const value = values.get(zone.id);
                if (value == null) return null;
                const spot = anchorOf(area);
                const rating = ratings.get(zone.id);
                if (view === 'comfort' && !rating) return null;
                const from = windFrom(zone.seasons[seasonInfo.id], frame, time);
                return <span key={zone.id} className={`temp-label ${active === zone.id ? 'on' : ''} ${view === 'comfort' && mine.has(zone.id) ? 'mine' : ''}`} style={{ left: `${spot.x * 100}%`, top: `calc(${spot.y * 100}% + 15px)` }}>
                  {view === 'comfort' && rating
                    ? <><b className={`temp-glyph k-${look(rating).key}`} title={restLabel(me!, rating) ?? undefined}>{rating.resting && rating.refuge ? '⌂' : look(rating).glyph}</b>{deg(rating.open)}{rating.resting && <small title={restLabel(me!, rating)!}>z</small>}</>
                    : <><i style={{ background: tone(view, value) }} />{view === 'wind' ? <>{Math.round(value)}<small>km/h</small><em style={{ transform: `rotate(${(COMPASS[from]?.angle ?? 0) + 180}deg)` }}>↑</em></> : deg(value)}</>}
                </span>;
              })}
            </div>
            <svg className="temp-hits" viewBox="0 0 1 1" preserveAspectRatio="none">
              {areas.map(({ zone, area }) => <polygon key={zone.id} points={polygon(area)} aria-label={zone.name} onMouseEnter={() => setHover(zone.id)} onClick={() => pin(zone.id)} />)}
            </svg>
          </div>
          {activeItem && <ZoneCard key={activeItem.zone.id} zone={activeItem.zone} area={activeItem.area} climate={climate} season={seasonInfo.id} time={time} me={rated ? me : null} mine={mine} pinned={pinned === activeItem.zone.id} onClose={() => setPinned(null)} onTime={setManual} />}
        </div>
        <p className="temp-hint" lang="de"><b>Live</b> läuft mit der Spielzeit: Eine echte Stunde ist ein Spieltag (:00 = 06:00, :15 = 12:00, :30 = 18:00, :45 = 00:00). Mausrad, Regler oder Zeitknöpfe schalten Live aus, der Live-Knopf holt es zurück. Mausrad über Karte oder Zeitleiste = Uhrzeit (eine Raste = 30 Minuten). Hover zeigt die Zone, Klick hält sie fest, <kbd>Esc</kbd> löst sie. Der Wind ist geschätzt, der Pfeil zeigt, wohin er weht.{view === 'comfort' && ' Angenehme Zonen bleiben ohne Farbe. ⌂ = draußen zu heiß oder kalt, aber Schatten, Bau oder Wasser helfen. z = dein Playable ruht und liegt im besten Platz der Zone.'}</p>
        {me?.ideal && <ThermoCompass me={me} zones={areas.map(item => item.zone)} here={here} season={seasonInfo.id} time={time} live={live} realNow={realNow} onHere={id => { setHere(id); writeStore(HERE_KEY, id); }} />}
        {rated && me && <DayStrip me={me} zones={areas.map(item => item.zone)} season={seasonInfo.id} time={time} active={active} onPick={(id, hour) => { setManual(hour); setPinned(id); }} onHover={setHover} />}
      </div>

      <aside className="temp-panel">
        {view === 'comfort' && me
          ? <ThermoBox me={me} thermo={thermo!} rating={activeItem ? ratings.get(activeItem.zone.id) ?? null : null} zoneName={activeItem?.zone.name || null} />
          : <div className="temp-legend">
            <b>{METRICS.find(item => item.id === view)!.title}</b>
            <div className="temp-legend-bar" style={{ background: `linear-gradient(90deg, ${legendStops.map(([value, hex]) => `${hex} ${((value - legendMin) / (legendMax - legendMin)) * 100}%`).join(', ')})` }} />
            <div className="temp-legend-ticks">{legendTicks.map(value => <span key={value} style={{ left: `${((value - legendMin) / (legendMax - legendMin)) * 100}%` }}>{view === 'wind' ? value : `${value}°`}</span>)}</div>
          </div>}
        {me?.aquatic && view === 'comfort' && <p className="temp-aquatic" lang="de"><b>{me.name}</b> lebt im Meer und wird an der Wassertemperatur bewertet. Süßwasser und Land bleiben grau.</p>}
        <div className="temp-panel-head"><b>{view === 'comfort' ? 'Deine POIs zuerst' : view === 'wind' ? 'Windigste Zonen' : view === 'water' ? 'Wärmstes Wasser' : 'Heißeste Zonen'}</b><small>{clock(time)} · {seasonInfo.de}</small></div>
        <ol className="temp-list">{ranked.map(({ zone }) => {
          const value = values.get(zone.id) ?? null;
          const rating = ratings.get(zone.id);
          const own = view === 'comfort' && mine.has(zone.id);
          return <li key={zone.id}><button type="button" className={`${active === zone.id ? 'on' : ''} ${own ? 'mine' : ''}`} onMouseEnter={() => setHover(zone.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(zone.id)} onBlur={() => setHover(null)} onClick={() => pin(zone.id)}>
            {view === 'comfort'
              ? <i style={{ background: rating ? look(rating).colour : 'transparent' }} />
              : <i style={{ background: value == null ? 'transparent' : tone(view, value) }} />}
            <span>{zone.name}{own && <em>{me?.route.includes(zone.id) ? ' ⇢' : ' ◆'}</em>}</span>
            <b>{view === 'comfort' ? (rating ? <small className={`k-${look(rating).key}`}>{look(rating).de}</small> : <small>{me?.aquatic ? 'kein Meer' : 'Meer'}</small>) : value == null ? <small>{view === 'water' ? 'kein Gewässer' : 'Wasser'}</small> : view === 'wind' ? kmh(value) : deg(value)}</b>
          </button></li>;
        })}</ol>
      </aside>
    </div>

    <details className="temp-method" lang="de">
      <summary>Wie die Werte entstehen</summary>
      <p>{climate.frame.de}</p>
      <ul>
        <li><b>Luft</b>: Für jede Zone ist das Tagesmaximum und -minimum in 2 m Höhe im Schatten geschätzt, nach Landschaft, Höhe, Wasser, Wald und Lage zum Meer. Den Verlauf über den Tag rechnet das Modell nach Parton &amp; Logan (1981): tagsüber eine Sinuskurve mit dem Maximum am Nachmittag, nachts eine exponentielle Abkühlung bis zum Sonnenaufgang.</li>
        <li><b>Gefühlt</b>: die Apparent Temperature nach Steadman (1994) in der Form des australischen Wetterdienstes. Feuchte Luft fühlt sich wärmer an, Wind kühler. „In der Sonne“ rechnet die Strahlung dazu.</li>
        <li><b>Boden</b>: Die Oberfläche hängt am Untergrund. Sand, Erde und Lavagestein heizen sich in der Sonne weit über die Luft auf, Wind, Wolken und Kronendach bremsen das. Nachts strahlt offener Boden ab und wird kälter als die Luft. Fels speichert die Wärme und hängt der Luft hinterher. In {climate.frame.depthCm} cm Tiefe kommt die Tageswelle gedämpft und Stunden später an (Wärmeleitung).</li>
        <li><b>Feuchte</b>: relative Luftfeuchte aus dem Taupunkt (Magnus-Formel). Erreicht die Luft fast den Taupunkt bei schwachem Wind, gibt es Nebel oder Tau.</li>
        <li><b>Wind</b>: ein geschätzter Mittelwert je Zone. Tagsüber durchmischt die Sonne die Luft und an den Küsten weht Seewind, nachts ist es im Landesinneren ruhig. Von den Bergen im Westen und Süden fallen dann kühle Hangwinde. Böen über einen Faktor je Gelände, in der Regenzeit böiger. Die Stärke steht zusätzlich in Beaufort.</li>
        <li><b>Kleinklima</b>: Teiche, Wasserfälle, Felsdächer, Senken und Kuppen weichen von ihrer Zone ab und stehen in der Zonenkarte.</li>
        <li><b>Wasser</b>: Jedes Gewässer folgt der Luft und der Sonne, aber umso träger, je tiefer es ist (etwa 39 Stunden pro Meter Tiefe): Ein flacher Teich schwankt am Tag um einige Grad, das offene Meer fast gar nicht. Trockene Luft kühlt durch Verdunstung, Flüsse und Wasserfälle bringen kühles Wasser von oben, Moore und Lagunen werden warm. Tiefe Seen und das offene Meer haben unten eine kühlere Schicht. Das Tiefenwasser der Kreidezeit war mit rund 12 bis 20 °C viel wärmer als heute. Sauerstoff: Warmes Wasser hält weniger davon, Salzwasser etwa ein Fünftel weniger, stehendes Wasser ist zusätzlich arm daran.</li>
        <li><b>Im Wasser</b>: Wer sich im Wasser abkühlt, bekommt die echte Wassertemperatur der Zone und ihrer Teiche, Flüsse und Seen. Für Warmblütige zählt Wasser etwa 6 °C kühler als gleich warme Luft, weil es die Wärme rund 25-mal schneller abzieht. Wechselwarme nehmen die Wassertemperatur an und wärmen sich nachts darin. Reine Meerestiere (Tylosaurus, Kaiwhekea, Eurhinosaurus, Leedsichthys) werden am Meerwasser gemessen, die Tiefe ist ihr Rückzug. Leedsichthys atmet mit Kiemen, warmes, sauerstoffarmes Wasser setzt ihm zusätzlich zu.</li>
        <li><b>Für dein Playable</b>: Jedes Playable hat eine Thermo-Stufe von A (sicher warmblütig) bis E (wechselwarm) und damit einen Wohlfühlbereich. Federn verschieben ihn zur Kälte hin, ein größerer Körper hält Wärme und verschiebt ihn nach unten, und was das eigene Profil über Hitze und Kälte sagt (wörtlich zitiert), verschiebt ihn weiter. Die Bereiche gelten für Tiere, die an das warme Kreideklima angepasst sind: In ihren eigenen POIs sollen sie zu ihren Aktivzeiten leben können.</li>
        <li><b>Was am Körper ankommt</b>: Warmblütige werden an der gefühlten Temperatur gemessen, weil sie über Hecheln und Verdunstung kühlen. Wechselwarme schwitzen nicht. Bei ihnen zählen Luft, Sonne und vor allem der Boden, auf dem sie liegen: Auf 50 °C heißem Fels wird ein Waran mittags gegrillt, auch wenn die Luft „nur“ 39 °C hat.</li>
        <li><b>Draußen oder Rückzug</b>: Ist dein Playable aktiv, zählt es draußen in Sonne und auf dem Boden. Ruht es, liegt es im besten Platz der Zone. Zu heiß oder zu kalt draußen ist normal, solange es einen Rückzug gibt: Schatten, Wasser für die, die sich darin abkühlen, und für Wechselwarme ein Bau oder eine Felsspalte, die etwa die mittlere Bodentemperatur des Tages hält. Gefährlich ist es nur, wo nichts davon hilft.</li>
      </ul>
    </details>
  </>;
}

function MePicker({ me, thermo, herd, items, mode, onChoose }: { me: string | null; thermo: NonNullable<ClimateIndex['thermo']>; herd: HerdDino[]; items: Map<string, CatalogItem>; mode: PlayMode; onChoose: (id: string) => void }) {
  const entries = Object.entries(thermo.playables).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const own = herd.filter(dino => dino.playableId && thermo.playables[dino.playableId] && !isDeceased(dino));
  const current = me ? thermo.playables[me] : null;
  return <div className="temp-me">
    {current && <Avatar id={me!} items={items} mode={mode} size="lg" />}
    <label><span lang="de">Für Playable</span>
      <select value={current ? me! : ''} onChange={event => onChoose(event.target.value)}>
        <option value="">Kein Playable (nur Klima)</option>
        {(['A', 'B', 'C', 'D', 'E'] as const).map(tier => <optgroup key={tier} label={`${tier} · ${thermo.tiers[tier].de}`}>{entries.filter(([, item]) => item.tier === tier).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</optgroup>)}
      </select>
      <small>{current ? [`Stufe ${current.tier} · ${thermo.tiers[current.tier].de}`, thermo.covers[current.cover], current.activity && ACTIVITY_DE[current.activity]].filter(Boolean).join(' · ') : 'Wähle, wofür die Karte bewerten soll'}</small>
    </label>
    {own.length > 0 && <div className="temp-herd" aria-label="Meine Dinos">{own.map(dino => <button type="button" key={dino.id} className={dino.playableId === me ? 'on' : ''} onClick={() => onChoose(dino.playableId!)} title={`${dino.name}: ${thermo.playables[dino.playableId!].name}`}>
      {dino.photo ? <img src={herdApi.fileUrl(dino, dino.photo)} alt="" /> : <Avatar id={dino.playableId!} items={items} mode={mode} size="xs" />}{dino.name}
    </button>)}</div>}
  </div>;
}

// The playable's comfort band as a strip from 0 to 50 °C, with the hovered zone marked: solid =
// out in the open, hollow = in the shade.
function ThermoBox({ me, thermo, rating, zoneName }: { me: ThermoPlayable; thermo: NonNullable<ClimateIndex['thermo']>; rating: Rating; zoneName: string | null }) {
  const min = 0, max = 50;
  const x = (value: number) => `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%`;
  const [tooCold, cool, warm, tooHot] = me.band;
  const segments: [ComfortLevel, number, number][] = [['cold', min, tooCold], ['cool', tooCold, cool], ['ok', cool, warm], ['warm', warm, tooHot], ['hot', tooHot, max]];
  return <div className="temp-thermo">
    <b>{me.name}</b>
    <p className="temp-thermo-tier"><span>Stufe {me.tier}</span>{thermo.tiers[me.tier].de}</p>
    <p className="temp-thermo-text" lang="de">{me.de}</p>
    <div className="temp-band" role="img" aria-label={`Angenehm von ${Math.round(cool)} bis ${Math.round(warm)} Grad gefühlt, zu kalt unter ${Math.round(tooCold)}, zu heiß über ${Math.round(tooHot)}`}>
      {segments.map(([level, from, to]) => <i key={level} className={`l-${level}`} style={{ left: x(from), width: `calc(${x(to)} - ${x(from)})` }} title={LEVEL[level].de} />)}
      {rating && <em style={{ left: x(rating.open) }} title={`${zoneName}: ${me.aquatic ? 'Oberfläche' : 'draußen'} ${Math.round(rating.open)}°`} />}
      {rating && <em className="shade" style={{ left: x(rating.shade) }} title={`${zoneName}: ${me.aquatic ? 'Tiefe' : 'im Schatten'} ${Math.round(rating.shade)}°`} />}
    </div>
    <div className="temp-band-ticks">{[tooCold, cool, warm, tooHot].map((value, index) => <span key={index} style={{ left: x(value) }}>{Math.round(value)}°</span>)}</div>
    <p className="temp-band-measure">{me.aquatic ? 'Gemessen an der Wassertemperatur im Meer' : me.tier === 'E' ? 'Gemessen am Körper: Luft, Sonne und Boden' : 'Gemessen an der gefühlten Temperatur'}{rating ? ` · ${zoneName}: ${me.aquatic ? `Oberfläche ${deg(rating.open)}, Tiefe ${deg(rating.shade)}` : `draußen ${deg(rating.open)}, Schatten ${deg(rating.shade)}${me.dens && rating.den != null ? `, Bau ${deg(rating.den)}` : ''}${rating.waterCool != null ? `, Wasser ${deg(rating.waterCool)}${rating.waterWarm != null && Math.round(rating.waterWarm) !== Math.round(rating.waterCool) ? `–${deg(rating.waterWarm)}` : ''}` : ''}`}` : ''}</p>
    <p className="temp-band-key">{LOOK_KEY.map(item => <span key={item.key}><i style={{ background: item.colour }} />{item.de}</span>)}</p>
    <p className="temp-thermo-facts">{[thermo.covers[me.cover], `Combat Weight ${me.cw}`, me.water ? 'kühlt sich im Wasser' : null, me.dens ? 'nutzt Baue' : null, me.gills ? 'atmet mit Kiemen' : null, me.activity ? ACTIVITY_DE[me.activity] : null].filter(Boolean).join(' · ')}</p>
    {me.quotes.length > 0 && <details className="temp-quotes">
      <summary>Laut Profil ({me.quotes.length})</summary>
      {me.quotes.map(quote => <blockquote key={quote.text} lang="en">„{quote.text}“<cite>{quote.section}</cite></blockquote>)}
    </details>}
  </div>;
}

// Thermo compass for land ectotherms (crocodiles, monitors), adults only. It compares the options
// inside the one POI the player is in right now (sun on the bank, shade, den, shallow water, open
// water, deeper water) against the body temperature the animal aims for. It simulates nothing:
// the player knows where they have been and decides.
type OptionKind = 'sun' | 'shade' | 'den' | 'shallow' | 'water' | 'deep';
const OPTION: Record<OptionKind, { de: string; colour: string; water: boolean }> = {
  sun: { de: 'Ufer in der Sonne', colour: '#eda100', water: false },
  shade: { de: 'Schatten an Land', colour: '#8fa08f', water: false },
  den: { de: 'Bau oder Schlammloch', colour: '#a07850', water: false },
  shallow: { de: 'Flachwasser', colour: '#86b6ef', water: true },
  water: { de: 'offenes Wasser', colour: '#3987e5', water: true },
  deep: { de: 'tieferes Wasser', colour: '#256abf', water: true },
};
const OPTION_ORDER: OptionKind[] = ['sun', 'shade', 'den', 'shallow', 'water', 'deep'];
// Water a playable may use in a POI: the area's own water, or else its best spot (lake before
// river before falls …); small pools only where the profile allows them.
const SPOT_RANK = ['lake', 'river', 'falls', 'shallows', 'oasis', 'pond', 'swamp'];
const SMALL_POOLS = new Set(['pond', 'swamp', 'oasis']);

interface Option { kind: OptionKind; temp: number; where: string | null }
function compassWater(me: ThermoPlayable, zone: ClimateZone, season: string) {
  const own = zone.seasons[season].water;
  if (own && zone.body) return { water: own, depth: zone.body.depth, name: null as string | null };
  const spot = zone.spots.filter(item => item.seasons[season].water && (me.smallPools || !SMALL_POOLS.has(item.kind)))
    .sort((a, b) => SPOT_RANK.indexOf(a.kind) - SPOT_RANK.indexOf(b.kind))[0];
  return spot ? { water: spot.seasons[season].water!, depth: 1, name: spot.name } : null;
}
function compassOptions(me: ThermoPlayable, zone: ClimateZone, season: string, t: number): Option[] {
  const series = zone.seasons[season];
  const out: Option[] = [];
  if (series.ground) {
    const air = at(series.air, t)!, feelSun = at(series.feelSun, t);
    const ground = zone.surfaces[0] ? at(series.ground[zone.surfaces[0]], t) : null;
    if (feelSun != null) out.push({ kind: 'sun', temp: bodyTemps({ air, feel: at(series.feel, t)!, feelSun, ground }, true).open, where: null });
    out.push({ kind: 'shade', temp: air, where: null });
    if (me.dens && series.deep) out.push({ kind: 'den', temp: mean(series.deep), where: null });
  }
  const pool = compassWater(me, zone, season);
  if (pool) {
    if (pool.water.shallow) out.push({ kind: 'shallow', temp: at(pool.water.shallow, t)!, where: pool.name });
    out.push({ kind: pool.depth <= 0.6 ? 'shallow' : 'water', temp: at(pool.water.surface, t)!, where: pool.name });
    if (pool.water.deep != null) out.push({ kind: 'deep', temp: pool.water.deep, where: pool.name });
  }
  return out;
}
// How far an option is from the ideal body range (0 = inside) and how it feels.
const offIdeal = ([low, high]: [number, number], temp: number) => temp < low ? low - temp : temp > high ? temp - high : 0;
function feelOf(me: ThermoPlayable, temp: number) {
  const [tooCold, cool, warm, tooHot] = me.band, [low, high] = me.ideal!;
  if (temp < tooCold) return { de: 'zu kalt', colour: '#256abf' };
  if (temp < cool) return { de: 'kalt', colour: '#3987e5' };
  if (temp < low) return { de: 'kühl', colour: '#86b6ef' };
  if (temp <= high) return { de: 'ideal', colour: '#9fd18a' };
  if (temp <= warm) return { de: 'warm', colour: '#f5c04a' };
  if (temp <= tooHot) return { de: 'heiß', colour: '#e8794f' };
  return { de: 'zu heiß', colour: '#e34948' };
}
// The option closest to the ideal; within half a degree a water user takes the water (crocodiles
// spend the night in it, as their profiles say).
const scoreOf = (me: ThermoPlayable, item: Option) => offIdeal(me.ideal!, item.temp) - (me.water && OPTION[item.kind].water ? 0.5 : 0);
function bestOf(me: ThermoPlayable, options: Option[]) {
  return options.reduce<Option | null>((best, item) => !best || scoreOf(me, item) < scoreOf(me, best) ? item : best, null);
}
// Other kinds of place within a degree of the best: just as good to the body, so the player may pick.
const NEAR = 1;
const nearBest = (me: ThermoPlayable, best: Option, options: Option[]) =>
  options.filter(item => item.kind !== best.kind && scoreOf(me, item) - scoreOf(me, best) <= NEAR);
// Why the best option wins, against the air in the shade: a den or water holds the day's warmth
// through the night and stays cooler than the air by day, the sun warms, the shade keeps it off.
function whyBest(best: Option, options: Option[]) {
  const air = options.find(item => item.kind === 'shade')?.temp;
  const sun = options.find(item => item.kind === 'sun')?.temp;
  if (air == null) return null;
  const holds = best.temp > air;
  if (best.kind === 'den') return holds ? `Der Bau hält die Wärme des Tages, draußen hat es nur ${deg(air)}.` : `Der Bau bleibt kühler als die Luft draußen (${deg(air)}).`;
  if (OPTION[best.kind].water) return holds ? `Das Wasser hält die Wärme des Tages, an Land hat es nur ${deg(air)}.` : `Das Wasser kühlt, an Land hat es ${deg(air)}${sun != null ? `, in der Sonne ${deg(sun)}` : ''}.`;
  if (best.kind === 'sun') return `Die Sonne wärmt dich auf ${deg(best.temp)}, im Schatten hat es nur ${deg(air)}.`;
  if (sun != null) return `In der Sonne kämst du auf ${deg(sun)}.`;
  const others = options.filter(item => item.kind !== 'shade');
  if (!others.length) return null;
  const places = [...new Set(others.map(item => item.kind === 'den' ? 'im Bau' : 'im Wasser'))].join(' und ');
  return others.every(item => item.temp < air) ? `Draußen ist es gerade wärmer als ${places}.` : 'Draußen liegst du gerade am nächsten an deinem Wunschbereich.';
}

// Being active (hunting, roaming, patrolling) means moving in the open: sun and ground by day, the
// night air and the ground after dark, as on the map. Good hours are the playable's active hours
// with the open inside its comfort band; inside the ideal range it is at its best.
interface Activity { open: number; level: ComfortLevel; awake: boolean }
function activityAt(me: ThermoPlayable, zone: ClimateZone, season: string, t: number): Activity | null {
  const rating = rate(me, zone, season, t);
  return rating && { open: rating.open, level: levelOf(me.band, rating.open), awake: isActive(me.activity, t) };
}
// The good stretches of the day in quarter hours, a stretch over midnight kept whole.
function activityWindows(me: ThermoPlayable, zone: ClimateZone, season: string): [number, number][] | 'all' {
  const slots = 24 / STEP;
  const good = Array.from({ length: slots }, (_, slot) => {
    const activity = activityAt(me, zone, season, slot * STEP);
    return Boolean(activity?.awake && activity.level === 'ok');
  });
  const start = good.indexOf(false);
  if (start < 0) return 'all';
  const out: [number, number][] = [];
  let from: number | null = null;
  for (let step = 1; step <= slots; step++) {
    const slot = (start + step) % slots;
    if (good[slot] && from == null) from = slot;
    if (!good[slot] && from != null) { out.push([from * STEP, slot * STEP]); from = null; }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
const within = ([from, to]: [number, number], t: number) => from <= to ? t >= from && t < to : t >= from || t < to;
// What being active feels like now, in words that fit any playable: the head says whether to be
// out and about, the text what the body does, the break where it cools off or warms up best.
function activityVerdict(me: ThermoPlayable, activity: Activity, best: Option | null) {
  const [low, high] = me.ideal!;
  const heat = activity.level === 'warm' || activity.level === 'hot';
  const pause = best && activity.level !== 'ok' && best.kind !== 'sun' ? `${heat ? 'Abkühlen' : 'Aufwärmen'}: ${OPTION[best.kind].de} (${deg(best.temp)})` : null;
  if (!activity.awake) return { head: 'Ruhezeit laut Profil', text: `${me.name} ist ${ACTIVITY_DE[me.activity || ''] || 'jetzt nicht aktiv'}: Jetzt ruhst du.`, pause: null };
  if (activity.level === 'ok') return activity.open >= low && activity.open <= high
    ? { head: 'Beste Zeit, um aktiv zu sein', text: 'Draußen liegt dein Körper in der Wunschtemperatur: schnell und ausdauernd.', pause }
    : { head: 'Gut, um aktiv zu sein', text: `Etwas ${activity.open < low ? 'kühler' : 'wärmer'} als ideal, aber gut beweglich.`, pause };
  if (activity.level === 'warm') return { head: 'Aktiv mit Pausen', text: 'Lange Wege und Verfolgungen heizen dich weiter auf: lieber lauern als hetzen.', pause };
  if (activity.level === 'hot') return { head: 'Zu heiß für lange Wege', text: 'Draußen überhitzt du schnell. Wenn überhaupt, dann lauern statt hetzen.', pause };
  if (activity.level === 'cool') return { head: 'Langsam unterwegs', text: 'Dein Körper ist kühl und träge: nur kurze Wege.', pause };
  return { head: 'Zu kalt, um aktiv zu sein', text: 'Steif und langsam: Jagen und Streifzüge lohnen sich kaum.', pause };
}

function ThermoCompass({ me, zones, here, season, time, live, realNow, onHere }: {
  me: ThermoPlayable; zones: ClimateZone[]; here: string | null; season: string; time: number; live: boolean; realNow: Date; onHere: (id: string) => void;
}) {
  const byId = new Map(zones.map(zone => [zone.id, zone]));
  const ownIds = [...me.home, ...me.route].filter(id => byId.has(id));
  const zone = byId.get(here || '') || byId.get(ownIds[0] || '') || zones[0];
  const options = compassOptions(me, zone, season, time).sort((a, b) => b.temp - a.temp);
  const best = bestOf(me, options);
  const near = best ? nearBest(me, best, options) : [];
  const why = best ? whyBest(best, options) : null;
  const activity = activityAt(me, zone, season, time);
  const verdict = activity ? activityVerdict(me, activity, best) : null;
  const windows = activityWindows(me, zone, season);
  const nowWindow = windows === 'all' ? null : windows.find(item => within(item, wrap(time))) || null;
  const nextWindow = windows === 'all' || nowWindow ? null : [...windows].sort((a, b) => wrap(a[0] - time) - wrap(b[0] - time))[0] || null;
  const swim = me.water ? options.find(item => item.kind === 'water') || options.find(item => item.kind === 'shallow') : undefined;
  const [low, high] = me.ideal!;
  // When does another option take the lead? Look ahead in quarter hours over the next day.
  let next: { at: number; option: Option } | null = null;
  for (let ahead = STEP; ahead < 24 && best; ahead += STEP) {
    const lead = bestOf(me, compassOptions(me, zone, season, time + ahead));
    if (lead && lead.kind !== best.kind) { next = { at: wrap(time + ahead), option: lead }; break; }
  }
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const plan = hours.map(hour => bestOf(me, compassOptions(me, zone, season, hour + 0.5)));
  const realAt = (hour: number) => { const date = realTimeOf(hour, realNow); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };
  const used = OPTION_ORDER.filter(kind => plan.some(item => item?.kind === kind) || options.some(item => item.kind === kind));
  const sorted = [...ownIds, ...zones.map(item => item.id).filter(id => !ownIds.includes(id))];
  return <section className="temp-compass" lang="de">
    <header>
      <div><b>Thermo-Kompass</b><small>{me.name} · Adult · Ziel-Körpertemperatur {low}–{high} °C</small></div>
      <label><span>Ich bin in</span>
        <select value={zone.id} onChange={event => onHere(event.target.value)}>
          {sorted.map(id => <option key={id} value={id}>{byId.get(id)!.name}{me.home.includes(id) ? ' ◆' : me.route.includes(id) ? ' ⇢' : ''}</option>)}
        </select>
      </label>
    </header>
    {best ? <div className="temp-compass-now">
      <div className="temp-compass-best" style={{ borderColor: OPTION[best.kind].colour }}>
        <span>Jetzt am besten</span>
        <b>{OPTION[best.kind].de}{best.where ? <small> · {best.where}</small> : null}</b>
        <em style={{ color: feelOf(me, best.temp).colour }}>{deg(best.temp)} · {feelOf(me, best.temp).de}</em>
        {why && <p className="temp-compass-why">{why}</p>}
        {near.length > 0 && <small className="temp-compass-alt">Fast gleich gut: {near.map(item => `${OPTION[item.kind].de} (${deg(item.temp)})`).join(', ')}</small>}
        {next && <small>Ab {clock(next.at)}{live ? ` (echt ${realAt(next.at)})` : ''}: {OPTION[next.option.kind].de} ({deg(next.option.temp)})</small>}
      </div>
      {activity && verdict && <div className="temp-compass-best temp-compass-act" style={{ borderColor: activity.awake ? feelOf(me, activity.open).colour : '#3b4f3e' }} title="Jagen, Streifzüge, Patrouille: unterwegs draußen in Sonne und auf dem Boden">
        <span>Aktiv sein</span>
        <b>{verdict.head}</b>
        <em style={{ color: feelOf(me, activity.open).colour }}>draußen {deg(activity.open)} · {feelOf(me, activity.open).de}</em>
        <p className="temp-compass-why">{verdict.text}</p>
        {swim && <small>Im Wasser: {deg(swim.temp)} · {feelOf(me, swim.temp).de}</small>}
        {verdict.pause && <small className="temp-compass-alt">{verdict.pause}</small>}
        <small className="temp-compass-windows">{windows === 'all' ? 'Hier den ganzen Tag gut, um aktiv zu sein.'
          : !windows.length ? 'Hier gibt es in dieser Saison keine gute Zeit draußen.'
          : <>Gute Zeiten: {windows.map(([from, to]) => `${clock(from)}–${clock(to)}`).join(', ')}
            {nowWindow && <><br />Noch bis {clock(nowWindow[1])}{live ? ` (echt ${realAt(nowWindow[1])})` : ''}</>}
            {nextWindow && <><br />Nächste ab {clock(nextWindow[0])}{live ? ` (echt ${realAt(nextWindow[0])})` : ''}</>}</>}</small>
      </div>}
      <ol className="temp-compass-options">{options.map(item => <li key={`${item.kind}-${item.where}`} className={item === best ? 'on' : near.includes(item) ? 'near' : ''} title={near.includes(item) ? `Liegt höchstens ${NEAR} °C weiter weg von deinem Wunschbereich als der beste Platz` : undefined}>
        <i style={{ background: OPTION[item.kind].colour }} />
        <span>{OPTION[item.kind].de}{item.where && <small> · {item.where}</small>}{near.includes(item) && <small className="temp-compass-tag">fast gleich gut</small>}</span>
        <b>{deg(item.temp)}</b>
        <em style={{ color: feelOf(me, item.temp).colour }}>{feelOf(me, item.temp).de}</em>
      </li>)}</ol>
    </div> : <p className="temp-compass-empty">In {zone.name} gibt es für {me.name} weder Land noch passendes Wasser.</p>}
    <div className="temp-compass-plan">
      <span className="temp-compass-cap">Am besten über den Tag in {zone.name}</span>
      <div className="temp-compass-cells" style={{ ['--now' as string]: `${(wrap(time) / 24) * 100}%` }}>
        {plan.map((item, hour) => <i key={hour} style={{ background: item ? OPTION[item.kind].colour : 'transparent' }} title={`${String(hour).padStart(2, '0')}–${String(hour + 1).padStart(2, '0')} Uhr: ${item ? `${OPTION[item.kind].de} ${deg(item.temp)}` : '–'}`} />)}
        <b className="temp-compass-now-line" />
      </div>
      <div className="temp-compass-hours">{hours.map(hour => <span key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>)}</div>
      <p className="temp-compass-key">{used.map(kind => <span key={kind}><i style={{ background: OPTION[kind].colour }} />{OPTION[kind].de}</span>)}</p>
    </div>
    <p className="temp-compass-hint">Der Kompass zeigt, wo dein Körper gerade am nächsten an {low}–{high} °C liegt.{me.dens && me.activity === 'Cathemeral' ? ` Er verbietet nichts: ${me.name} ist Tag und Nacht aktiv, und nach einem warmen Tag kühlst du draußen nur langsam aus.` : ''} Als Adult ist dein Körper träge: Er nimmt eine neue Temperatur erst nach einer Weile an. Wechsle deshalb lieber etwas früher, {me.dens
      ? 'abends in den Bau, bevor es draußen kühl wird, morgens raus, sobald die Sonne dich wärmer macht als der Bau.'
      : 'abends ins Wasser, solange es noch warm ist, morgens raus, sobald das Ufer in der Sonne wärmer ist als das Wasser.'}{!me.smallPools ? ` ${me.name} geht laut Profil nicht in kleine Teiche: Die zählen hier nicht mit.` : ''}</p>
  </section>;
}

// A day at a glance: one row per own POI (home first, then route), one cell per hour.
function DayStrip({ me, zones, season, time, active, onPick, onHover }: {
  me: ThermoPlayable; zones: ClimateZone[]; season: string; time: number; active: string | null; onPick: (id: string, hour: number) => void; onHover: (id: string | null) => void;
}) {
  const byId = new Map(zones.map(zone => [zone.id, zone]));
  const rows = [...me.home, ...me.route].map(id => byId.get(id)).filter((zone): zone is ClimateZone => Boolean(zone));
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const awake = hours.filter(hour => isActive(me.activity, hour + 0.5));
  if (!rows.length) return null;
  return <section className="temp-strip" lang="de">
    <header><b>Dein Tag in deinen POIs</b><small>{me.activity ? ACTIVITY_DE[me.activity] : ''} · gedimmt = Ruhezeit · Klick setzt Uhrzeit und Zone</small></header>
    <div className="temp-strip-grid" style={{ ['--now' as string]: `${(wrap(time) / 24) * 100}%` }}>
      <span className="temp-strip-corner" />
      <div className="temp-strip-hours">{hours.map(hour => <span key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>)}</div>
      <span />
      {rows.map(zone => {
        const levels = hours.map(hour => rate(me, zone, season, hour + 0.5));
        const good = awake.filter(hour => levels[hour]?.level === 'ok').length;
        return <div key={zone.id} className={`temp-strip-row ${active === zone.id ? 'on' : ''}`} onMouseEnter={() => onHover(zone.id)} onMouseLeave={() => onHover(null)}>
          <span className="temp-strip-name">{zone.name}{me.route.includes(zone.id) && <em title="Auf deiner Wanderroute"> ⇢</em>}</span>
          <div className="temp-strip-cells">{levels.map((rating, hour) => <button type="button" key={hour} className={`${isActive(me.activity, hour + 0.5) ? '' : 'rest'}`} style={{ background: rating ? look(rating).colour : 'transparent' }} title={`${zone.name}, ${String(hour).padStart(2, '0')}–${String(hour + 1).padStart(2, '0')} Uhr: ${rating ? look(rating).de : 'nicht bewertet'}${rating?.refuge ? ` (${REFUGE_DE[rating.refuge]} hilft)` : ''}${rating?.resting ? ', ruht' : ''}`} onClick={() => onPick(zone.id, hour + 0.5)} />)}<i className="temp-strip-now" /></div>
          <span className="temp-strip-sum" title="Angenehme Stunden in deiner Aktivzeit">{good}/{awake.length}</span>
        </div>;
      })}
    </div>
  </section>;
}

function ZoneCard({ zone, area, climate, season, time, me, mine, pinned, onClose, onTime }: {
  zone: ClimateZone; area: Area; climate: ClimateIndex; season: string; time: number; me: ThermoPlayable | null; mine: Set<string>; pinned: boolean; onClose: () => void; onTime: (value: number) => void;
}) {
  const at0 = anchorOf(area);
  const side = at0.x > 0.55 ? { right: `calc(${(1 - at0.x) * 100}% + 16px)` } : { left: `calc(${at0.x * 100}% + 16px)` };
  const series = zone.seasons[season];
  const frame = climate.frame;
  const air = at(series.air, time)!, feel = at(series.feel, time)!, sun = at(series.feelSun, time), rh = at(series.rh, time)!, dew = at(series.dew, time)!;
  const wind = at(series.wind, time)!, gust = at(series.gust, time)!;
  const from = windFrom(series, frame, time);
  const scale = beaufort(wind);
  const deep = series.deep ? at(series.deep, time) : null;
  const tags = [zone.exposureDe, zone.canopy >= 0.3 && `Kronendach ${Math.round(zone.canopy * 100)} %`, zone.geothermal > 0 && 'Erdwärme', zone.water && 'Wasser zum Abkühlen'].filter(Boolean) as string[];
  const flags = signals(zone, series, time);
  const range = (values: number[]) => `${deg(Math.min(...values))} bis ${deg(Math.max(...values))}`;
  const rating = me ? rate(me, zone, season, time) : null;
  // A spot shares its zone's sun and den; its own air, feel, ground and water make the difference.
  // Sea animals are rated on the zone's sea only.
  const spotLook = (values: ClimateZone['spots'][number]['seasons'][string]) => {
    if (!me || !rating || rating.where === 'sea') return null;
    const ectotherm = me.tier === 'E';
    const feelNow = at(values.feel, time)!;
    const temps = bodyTemps({ air: at(values.air, time)!, feel: feelNow, feelSun: sun != null ? feelNow + (sun - feel) : null, ground: at(values.ground, time) }, ectotherm);
    const own = me.water && values.water ? at(values.water.surface, time)! : null;
    const water = own != null ? { cool: inWater(own, ectotherm), warm: inWater(own, ectotherm) } : null;
    return look({ ...comfort(me.band, { ...temps, den: rating.den, water, ectotherm, resting: rating.resting }), ...temps, den: rating.den, waterCool: own, waterWarm: own, where: 'land' });
  };
  const water = series.water && zone.body ? { body: zone.body, surface: at(series.water.surface, time)!, deep: series.water.deep, oxygen: at(series.water.oxygen, time)! } : null;
  const spotWater = zone.spots.some(spot => spot.seasons[season].water);
  return <div className={`temp-card ${pinned ? 'pinned' : ''}`} style={{ ...side, top: `${at0.y * 100}%`, transform: `translateY(-${at0.y * 100}%)` }}>
    <header>
      <h2>{zone.name}</h2>
      {pinned && <button type="button" className="temp-card-close" onClick={onClose} aria-label="Schließen">×</button>}
      <div className="temp-card-tags">{me && mine.has(zone.id) && <span className="mine">{me.route.includes(zone.id) ? '⇢ deine Route' : '◆ dein POI'}</span>}{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </header>

    {me && <FitLine me={me} rating={rating} oxygen={water?.oxygen ?? null} />}

    <div className="temp-now">
      <div><span>Luft</span><b>{deg(air)}</b><small>2 m, Schatten</small></div>
      <div><span>Gefühlt</span><b>{deg(feel)}</b><small>{sun != null ? `Sonne ${deg(sun)}` : 'Schatten'}</small></div>
      <div className="wide"><span>Boden</span>
        {series.ground ? <b className="multi">{zone.surfaces.map(id => <em key={id}>{climate.surfaces[id]} <strong>{deg(at(series.ground![id], time))}</strong></em>)}</b> : <b className="muted">kein Land</b>}
        <small>{series.ground ? `in ${frame.depthCm} cm Tiefe ${deg(deep)}` : 'offenes Wasser'}</small>
      </div>
      {(water || spotWater) && <div className="wide"><span>Wasser</span>
        {water ? <b className="multi"><em>{water.body.de} <strong>{deg(water.surface)}</strong></em>{water.deep != null && <em>{water.body.deepDe} <strong>{deg(water.deep)}</strong></em>}</b> : <b className="muted">nur in den Kleinklima-Spots</b>}
        {water && <small>{water.body.saltDe} · Sauerstoff {decimal(water.oxygen)} mg/l{water.body.stagnant ? ' · stehend, sauerstoffarm' : ''}</small>}
      </div>}
      <div><span>Feuchte</span><b>{Math.round(rh)} %</b><small>Taupunkt {deg(dew)}</small></div>
      <div><span>Wind</span><b>{kmh(wind)}</b><small>aus {COMPASS[from]?.de || from} · Böen {Math.round(gust)}</small></div>
      <div className="wide"><span>Stärke</span><b className="small">Bft {scale.force} · {scale.de}</b></div>
    </div>

    {flags.length > 0 && <div className="temp-flags">{flags.map(flag => <span key={flag.de} className={`f-${flag.tone}`} title={flag.title}><i aria-hidden="true">{flag.tone === 'fog' ? '≋' : flag.tone === 'wind' ? '➶' : flag.tone === 'cool' ? '❄' : '▲'}</i>{flag.de}</span>)}</div>}

    <DayChart series={series} surface={zone.surfaces[0] ? { id: zone.surfaces[0], de: climate.surfaces[zone.surfaces[0]] } : null} frame={frame} time={time} interactive={pinned} onTime={onTime} />
    <p className="temp-day">Heute: Luft {range(series.air)}{series.ground && zone.surfaces[0] ? `, Boden ${range(series.ground[zone.surfaces[0]])}` : ''}{series.water ? `, Wasser ${range(series.water.surface)}` : ''}, Wind Ø {Math.round(series.wind.reduce((sum, value) => sum + value, 0) / 24)} km/h, Böen bis {Math.round(Math.max(...series.gust))}</p>

    <p className="temp-why" lang="de">{zone.why}{zone.body?.why ? ` ${zone.body.why}` : ''}</p>

    {zone.spots.length > 0 && <section className="temp-spots">
      <h3>Kleinklima<small>Luft · Boden · Wasser</small></h3>
      {zone.spots.map(spot => {
        const values = spot.seasons[season];
        const shown = spotLook(values);
        return <div key={spot.id} className="temp-spot" title={spot.note}>
          <span className="temp-spot-name">{shown && <i className="temp-dot" style={{ background: shown.colour }} title={`Für ${me!.name}: ${shown.de}`} />}{spot.name}<small>{spot.kindDe}{spot.body && spot.body.salt !== 'fresh' ? ` · ${spot.body.saltDe}` : ''}{values.fog.includes(Math.round(wrap(time)) % 24) ? ' · Nebel' : ''}</small></span>
          <b>{deg(at(values.air, time))}</b>
          <b className="ground" title={climate.surfaces[spot.surface]}>{deg(at(values.ground, time))}</b>
          <b className="water" title={values.water?.deep != null ? `${spot.body?.deepDe}: ${deg(values.water.deep)}` : spot.body?.de}>{values.water ? deg(at(values.water.surface, time)) : '–'}</b>
          {pinned && <p>{spot.note}{values.water?.deep != null ? ` ${spot.body?.deepDe} ${deg(values.water.deep)}.` : ''}</p>}
        </div>;
      })}
    </section>}
  </div>;
}

function FitLine({ me, rating, oxygen }: { me: ThermoPlayable; rating: Rating; oxygen: number | null }) {
  if (!rating) return <div className="temp-fit" style={{ borderLeftColor: '#3a4b3d' }}><b>Nicht bewertet</b><small>{me.aquatic ? `Kein Meerwasser: ${me.name} lebt im Meer.` : `Offenes Meer: kein Ort für ${me.name}.`}</small></div>;
  const [tooCold, cool, warm, tooHot] = me.band;
  const shown = look(rating);
  const sea = rating.where === 'sea';
  const outside = `${sea ? 'an der Oberfläche' : 'draußen'} ${deg(rating.open)}`;
  const limit = rating.open > warm ? (rating.open > tooHot ? `zu ${sea ? 'warm' : 'heiß'} ab ${deg(tooHot)}` : `angenehm bis ${deg(warm)}`)
    : rating.open < cool ? (rating.open < tooCold ? `zu kalt unter ${deg(tooCold)}` : `angenehm ab ${deg(cool)}`)
      : `angenehm von ${deg(cool)} bis ${deg(warm)}`;
  const place = rating.refuge ? (sea && rating.refuge === 'shade' ? 'Die kühlere Tiefe' : REFUGE_DE[rating.refuge]) : null;
  const value = refugeValue(rating);
  const help = place ? `${place}${value != null ? ` (${deg(value)})` : ''} hilft: dort ${LEVEL[rating.best].de}.` : shown.strength === 'danger' ? (sea ? 'Hier gibt es keine kühlere Tiefe.' : 'Kein Schatten, Bau oder Wasser hilft hier genug.') : '';
  const breath = me.gills && oxygen != null && oxygen < 7 ? ` Warmes Wasser hält wenig Sauerstoff (${decimal(oxygen)} mg/l): für Kiemenatmer anstrengend.` : '';
  return <div className="temp-fit" style={{ borderLeftColor: shown.colour }}>
    <b><i aria-hidden="true" style={{ color: shown.colour === LEVEL.ok.colour ? '#9fd18a' : shown.colour }}>{shown.glyph}</i>{shown.de} für {me.name}</b>
    <small>{rating.resting ? `${me.name} ruht jetzt und liegt im besten Platz. ` : ''}{outside}, {limit}. {help}{breath}</small>
  </div>;
}

const CHART = { width: 330, height: 120, left: 26, right: 8, top: 8, bottom: 18 };

function DayChart({ series, surface, frame, time, interactive, onTime }: {
  series: ClimateSeries; surface: { id: string; de: string } | null; frame: Frame; time: number; interactive: boolean; onTime: (value: number) => void;
}) {
  const [probe, setProbe] = useState<number | null>(null);
  const ground = surface && series.ground ? series.ground[surface.id] : null;
  const water = series.water?.surface || null;
  const all = [...series.air, ...(ground || []), ...(water || [])];
  const low = Math.floor((Math.min(...all) - 2) / 5) * 5, high = Math.ceil((Math.max(...all) + 2) / 5) * 5;
  const plotW = CHART.width - CHART.left - CHART.right, plotH = CHART.height - CHART.top - CHART.bottom;
  const x = (hour: number) => CHART.left + (hour / 24) * plotW;
  const y = (value: number) => CHART.top + (1 - (value - low) / (high - low)) * plotH;
  const path = (values: number[]) => [...values, values[0]].map((value, hour) => `${hour ? 'L' : 'M'}${x(hour).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: Math.floor((high - low) / 10) + 1 }, (_, index) => low + index * 10).filter(value => value <= high);
  const hourAt = (event: ReactMouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(24 - STEP, Math.round(((event.clientX - box.left) / box.width) * 24 / STEP) * STEP));
  };
  const shown = probe ?? time;
  const airNow = at(series.air, shown)!, groundNow = ground ? at(ground, shown) : null, waterNow = water ? at(water, shown) : null;
  return <figure className="temp-chart">
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={`Tagesgang: Luft ${Math.round(Math.min(...series.air))} bis ${Math.round(Math.max(...series.air))} Grad${ground ? `, Boden ${Math.round(Math.min(...ground))} bis ${Math.round(Math.max(...ground))} Grad` : ''}${water ? `, Wasser ${Math.round(Math.min(...water))} bis ${Math.round(Math.max(...water))} Grad` : ''}`}>
      <rect className="night" x={x(0)} y={CHART.top} width={x(frame.sunrise) - x(0)} height={plotH} />
      <rect className="night" x={x(frame.sunset)} y={CHART.top} width={x(24) - x(frame.sunset)} height={plotH} />
      {ticks.map(value => <g key={value}><line className="grid" x1={CHART.left} x2={CHART.width - CHART.right} y1={y(value)} y2={y(value)} /><text className="axis" x={CHART.left - 4} y={y(value) + 3} textAnchor="end">{value}°</text></g>)}
      {[0, 6, 12, 18].map(hour => <text key={hour} className="axis" x={x(hour)} y={CHART.height - 4} textAnchor={hour ? 'middle' : 'start'}>{String(hour).padStart(2, '0')}</text>)}
      {ground && <path className="line ground" d={path(ground)} />}
      {water && <path className="line water" d={path(water)} />}
      <path className="line air" d={path(series.air)} />
      <line className="now" x1={x(time)} x2={x(time)} y1={CHART.top} y2={CHART.top + plotH} />
      {probe != null && <line className="probe" x1={x(probe)} x2={x(probe)} y1={CHART.top} y2={CHART.top + plotH} />}
      <circle className="dot air" cx={x(shown)} cy={y(airNow)} r={4} />
      {groundNow != null && <circle className="dot ground" cx={x(shown)} cy={y(groundNow)} r={4} />}
      {waterNow != null && <circle className="dot water" cx={x(shown)} cy={y(waterNow)} r={4} />}
      {interactive && <rect className="hit" x={CHART.left} y={CHART.top} width={plotW} height={plotH} onMouseMove={event => setProbe(hourAt(event))} onMouseLeave={() => setProbe(null)} onClick={event => onTime(hourAt(event))} />}
    </svg>
    <figcaption>
      <span><i className="air" />Luft {deg(airNow)}</span>
      {ground && <span><i className="ground" />{surface!.de} {deg(groundNow)}</span>}
      {water && <span><i className="water" />Wasser {deg(waterNow)}</span>}
      <span className="when">{probe != null ? `${clock(probe)} · Klick setzt die Uhrzeit` : clock(time)}</span>
    </figcaption>
  </figure>;
}
