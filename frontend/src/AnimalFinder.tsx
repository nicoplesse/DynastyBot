import { useEffect, useMemo, useState } from 'react';
import { api, type AnalogIndex, type AnalogSearchResult, type Catalog } from './api';
import './plays-like.css';

function go(path: string) { window.location.hash = `#${path}`; }

function params(route: string) { return new URLSearchParams(route.split('?')[1] || ''); }

type Filters = { archetype: string; mood: string; habitat: string; diet: string };

function withFilters(filters: Filters) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== 'All'));
  return `/animals${query.toString() ? `?${query}` : ''}`;
}

export function AnimalFinder({ route }: { route: string }) {
  const [index, setIndex] = useState<AnalogIndex | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [search, setSearch] = useState<AnalogSearchResult | null>(null);
  const query = params(route);
  const filters: Filters = { archetype: query.get('archetype') || '', mood: query.get('mood') || '', habitat: query.get('habitat') || '', diet: query.get('diet') || 'All' };

  useEffect(() => {
    Promise.all([api.analogs(), api.catalog()]).then(([analogs, profiles]) => { setIndex(analogs); setCatalog(profiles); }).catch(cause => setError((cause as Error).message));
  }, []);
  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) { setSearch(null); return; }
    const timer = window.setTimeout(() => { api.analogSearch(trimmed).then(setSearch).catch(() => setSearch(null)); }, 180);
    return () => window.clearTimeout(timer);
  }, [text]);

  const covers = useMemo(() => new Map((catalog?.profiles || []).map(profile => [profile.id, profile.cover])), [catalog]);
  const setFilter = (key: keyof Filters, value: string) => go(withFilters({ ...filters, [key]: filters[key] === value ? '' : value }));

  const rows = useMemo(() => {
    if (!index) return [];
    return Object.entries(index.dinos).map(([id, dino]) => {
      const inFamily = filters.archetype ? dino.analogs.filter(item => item.archetype === filters.archetype) : dino.analogs.slice(0, 1);
      const match = inFamily.length ? {
        animal: inFamily.map(item => item.animal).join(' + '),
        role: inFamily.some(item => item.role === 'primary') ? 'primary' as const : 'secondary' as const,
        share: inFamily.reduce((sum, item) => sum + (item.share || 0), 0),
      } : null;
      return { id, dino, match };
    }).filter(({ dino, match }) => (!filters.archetype || match) &&
      (!filters.mood || dino.moods.includes(filters.mood)) &&
      (!filters.habitat || dino.habitats.includes(filters.habitat)) &&
      (filters.diet === 'All' || dino.diet === filters.diet))
      .sort((a, b) => (a.match?.role === b.match?.role ? 0 : a.match?.role === 'primary' ? -1 : 1) || (b.match?.share || 0) - (a.match?.share || 0) || a.dino.name.localeCompare(b.dino.name));
  }, [index, filters.archetype, filters.mood, filters.habitat, filters.diet]);

  if (error) return <div className="page-state error"><strong>Could not load the Animal Finder</strong><p>{error}</p></div>;
  if (!index) return <div className="page-state" role="status"><span /><strong>Loading animals…</strong></div>;

  const archetypeCounts = Object.entries(index.archetypes).map(([id, archetype]) => ({ id, ...archetype, primary: archetype.dinos.filter(dino => dino.role === 'primary').length }))
    .filter(archetype => archetype.dinos.length > 0);
  const diets = ['All', ...new Set(Object.values(index.dinos).map(dino => dino.diet).filter((value): value is string => Boolean(value)))];
  const activeArchetype = filters.archetype ? index.archetypes[filters.archetype] : null;

  return <>
    <div className="topline"><span>ARCHIVE / ANIMAL FINDER</span><span>{Object.keys(index.dinos).length} PLAYABLES · {Object.keys(index.animals).length} REAL ANIMALS</span></div>
    <header className="directory-head"><div><div className="eyebrow">DYNASTY REALISM · PLAYS LIKE</div><h1>Animal Finder</h1><p>Every playable is matched to the one or two real animals it plays most like. Pick the animal you're in the mood to play, or just describe it.</p></div><div className="archive-metric"><strong>{archetypeCounts.length}</strong><span>animal families</span></div></header>

    <section className="filter-bar af-search" aria-label="Describe the animal you want to play">
      <label className="search-field"><span aria-hidden="true">⌕</span><input value={text} onChange={event => setText(event.target.value)} placeholder="Try “ox”, “Großkatze im Dschungel”, “Rudel Wolf”, “Krokodil im Sumpf”…" aria-label="Describe the animal you want to play" /></label>
    </section>
    {search && <section className="af-results" aria-live="polite">
      <div className="results-line"><strong>{search.results.length}</strong> matches for “{search.query}”<span>{[...search.matched.archetypes.map(id => index.vocabulary.archetypes[id]?.label), ...search.matched.habitats.map(id => index.vocabulary.habitats[id]?.label), ...search.matched.moods.map(id => index.vocabulary.moods[id]?.label)].filter(Boolean).join(' · ') || 'no animal words recognised'}</span></div>
      {search.results.length ? <div className="af-list">{search.results.map(result => <button type="button" className="af-row" key={result.id} onClick={() => go(`/profiles/${result.id}`)}>
        <Thumb url={covers.get(result.id) ? api.imageUrl(result.id, covers.get(result.id)!.file) : null} name={result.name} />
        <span className="af-row-main"><span className="af-row-title"><b>{result.name}</b><i>{[result.tier, result.diet].filter(Boolean).join(' · ')}</i></span><span className="af-row-label">≈ {result.label}</span><span className="af-row-headline">{result.headline}</span><span className="af-row-reasons">{result.reasons.join(' · ')}</span></span>
      </button>)}</div> : <p className="af-empty">No playable matches those words yet. Try an animal family such as “bear”, “Hirsch”, “Vogel” or a habitat like “Wüste”.</p>}
    </section>}

    <section className="af-families" aria-label="Animal families">
      <div className="af-section-head"><h2>Pick an animal family</h2>{filters.archetype && <button type="button" onClick={() => setFilter('archetype', filters.archetype)}>Clear family ×</button>}</div>
      <div className="af-family-grid">{archetypeCounts.map(archetype => <button type="button" key={archetype.id} className={filters.archetype === archetype.id ? 'active' : ''} aria-pressed={filters.archetype === archetype.id} onClick={() => setFilter('archetype', archetype.id)}>
        <b>{archetype.label}</b><span lang="de">{archetype.de}</span><em>{archetype.primary} mainly · {archetype.dinos.length - archetype.primary} partly</em>
      </button>)}</div>
    </section>

    <section className="af-filters" aria-label="Filters">
      <div><span className="pl-label">HABITAT</span><div className="pl-chips">{Object.entries(index.vocabulary.habitats).map(([id, habitat]) => <button type="button" key={id} className={filters.habitat === id ? 'active' : ''} aria-pressed={filters.habitat === id} onClick={() => setFilter('habitat', id)}>{habitat.label}</button>)}</div></div>
      <div><span className="pl-label">PLAY FEEL</span><div className="pl-chips">{Object.entries(index.vocabulary.moods).filter(([id]) => index.moods[id]?.dinoIds.length).map(([id, mood]) => <button type="button" key={id} className={filters.mood === id ? 'active' : ''} aria-pressed={filters.mood === id} onClick={() => setFilter('mood', id)}>{mood.label}</button>)}</div></div>
      <div><span className="pl-label">DIET</span><div className="pl-chips">{diets.map(diet => <button type="button" key={diet} className={filters.diet === diet ? 'active' : ''} aria-pressed={filters.diet === diet} onClick={() => go(withFilters({ ...filters, diet }))}>{diet}</button>)}</div></div>
    </section>

    <div className="results-line"><strong>{rows.length}</strong> {rows.length === 1 ? 'playable' : 'playables'}{activeArchetype && <> that play like a <b className="af-family-name">{activeArchetype.label.toLowerCase()}</b></>}<span>Main animal first, then partial matches</span></div>
    {rows.length ? <div className="af-list">{rows.map(({ id, dino, match }) => <button type="button" className="af-row" key={id} onClick={() => go(`/profiles/${id}`)}>
      <Thumb url={covers.get(id) ? api.imageUrl(id, covers.get(id)!.file) : null} name={dino.name} />
      <span className="af-row-main">
        <span className="af-row-title"><b>{dino.name}</b><i>{[dino.tier, dino.activity, dino.diet].filter(Boolean).join(' · ')}</i>{match && filters.archetype && <span className={`af-role role-${match.role}`}>{match.role === 'primary' ? 'Mainly' : 'Partly'} {match.animal} · {match.share}%</span>}</span>
        <span className="af-row-label">≈ {dino.label} <small lang="de">({dino.labelDe})</small></span>
        <span className="af-row-headline">{dino.headline}</span>
        <span className="af-row-reasons">{dino.setting}</span>
      </span>
    </button>)}</div> : <p className="af-empty">No playable fits every filter. Remove one to see more.</p>}
  </>;
}

function Thumb({ url, name }: { url: string | null; name: string }) {
  return <span className="af-thumb">{url ? <img src={url} alt="" loading="lazy" /> : <span>{name.charAt(0)}</span>}</span>;
}
