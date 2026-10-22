import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { combatSide, simulateFight, type CombatStats } from '../../shared/combat-sim.mjs';
import { api, type Catalog, type CatalogItem, type FoodWebIndex, type FoodWebVerdict, type MapRegion, type PlayMode, type PoiRadar, type WorldMap } from './api';
import { DinoAvatar as Avatar } from './DinoAvatar';
import { herdApi, type HerdDino } from './herd';
import { PlayModeSwitch, usePlayMode } from './PlayMode';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './poi-radar.css';

// POI radar: pick what you play, hover a POI and see who is there. Hunters get their prey in the
// profile's own order (food web ranks) with a win chance and the speed check; everyone gets the
// threats there, rated by fight and escape. The map stays quiet: your POIs are lit, the rest is
// dimmed, the hovered one gets a thin outline. Everything else sits on the card.

const ME_KEY = 'dynasty.radar.me';
const ALL_KEY = 'dynasty.radar.all';
const DEFAULT_ME = 'allosaurus';
const HUNTABLE = new Set(['priority', 'allowed', 'legal', 'last', 'special']);
const STAGE_DE = ['Hatchling', 'Juvenile', 'Adolescent', 'Sub-Adult', 'Adult'];
const LEVEL_DE = ['', 'gering', 'mittel', 'hoch', 'extrem'];
// How much of a lost fight is a real danger, by whether you can still outrun the attacker.
const ESCAPE: Record<string, number> = { 'attacker-faster': 1, 'attacker-edge': 0.85, 'approach-advantage': 0.85, 'close-chase': 0.7, 'target-can-disengage': 0.35 };
const ACTIVITY_DE: Record<string, string> = { Diurnal: 'tagaktiv', Nocturnal: 'nachtaktiv', Cathemeral: 'tag & nacht', Crepuscular: 'Dämmerung' };

type Area = MapRegion & { shape: Extract<MapRegion['shape'], { type: 'polygon' }> };
type Tempo = 'up' | 'even' | 'down';
interface Prey {
  id: string; v: FoodWebVerdict; group: 'clamp' | 'fav' | 'ok' | 'last'; rank: string; rankTitle: string;
  chance: number | null; herd: { size: number; chance: number | null } | null; tempo: Tempo;
  young: 'only' | 'first' | null; clamp: string | null; route: boolean; asleep: boolean; note: string;
}
interface Threat { id: string; level: number; chance: number | null; size: number; tempo: Tempo; route: boolean; young: boolean; asleep: boolean; note: string }
interface Reading { prey: Prey[] | null; threats: Threat[]; score: number; worst: number; serious: number }

function readStore<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* per-viewer convenience only */ }
}

const polygon = (area: Area) => area.shape.points.map(([x, y]) => `${x},${y}`).join(' ');
const anchorOf = (area: Area) => area.anchor || { x: area.shape.points.reduce((s, p) => s + p[0], 0) / area.shape.points.length, y: area.shape.points.reduce((s, p) => s + p[1], 0) / area.shape.points.length };
// Lower is a stronger reason to hunt (same order as the food web).
const verdictScore = (v: FoodWebVerdict) => v.k === 'priority' ? v.r ?? 1 : v.k === 'allowed' || v.k === 'legal' ? 50 : v.k === 'last' ? 60 : v.k === 'special' ? 70 : v.k === 'locked' ? 80 : v.k === 'never' ? 90 : 99;
// The strongest verdict over all setups; on a tie the bigger party (the worst case as a threat).
const bestSetup = (per: FoodWebVerdict[], sizes: number[]) => per.reduce((best, item, index) => {
  const delta = verdictScore(item) - verdictScore(per[best]);
  return delta < 0 || (delta === 0 && (sizes[index] || 1) > (sizes[best] || 1)) ? index : best;
}, 0);

// Both awake at the same time? Hunting is limited to active hours (rule 1.4).
function overlaps(a: string | null, b: string | null) {
  if (!a || !b || a === 'Cathemeral' || b === 'Cathemeral') return true;
  return a === b || a === 'Crepuscular' || b === 'Crepuscular';
}

// The fight sim is deterministic; its margin reads as a chance: winning with 80 % health left ≈ 90 %,
// a narrow win ≈ 50 %, a loss in which the other side keeps 60 % ≈ 20 %.
function chanceOf(attacker: CombatStats | undefined, attackers: number, defender: CombatStats | undefined, defenders: number) {
  if (!attacker || !defender || (!attacker.dps && !defender.dps)) return null;
  const sim = simulateFight(combatSide(attacker, 'attacker'), attackers, combatSide(defender, 'defender'), defenders);
  if (sim.winner === 'attacker') return 0.5 + sim.attackerHpShare / 2;
  if (sim.winner === 'defender') return 0.5 - sim.defenderHpShare / 2;
  return 0.5;
}

function tempoOf(verdict: string | undefined, youAttack: boolean): Tempo {
  if (!verdict || verdict === 'close-chase') return 'even';
  const attackerAhead = verdict !== 'target-can-disengage';
  return attackerAhead === youAttack ? 'up' : 'down';
}

function read(radar: PoiRadar, web: FoodWebIndex, me: string, poi: string, mode: PlayMode): Reading {
  const self = radar.dinos[me];
  const card = radar.cards[me];
  const present = Object.entries(radar.dinos).filter(([id, dino]) => id !== me && (dino.home.includes(poi) || dino.route.includes(poi)));
  const onRoute = (id: string) => !radar.dinos[id].home.includes(poi);
  const defenders = mode === 'solo' ? 1 : card?.engagementUnlimited ? 3 : card?.engagementLimit || 1;

  const hunter = web.hunters[me];
  let prey: Prey[] | null = null;
  if (hunter && !hunter.none) {
    const edges = new Map(hunter.edges.map(edge => [edge.t, edge]));
    const clampStyle = self.clamp?.ability === 'clamp' && /Aquatic/.test(self.habitat || '');
    prey = [];
    for (const [id, dino] of present) {
      const edge = edges.get(id);
      if (!edge) continue;
      const index = mode === 'solo' ? 0 : bestSetup(edge.per, hunter.setups.map(setup => setup.size));
      const v = edge.per[index];
      if (!HUNTABLE.has(v.k)) continue;
      const size = mode === 'solo' ? 1 : hunter.setups[index]?.size || 1;
      const them = radar.cards[id];
      const youngRule = (v.c || []).some(text => /Jungtier/i.test(text));
      const young = youngRule ? (v.c || []).some(text => /Adult/i.test(text)) ? 'first' : 'only' : null;
      const reach = self.clamp ? dino.cw.reduce<number>((max, weight, stage) => weight != null && weight < self.clamp!.capacity ? stage : max, -1) : -1;
      const herdSize = them && !them.engagementUnlimited && them.engagementLimit > 1 ? them.engagementLimit : null;
      const stage = hunter.stages.find(item => item.rank === v.r);
      prey.push({
        id, v, rank: v.k === 'priority' ? String(v.r ?? 1) : v.k === 'last' ? '↓' : v.k === 'special' ? '◇' : '•',
        rankTitle: v.k === 'priority' ? `Rang ${v.r}${stage ? `: ${stage.label}` : ''}` : v.k === 'last' ? 'Erst wenn nichts anderes da ist' : v.k === 'special' ? 'Nur unter einer Bedingung' : 'Freie Wahl (erlaubt)',
        group: clampStyle && reach === 4 ? 'clamp' : v.k === 'priority' ? 'fav' : v.k === 'allowed' || v.k === 'legal' ? 'ok' : 'last',
        chance: young === 'only' ? null : chanceOf(card, size, them, 1),
        herd: herdSize && young !== 'only' ? { size: herdSize, chance: chanceOf(card, size, them, herdSize) } : null,
        tempo: tempoOf(radar.pairs[me]?.[id]?.v, true), young,
        clamp: reach < 0 ? null : reach === 4 ? 'Adult' : `bis ${STAGE_DE[reach]}`,
        route: onRoute(id), asleep: !overlaps(self.activity, dino.activity),
        note: (v.c || []).join(' · '),
      });
    }
    // Inside a rank the meal that pays off comes first: win chance times how much meat it carries
    // (tiny critters are an easy 100 % but hardly a meal for a big hunter).
    const own = self.cw.at(-1) || 1;
    const worth = (item: Prey) => (item.chance ?? 0.4) * Math.sqrt(Math.min(1, (radar.dinos[item.id].cw.at(-1) || 0) / own));
    const order = { clamp: 0, fav: 1, ok: 2, last: 3 };
    prey.sort((a, b) => order[a.group] - order[b.group] || verdictScore(a.v) - verdictScore(b.v) || worth(b) - worth(a));
  }

  const threats: Threat[] = [];
  for (const [id, dino] of present) {
    const them = radar.cards[id];
    const theirWeb = web.hunters[id];
    let size = 1, young = false, note = '';
    if (theirWeb) {
      if (theirWeb.none) continue;
      const edge = theirWeb.edges.find(item => item.t === me);
      if (!edge) continue;
      const index = bestSetup(edge.per, theirWeb.setups.map(setup => setup.size));
      const v = edge.per[index];
      if (!HUNTABLE.has(v.k)) continue;
      size = theirWeb.setups[index]?.size || 1;
      young = (v.c || []).some(text => /Jungtier/i.test(text)) && !(v.c || []).some(text => /Adult/i.test(text));
      note = (v.c || []).join(' · ');
    } else {
      if (!radar.pairs[id]?.[me]?.a) continue;
      size = them?.huntUnlimited ? 3 : them?.huntLimit || 1;
    }
    const theirs = chanceOf(them, size, card, defenders);
    const verdict = radar.pairs[id]?.[me]?.v;
    const danger = (theirs ?? 0.5) * (ESCAPE[verdict || 'close-chase'] ?? 0.7);
    const level = young ? 1 : danger >= 0.7 ? 4 : danger >= 0.5 ? 3 : danger >= 0.3 ? 2 : 1;
    threats.push({ id, level, chance: theirs == null ? null : 1 - theirs, size, tempo: tempoOf(verdict, false), route: onRoute(id), young, asleep: !overlaps(self.activity, dino.activity), note });
  }
  threats.sort((a, b) => b.level - a.level || (a.chance ?? 0.5) - (b.chance ?? 0.5));

  const weight = (item: Prey) => (item.group === 'clamp' ? 3 : item.v.k === 'priority' ? Math.max(1.5, 3.5 - (item.v.r ?? 1) * 0.5) : item.group === 'ok' ? 1 : 0.4) * (item.chance ?? 0.6);
  return { prey, threats, score: (prey || []).reduce((sum, item) => sum + weight(item), 0), worst: threats.reduce((max, item) => Math.max(max, item.level), 0), serious: threats.filter(item => item.level >= 3).length };
}

const tone = (chance: number | null) => chance == null ? 'none' : chance >= 0.7 ? 'good' : chance >= 0.5 ? 'fair' : chance >= 0.35 ? 'hard' : 'bad';
const pct = (chance: number | null) => chance == null ? '–' : `${Math.round(chance * 100)}%`;
const TEMPO = { up: { glyph: '▲', de: 'du bist schneller' }, even: { glyph: '≈', de: 'etwa gleich schnell, die Ausdauer entscheidet' }, down: { glyph: '▼', de: 'du bist langsamer' } };

export function PoiRadarPage({ route }: { route: string }) {
  const [data, setData] = useState<{ radar: PoiRadar; web: FoodWebIndex; catalog: Catalog; world: WorldMap } | null>(null);
  const [herd, setHerd] = useState<HerdDino[]>([]);
  const [error, setError] = useState('');
  const [all, setAll] = useState<boolean>(() => readStore(ALL_KEY, false));
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const mode = usePlayMode();
  const fromRoute = decodeURIComponent(route.split('/')[2] || '') || null;
  const me = fromRoute || readStore(ME_KEY, DEFAULT_ME);

  useEffect(() => {
    Promise.all([api.poiRadar(), api.foodWeb(), api.catalog(), api.worldMap()])
      .then(([radar, web, catalog, world]) => setData({ radar, web, catalog, world })).catch(cause => setError((cause as Error).message));
    herdApi.list().then(setHerd).catch(() => setHerd([]));
  }, []);
  useEffect(() => { if (fromRoute) writeStore(ME_KEY, fromRoute); }, [fromRoute]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPinned(null); setHover(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { setPinned(null); setHover(null); }, [me]);

  const derived = useMemo(() => {
    if (!data || !data.radar.dinos[me]) return null;
    const { radar, web, catalog, world } = data;
    const items = new Map(catalog.profiles.map(item => [item.id, item]));
    const areas = world.regions.filter((region): region is Area => region.shape.type === 'polygon' && !region.within);
    const self = radar.dinos[me];
    const mine = new Set([...self.home, ...self.route]);
    const readings = new Map(areas.map(area => [area.id, read(radar, web, me, area.id, mode)]));
    return { items, areas, self, mine, readings };
  }, [data, me, mode]);

  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading label="Loading POI radar…" />;
  if (!derived) return <div className="catalog-empty"><strong>Unbekanntes Playable</strong><p>{me}</p><button type="button" className="secondary-button" onClick={() => go(`/radar/${DEFAULT_ME}`)}>Allosaurus wählen</button></div>;
  const { radar } = data;
  const { items, areas, self, mine, readings } = derived;
  const choose = (id: string) => { writeStore(ME_KEY, id); go(`/radar/${id}`); };
  const toggleAll = () => setAll(value => { writeStore(ALL_KEY, !value); return !value; });
  const active = hover || pinned;
  const activeArea = active ? areas.find(area => area.id === active) || null : null;
  const lit = (id: string) => all || mine.has(id);
  const ownList = areas.filter(area => mine.has(area.id)).sort((a, b) => derived.readings.get(b.id)!.score - derived.readings.get(a.id)!.score || derived.readings.get(a.id)!.worst - derived.readings.get(b.id)!.worst);
  const isHunter = Boolean(data.web.hunters[me] && !data.web.hunters[me].none);
  const stamp = encodeURIComponent(radar.generatedAt);

  return <>
    <ExplorerTopline section="PROFILES / POI RADAR" count={`${areas.length} POIS · ${Object.keys(radar.dinos).length} PLAYABLES`} />
    <header className="directory-head radar-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · POI RADAR</div>
        <h1>POI-Radar</h1>
        <p lang="de">Wähle, was du spielst, und fahr über einen POI: Beute in deiner Profil-Reihenfolge mit Siegchance, dazu die Gefahren vor Ort.</p>
      </div>
    </header>

    <div className="radar-bar">
      <MePicker me={me} items={items} radar={radar} herd={herd} mode={mode} onChoose={choose} />
      <div className="radar-switches">
        <PlayModeSwitch compact />
        <button type="button" className={`radar-toggle ${all ? 'on' : ''}`} aria-pressed={all} onClick={toggleAll} title="Nur deine Profil-POIs und Routen oder alle POIs der Karte">{all ? 'Alle POIs' : 'Nur meine POIs'}</button>
      </div>
    </div>

    <div className="radar-layout">
      <div className="radar-map-wrap">
        <div className="radar-stage" onMouseLeave={() => setHover(null)}>
          <div className="radar-map">
          <img src={`${api.mapLayerUrl('layers/base-clean.png')}?v=${stamp}`} alt="Karte der Insel mit allen POIs" />
          <svg className="radar-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {!all && <>
              <defs><mask id="radar-mine" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill="white" />{areas.filter(area => mine.has(area.id)).map(area => <polygon key={area.id} points={polygon(area)} fill="black" />)}</mask></defs>
              <rect className="radar-veil" width="1" height="1" mask="url(#radar-mine)" />
            </>}
            {pinned && pinned !== hover && (() => { const area = areas.find(item => item.id === pinned); return area ? <polygon className="radar-outline pinned" points={polygon(area)} /> : null; })()}
            {activeArea && <polygon className="radar-outline" points={polygon(activeArea)} />}
          </svg>
          <svg className="radar-hits" viewBox="0 0 1 1" preserveAspectRatio="none">
            {areas.filter(area => lit(area.id)).map(area => <polygon key={area.id} points={polygon(area)} aria-label={area.name} onMouseEnter={() => setHover(area.id)} onClick={() => setPinned(value => value === area.id ? null : area.id)} />)}
          </svg>
          </div>
          {activeArea && <PoiCard key={activeArea.id} area={activeArea} reading={readings.get(activeArea.id)!} mine={mine.has(activeArea.id)} onRoute={self.route.includes(activeArea.id)} isHunter={isHunter} items={items} radar={radar} mode={mode} pinned={pinned === activeArea.id} onClose={() => setPinned(null)} />}
        </div>
        <p className="radar-hint" lang="de">Hover zeigt den POI, Klick hält ihn fest, <kbd>Esc</kbd> löst ihn. Prozent = deine Siegchance im offenen Kampf (Simulation, ohne Hinterhalt und Ausweichen). ▲ ≈ ▼ = dein Tempo gegenüber dem anderen.</p>
      </div>

      <aside className="radar-panel">
        <div className="radar-panel-head"><b>{isHunter ? 'Deine Jagdgründe' : 'Deine POIs'}</b><small>{isHunter ? 'nach Beute sortiert' : 'nach Gefahr sortiert'}</small></div>
        {ownList.length ? <ol className="radar-list">{(isHunter ? ownList : [...ownList].sort((a, b) => readings.get(a.id)!.serious - readings.get(b.id)!.serious || readings.get(a.id)!.threats.length - readings.get(b.id)!.threats.length)).map(area => {
          const reading = readings.get(area.id)!;
          return <li key={area.id}><button type="button" className={active === area.id ? 'on' : ''} onMouseEnter={() => setHover(area.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(area.id)} onBlur={() => setHover(null)} onClick={() => setPinned(value => value === area.id ? null : area.id)}>
            <span className="radar-list-name">{area.name}{self.route.includes(area.id) && <i title="Auf deiner Wanderroute">⇢</i>}</span>
            {isHunter && <span className="radar-list-prey">{(reading.prey || []).slice(0, 4).map(item => <Avatar key={item.id} id={item.id} items={items} mode={mode} size="xs" />)}<em>{reading.prey?.length || 0}</em></span>}
            <span className="radar-list-risk" title={`${reading.serious} ernste Gefahren (hoch oder extrem)`}><Level value={reading.worst} /><em>{reading.serious || ''}</em></span>
          </button></li>;
        })}</ol> : <p className="radar-empty" lang="de">Für {self.name} sind keine POIs eingetragen.</p>}
      </aside>
    </div>
  </>;
}

function MePicker({ me, items, radar, herd, mode, onChoose }: { me: string; items: Map<string, CatalogItem>; radar: PoiRadar; herd: HerdDino[]; mode: PlayMode; onChoose: (id: string) => void }) {
  const self = radar.dinos[me];
  const byDiet = (diet: string) => Object.entries(radar.dinos).filter(([, dino]) => dino.diet === diet).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const own = herd.filter(dino => dino.playableId && radar.dinos[dino.playableId]);
  return <div className="radar-me">
    <Avatar id={me} items={items} mode={mode} size="lg" />
    <label><span lang="de">Ich spiele</span>
      <select value={me} onChange={event => onChoose(event.target.value)}>
        <optgroup label="Fleischfresser">{byDiet('Carnivore').map(([id, dino]) => <option key={id} value={id}>{dino.name}</option>)}</optgroup>
        <optgroup label="Pflanzenfresser">{byDiet('Herbivore').map(([id, dino]) => <option key={id} value={id}>{dino.name}</option>)}</optgroup>
      </select>
      <small>{[self.tier, self.diet === 'Carnivore' ? 'Fleischfresser' : 'Pflanzenfresser', self.activity && ACTIVITY_DE[self.activity]].filter(Boolean).join(' · ')}</small>
    </label>
    {own.length > 0 && <div className="radar-herd" aria-label="Meine Dinos">{own.map(dino => <button type="button" key={dino.id} className={dino.playableId === me ? 'on' : ''} onClick={() => onChoose(dino.playableId!)} title={`${dino.name}: ${radar.dinos[dino.playableId!].name}`}>
      {dino.photo ? <img src={herdApi.fileUrl(dino, dino.photo)} alt="" /> : <Avatar id={dino.playableId!} items={items} mode={mode} size="xs" />}{dino.name}
    </button>)}</div>}
  </div>;
}

function Level({ value }: { value: number }) {
  return <span className={`radar-level l${value}`} title={value ? `Gefahr: ${LEVEL_DE[value]}` : 'Keine Gefahr bekannt'} aria-label={value ? `Gefahr ${LEVEL_DE[value]}` : 'keine Gefahr'}>{[1, 2, 3, 4].map(step => <i key={step} className={step <= value ? 'on' : ''} />)}</span>;
}

function Chance({ value }: { value: number | null }) {
  return <span className={`radar-chance ${tone(value)}`}><i style={{ width: `${Math.round((value ?? 0) * 100)}%` }} /><b>{pct(value)}</b></span>;
}

const GROUP_DE: Record<Prey['group'], string> = { clamp: 'Runterziehen', fav: 'Lieblingsbeute', ok: 'Auch möglich', last: 'Notfalls' };
// Rows per list before "+n weitere": the favourites stay complete, the free choice shows the easiest.
const LIMIT: Record<Prey['group'] | 'threats', number> = { clamp: 6, fav: 6, ok: 5, last: 3, threats: 6 };

function Capped<T>({ rows, limit, open, pinned, onMore, render }: { rows: T[]; limit: number; open: boolean; pinned: boolean; onMore: () => void; render: (row: T) => ReactNode }) {
  const shown = open ? rows : rows.slice(0, limit);
  return <>
    {shown.map(render)}
    {rows.length > shown.length && (pinned
      ? <button type="button" className="radar-more" onClick={onMore}>+{rows.length - shown.length} weitere</button>
      : <span className="radar-more" lang="de">+{rows.length - shown.length} weitere · Klick zum Festhalten</span>)}
  </>;
}

function PoiCard({ area, reading, mine, onRoute, isHunter, items, radar, mode, pinned, onClose }: {
  area: Area; reading: Reading; mine: boolean; onRoute: boolean; isHunter: boolean; items: Map<string, CatalogItem>; radar: PoiRadar; mode: PlayMode; pinned: boolean; onClose: () => void;
}) {
  const at = anchorOf(area);
  const side = at.x > 0.55 ? { right: `calc(${(1 - at.x) * 100}% + 16px)` } : { left: `calc(${at.x * 100}% + 16px)` };
  const groups = (['clamp', 'fav', 'ok', 'last'] as const).map(group => ({ group, rows: (reading.prey || []).filter(item => item.group === group) })).filter(item => item.rows.length);
  const name = (id: string) => radar.dinos[id]?.name || id;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const more = (key: string) => setOpen(current => new Set([...current, key]));
  return <div className={`radar-card ${pinned ? 'pinned' : ''}`} style={{ ...side, top: `${at.y * 100}%`, transform: `translateY(-${at.y * 100}%)` }}>
    <header>
      <h2>{area.name}</h2>
      {pinned && <button type="button" className="radar-card-close" onClick={onClose} aria-label="Schließen">×</button>}
      <div className="radar-card-tags">{mine ? <span className="mine">{onRoute ? '⇢ deine Route' : 'dein POI'}</span> : <span>kein POI von dir</span>}</div>
    </header>

    {isHunter && <section>
      <h3><span lang="de">Beute</span><em>{reading.prey?.length || 0}</em><small>Rang · Tempo · Chance</small></h3>
      {groups.length ? groups.map(({ group, rows }) => <div key={group} className={`radar-group g-${group}`}>
        <span className="radar-group-cap">{GROUP_DE[group]}</span>
        <Capped rows={rows} limit={LIMIT[group]} open={open.has(group)} pinned={pinned} onMore={() => more(group)} render={item => <div key={item.id} className="radar-row" title={[item.rankTitle, TEMPO[item.tempo].de, item.herd ? `gegen ${item.herd.size}: ${pct(item.herd.chance)}` : '', item.note].filter(Boolean).join(' · ')}>
          <span className={`radar-rank k-${item.v.k}`}>{item.rank}</span>
          <Avatar id={item.id} items={items} mode={mode} />
          <span className="radar-name">{name(item.id)}
            <span className="radar-chips">
              {item.young && <i className="young" title={item.young === 'only' ? 'Nur Jungtiere' : 'Jungtiere zuerst, Alttiere später'}>{item.young === 'only' ? 'nur Jung' : 'Jung zuerst'}</i>}
              {item.clamp && <i className="clamp" title={`Runterziehen: ${item.clamp}`}>⊐ {item.clamp === 'Adult' ? '' : item.clamp.replace('bis ', '')}</i>}
              {item.route && <i title="Nur auf Durchzug (Wanderroute)">⇢</i>}
              {item.asleep && <i className="sleep" title="Schläft, wenn du jagst">z</i>}
              {item.herd && <i className="herd" title={`In der Gruppe (${item.herd.size}): ${pct(item.herd.chance)}`}>×{item.herd.size} {pct(item.herd.chance)}</i>}
            </span>
          </span>
          <span className={`radar-tempo t-${item.tempo}`}>{TEMPO[item.tempo].glyph}</span>
          <Chance value={item.chance} />
        </div>} />
      </div>) : <p className="radar-quiet" lang="de">Keine erlaubte Beute hier.</p>}
    </section>}

    <section>
      <h3><span lang="de">Gefahren</span><em>{reading.threats.length}</em><small>Gefahr · Tempo · Chance</small></h3>
      {reading.threats.length ? <Capped rows={reading.threats} limit={LIMIT.threats} open={open.has('threats')} pinned={pinned} onMore={() => more('threats')} render={item => <div key={item.id} className="radar-row threat" title={[`Gefahr ${LEVEL_DE[item.level]}`, `jagt mit ${item.size}`, TEMPO[item.tempo].de, item.note].filter(Boolean).join(' · ')}>
        <Level value={item.level} />
        <Avatar id={item.id} items={items} mode={mode} />
        <span className="radar-name">{name(item.id)}
          <span className="radar-chips">
            {item.size > 1 && <i className="herd">×{item.size}</i>}
            {item.young && <i className="young" title="Jagt nur Jungtiere">nur Jung</i>}
            {item.route && <i title="Nur auf Durchzug (Wanderroute)">⇢</i>}
            {item.asleep && <i className="sleep" title="Jagt, während du schläfst">z</i>}
          </span>
        </span>
        <span className={`radar-tempo t-${item.tempo}`}>{TEMPO[item.tempo].glyph}</span>
        <Chance value={item.chance} />
      </div>} /> : <p className="radar-quiet" lang="de">Hier jagt dich niemand.</p>}
    </section>
  </div>;
}
