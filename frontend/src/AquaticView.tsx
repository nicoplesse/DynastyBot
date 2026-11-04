import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  aquaticApi, formatDecimal, secondsToKill, sideLabels,
  type AquaticBlock, type AquaticExtra, type AquaticHabitat, type AquaticIndex, type AquaticListBlock, type AquaticProfile, type AquaticRelations,
  type AquaticSide, type AquaticSummary, type HabitatRole, type RelationKind,
} from './aquatic';
import { api } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './aquatic.css';

const SIDES: AquaticSide[] = ['prey', 'giant', 'hunter'];
function formatDay(value: string) { return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)); }

// Aquatic Update is the user's own suggestion: its own tab, kept apart from the Dynasty archive.
export function AquaticPage({ route }: { route: string }) {
  const id = route.split('/')[2] || null;
  return id ? <AquaticDetail id={id} /> : <AquaticDirectory />;
}

function Monogram({ name, className }: { name: string; className: string }) {
  return <span className={className} aria-hidden="true">{name.slice(0, 2)}</span>;
}

// Bold, inline code and links are all the drafts use inside a line.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return <>{parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

function List({ block }: { block: AquaticListBlock }) {
  const items = block.items.map((item, index) => <li key={index}><Inline text={item.text} />{item.children && <List block={item.children} />}</li>);
  return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
}

function Blocks({ blocks }: { blocks: AquaticBlock[] }) {
  return <>{blocks.map((block, index) => {
    if (block.type === 'heading') {
      if (block.level <= 2) return <h2 key={index} id={`aq-${block.id}`} className="aq-h2">{block.text}</h2>;
      return block.level === 3 ? <h3 key={index} className="aq-h3">{block.text}</h3> : <h4 key={index} className="aq-h4">{block.text}</h4>;
    }
    if (block.type === 'paragraph') return <p key={index}><Inline text={block.text} /></p>;
    if (block.type === 'list') return <List key={index} block={block} />;
    return <div key={index} className="aq-table-wrap"><table>
      <thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex}><Inline text={cell} /></th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><Inline text={cell} /></td>)}</tr>)}</tbody>
    </table></div>;
  })}</>;
}

function KindBadge({ profile }: { profile: AquaticSummary }) {
  return profile.kind === 'new'
    ? <span className="aq-badge aq-badge-new" title={profile.mod ? [profile.mod.name, profile.mod.id].filter(Boolean).join(' · ') : undefined}>Neu · Mod</span>
    : <span className="aq-badge">Geändert</span>;
}

function AquaticDirectory() {
  const [index, setIndex] = useState<AquaticIndex | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { aquaticApi.index().then(setIndex).catch(cause => setError((cause as Error).message)); }, []);
  if (error) return <PageError message={error} />;
  if (!index) return <PageLoading label="Lade Aquatic-Update-Profile…" />;
  const created = index.profiles.filter(profile => profile.kind === 'new').length;
  return <div className="aquatic" lang="de">
    <ExplorerTopline section="AQUATIC UPDATE · PROJEKT" count={`${index.count} PROFILE`} />
    <header className="aq-head">
      <div>
        <div className="aq-eyebrow">PROJEKT · EIGENE SUGGESTION</div>
        <h1>{index.title}</h1>
        <p className="aq-sub">{index.status} · Stand {formatDay(index.updatedAt)}</p>
        <p className="aq-intro">{index.intro}</p>
      </div>
      <div className="aq-metrics">
        <div><strong>{created}</strong><span>neue Arten (Mods)</span></div>
        <div><strong>{index.count - created}</strong><span>geänderte Dynasty-Profile</span></div>
        <div><strong>{index.rules.length}</strong><span>Regeländerungen</span></div>
      </div>
    </header>
    {SIDES.map(side => {
      const meta = index.sides.find(entry => entry.id === side);
      const items = index.profiles.filter(profile => profile.side === side);
      if (!items.length) return null;
      return <section key={side} className={`aq-group side-${side}`} aria-label={meta?.label}>
        <h2><i className="aq-dot" aria-hidden="true" />{meta?.label}<b>{items.length}</b></h2>
        {meta?.text && <p className="aq-group-text">{meta.text}</p>}
        <div className="aq-grid">{items.map(item => <AquaticCard key={item.id} item={item} />)}</div>
      </section>;
    })}
    <HabitatPanel habitat={index.habitat} profiles={index.profiles} />
    <RelationsMatrix profiles={index.profiles} extras={index.extras} relations={index.relations} />
    <SpeedTable profiles={index.profiles} extras={index.extras} />
    <DuelMatrix profiles={index.profiles} />
    <section className="aq-panel">
      <div className="aq-section-head"><span aria-hidden="true">§</span><div><div className="aq-eyebrow">FÜR DEN SERVER</div><h2>Nötige Regeländerungen</h2></div></div>
      <div className="aq-rules">{index.rules.map((rule, number) => <article key={rule.title}><b>{number + 1}</b><div><h3>{rule.title}</h3><p>{rule.text}</p></div></article>)}</div>
    </section>
  </div>;
}

function AquaticCard({ item }: { item: AquaticSummary }) {
  return <button type="button" className={`aq-card side-${item.side}`} onClick={() => go(`/aquatic/${item.id}`)}>
    <div className="aq-card-top">
      <Monogram name={item.name} className="aq-mono" />
      <div><h3>{item.name}<small>„{item.nickname}“</small></h3><span className="aq-role">{item.role}</span></div>
      <KindBadge profile={item} />
    </div>
    <p>{item.essence}</p>
    <div className="aq-card-traits"><span>{item.activity}</span><span>{item.group}</span></div>
    <div className="aq-card-facts">
      <span><b>{item.stats.cw}</b>CW</span>
      <span><b>{item.stats.health}{item.stats.healthNote ? '+' : ''}</b>Health</span>
      <span><b>{item.stats.sprint ?? '?'}</b>Sprint</span>
      {item.changes.length > 0 && <span><b>{item.changes.length}</b>Änderungen</span>}
    </div>
  </button>;
}

const ROLE_MARK: Record<HabitatRole, string> = { home: '●', route: '→', trip: '↗', territory: '◆', front: '⚔', nest: '⌂' };
const ROLE_ORDER: HabitatRole[] = ['territory', 'front', 'home', 'route', 'trip', 'nest'];
const points = (outline: Array<[number, number]>) => outline.map(([x, y]) => `${x},${y}`).join(' ');
const at = ([x, y]: [number, number]) => ({ left: `${x * 100}%`, top: `${y * 100}%` });

// The map stays quiet like the other map tabs: lit POIs, a veil over the rest, white outlines and labels only.
function HabitatPanel({ habitat, profiles }: { habitat: AquaticHabitat; profiles: AquaticSummary[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoneHover, setZoneHover] = useState<string | null>(null);
  const species = selected ? habitat.species.find(entry => entry.id === selected) ?? null : null;
  const profile = selected ? profiles.find(entry => entry.id === selected) ?? null : null;
  const areaById = useMemo(() => new Map(habitat.areas.map(area => [area.id, area])), [habitat]);
  const residents = useMemo(() => {
    const byArea = new Map<string, Array<{ profile: AquaticSummary; roles: HabitatRole[] }>>();
    for (const entry of habitat.species) {
      const owner = profiles.find(item => item.id === entry.id);
      if (!owner) continue;
      for (const area of entry.areas) byArea.set(area.id, [...(byArea.get(area.id) ?? []), { profile: owner, roles: area.roles }]);
    }
    return byArea;
  }, [habitat, profiles]);
  const lit = new Set(species ? species.areas.map(area => area.id) : habitat.zones.filter(zone => zone.id !== 'fresh').flatMap(zone => zone.areas));
  const traced = zoneHover ? habitat.zones.find(zone => zone.id === zoneHover)?.areas ?? [] : hover ? [hover] : [];
  const showTerritories = !species || species.territories;
  const hoverArea = hover ? areaById.get(hover) : undefined;
  const sortedRoles = (roles: HabitatRole[]) => ROLE_ORDER.filter(role => roles.includes(role));
  // Crop to the water: the whole map is laid out at full size inside, shifted and scaled by the view.
  const { view } = habitat;
  const frame = { aspectRatio: `${948 * view.width} / ${874 * view.height}` };
  const sheet = { width: `${100 / view.width}%`, height: `${100 / view.height}%`, left: `${-view.x / view.width * 100}%`, top: `${-view.y / view.height * 100}%` };

  return <section className="aq-panel aq-habitat">
    <div className="aq-section-head"><span aria-hidden="true">◎</span><div><div className="aq-eyebrow">WER LEBT WO</div><h2>Lebensräume und Reviere</h2></div></div>
    <div className="aq-chips" role="group" aria-label="Art wählen">
      <button type="button" className={!selected ? 'on' : ''} aria-pressed={!selected} onClick={() => setSelected(null)}>Übersicht</button>
      {profiles.map(item => <button key={item.id} type="button" className={`side-${item.side} ${selected === item.id ? 'on' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(value => value === item.id ? null : item.id)}><i className="aq-dot" aria-hidden="true" />{item.nickname}</button>)}
    </div>
    <div className="aq-habitat-body">
      <div className="aq-map" style={frame} onMouseLeave={() => setHover(null)}><div className="aq-map-sheet" style={sheet}>
        <img src={api.mapLayerUrl('layers/base-clean.png')} alt="Karte von Riparia mit den Wasser-POIs" />
        <svg className="aq-map-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <defs><mask id="aq-lit" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1"><rect width="1" height="1" fill="white" />{habitat.areas.filter(area => lit.has(area.id)).map(area => <polygon key={area.id} points={points(area.points)} fill="black" />)}</mask></defs>
          <rect className="aq-veil" width="1" height="1" mask="url(#aq-lit)" />
          {habitat.areas.filter(area => lit.has(area.id)).map(area => <polygon key={area.id} className="aq-outline" points={points(area.points)} />)}
          {showTerritories && habitat.territories.map(territory => <polygon key={territory.id} className={`aq-territory ${species ? 'strong' : ''}`} points={points(territory.points)} />)}
          {traced.map(id => areaById.get(id)).filter(area => area !== undefined).map(area => <polygon key={`trace-${area.id}`} className="aq-outline on" points={points(area.points)} />)}
        </svg>
        {species?.route && <div className="aq-route" style={{ WebkitMaskImage: `url(${api.mapLayerUrl(habitat.route.layer)})`, maskImage: `url(${api.mapLayerUrl(habitat.route.layer)})` }} />}
        {species?.territories && habitat.territories.map(territory => <span key={territory.id} className="aq-map-label" style={at(territory.anchor)}>{territory.label}</span>)}
        <svg className="aq-map-hits" viewBox="0 0 1 1" preserveAspectRatio="none">
          {habitat.areas.map(area => <polygon key={area.id} points={points(area.points)} aria-label={area.name} onMouseEnter={() => setHover(area.id)} />)}
        </svg>
      </div></div>
      <aside className="aq-habitat-side">
        {hoverArea ? <div className="aq-habitat-card">
          <div className="aq-eyebrow">{habitat.zones.find(zone => zone.id === hoverArea.zone)?.label.toUpperCase()}</div>
          <h3>{hoverArea.name}</h3>
          {(residents.get(hoverArea.id) ?? []).length ? <ul className="aq-residents">{(residents.get(hoverArea.id) ?? []).map(({ profile: owner, roles }) => <li key={owner.id} className={`side-${owner.side}`}>
            <i className="aq-dot" aria-hidden="true" /><b>{owner.nickname}</b><span>{sortedRoles(roles).map(role => habitat.roles[role]).join(' · ')}</span>
          </li>)}</ul> : <p className="aq-muted">Keine der Wasserarten lebt hier.</p>}
          {hoverArea.id === 'palm-islands' && <p className="aq-muted">Livy kommt nie hierher. Darum ist Palm das eine Meer, in dem Sachi vor ihm sicher ist, und zugleich die Front zu Deino und Spino.</p>}
        </div> : species && profile ? <div className={`aq-habitat-card side-${profile.side}`}>
          <div className="aq-eyebrow">{profile.role.toUpperCase()}</div>
          <h3><a href={`#/aquatic/${profile.id}`}>{profile.name}</a></h3>
          <p>{species.text}</p>
          {species.route && <p className="aq-muted"><b>{habitat.route.label}:</b> {habitat.route.text}</p>}
          <dl className="aq-roles">{ROLE_ORDER.map(role => {
            const names = species.areas.filter(area => area.roles.includes(role)).map(area => areaById.get(area.id)?.name).filter(Boolean);
            return names.length ? <Fragment key={role}><dt>{ROLE_MARK[role]} {habitat.roles[role]}</dt><dd>{names.join(', ')}</dd></Fragment> : null;
          })}</dl>
          {species.territories && <div className="aq-territory-list"><b>{habitat.territories.length} halbe Reviere</b><span>{habitat.territories.map(territory => territory.name).join(' · ')}</span></div>}
        </div> : <div className="aq-habitat-card">
          <p className="aq-muted">Wähle eine Art oder fahr über einen POI. Die gestrichelten Linien teilen die Ozeane in die halben Reviere des Sachicasaurus.</p>
          {habitat.zones.map(zone => <article key={zone.id} className="aq-zone" onMouseEnter={() => setZoneHover(zone.id)} onMouseLeave={() => setZoneHover(null)}>
            <h3>{zone.label}</h3>
            <p>{zone.text}</p>
            <small>{zone.areas.map(id => areaById.get(id)?.name).join(' · ')}</small>
          </article>)}
        </div>}
      </aside>
    </div>
    <div className="aq-table-wrap aq-who"><table>
      <thead><tr><th>POI</th>{profiles.map(item => <th key={item.id} className={`side-${item.side}`}>{item.nickname}</th>)}</tr></thead>
      {habitat.zones.map(zone => <tbody key={zone.id}>
        <tr className="aq-who-zone"><th colSpan={profiles.length + 1}>{zone.label}</th></tr>
        {zone.areas.map(id => <tr key={id} className={hover === id ? 'on' : ''} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
          <th>{areaById.get(id)?.name}</th>
          {profiles.map(item => {
            const roles = habitat.species.find(entry => entry.id === item.id)?.areas.find(area => area.id === id)?.roles ?? [];
            return <td key={item.id} title={sortedRoles(roles).map(role => habitat.roles[role]).join(', ')}>{sortedRoles(roles).map(role => ROLE_MARK[role]).join(' ')}</td>;
          })}
        </tr>)}
      </tbody>)}
    </table></div>
    <p className="aq-legend">{ROLE_ORDER.map(role => `${ROLE_MARK[role]} ${habitat.roles[role]}`).join(' · ')}. Die halben Sachi-Reviere sind flächengleich aus dem POI geschnitten; Grenzen im Spiel kann der Server anders ziehen.</p>
  </section>;
}

// Who kills whom faster, recomputed from the stats on the cards so it always matches them.
function DuelMatrix({ profiles }: { profiles: AquaticSummary[] }) {
  const rows = useMemo(() => profiles.map(attacker => {
    const cells = profiles.map(victim => {
      if (victim.id === attacker.id) return null;
      const seconds = secondsToKill(attacker.stats, victim.stats);
      return { id: victim.id, seconds, wins: seconds < secondsToKill(victim.stats, attacker.stats) };
    });
    const results = cells.filter(cell => cell !== null);
    return { attacker, cells, wins: results.filter(cell => cell.wins).length, losses: results.filter(cell => !cell.wins).length };
  }), [profiles]);
  const lowerBound = profiles.filter(profile => profile.stats.healthNote);
  return <section className="aq-panel">
    <div className="aq-section-head"><span aria-hidden="true">⚔</span><div><div className="aq-eyebrow">MIT DEN VORGESCHLAGENEN WERTEN</div><h2>1 gegen 1 im Bissduell: Sekunden bis zum Kill</h2></div></div>
    <div className="aq-table-wrap aq-matrix"><table>
      <thead><tr><th>Angreifer ↓ / Ziel →</th>{profiles.map(profile => <th key={profile.id} className={`side-${profile.side}`}>{profile.nickname}</th>)}<th>Bilanz</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.attacker.id}>
        <th className={`side-${row.attacker.side}`}><a href={`#/aquatic/${row.attacker.id}`}><i className="aq-dot" aria-hidden="true" />{row.attacker.nickname}</a></th>
        {row.cells.map((cell, index) => cell ? <td key={cell.id} className={cell.wins ? 'aq-win' : 'aq-loss'} title={cell.wins ? 'tötet schneller, als es getötet wird' : 'wird schneller getötet'}>{Math.round(cell.seconds)} s</td> : <td key={`self-${index}`} className="aq-self">–</td>)}
        <td className="aq-record"><b>{row.wins}</b>–{row.losses}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="aq-legend">Formel: Schaden × (CW Angreifer ÷ CW Ziel) ÷ Armor Ziel, mit dem Schaden pro Sekunde der Angriffsrotation. Ohne Blutung, Gift, Heilung und Buffs. Grün heißt: tötet schneller, als es selbst getötet wird. Das ist ein reines Bissduell ohne Wendigkeit und Skill. Im Wasser entscheidet meist, wer um den anderen herumschwimmt: Ein Tylo schlägt einen Spino im Wasser, obwohl er das Bissduell verliert.{lowerBound.map(profile => ` ${profile.nickname}: ${profile.stats.healthNote}.`).join('')}</p>
  </section>;
}

type SpeedKey = 'sprint' | 'swim' | 'accel' | 'sprintTime' | 'oxygen';
const SPEED_COLUMNS: Array<{ key: SpeedKey; label: string }> = [
  { key: 'swim', label: 'Schwimmen' }, { key: 'sprint', label: 'Sprint' }, { key: 'sprintTime', label: 'Sprintdauer' },
  { key: 'accel', label: 'Beschleunigung' }, { key: 'oxygen', label: 'Luft' },
];
// "2:47, getaucht 2:05" → 167 s; "unbegrenzt" sorts above every timed value.
const clockSeconds = (text: string) => {
  const match = text.match(/(\d+):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
};

function SpeedTable({ profiles, extras }: { profiles: AquaticSummary[]; extras: AquaticExtra[] }) {
  const [sort, setSort] = useState<{ key: SpeedKey; desc: boolean }>({ key: 'sprint', desc: true });
  const rows = [...profiles.map(profile => ({ ...profile, extra: false, note: '' })), ...extras.map(extra => ({ ...extra, extra: true }))];
  const value = (row: (typeof rows)[number]) => {
    const { stats } = row;
    if (sort.key === 'sprintTime') return clockSeconds(stats.sprintTime);
    if (sort.key === 'oxygen') return clockSeconds(stats.oxygen);
    return stats[sort.key];
  };
  // Unknown speeds (null) sit at the bottom in either direction.
  const sorted = [...rows].sort((a, b) => {
    const [first, second] = [value(a), value(b)];
    if (first === null || second === null) return Number(first === null) - Number(second === null);
    return (sort.desc ? second - first : first - second) || (b.stats.sprint ?? 0) - (a.stats.sprint ?? 0);
  });
  const max = Math.max(...rows.map(row => row.stats.sprint ?? 0));
  const choose = (key: SpeedKey) => setSort(current => ({ key, desc: current.key === key ? !current.desc : true }));
  return <section className="aq-panel">
    <div className="aq-section-head"><span aria-hidden="true">≋</span><div><div className="aq-eyebrow">WER WEN EINHOLT</div><h2>Tempo im Wasser</h2></div></div>
    <div className="aq-table-wrap aq-speed"><table>
      <thead><tr>
        <th>#</th><th>Art</th><th>Typ</th>
        {SPEED_COLUMNS.map(column => <th key={column.key} aria-sort={sort.key === column.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
          <button type="button" className={sort.key === column.key ? 'on' : ''} onClick={() => choose(column.key)}>{column.label}{sort.key === column.key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>
        </th>)}
      </tr></thead>
      <tbody>{sorted.map((row, rank) => <tr key={row.id} className={`side-${row.side} ${row.extra ? 'aq-extra' : ''}`} title={row.extra ? row.note : undefined}>
        <td className="aq-rank">{rank + 1}</td>
        <th>{row.extra
          ? <span className="aq-speed-name"><i className="aq-dot" aria-hidden="true" />{row.name}<small>unverändert</small></span>
          : <a className="aq-speed-name" href={`#/aquatic/${row.id}`}><i className="aq-dot" aria-hidden="true" />{row.name}</a>}</th>
        <td><span className={`aq-type ${row.stats.type === 'Aquatic' ? 'full' : 'semi'}`}>{row.stats.type === 'Aquatic' ? 'voll' : 'halb'}</span></td>
        <td>{row.stats.swim ?? '?'}</td>
        <td className="aq-speed-sprint"><span className="aq-bar" aria-hidden="true"><span className="aq-bar-sprint" style={{ width: `${(row.stats.sprint ?? 0) / max * 100}%` }} /><span className="aq-bar-swim" style={{ width: `${(row.stats.swim ?? 0) / max * 100}%` }} /></span><b>{row.stats.sprint ?? '?'}</b></td>
        <td>{row.stats.sprintTime}</td>
        <td>{row.stats.accel ?? '?'}</td>
        <td>{row.stats.oxygen}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="aq-legend">Spieleinheiten pro Sekunde, direkt aus den Blueprints der Spieldateien, ohne Traits. „?“ heißt: noch nicht aus den Spieldateien gelesen, weil der Mod nicht heruntergeladen ist. Klick auf eine Spalte sortiert. Wendigkeit fehlt, weil sich kein Wende-Wert in den Spieldateien sicher benennen lässt. Als Faustregel gilt: Volle Aquatics sind im Wasser wendiger als halbe, darum schlägt Tylo einen Spino im Wasser. Sarcosuchus ist ein unverändertes Dynasty-Profil und steht nur zum Vergleich dabei.</p>
  </section>;
}

const RELATION_SHORT: Record<RelationKind, string> = { hunt: 'jagt', limited: 'bedingt', rival: 'Revier', defend: 'wehrt sich', flee: 'flieht', group: 'Gruppe', ignore: 'ignoriert', none: '·' };
const RELATION_ORDER: RelationKind[] = ['hunt', 'limited', 'rival', 'defend', 'flee', 'group', 'ignore', 'none'];

// Who hunts, flees from or defends against whom, as the drafts say: the row acts, the column is the other side.
function RelationsMatrix({ profiles, extras, relations }: { profiles: AquaticSummary[]; extras: AquaticExtra[]; relations: AquaticRelations }) {
  const [picked, setPicked] = useState<[string, string] | null>(null);
  const byId = new Map<string, { id: string; name: string; nickname: string; side: AquaticSide; extra: boolean }>([
    ...profiles.map(profile => [profile.id, { ...profile, extra: false }] as const),
    ...extras.map(extra => [extra.id, { ...extra, extra: true }] as const),
  ]);
  const species = relations.order.map(id => byId.get(id)).filter(entry => entry !== undefined);
  const cell = picked ? relations.relations[picked[0]][picked[1]] : null;
  return <section className="aq-panel">
    <div className="aq-section-head"><span aria-hidden="true">⇄</span><div><div className="aq-eyebrow">WIE ES IN DEN ENTWÜRFEN STEHT</div><h2>Wer jagt wen, wer flieht, wer wehrt sich</h2></div></div>
    <div className="aq-table-wrap aq-rel"><table>
      <thead><tr><th>Zeile gegenüber Spalte →</th>{species.map(entry => <th key={entry.id} className={`side-${entry.side}`}>{entry.nickname}</th>)}</tr></thead>
      <tbody>{species.map(actor => <tr key={actor.id}>
        <th className={`side-${actor.side}`}>{actor.extra ? <span><i className="aq-dot" aria-hidden="true" />{actor.nickname}</span> : <a href={`#/aquatic/${actor.id}`}><i className="aq-dot" aria-hidden="true" />{actor.nickname}</a>}</th>
        {species.map(target => {
          if (target.id === actor.id) return <td key={target.id} className="aq-self">–</td>;
          const [kind, note] = relations.relations[actor.id][target.id];
          const on = picked?.[0] === actor.id && picked?.[1] === target.id;
          return <td key={target.id} className={`rel-${kind} ${on ? 'on' : ''}`}>
            <button type="button" title={`${actor.nickname} → ${target.nickname}: ${relations.kinds[kind]}. ${note}`} onClick={() => setPicked(on ? null : [actor.id, target.id])}>{RELATION_SHORT[kind]}</button>
          </td>;
        })}
      </tr>)}</tbody>
    </table></div>
    <p className="aq-rel-detail" aria-live="polite">{picked && cell
      ? <><b>{byId.get(picked[0])?.name} gegenüber {byId.get(picked[1])?.name}:</b> {relations.kinds[cell[0]]}. {cell[1]}</>
      : 'Klick auf eine Zelle zeigt die Begründung aus dem Entwurf.'}</p>
    <div className="aq-rel-legend">{RELATION_ORDER.map(kind => <span key={kind} className={`rel-${kind}`}><i>{RELATION_SHORT[kind]}</i>{relations.kinds[kind]}</span>)}</div>
    <p className="aq-legend">„Bedingt“ heißt: nur unter einer Bedingung, etwa ab einer Schwarmgröße, nur Junge oder nur bei großem Hunger. „Revier“ heißt: Revierkämpfe, gejagt wird nur unter Bedingungen. Sarcosuchus ist ein unverändertes Dynasty-Profil und steht nur zum Vergleich dabei.</p>
  </section>;
}

// Some embedded browsers deny the Clipboard API; a selected textarea still copies there.
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  return copied;
}

function Jump({ id, children }: { id: string; children: ReactNode }) {
  return <a href={`#${id}`} onClick={event => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{children}</a>;
}

function AquaticDetail({ id }: { id: string }) {
  const [profile, setProfile] = useState<AquaticProfile | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => { setProfile(null); setError(''); setCopied('idle'); aquaticApi.profile(id).then(setProfile).catch(cause => setError((cause as Error).message)); window.scrollTo(0, 0); }, [id]);
  if (error) return <PageError message={error} />;
  if (!profile) return <PageLoading label="Lade Profil…" />;
  const { stats, draft } = profile;
  const copy = () => copyText(draft.markdown).then(done => setCopied(done ? 'done' : 'failed'));
  return <div className="aquatic" lang="de">
    <ExplorerTopline section="AQUATIC UPDATE / PROFIL" count={`${profile.position} VON ${profile.count}`} />
    <button className="back-link" type="button" onClick={() => go('/aquatic')}>← Alle Aquatic-Update-Profile</button>
    <article className={`aq-detail side-${profile.side}`}>
      <header className="aq-hero">
        <Monogram name={profile.name} className="aq-hero-mono" />
        <div className="aq-hero-copy">
          <div className="aq-kicker">{sideLabels[profile.side]} · {profile.role}</div>
          <h1>{profile.name}</h1>
          <p className="aq-nick">„{profile.nickname}“ · {profile.classification}</p>
          <p className="aq-essence">{profile.essence}</p>
          <div className="hero-pills">
            <KindBadge profile={profile} />
            <span>{profile.activity}</span>
            <span>{profile.group}</span>
            <span>Vorbild: {profile.analog}</span>
            {profile.mod && <span className="aq-mod">{profile.mod.name}{profile.mod.id && <> · <code>{profile.mod.id}</code></>}</span>}
          </div>
          <p className="aq-home"><b>Lebensraum</b> {profile.home}</p>
        </div>
      </header>
      <dl className="aq-statstrip">
        <div><dt>CW</dt><dd>{stats.cw}</dd></div>
        <div><dt>Health</dt><dd>{stats.health}{stats.healthNote && <small title={stats.healthNote}> +</small>}</dd></div>
        <div><dt>Armor</dt><dd>{formatDecimal(stats.armor)}</dd></div>
        <div><dt>Heilung/s</dt><dd>{formatDecimal(stats.heal)}</dd></div>
        <div><dt>Schwimmen / Sprint</dt><dd>{stats.swim ?? '?'} / {stats.sprint ?? '?'}</dd></div>
        <div><dt>Unter Wasser</dt><dd>{stats.oxygen}</dd></div>
      </dl>
      {profile.changes.length > 0 && <div className="aq-changes"><strong>Änderungen</strong>{profile.changes.map(change => <span key={change.label}><b>{change.label}</b> {change.from} <i aria-hidden="true">→</i> <em>{change.to}</em></span>)}</div>}
      <div className="aq-layout">
        <aside className="aq-toc"><strong>AUF DIESER SEITE</strong>
          <Jump id="aq-overview">Überblick (Deutsch)</Jump>
          <Jump id="aq-profile">Profiltext (Englisch)</Jump>
          {draft.toc.map(entry => <Jump key={entry.id} id={`aq-${entry.id}`}><span className="aq-toc-sub">{entry.title}</span></Jump>)}
        </aside>
        <div className="aq-body">
          <section className="aq-section aq-overview" id="aq-overview">
            <div className="detail-section-title"><span>01</span><h2>Überblick</h2></div>
            <p className="aq-draft-title">{draft.title}</p>
            <div className="aq-prose"><Blocks blocks={draft.overview} /></div>
          </section>
          <section className="aq-section" id="aq-profile">
            <div className="detail-section-title"><span>02</span><h2>Profiltext (Englisch)</h2></div>
            <div className="aq-actions">
              <button type="button" onClick={copy}>{copied === 'done' ? '✓ Kopiert' : copied === 'failed' ? 'Kopieren blockiert, Text bitte markieren' : 'Englischen Text kopieren'}</button>
              {profile.dynastyProfile && <button type="button" onClick={() => go(`/profiles/${profile.dynastyProfile}`)}>Aktuelles Dynasty-Profil ↗</button>}
            </div>
            <div className="aq-prose aq-en" lang="en"><Blocks blocks={draft.profile} /></div>
          </section>
          <nav className="profile-pagination" aria-label="Benachbarte Profile">
            <button type="button" onClick={() => go(`/aquatic/${profile.previous.id}`)}>← <span>Zurück</span><strong>{profile.previous.name}</strong></button>
            <button type="button" onClick={() => go(`/aquatic/${profile.next.id}`)}><span>Weiter</span><strong>{profile.next.name}</strong> →</button>
          </nav>
        </div>
      </div>
    </article>
  </div>;
}
