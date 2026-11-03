import { useEffect, useMemo, useState } from 'react';
import { api, type RestNestIndex, type RestNestRow, type RestNestVerdict } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './rest-nests.css';

const VERDICT_IDS: RestNestVerdict[] = ['profile', 'rule', 'brief', 'against', 'check'];
const isVerdict = (value: string | undefined): value is RestNestVerdict => VERDICT_IDS.includes(value as RestNestVerdict);

export function RestNestsPage({ route }: { route: string }) {
  const [data, setData] = useState<RestNestIndex | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'verdict' | 'name'>('verdict');
  useEffect(() => { api.restNests().then(setData).catch(cause => setError((cause as Error).message)); }, []);
  const segment = route.split('/')[2];
  const filter = isVerdict(segment) ? segment : null;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const order = new Map((data?.verdicts || []).map((verdict, index) => [verdict.id, index]));
    const list = (data?.playables || [])
      .filter(row => !filter || row.verdict === filter)
      .filter(row => !needle || [row.name, row.id, row.life, row.where, row.hint, row.variant?.de || ''].join(' ').toLowerCase().includes(needle));
    return sort === 'name' ? list : [...list].sort((a, b) => (order.get(a.verdict) ?? 9) - (order.get(b.verdict) ?? 9) || a.name.localeCompare(b.name));
  }, [data, query, sort, filter]);
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading label="Loading rest nests…" />;
  const label = new Map(data.verdicts.map(verdict => [verdict.id, verdict.label]));
  const explicit = data.verdicts.find(verdict => verdict.id === 'profile')?.count ?? 0;
  return <>
    <ExplorerTopline section="PROFILES / REST NESTS" count={`${data.playables.length} PLAYABLES`} />
    <header className="directory-head rest-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · NEST OHNE NACHWUCHS</div>
        <h1>Rest Nests <span lang="de">Ruhenester</span></h1>
        <p lang="de">Darf ein Playable ein Nest hinstellen, nur um darin zu ruhen, auch solo? Regel 9.8 erlaubt es jedem. Wie gut es zum Tier passt, sagt das Profil, und das Profil geht vor (Regel 1.1). Jede Einstufung ist mit wörtlichen Profilstellen belegt.</p>
      </div>
      <div className="archive-metric"><strong>{explicit}</strong><span>mit Ruhenest im Profil</span></div>
    </header>

    <section className="rest-rules" aria-labelledby="rest-rules-title">
      <h2 id="rest-rules-title" lang="de">Was für alle gilt</h2>
      <ul>
        {data.rules.map(rule => <li key={rule.number}>
          <b className="rule-no">{rule.number}</b>
          <div><span lang="de">{rule.de}</span><small title="Server rules (original)">{rule.text}</small></div>
        </li>)}
      </ul>
    </section>

    <nav className="rest-verdicts" aria-label="Filter by verdict">
      <button type="button" className={!filter ? 'active' : ''} aria-pressed={!filter} onClick={() => go('/restnests')}>
        <span className="rest-card-top"><b lang="de">Alle</b><strong>{data.playables.length}</strong></span>
        <small lang="de">Jeder Playable mit seiner Einstufung.</small>
      </button>
      {data.verdicts.map(verdict => <button type="button" key={verdict.id} className={`v-${verdict.id} ${filter === verdict.id ? 'active' : ''}`} aria-pressed={filter === verdict.id} onClick={() => go(filter === verdict.id ? '/restnests' : `/restnests/${verdict.id}`)}>
        <span className="rest-card-top"><i className={`verdict ${verdict.id}`} lang="de">{verdict.label}</i><strong>{verdict.count}</strong></span>
        <small lang="de">{verdict.description}</small>
      </button>)}
    </nav>

    <section className="filter-bar rest-filters" aria-label="Rest nest filters">
      <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen, z. B. Utah, Höhle, nomadisch…" aria-label="Search playables" /></label>
      <label><span>Sortierung</span><select value={sort} onChange={event => setSort(event.target.value as 'verdict' | 'name')}><option value="verdict">Einstufung</option><option value="name">Name A–Z</option></select></label>
    </section>

    <div className="rest-table-wrap">
      <table className="rest-table">
        <thead><tr>
          <th scope="col">Playable</th>
          <th scope="col">Einstufung</th>
          <th scope="col">Lebensweise</th>
          <th scope="col">Ruhe- und Nistplatz</th>
          <th scope="col">Hinweis aus dem Profil</th>
        </tr></thead>
        <tbody>{rows.map(row => <RestRow key={row.id} row={row} label={label.get(row.verdict) || row.verdict} />)}</tbody>
      </table>
      {!rows.length && <div className="catalog-empty"><strong>Nichts gefunden</strong><p>Versuch einen anderen Namen oder Filter.</p></div>}
    </div>
    <p className="rest-foot" lang="de">„Nur kurz“ heißt nicht verboten: Regel 9.8 erlaubt das Ruhenest auch umherziehenden Arten, als festes Zuhause passt es aber nicht zum Profil. Ohne lebenden Nachwuchs verteidigst du kein Nest als Revier (6.8.1.1), außer das Profil nennt Ruheplätze, die verteidigt werden.</p>
  </>;
}

function RestRow({ row, label }: { row: RestNestRow; label: string }) {
  return <tr className={`v-${row.verdict}`}>
    <th scope="row">
      <a href={`#/profiles/${row.id}`}><b>{row.name}</b></a>
      <small>{[row.variant?.de, row.tier, row.diet].filter(Boolean).join(' · ')}</small>
    </th>
    <td data-label="Einstufung"><span className={`verdict ${row.verdict}`} lang="de">{label}</span></td>
    <td data-label="Lebensweise" lang="de">{row.life}</td>
    <td data-label="Ruhe- und Nistplatz" lang="de">{row.where}</td>
    <td data-label="Hinweis" className="rest-hint">
      <p lang="de">{row.hint}</p>
      <details>
        <summary lang="de">Profilstellen ({row.quotes.length})</summary>
        <ul>{row.quotes.map(quote => <li key={quote.text}><q lang="en">{quote.text}</q><small>{quote.section}</small></li>)}</ul>
      </details>
    </td>
  </tr>;
}
