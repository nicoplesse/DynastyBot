import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, type Ecosystem, type FoodWebIndex, type FoodWebKind, type FoodWebNode, type FoodWebVerdict } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './foodweb.css';

// Food web ("Beutenetz"). Two views on one curated hunting web:
//   Mindmap  – one playable in the centre, who hunts it on the left, whom it hunts on the right,
//              grouped by the profile's own order (rank 1 → 2 → free choice → last → special → never).
//              The group chips switch the hunting party, which changes what is in reach.
//   Gesamtnetz – every playable on its food-chain level; hover shows all of its hunts and hunters.
// Ranks, exceptions and "never" come from verbatim profile quotes; everything else is the tier rule.

const PREFS_KEY = 'dynasty.foodweb.prefs';
type Sort = 'rank' | 'weight' | 'name';
type Prefs = { hunters: 'full' | 'solo'; sort: Sort; habitat: boolean; contact: boolean; never: boolean; edges: 'preferred' | 'all' };
const DEFAULT_PREFS: Prefs = { hunters: 'full', sort: 'rank', habitat: false, contact: false, never: false, edges: 'preferred' };
const HUNTABLE = new Set<FoodWebKind>(['priority', 'allowed', 'legal', 'last', 'special']);
const ACTIVITY_DE: Record<string, string> = { Diurnal: 'tagaktiv', Nocturnal: 'nachtaktiv', Cathemeral: 'tag & nacht', Crepuscular: 'Dämmerung' };

function readPrefs(): Prefs {
  try { const raw = window.localStorage.getItem(PREFS_KEY); return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) as Partial<Prefs> } : DEFAULT_PREFS; } catch { return DEFAULT_PREFS; }
}
function writePrefs(prefs: Prefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* per-viewer convenience only */ }
}

// Lower is a stronger reason to hunt.
const score = (v: FoodWebVerdict) => v.k === 'priority' ? v.r ?? 1 : v.k === 'allowed' || v.k === 'legal' ? 50 : v.k === 'last' ? 60 : v.k === 'special' ? 70 : v.k === 'locked' ? 80 : v.k === 'never' ? 90 : 99;

type Rel = { hunter: string; target: string; v: FoodWebVerdict; setup: number; contact: number };
type Leaf = Rel & { other: FoodWebNode; badge?: string };
type Branch = { key: string; title: string; tone: string; hint?: string; leaves: Leaf[]; groups?: Array<{ label: string; leaves: Leaf[] }> };

// The verdict a hunter has on a target: its first setup ("solo") or the best over all setups.
function pick(per: FoodWebVerdict[], mode: 'full' | 'solo') {
  if (mode === 'solo') return { v: per[0], setup: 0 };
  let best = 0;
  per.forEach((item, index) => { if (score(item) < score(per[best])) best = index; });
  return { v: per[best], setup: best };
}

function sortLeaves(leaves: Leaf[], sort: Sort) {
  const cw = (leaf: Leaf) => leaf.other.combatWeight ?? 0;
  return [...leaves].sort((a, b) => sort === 'name' ? a.other.name.localeCompare(b.other.name)
    : sort === 'weight' ? cw(b) - cw(a) || a.other.name.localeCompare(b.other.name)
      : score(a.v) - score(b.v) || cw(b) - cw(a) || a.other.name.localeCompare(b.other.name));
}

export function FoodWebPage({ route }: { route: string }) {
  const [web, setWeb] = useState<FoodWebIndex | null>(null);
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const focus = decodeURIComponent(route.split('/')[2] || '') || null;
  useEffect(() => {
    api.foodWeb().then(setWeb).catch(cause => setError((cause as Error).message));
    api.ecosystems().then(index => setEcosystems(index.ecosystems)).catch(() => setEcosystems([]));
  }, []);
  const update = (patch: Partial<Prefs>) => setPrefs(current => { const next = { ...current, ...patch }; writePrefs(next); return next; });

  if (error) return <PageError message={error} />;
  if (!web) return <PageLoading label="Loading food web…" />;
  const node = focus ? web.nodes[focus] : null;
  const hunterCount = Object.values(web.hunters).filter(item => !item.none).length;
  return <>
    <ExplorerTopline section="PROFILES / FOOD WEB" count={`${Object.keys(web.nodes).length} PLAYABLES · ${hunterCount} HUNTERS`} />
    <header className="directory-head fw-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · PREFERRED PREY</div>
        <h1>Food Web <span lang="de">Beutenetz</span></h1>
        <p lang="de">Wer jagt wen, in welcher Reihenfolge und ab welcher Gruppengröße. Bevorzugte Beute, Ausnahmen und Verbote stehen wörtlich im Profil. Alles andere folgt aus der Jagdgrenze (Tier) und daraus, ob der Lebensraum erreichbar ist.</p>
      </div>
      <div className="fw-modes" role="tablist" aria-label="Ansicht">
        <button type="button" role="tab" aria-selected={Boolean(focus)} className={focus ? 'active' : ''} onClick={() => go(`/foodweb/${focus || 'daspletosaurus'}`)}><b>Mindmap</b><small>eine Kreatur im Zentrum</small></button>
        <button type="button" role="tab" aria-selected={!focus} className={!focus ? 'active' : ''} onClick={() => go('/foodweb')}><b>Gesamtnetz</b><small>alle Ebenen auf einen Blick</small></button>
      </div>
    </header>
    {focus && !node ? <div className="catalog-empty"><strong>Unbekanntes Playable</strong><p>{focus}</p></div>
      : node ? <Mindmap key={node.id} web={web} node={node} ecosystems={ecosystems} prefs={prefs} update={update} />
        : <Overview web={web} ecosystems={ecosystems} prefs={prefs} update={update} />}
  </>;
}

function Picker({ web, value, onPick }: { web: FoodWebIndex; value: string; onPick: (id: string) => void }) {
  const byLevel = useMemo(() => web.levels.map(level => ({ level, nodes: Object.values(web.nodes).filter(node => node.level === level.level).sort((a, b) => a.name.localeCompare(b.name)) })), [web]);
  return <label className="fw-picker"><span lang="de">Im Zentrum</span>
    <select value={value} onChange={event => event.target.value && onPick(event.target.value)}>
      {!value && <option value="">– Kreatur wählen –</option>}
      {byLevel.map(({ level, nodes }) => <optgroup key={level.level} label={`${level.level} · ${level.de || level.label}`}>{nodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</optgroup>)}
    </select>
  </label>;
}

function Toggle({ on, onChange, children, title }: { on: boolean; onChange: (value: boolean) => void; children: string; title?: string }) {
  return <button type="button" className={`fw-toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)} title={title}><i aria-hidden="true" />{children}</button>;
}

function SortSelect({ prefs, update }: { prefs: Prefs; update: (patch: Partial<Prefs>) => void }) {
  return <label className="fw-sort"><span>Sortierung</span><select value={prefs.sort} onChange={event => update({ sort: event.target.value as Sort })}>
    <option value="rank">Rang & Gewicht</option><option value="weight">Combat Weight</option><option value="name">Name</option>
  </select></label>;
}

// ── Mindmap ────────────────────────────────────────────────────────────────────────────────────

function Mindmap({ web, node, ecosystems, prefs, update }: { web: FoodWebIndex; node: FoodWebNode; ecosystems: Ecosystem[]; prefs: Prefs; update: (patch: Partial<Prefs>) => void }) {
  const hunter = web.hunters[node.id] || null;
  const [setup, setSetup] = useState(0);
  const [selected, setSelected] = useState<{ hunter: string; target: string } | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  useEffect(() => { setTrail(list => [node.id, ...list.filter(id => id !== node.id)].slice(0, 7)); }, [node.id]);
  const eco = useMemo(() => new Map(ecosystems.map(item => [item.id, item])), [ecosystems]);
  const habitats = new Set([node.ecosystem, ...node.also].filter(Boolean));
  const visible = (other: FoodWebNode, contact: number) =>
    (!prefs.habitat || [other.ecosystem, ...other.also].some(id => id && habitats.has(id))) && (!prefs.contact || contact > 0);

  const prey = useMemo<Branch[]>(() => {
    if (!hunter || hunter.none) return [];
    const branches = new Map<string, Branch>();
    const add = (key: string, make: () => Omit<Branch, 'leaves' | 'key'>, leaf: Leaf) => { if (!branches.has(key)) branches.set(key, { ...make(), key, leaves: [] }); branches.get(key)!.leaves.push(leaf); };
    for (const edge of hunter.edges) {
      const v = edge.per[setup];
      const other = web.nodes[edge.t];
      if (!other || v.k === 'out' || !visible(other, edge.contact)) continue;
      const leaf: Leaf = { hunter: node.id, target: edge.t, v, setup, contact: edge.contact, other };
      if (v.k === 'priority') { const stage = hunter.stages[v.st ?? 0]; add(`p${v.st}`, () => ({ title: `${stage.rank}. ${stage.label}`, tone: `priority r${Math.min(stage.rank, 3)}` }), leaf); }
      else if (v.k === 'allowed') add(`a:${v.l}`, () => ({ title: v.l || 'Ausdrücklich erlaubt', tone: 'free', hint: 'ausdrücklich im Profil' }), leaf);
      else if (v.k === 'legal') add('free', () => ({ title: hunter.stages.length ? 'Freie Wahl' : 'Freie Wahl – keine Vorliebe im Profil', tone: 'free', hint: 'innerhalb der Jagdgrenze' }), leaf);
      else if (v.k === 'last') add(`last:${v.l}`, () => ({ title: v.l || 'Nur als letzte Option', tone: 'last' }), leaf);
      else if (v.k === 'special') add('special', () => ({ title: 'Sondersituationen', tone: 'special', hint: 'nur unter Bedingungen' }), leaf);
      else if (v.k === 'locked') add('locked', () => ({ title: 'Mit anderer Gruppe', tone: 'locked', hint: 'mit dieser Gruppe nicht' }), leaf);
      else if (v.k === 'never' && prefs.never) add(`never:${v.l}`, () => ({ title: `Nie: ${v.l || 'laut Profil'}`, tone: 'never' }), leaf);
    }
    // Profile ranks first (in stage order), then the free choice, last resort, special, locked, never.
    const order = (branch: Branch) => {
      if (branch.tone.startsWith('priority')) { const stage = Number(branch.key.slice(1)); return hunter.stages[stage].rank * 100 + stage; }
      return 10000 + ['a:', 'free', 'last:', 'special', 'locked', 'never:'].findIndex(prefix => branch.key === prefix || branch.key.startsWith(prefix));
    };
    const list = [...branches.values()].sort((a, b) => order(a) - order(b));
    for (const branch of list) {
      branch.leaves = sortLeaves(branch.leaves, prefs.sort);
      if (branch.key === 'special') branch.groups = groupBy(branch.leaves, leaf => leaf.v.c?.[0] || 'Bedingung siehe Profil');
      if (branch.key === 'locked') branch.groups = groupBy(branch.leaves, leaf => `ab ${hunter.setups[leaf.v.need ?? 0]?.label}`);
    }
    return list;
  }, [hunter, setup, prefs, web, node.id]);

  const predators = useMemo<Branch[]>(() => {
    const defs: Record<string, Omit<Branch, 'leaves'>> = {
      priority: { key: 'priority', title: 'Jagt dich bevorzugt', tone: 'threat-high', hint: 'du stehst auf seiner Liste' },
      legal: { key: 'legal', title: 'Kann dich jagen', tone: 'threat', hint: 'innerhalb seiner Jagdgrenze' },
      last: { key: 'last', title: 'Nur als letzte Option', tone: 'last' },
      special: { key: 'special', title: 'Nur in Sondersituationen', tone: 'special' },
      locked: { key: 'locked', title: 'Erst in der Gruppe', tone: 'locked', hint: 'solo kann er dich nicht' },
      never: { key: 'never', title: 'Jagt dich nie', tone: 'never', hint: 'laut seinem Profil' },
    };
    const buckets = new Map<string, Leaf[]>();
    for (const [id, other] of Object.entries(web.hunters)) {
      if (id === node.id || other.none) continue;
      const edge = other.edges.find(item => item.t === node.id);
      const otherNode = web.nodes[id];
      if (!edge || !otherNode || !visible(otherNode, edge.contact)) continue;
      const { v, setup: index } = pick(edge.per, prefs.hunters);
      if (v.k === 'out' || (v.k === 'never' && !prefs.never)) continue;
      const key = v.k === 'allowed' ? 'legal' : v.k;
      const setupLabel = other.setups[index]?.label;
      const badge = v.k === 'priority' ? `Rang ${v.r}${index > 0 || other.setups.length > 1 ? ` · ${setupLabel}` : ''}`
        : v.k === 'locked' ? `ab ${other.setups[v.need ?? 0]?.label}`
          : HUNTABLE.has(v.k) && other.setups.length > 1 ? setupLabel : undefined;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ hunter: id, target: node.id, v, setup: index, contact: edge.contact, other: otherNode, badge });
    }
    return Object.keys(defs).filter(key => buckets.has(key)).map(key => ({ ...defs[key], leaves: sortLeaves(buckets.get(key)!, prefs.sort) }));
  }, [web, node.id, prefs]);

  const preyCount = prey.filter(branch => !['locked', 'never'].includes(branch.tone)).reduce((sum, branch) => sum + branch.leaves.length, 0);
  const preferred = prey.filter(branch => branch.tone.startsWith('priority')).reduce((sum, branch) => sum + branch.leaves.length, 0);
  const huntedBy = predators.filter(branch => !['locked', 'never'].includes(branch.tone)).reduce((sum, branch) => sum + branch.leaves.length, 0);
  const current = hunter?.setups[setup];
  const home = node.ecosystem ? eco.get(node.ecosystem) : null;

  // Connector lines from the centre card to every branch header, measured after layout.
  const boardRef = useRef<HTMLDivElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const heads = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<Array<{ key: string; d: string; tone: string }>>([]);
  const measure = useCallback(() => {
    const board = boardRef.current, centre = centreRef.current;
    if (!board || !centre) return;
    const box = board.getBoundingClientRect();
    const c = centre.getBoundingClientRect();
    const cy = c.top - box.top + Math.min(70, c.height / 2);
    const next: Array<{ key: string; d: string; tone: string }> = [];
    heads.current.forEach((element, key) => {
      if (!element.isConnected) return;
      const r = element.getBoundingClientRect();
      const y = r.top - box.top + r.height / 2;
      const left = key.startsWith('L:');
      const x1 = left ? c.left - box.left : c.right - box.left;
      const x2 = left ? r.right - box.left : r.left - box.left;
      if (Math.abs(x2 - x1) < 8) return;
      const mid = (x1 + x2) / 2;
      next.push({ key, tone: element.dataset.tone || '', d: `M${x1},${cy} C${mid},${cy} ${mid},${y} ${x2},${y}` });
    });
    setPaths(next);
  }, []);
  useLayoutEffect(() => { measure(); }, [measure, prey, predators, selected]);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(board);
    // The centre card is sticky, so its curves follow it while the page scrolls.
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); document.removeEventListener('scroll', onScroll, { capture: true }); };
  }, [measure]);
  const headRef = (key: string) => (element: HTMLElement | null) => { if (element) heads.current.set(key, element); else heads.current.delete(key); };

  const select = (leaf: Leaf) => setSelected(value => value && value.hunter === leaf.hunter && value.target === leaf.target ? null : { hunter: leaf.hunter, target: leaf.target });
  const isSelected = (leaf: Leaf) => Boolean(selected && selected.hunter === leaf.hunter && selected.target === leaf.target);

  return <>
    <div className="fw-bar">
      <Picker web={web} value={node.id} onPick={id => go(`/foodweb/${id}`)} />
      {hunter && !hunter.none && <div className="fw-setups" role="group" aria-label="Meine Jagdgruppe">
        <span>Meine Gruppe</span>
        {hunter.setups.map((item, index) => <button type="button" key={item.id} className={index === setup ? 'active' : ''} aria-pressed={index === setup} onClick={() => setSetup(index)} title={[item.with, item.when].filter(Boolean).join(' · ') || undefined}>
          <b>{item.label}</b><small>{item.only ? 'Spezialfall' : item.minTier ? `nur ${item.minTier}` : `bis ${item.tier === 'Giant' ? 'jede Stufe' : item.tier}`}</small>
        </button>)}
      </div>}
      <div className="fw-setups" role="group" aria-label="Jäger kommen">
        <span>Jäger kommen</span>
        <button type="button" className={prefs.hunters === 'full' ? 'active' : ''} aria-pressed={prefs.hunters === 'full'} onClick={() => update({ hunters: 'full' })}><b>mit voller Gruppe</b><small>stärkste legale Aufstellung</small></button>
        <button type="button" className={prefs.hunters === 'solo' ? 'active' : ''} aria-pressed={prefs.hunters === 'solo'} onClick={() => update({ hunters: 'solo' })}><b>solo</b><small>erste Aufstellung</small></button>
      </div>
    </div>
    <div className="fw-filters">
      <Toggle on={prefs.habitat} onChange={value => update({ habitat: value })} title="Nur Arten, die ein Ökosystem mit dem Zentrum teilen">Nur mein Lebensraum</Toggle>
      <Toggle on={prefs.contact} onChange={value => update({ contact: value })} title="Nur Arten mit mindestens einem gemeinsamen Kartengebiet">Nur mit Gebietskontakt</Toggle>
      <Toggle on={prefs.never} onChange={value => update({ never: value })} title="Ausdrückliche Verbote und Fluchtregeln einblenden">Nie-Regeln zeigen</Toggle>
      <SortSelect prefs={prefs} update={update} />
      {trail.length > 1 && <div className="fw-trail"><span>Verlauf</span>{trail.slice(1).map(id => <button type="button" key={id} onClick={() => go(`/foodweb/${id}`)}>{web.nodes[id]?.name || id}</button>)}</div>}
    </div>

    <div className="fw-board" ref={boardRef}>
      <svg className="fw-links" aria-hidden="true">{paths.map(path => <path key={path.key} d={path.d} className={`fw-link ${path.tone}`} />)}</svg>
      <section className="fw-side left" aria-label="Wer jagt dich">
        <h2 className="fw-side-title">Wird gejagt von <b>{huntedBy}</b></h2>
        {predators.length ? predators.map(branch => <BranchBlock key={branch.key} side="L" branch={branch} headRef={headRef} onPick={select} isSelected={isSelected} />)
          : <p className="fw-empty">Kein Jäger mit diesen Filtern.</p>}
      </section>

      <section className="fw-centre" aria-label={node.name}>
        <div className="fw-centre-card" ref={centreRef} style={{ '--eco': home?.accent || '#9bbc7b' } as CSSProperties}>
          <div className="fw-kicker">{[node.tier, ACTIVITY_DE[node.activity || ''] || node.activity, node.habitat, node.diet].filter(Boolean).join(' · ')}</div>
          <h2>{node.name}</h2>
          {home && <p className="fw-eco"><i aria-hidden="true">{home.symbol}</i>{home.de}{node.level && web.levels.find(level => level.level === node.level) && <> · Ebene {node.level}: {web.levels.find(level => level.level === node.level)!.de}</>}</p>}
          <div className="fw-counts">
            <span><b>{hunter && !hunter.none ? preyCount : '–'}</b>jagt{preferred ? <em> · {preferred} bevorzugt</em> : null}</span>
            <span><b>{huntedBy}</b>Jäger</span>
            <span><b>{node.combatWeight?.toLocaleString('de-DE') ?? '–'}</b>CW</span>
          </div>
          {current && (current.with || current.when) && <p className="fw-when">{[current.with, current.when].filter(Boolean).join(' · ')}</p>}
          <div className="fw-centre-links"><a href={`#/profiles/${node.id}`}>Profil ↗</a><a href={`#/foodweb`} onClick={event => { event.preventDefault(); go('/foodweb'); }}>Im Gesamtnetz</a></div>
        </div>
        {selected && <RelationDetail web={web} rel={selected} onClose={() => setSelected(null)} focus={node.id} />}
        {hunter?.none ? <div className="fw-notes"><h3>Jagt nicht</h3><p>{hunter.none}</p><blockquote>„{hunter.noneQuote}“<cite>{hunter.noneSection}</cite></blockquote></div>
          : !hunter ? <div className="fw-notes"><h3>Pflanzenfresser</h3><p>Jagt keine anderen Playables. Links siehst du, wer es auf dich abgesehen hat.</p></div>
            : hunter.notes.length > 0 && <div className="fw-notes"><h3>Außerdem laut Profil</h3><ul>{hunter.notes.map(note => <li key={note}>{note}</li>)}</ul></div>}
      </section>

      <section className="fw-side right" aria-label="Wen du jagst">
        <h2 className="fw-side-title">Jagt <b>{hunter && !hunter.none ? preyCount : 0}</b>{current && <small> · {current.label}</small>}</h2>
        {prey.length ? prey.map(branch => <BranchBlock key={branch.key} side="R" branch={branch} headRef={headRef} onPick={select} isSelected={isSelected} />)
          : <p className="fw-empty">{hunter && !hunter.none ? 'Keine Beute mit diesen Filtern.' : 'Keine Beute – dieses Playable jagt nicht.'}</p>}
      </section>
    </div>
    <p className="fw-legend" lang="de"><span className="k priority">Rang aus dem Profil</span><span className="k free">Freie Wahl (Jagdgrenze)</span><span className="k last">Zuletzt</span><span className="k special">Sondersituation</span><span className="k locked">andere Gruppe nötig</span><span className="k threat">Jäger</span> Klick auf eine Kreatur zeigt Regel und Zitat, Doppelklick macht sie zum Zentrum.</p>
  </>;
}

function groupBy(leaves: Leaf[], key: (leaf: Leaf) => string) {
  const groups = new Map<string, Leaf[]>();
  for (const leaf of leaves) { const label = key(leaf); if (!groups.has(label)) groups.set(label, []); groups.get(label)!.push(leaf); }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([label, items]) => ({ label, leaves: items }));
}

function BranchBlock({ side, branch, headRef, onPick, isSelected }: { side: 'L' | 'R'; branch: Branch; headRef: (key: string) => (element: HTMLElement | null) => void; onPick: (leaf: Leaf) => void; isSelected: (leaf: Leaf) => boolean }) {
  const big = branch.leaves.length > 14;
  const [open, setOpen] = useState(!big || branch.tone.startsWith('priority'));
  const chips = (leaves: Leaf[]) => <div className="fw-chips">{leaves.map(leaf => <Chip key={`${leaf.hunter}>${leaf.target}`} leaf={leaf} side={side} onPick={onPick} selected={isSelected(leaf)} />)}</div>;
  return <div className={`fw-branch ${branch.tone}`}>
    <button type="button" className="fw-branch-head" ref={headRef(`${side}:${branch.key}`)} data-tone={branch.tone} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <b>{branch.title}</b>{branch.hint && <small>{branch.hint}</small>}<em>{branch.leaves.length}</em><i aria-hidden="true">{open ? '▾' : '▸'}</i>
    </button>
    {open && (branch.groups && branch.groups.length > 1 ? branch.groups.map(group => <div className="fw-group" key={group.label}><span>{group.label}</span>{chips(group.leaves)}</div>)
      : branch.groups?.length === 1 && branch.groups[0].label ? <div className="fw-group"><span>{branch.groups[0].label}</span>{chips(branch.leaves)}</div> : chips(branch.leaves))}
  </div>;
}

function Chip({ leaf, side, onPick, selected }: { leaf: Leaf; side: 'L' | 'R'; onPick: (leaf: Leaf) => void; selected: boolean }) {
  const condition = leaf.v.c?.length ? leaf.v.c.join(' · ') : '';
  const target = side === 'L' ? leaf.hunter : leaf.target;
  return <button type="button" className={`fw-chip ${selected ? 'selected' : ''} ${leaf.contact ? '' : 'far'}`} onClick={() => onPick(leaf)} onDoubleClick={() => go(`/foodweb/${target}`)}
    title={[condition, leaf.contact ? `${leaf.contact} gemeinsame Kartengebiete` : 'kein gemeinsames Kartengebiet'].filter(Boolean).join('\n')}>
    <span>{leaf.other.name}</span><small>{leaf.other.tier}</small>
    {leaf.badge && <em>{leaf.badge}</em>}
    {condition && side === 'R' && leaf.v.k !== 'special' && <i aria-label="mit Bedingung">◔</i>}
  </button>;
}

const KIND_DE: Record<FoodWebKind, string> = {
  priority: 'Bevorzugt', allowed: 'Ausdrücklich erlaubt', legal: 'Freie Wahl', last: 'Nur als letzte Option',
  special: 'Sondersituation', never: 'Nie', locked: 'Nicht mit dieser Gruppe', out: 'Keine Jagd in diesem Setup',
};

function RelationDetail({ web, rel, onClose, focus }: { web: FoodWebIndex; rel: { hunter: string; target: string }; onClose: () => void; focus: string }) {
  const hunter = web.hunters[rel.hunter];
  const edge = hunter?.edges.find(item => item.t === rel.target);
  const h = web.nodes[rel.hunter], t = web.nodes[rel.target];
  if (!hunter || !edge || !h || !t) return null;
  const quoteIds = [...new Set(edge.per.map(v => v.q).filter((q): q is number => q !== undefined))];
  const other = rel.hunter === focus ? rel.target : rel.hunter;
  const derived = edge.per.some(v => v.k === 'legal') && !quoteIds.length;
  return <div className="fw-detail" role="region" aria-label="Beziehung">
    <button type="button" className="fw-close" aria-label="Schließen" onClick={onClose}>×</button>
    <div className="fw-kicker">Beziehung</div>
    <h3>{h.name} <span>jagt</span> {t.name}</h3>
    <table className="fw-per"><tbody>{edge.per.map((v, index) => <tr key={hunter.setups[index].id} className={`k-${v.k}`}>
      <th>{hunter.setups[index].label}</th>
      <td><b>{v.k === 'priority' ? `Rang ${v.r} · ${hunter.stages[v.st ?? 0]?.label}` : v.k === 'locked' ? `erst ${hunter.setups[v.need ?? 0]?.label}` : v.l ? `${KIND_DE[v.k]}: ${v.l}` : KIND_DE[v.k]}</b>
        {v.c?.length ? <small>{v.c.join(' · ')}</small> : null}</td>
    </tr>)}</tbody></table>
    <p className="fw-contact">{edge.contact ? `${edge.contact} gemeinsame Kartengebiete – Begegnungen sind realistisch.` : 'Kein gemeinsames Kartengebiet laut Profilkarten – Begegnungen eher selten.'}</p>
    {derived && <p className="fw-derived">Kein eigener Satz im Profil: erlaubt, weil {t.name} ({t.tier}) innerhalb der Jagdgrenze von {h.name} liegt.</p>}
    {quoteIds.map(id => <blockquote key={id}>„{hunter.quotes[id].text}“<cite>{h.name} · {hunter.quotes[id].section}</cite></blockquote>)}
    <div className="fw-detail-actions">
      <button type="button" onClick={() => go(`/foodweb/${other}`)}>{web.nodes[other].name} ins Zentrum</button>
      <a href={`#/profiles/${rel.hunter}`}>Profil {h.name} ↗</a>
    </div>
  </div>;
}

// ── Gesamtnetz ─────────────────────────────────────────────────────────────────────────────────

const WIDTH = 1040;
const ROW_GAP = 34;
const NODE_H = 26;
const LEFT = 128;

// Two short lines fit the gutter left of the nodes.
function splitLabel(label: string) {
  if (label.length <= 14 || !label.includes(' ')) return [label];
  const spaces = [...label.matchAll(/ /g)].map(match => match.index ?? 0);
  const cut = spaces.reduce((best, index) => Math.abs(index - label.length / 2) < Math.abs(best - label.length / 2) ? index : best, spaces[0]);
  return [label.slice(0, cut), label.slice(cut + 1)];
}

function Overview({ web, ecosystems, prefs, update }: { web: FoodWebIndex; ecosystems: Ecosystem[]; prefs: Prefs; update: (patch: Partial<Prefs>) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const active = hover || pinned;
  const eco = useMemo(() => new Map(ecosystems.map(item => [item.id, item])), [ecosystems]);
  const ecoOrder = useMemo(() => new Map(ecosystems.map((item, index) => [item.id, index])), [ecosystems]);

  // Rows per food-chain level, wrapped when a level is wider than the canvas.
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; w: number }>();
    const bands: Array<{ level: number; label: string; y: number; h: number }> = [];
    let y = 18;
    for (const level of web.levels) {
      const nodes = Object.values(web.nodes).filter(node => node.level === level.level)
        .sort((a, b) => (ecoOrder.get(a.ecosystem || '') ?? 9) - (ecoOrder.get(b.ecosystem || '') ?? 9) || (b.combatWeight ?? 0) - (a.combatWeight ?? 0));
      const rows: Array<typeof nodes> = [[]];
      let used = 0;
      for (const node of nodes) {
        const w = Math.max(70, node.name.length * 6.6 + 18);
        if (used + w > WIDTH - LEFT - 10 && rows.at(-1)!.length) { rows.push([]); used = 0; }
        rows.at(-1)!.push(node); used += w + 10;
      }
      const top = y;
      for (const row of rows) {
        const widths = row.map(node => Math.max(70, node.name.length * 6.6 + 18));
        const total = widths.reduce((sum, w) => sum + w, 0) + (row.length - 1) * 10;
        let x = LEFT + (WIDTH - LEFT - total) / 2;
        row.forEach((node, index) => { pos.set(node.id, { x, y, w: widths[index] }); x += widths[index] + 10; });
        y += NODE_H + 14;
      }
      bands.push({ level: level.level, label: level.de || level.label, y: top - 8, h: y - top + 2 });
      y += ROW_GAP;
    }
    return { pos, bands, height: y };
  }, [web, ecoOrder]);

  const relations = useMemo(() => {
    const list: Array<{ hunter: string; target: string; v: FoodWebVerdict }> = [];
    for (const [id, hunter] of Object.entries(web.hunters)) {
      if (hunter.none) continue;
      for (const edge of hunter.edges) {
        const { v } = pick(edge.per, prefs.hunters);
        if (HUNTABLE.has(v.k)) list.push({ hunter: id, target: edge.t, v });
      }
    }
    return list;
  }, [web, prefs.hunters]);
  const counts = useMemo(() => {
    const map = new Map<string, { prey: number; preferred: number; hunters: number; preferredBy: number }>();
    const get = (id: string) => { if (!map.has(id)) map.set(id, { prey: 0, preferred: 0, hunters: 0, preferredBy: 0 }); return map.get(id)!; };
    for (const rel of relations) {
      get(rel.hunter).prey++; get(rel.target).hunters++;
      if (rel.v.k === 'priority') { get(rel.hunter).preferred++; get(rel.target).preferredBy++; }
    }
    return map;
  }, [relations]);

  const inEco = (node: FoodWebNode) => !only || node.ecosystem === only || node.also.includes(only);
  const shown = relations.filter(rel => {
    const touches = active && (rel.hunter === active || rel.target === active);
    if (active) return touches;
    return rel.v.k === 'priority' && (prefs.edges === 'all' || rel.v.r === 1) && inEco(web.nodes[rel.hunter]) && inEco(web.nodes[rel.target]);
  });
  const linked = new Set(active ? shown.flatMap(rel => [rel.hunter, rel.target]) : []);
  const path = (from: string, to: string) => {
    const a = layout.pos.get(from), b = layout.pos.get(to);
    if (!a || !b) return '';
    const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
    if (b.y > a.y + 4) { const ay = a.y + NODE_H, by = b.y, mid = (ay + by) / 2; return `M${ax},${ay} C${ax},${mid} ${bx},${mid} ${bx},${by}`; }
    if (b.y < a.y - 4) { const ay = a.y, by = b.y + NODE_H, mid = (ay + by) / 2; return `M${ax},${ay} C${ax},${mid} ${bx},${mid} ${bx},${by}`; }
    const lift = Math.min(60, 18 + Math.abs(bx - ax) / 6);
    return `M${ax},${a.y} C${ax},${a.y - lift} ${bx},${b.y - lift} ${bx},${b.y}`;
  };
  const tone = (rel: { hunter: string; target: string; v: FoodWebVerdict }) => active && rel.target === active ? 'in' : rel.v.k === 'priority' ? `priority r${Math.min(rel.v.r ?? 1, 3)}` : rel.v.k;
  const focusNode = active ? web.nodes[active] : null;
  const focusCount = active ? counts.get(active) : null;
  const topPrey = active ? relations.filter(rel => rel.hunter === active && rel.v.k === 'priority').sort((a, b) => (a.v.r ?? 9) - (b.v.r ?? 9)).map(rel => web.nodes[rel.target]) : [];
  const topHunters = active ? relations.filter(rel => rel.target === active && rel.v.k === 'priority').map(rel => web.nodes[rel.hunter]) : [];

  return <>
    <div className="fw-bar">
      <Picker web={web} value={pinned || ''} onPick={id => go(`/foodweb/${id}`)} />
      <div className="fw-setups" role="group" aria-label="Kanten">
        <span>Kanten</span>
        <button type="button" className={prefs.edges === 'preferred' ? 'active' : ''} aria-pressed={prefs.edges === 'preferred'} onClick={() => update({ edges: 'preferred' })}><b>Rang 1</b><small>nur Lieblingsbeute</small></button>
        <button type="button" className={prefs.edges === 'all' ? 'active' : ''} aria-pressed={prefs.edges === 'all'} onClick={() => update({ edges: 'all' })}><b>Alle Ränge</b><small>beim Hover: alle Jagden</small></button>
      </div>
      <div className="fw-setups" role="group" aria-label="Jäger kommen">
        <span>Jäger kommen</span>
        <button type="button" className={prefs.hunters === 'full' ? 'active' : ''} aria-pressed={prefs.hunters === 'full'} onClick={() => update({ hunters: 'full' })}><b>mit voller Gruppe</b></button>
        <button type="button" className={prefs.hunters === 'solo' ? 'active' : ''} aria-pressed={prefs.hunters === 'solo'} onClick={() => update({ hunters: 'solo' })}><b>solo</b></button>
      </div>
    </div>
    <div className="fw-filters fw-eco-filter">
      <button type="button" className={!only ? 'on' : ''} onClick={() => setOnly(null)}>Alle Ökosysteme</button>
      {ecosystems.map(item => <button type="button" key={item.id} className={only === item.id ? 'on' : ''} style={{ '--eco': item.accent } as CSSProperties} onClick={() => setOnly(value => value === item.id ? null : item.id)}><i aria-hidden="true">{item.symbol}</i>{item.de}</button>)}
    </div>
    <div className="fw-overview">
      <div className="fw-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${layout.height}`} role="img" aria-label="Nahrungsnetz aller Playables nach Nahrungskettenebene" onMouseLeave={() => setHover(null)}>
          <defs>
            <marker id="fw-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke" /></marker>
          </defs>
          {layout.bands.map(band => <g key={band.level} className="fw-band">
            <rect x="6" y={band.y} width={WIDTH - 12} height={band.h} rx="8" />
            <text x="18" y={band.y + 20} className="fw-band-num">{band.level}</text>
            <text x="38" y={band.y + 20} className="fw-band-label">{splitLabel(band.label).map((line, index) => <tspan key={line} x="38" dy={index ? 13 : 0}>{line}</tspan>)}</text>
          </g>)}
          <g className="fw-edges">{shown.map(rel => <path key={`${rel.hunter}>${rel.target}`} d={path(rel.hunter, rel.target)} className={`fw-edge ${tone(rel)} ${active ? 'hot' : ''}`} markerEnd="url(#fw-arrow)" />)}</g>
          {Object.values(web.nodes).map(node => {
            const p = layout.pos.get(node.id);
            if (!p) return null;
            const accent = node.ecosystem ? eco.get(node.ecosystem)?.accent : undefined;
            const dim = (active && node.id !== active && !linked.has(node.id)) || !inEco(node);
            return <g key={node.id} transform={`translate(${p.x},${p.y})`} className={`fw-node ${node.diet === 'Carnivore' ? 'carn' : 'herb'} ${node.id === active ? 'active' : ''} ${dim ? 'dim' : ''}`}
              tabIndex={0} role="button" aria-label={node.name}
              onMouseEnter={() => setHover(node.id)} onFocus={() => setHover(node.id)} onBlur={() => setHover(null)}
              onClick={() => setPinned(value => value === node.id ? null : node.id)} onDoubleClick={() => go(`/foodweb/${node.id}`)}
              onKeyDown={event => { if (event.key === 'Enter') go(`/foodweb/${node.id}`); }}>
              <rect width={p.w} height={NODE_H} rx="6" />
              {accent && <circle cx="10" cy={NODE_H / 2} r="3.2" fill={accent} />}
              <text x={18} y={NODE_H / 2 + 4}>{node.name}</text>
            </g>;
          })}
        </svg>
      </div>
      <aside className="fw-panel">
        {focusNode && focusCount ? <>
          <div className="fw-kicker">{[focusNode.tier, focusNode.diet, focusNode.habitat].filter(Boolean).join(' · ')}</div>
          <h2>{focusNode.name}</h2>
          <div className="fw-counts"><span><b>{focusCount.prey}</b>jagt{focusCount.preferred ? <em> · {focusCount.preferred} bevorzugt</em> : null}</span><span><b>{focusCount.hunters}</b>Jäger{focusCount.preferredBy ? <em> · {focusCount.preferredBy} bevorzugt</em> : null}</span></div>
          {topPrey.length > 0 && <><h3>Lieblingsbeute</h3><p className="fw-list">{topPrey.map(item => item.name).join(', ')}</p></>}
          {topHunters.length > 0 && <><h3>Steht auf der Liste von</h3><p className="fw-list">{topHunters.map(item => item.name).join(', ')}</p></>}
          {web.hunters[focusNode.id]?.none && <p className="fw-list">{web.hunters[focusNode.id].none}</p>}
          <button type="button" className="fw-open" onClick={() => go(`/foodweb/${focusNode.id}`)}>Als Mindmap öffnen →</button>
        </> : <>
          <h2>So liest du das Netz</h2>
          <p>Oben die Apex-Räuber, unten die kleinsten Beutetiere. Die Linien zeigen die <b>Lieblingsbeute</b> jedes Jägers aus seinem Profil.</p>
          <p>Fahr über eine Kreatur: <span className="fw-swatch out" /> wen sie jagt, <span className="fw-swatch in" /> wer sie jagt. Klick hält die Auswahl fest, Doppelklick öffnet die Mindmap.</p>
          <p className="fw-muted">Der Punkt am Namen ist das Heim-Ökosystem. Mit dem Ökosystem-Filter oben blendest du alle anderen aus.</p>
        </>}
      </aside>
    </div>
  </>;
}
