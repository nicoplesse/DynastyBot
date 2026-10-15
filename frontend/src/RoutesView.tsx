import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, type MapRegion, type MigrationIndex, type MigrationRoute, type WorldMap } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './routes.css';

// Migration-route overview: every traced route on the clean base map, one colour per named
// route. Pick where you are (click the map or search) and only the routes through that POI stay
// lit; pick what you play and the panel turns into your route guide or, for a hunter, into a list
// of prey passing by and the best ambush spots.

const ME_KEY = 'dynasty.routes.me';
const RECENT_KEY = 'dynasty.routes.recent';
const FOCUS_KEY = 'dynasty.routes.focus';
const ACTIVITY: Record<string, { icon: string; de: string }> = {
  Diurnal: { icon: '☀', de: 'tagaktiv' }, Nocturnal: { icon: '☾', de: 'nachtaktiv' },
  Cathemeral: { icon: '◐', de: 'tag & nacht' }, Crepuscular: { icon: '◑', de: 'Dämmerung' },
};
const BAND_DE: Record<string, string> = { severe: 'sehr gut', high: 'gut', meaningful: 'machbar', moderate: 'mäßig', conditional: 'nur bedingt', low: 'schwer' };

type Area = MapRegion & { shape: Extract<MapRegion['shape'], { type: 'polygon' }> };

function readStore<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeStore(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* per-viewer convenience only */ }
}

const polygon = (area: Area) => area.shape.points.map(([x, y]) => `${x},${y}`).join(' ');
const centre = (region: MapRegion) => region.anchor || (region.shape.type === 'polygon'
  ? { x: region.shape.points.reduce((s, p) => s + p[0], 0) / region.shape.points.length, y: region.shape.points.reduce((s, p) => s + p[1], 0) / region.shape.points.length }
  : { x: region.shape.x, y: region.shape.y });

// Both active at the same time of day? Migrating and hunting are limited to active hours (rule 1.4).
function overlaps(a: string | null, b: string | null) {
  if (!a || !b || a === 'Cathemeral' || b === 'Cathemeral') return true;
  return a === b || a === 'Crepuscular' || b === 'Crepuscular';
}

export function RoutesPage({ route }: { route: string }) {
  const [data, setData] = useState<{ index: MigrationIndex; world: WorldMap } | null>(null);
  const [error, setError] = useState('');
  const [me, setMe] = useState<string>(() => readStore(ME_KEY, ''));
  // Picked routes: several can be lit at once; none picked means all routes show.
  const [focus, setFocusState] = useState<string[]>(() => readStore(FOCUS_KEY, []));
  const setFocus = (next: string[]) => { setFocusState(next); writeStore(FOCUS_KEY, next); };
  const toggleFocus = (id: string) => setFocus(focus.includes(id) ? focus.filter(item => item !== id) : [...focus, id]);
  const [recent, setRecent] = useState<string[]>(() => readStore(RECENT_KEY, []));
  const poi = decodeURIComponent(route.split('/')[2] || '') || null;
  useEffect(() => {
    Promise.all([api.migration(), api.worldMap()]).then(([index, world]) => setData({ index, world })).catch(cause => setError((cause as Error).message));
  }, []);

  const selectPoi = (id: string | null) => {
    go(id ? `/routes/${id}` : '/routes');
    if (id) setRecent(list => { const next = [id, ...list.filter(item => item !== id)].slice(0, 5); writeStore(RECENT_KEY, next); return next; });
  };
  const chooseMe = (id: string) => { setMe(id); writeStore(ME_KEY, id); };

  const derived = useMemo(() => {
    if (!data) return null;
    const { index, world } = data;
    const regions = new Map(world.regions.map(region => [region.id, region]));
    const areas = world.regions.filter((region): region is Area => region.shape.type === 'polygon' && !region.within);
    const hunter = me ? index.hunters[me] || null : null;
    const migrant = me ? index.playables[me] || null : null;
    const preyIds = new Set(hunter?.prey.map(item => item.id) || []);
    // Ambush spots: POIs where the most of your prey passes, your own hunting grounds first.
    const ambush = hunter ? Object.values(index.pois).filter(item => !item.landmark)
      .map(item => ({ id: item.id, name: item.name, prey: item.playables.filter(id => preyIds.has(id)), own: hunter.pois.includes(item.id) }))
      .filter(item => item.prey.length).sort((a, b) => Number(b.own) - Number(a.own) || b.prey.length - a.prey.length).slice(0, 8) : [];
    const hubs = Object.values(index.pois).filter(item => !item.landmark).sort((a, b) => b.routes.length - a.routes.length || b.playables.length - a.playables.length).slice(0, 6);
    return { regions, areas, hunter, migrant, preyIds, ambush, hubs };
  }, [data, me]);
  // Drop picks of routes that no longer exist (e.g. renamed after a re-trace).
  const picked = data ? focus.filter(id => data.index.routes.some(item => item.id === id)) : focus;

  if (error) return <PageError message={error} />;
  if (!data || !derived) return <PageLoading label="Loading migration routes…" />;
  const { index } = data;
  const { regions, areas, hunter, migrant, preyIds, ambush, hubs } = derived;
  const passes = (item: MigrationRoute) => !poi || item.regions.includes(poi) || item.landmarks.includes(poi);
  const mine = (item: MigrationRoute) => !me || (migrant ? migrant.routes.some(entry => entry.id === item.id) : hunter ? item.members.some(member => preyIds.has(member.id)) : true);
  const lit = (item: MigrationRoute) => passes(item) && mine(item) && (!picked.length || picked.includes(item.id));
  const selected = poi ? regions.get(poi) || null : null;
  const selectedArea = selected && selected.shape.type === 'polygon' ? selected as Area : null;
  const stamp = encodeURIComponent(index.generatedAt);

  return <>
    <ExplorerTopline section="PROFILES / MIGRATION ROUTES" count={`${index.routes.length} ROUTES · ${Object.keys(index.playables).length} MIGRATING PLAYABLES`} />
    <header className="directory-head routes-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · MIGRATION</div>
        <h1>Migration Routes <span lang="de">Wanderrouten</span></h1>
        <p lang="de">Alle Routen der Profilkarten auf einer Karte. Wähl oben eine oder mehrere Routen aus, um nur diese zu zeigen. Klick auf die Karte oder such deinen POI, dann bleiben nur die Routen hell, die dort durchlaufen. Wähle, was du spielst, für deinen Routenplan oder als Jäger für Beute und Hinterhalt-Spots.</p>
      </div>
      <div className="archive-metric"><strong>{index.routes.length}</strong><span>named routes</span></div>
    </header>

    <div className="routes-chips" role="toolbar" aria-label="Routes">
      <span className="routes-chips-label" lang="de">{picked.length ? `${picked.length} von ${index.routes.length} gewählt` : 'Routen wählen (mehrere möglich)'}</span>
      {index.routes.map(item => <button type="button" key={item.id} className={`${picked.includes(item.id) ? 'active' : ''} ${lit(item) ? '' : 'off'}`} style={{ '--rc': item.color } as CSSProperties}
        aria-pressed={picked.includes(item.id)} onClick={() => toggleFocus(item.id)} title={item.note}>
        <i aria-hidden="true" /><b>{item.de}</b><small>{item.members.length}</small>
      </button>)}
      {migrant && migrant.routes.length > 1 && <button type="button" className="routes-chip-clear" onClick={() => setFocus(migrant.routes.map(entry => entry.id))} lang="de">Nur meine Routen</button>}
      {picked.length > 0 && <button type="button" className="routes-chip-clear" onClick={() => setFocus([])}>Alle zeigen</button>}
    </div>

    <div className="routes-layout">
      <div className="routes-map-wrap">
        <div className="routes-map">
          <img src={`${api.mapLayerUrl('layers/base.png')}?v=${stamp}`} alt="Map of the island with all migration routes" />
          <svg className="routes-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {selectedArea && <>
              <defs><mask id="routes-spot" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill="white" /><polygon points={polygon(selectedArea)} fill="black" /></mask></defs>
              <rect className="routes-veil" width="1" height="1" mask="url(#routes-spot)" />
            </>}
            {hunter && !poi && ambush.filter(item => item.own).map(item => { const area = regions.get(item.id); return area?.shape.type === 'polygon' ? <polygon key={item.id} className="routes-ambush" points={polygon(area as Area)} /> : null; })}
          </svg>
          {/* Route strokes are the traced map lines, tinted per route: they look like the profile maps. */}
          <div className="routes-strokes" aria-hidden="true">
            {index.routes.map(item => {
              const own = migrant ? item.members.find(member => member.id === me && member.usage === 'partial')?.file : null;
              const file = own || item.layer;
              return file ? <div key={item.id} className={`routes-stroke ${lit(item) ? 'lit' : 'dim'}`}>
                <div style={{ background: item.color, WebkitMaskImage: `url(${api.mapLayerUrl(file)}?v=${stamp})`, maskImage: `url(${api.mapLayerUrl(file)}?v=${stamp})` }} />
              </div> : null;
            })}
          </div>
          <svg className="routes-overlay top" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {selectedArea && <polygon className="routes-outline" points={polygon(selectedArea)} />}
            {selected && selected.shape.type !== 'polygon' && <circle className="routes-pin" cx={selected.shape.x} cy={selected.shape.y} r="0.008" />}
          </svg>
          <svg className="routes-hits" viewBox="0 0 1 1" preserveAspectRatio="none">
            {areas.map(area => <polygon key={area.id} points={polygon(area)} className={area.id === poi ? 'on' : ''} onClick={() => selectPoi(area.id === poi ? null : area.id)}><title>{area.name}</title></polygon>)}
          </svg>
        </div>
        <p className="routes-hint" lang="de">Klick auf ein Gebiet = „Hier bin ich“. Taste <kbd>/</kbd> springt in die Suche, <kbd>Esc</kbd> hebt die Auswahl auf. Wandern und Jagen nur in den aktiven Stunden (Regel 1.4).</p>
      </div>

      <aside className="routes-panel">
        <PoiPicker index={index} areas={areas} regions={regions} poi={poi} recent={recent} onSelect={selectPoi} />
        <label className="routes-me"><span lang="de">Ich spiele</span>
          <select value={me} onChange={event => chooseMe(event.target.value)}>
            <option value="">– niemand Bestimmtes –</option>
            <optgroup label="Wandert auf Routen">{Object.values(index.playables).sort((a, b) => a.name.localeCompare(b.name)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            <optgroup label="Jäger">{Object.values(index.hunters).filter(item => item.prey.length && !index.playables[item.id]).sort((a, b) => a.name.localeCompare(b.name)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
          </select>
        </label>
        {poi
          ? <PoiDetail index={index} poi={poi} regions={regions} me={me} preyIds={preyIds} hunterActivity={hunter?.activity || null} onSelect={selectPoi} lit={lit} />
          : <Overview index={index} hunter={hunter} migrantRoutes={migrant?.routes || null} ambush={ambush} hubs={hubs} picked={picked} onSelect={selectPoi} onFocus={toggleFocus} />}
      </aside>
    </div>
  </>;
}

function PoiPicker({ index, areas, regions, poi, recent, onSelect }: { index: MigrationIndex; areas: Area[]; regions: Map<string, MapRegion>; poi: string | null; recent: string[]; onSelect: (id: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '/' && !typing) { event.preventDefault(); input.current?.focus(); }
      if (event.key === 'Escape') { setQuery(''); onSelect(null); input.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect]);
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const landmarks = Object.values(index.pois).filter(item => item.landmark).map(item => regions.get(item.id)).filter((item): item is MapRegion => Boolean(item));
    return [...areas, ...landmarks].filter(item => item.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(needle)) - Number(a.name.toLowerCase().startsWith(needle)) || (index.pois[b.id]?.routes.length || 0) - (index.pois[a.id]?.routes.length || 0)).slice(0, 7);
  }, [query, areas, regions, index]);
  const pick = (id: string) => { onSelect(id); setQuery(''); setCursor(0); input.current?.blur(); };
  return <div className="routes-where">
    <label className="search-field"><span aria-hidden="true">⌖</span>
      <input ref={input} value={query} onChange={event => { setQuery(event.target.value); setCursor(0); }} placeholder={poi ? `Hier: ${regions.get(poi)?.name || poi}. Woanders?` : 'Wo bist du? z. B. Cedrus, Redwoods…'} aria-label="Where are you"
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(value => Math.min(options.length - 1, value + 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(value => Math.max(0, value - 1)); }
          if (event.key === 'Enter' && options[cursor]) pick(options[cursor].id);
        }} />
    </label>
    {options.length > 0 && <ul className="routes-suggest" role="listbox">{options.map((item, i) => <li key={item.id} role="option" aria-selected={i === cursor}>
      <button type="button" className={i === cursor ? 'active' : ''} onMouseDown={event => { event.preventDefault(); pick(item.id); }}>{item.name}<small>{index.pois[item.id] ? `${index.pois[item.id].routes.length} Route${index.pois[item.id].routes.length === 1 ? '' : 'n'}` : 'keine Route'}</small></button>
    </li>)}</ul>}
    {(poi || recent.length > 0) && <div className="routes-recent">
      {poi && <button type="button" className="clear" onClick={() => onSelect(null)}>× {regions.get(poi)?.name}</button>}
      {recent.filter(id => id !== poi).map(id => <button type="button" key={id} onClick={() => onSelect(id)}>{regions.get(id)?.name || id}</button>)}
    </div>}
  </div>;
}

function Who({ id, index, prey, hunterActivity }: { id: string; index: MigrationIndex; prey?: { band: string | null } | null; hunterActivity?: string | null }) {
  const item = index.playables[id] || index.hunters[id];
  if (!item) return null;
  const activity = item.activity ? ACTIVITY[item.activity] : null;
  const awake = hunterActivity ? overlaps(hunterActivity, item.activity) : true;
  return <a className={`routes-who ${prey ? 'prey' : ''}`} href={`#/profiles/${id}`} title={[item.tier, item.diet, activity?.de, item.animal && `≈ ${item.animal}`].filter(Boolean).join(' · ')}>
    {activity && <i aria-hidden="true">{activity.icon}</i>}{item.name}
    {prey && <em>{prey.band ? BAND_DE[prey.band] || prey.band : 'erlaubt'}</em>}
    {!awake && <small lang="de">anders aktiv</small>}
  </a>;
}

function RouteLine({ route }: { route: MigrationRoute }) {
  return <span className="routes-key" style={{ '--rc': route.color } as CSSProperties}><i aria-hidden="true" />{route.de}</span>;
}

function PoiDetail({ index, poi, regions, me, preyIds, hunterActivity, onSelect, lit }: { index: MigrationIndex; poi: string; regions: Map<string, MapRegion>; me: string; preyIds: Set<string>; hunterActivity: string | null; onSelect: (id: string | null) => void; lit: (route: MigrationRoute) => boolean }) {
  const entry = index.pois[poi];
  const region = regions.get(poi);
  const name = region?.name || poi;
  const through = index.routes.filter(item => item.regions.includes(poi) || item.landmarks.includes(poi));
  if (!through.length) {
    // Nearest POIs that do have a route, so you know where to head.
    const here = region ? centre(region) : null;
    const nearest = here ? Object.values(index.pois).filter(item => !item.landmark).map(item => ({ item, d: Math.hypot(centre(regions.get(item.id)!).x - here.x, centre(regions.get(item.id)!).y - here.y) })).sort((a, b) => a.d - b.d).slice(0, 3) : [];
    return <section className="routes-card"><h2>{name}</h2><p lang="de">Hier läuft keine Migrationsroute durch.</p>
      {nearest.length > 0 && <><h3 lang="de">Nächste Routen-POIs</h3><div className="routes-links">{nearest.map(({ item }) => <button type="button" key={item.id} onClick={() => onSelect(item.id)}>{item.name}<small>{item.routes.length} Route{item.routes.length === 1 ? '' : 'n'}</small></button>)}</div></>}
    </section>;
  }
  const passing = entry?.playables || [];
  const preyHere = passing.filter(id => preyIds.has(id));
  const hunter = me ? index.hunters[me] : null;
  return <section className="routes-card">
    <div className="eyebrow">DU BIST HIER</div>
    <h2>{name}</h2>
    <p className="routes-sum" lang="de"><b>{through.length}</b> Route{through.length === 1 ? '' : 'n'} · <b>{passing.length}</b> Playables ziehen hier durch</p>
    {hunter && <div className="routes-hunt">
      <h3 lang="de">Deine Beute auf Durchzug</h3>
      {preyHere.length ? <div className="routes-whos">{preyHere.map(id => <Who key={id} id={id} index={index} prey={hunter.prey.find(item => item.id === id)} hunterActivity={hunterActivity} />)}</div>
        : <p lang="de">Keine deiner erlaubten Beutetiere wandert hier durch.</p>}
      <p className="routes-small" lang="de">Erlaubt nach Jagdstufe bis {hunter.huntTier}; Einschätzung aus den Matchups. Profilregeln (z. B. Tabu-Beute) gelten trotzdem.</p>
    </div>}
    {through.map(item => {
      const next = item.links.filter(pair => pair.includes(poi)).map(pair => pair[0] === poi ? pair[1] : pair[0]);
      const members = item.members.filter(member => member.regions.includes(poi) || entry?.landmark);
      return <div key={item.id} className={`routes-through ${lit(item) ? '' : 'off'}`} style={{ '--rc': item.color } as CSSProperties}>
        <RouteLine route={item} />
        {next.length > 0 && <div className="routes-next"><span lang="de">Nächste Stationen</span>{next.map(id => <button type="button" key={id} onClick={() => onSelect(id)}>{regions.get(id)?.name || id} →</button>)}</div>}
        <div className="routes-whos">{members.map(member => <Who key={member.id} id={member.id} index={index} prey={preyIds.has(member.id) ? hunter?.prey.find(p => p.id === member.id) : null} hunterActivity={hunterActivity} />)}</div>
      </div>;
    })}
  </section>;
}

function Overview({ index, hunter, migrantRoutes, ambush, hubs, picked, onSelect, onFocus }: {
  index: MigrationIndex; hunter: MigrationIndex['hunters'][string] | null; migrantRoutes: Array<{ id: string; usage: string }> | null;
  ambush: Array<{ id: string; name: string; prey: string[]; own: boolean }>; hubs: MigrationIndex['pois'][string][];
  picked: string[]; onSelect: (id: string) => void; onFocus: (id: string) => void;
}) {
  return <>
    {hunter && <section className="routes-card">
      <div className="eyebrow">JÄGER · {hunter.name.toUpperCase()}</div>
      <h2 lang="de">Hinterhalt-Spots</h2>
      <p className="routes-small" lang="de">Wo die meisten deiner erlaubten Beutetiere durchziehen. Gestrichelt auf der Karte: deine eigenen Profil-POIs.</p>
      {ambush.length ? <ol className="routes-rank">{ambush.map(item => <li key={item.id}><button type="button" onClick={() => onSelect(item.id)}><b>{item.name}</b>{item.own && <em lang="de">dein Gebiet</em>}<small>{item.prey.length} Beute</small></button></li>)}</ol>
        : <p lang="de">Keine deiner erlaubten Beutetiere wandert auf diesen Routen.</p>}
      {hunter.prey.length > 0 && <><h3 lang="de">Wandernde Beute</h3><div className="routes-whos">{hunter.prey.map(item => <Who key={item.id} id={item.id} index={index} prey={item} hunterActivity={hunter.activity} />)}</div></>}
    </section>}
    {migrantRoutes && <section className="routes-card">
      <div className="eyebrow">DEINE ROUTEN</div>
      {migrantRoutes.map(entry => { const item = index.routes.find(r => r.id === entry.id)!; return <button type="button" key={item.id} className={`routes-route ${picked.includes(item.id) ? 'active' : ''}`} aria-pressed={picked.includes(item.id)} style={{ '--rc': item.color } as CSSProperties} onClick={() => onFocus(item.id)}>
        <RouteLine route={item} /><small lang="de">{entry.usage === 'partial' ? 'nur ein Teilstück' : entry.usage === 'profile' ? 'laut Profiltext' : 'ganze Route'} · {item.regions.length} POIs</small></button>; })}
    </section>}
    <section className="routes-card">
      <div className="eyebrow">ALLE ROUTEN</div>
      {index.routes.map(item => <button type="button" key={item.id} className={`routes-route ${picked.includes(item.id) ? 'active' : ''}`} aria-pressed={picked.includes(item.id)} style={{ '--rc': item.color } as CSSProperties} onClick={() => onFocus(item.id)} title={item.note}>
        <RouteLine route={item} /><small>{item.name}</small>
        <span className="routes-members">{item.members.map(member => member.name + (member.usage === 'partial' ? ' (Teil)' : member.usage === 'profile' ? ' (Profil)' : '')).join(', ')}</span>
      </button>)}
    </section>
    <section className="routes-card">
      <div className="eyebrow">KNOTENPUNKTE</div>
      <p className="routes-small" lang="de">Hier kreuzen sich die meisten Routen: viel Durchzug, für Jäger die besten Lauerplätze.</p>
      <ol className="routes-rank">{hubs.map(item => <li key={item.id}><button type="button" onClick={() => onSelect(item.id)}><b>{item.name}</b><small>{item.routes.length} Routen · {item.playables.length} Playables</small></button></li>)}</ol>
    </section>
  </>;
}
