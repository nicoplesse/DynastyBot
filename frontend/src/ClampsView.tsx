import { useEffect, useMemo, useState } from 'react';
import { api, type ClampIndex, type ClampPrey, type Clamper } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './clamps.css';

const SHORT = ['Hatch', 'Juv', 'Ado', 'Sub', 'Adult'];
const STAGE_KEY = 'dynasty.clamps.stage';

// One table column: a clamper, or a clamper with a carry-capacity buff such as Tylosaurus' Wide Gape.
type Column = { key: string; clamper: Clamper; buff: Clamper['buffs'][number] | null };
type Reach = { max: number; gaps: number[] };

function readStage() {
  try { const value = Number(window.localStorage.getItem(STAGE_KEY)); return value >= 0 && value <= 4 && window.localStorage.getItem(STAGE_KEY) !== null ? value : 4; } catch { return 4; }
}

function saveStage(value: number) {
  try { window.localStorage.setItem(STAGE_KEY, String(value)); } catch { /* per-viewer convenience only */ }
}

function capacityOf(column: Column, stage: number) {
  const base = column.clamper.capacity[stage] ?? 0;
  return base > 0 && column.buff ? base + column.buff.bonus : base;
}

// Same rule as server/src/clamps.js: a target fits while its combat weight is below the capacity.
function reachOf(capacity: number, weights: number[]): Reach {
  const fits = weights.map(weight => capacity > 0 && weight < capacity);
  const max = fits.lastIndexOf(true);
  return { max, gaps: max < 0 ? [] : fits.slice(0, max).flatMap((fit, index) => fit ? [] : [index]) };
}

const cw = (value: number) => value.toLocaleString('en-US');
// Heaviest clampable combat weight, the way Dynasty profiles write it ("Clamp Weight: Up to 3100").
const upTo = (capacity: number) => capacity > 0 ? `bis ${cw(capacity - 1)}` : '—';

export function ClampsPage({ route }: { route: string }) {
  const [data, setData] = useState<ClampIndex | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'name' | 'weight'>('name');
  const [stage, setStage] = useState(readStage);
  useEffect(() => { api.clamps().then(setData).catch(cause => setError((cause as Error).message)); }, []);
  const selected = route.split('/')[2] || null;
  const columns = useMemo<Column[]>(() => (data?.clampers || []).flatMap(clamper => [
    { key: clamper.id, clamper, buff: null },
    ...clamper.buffs.map(buff => ({ key: `${clamper.id}+${buff.key}`, clamper, buff })),
  ]), [data]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (data?.prey || []).filter(prey => !needle || [prey.name, prey.id, prey.tier, ...prey.aliases].join(' ').toLowerCase().includes(needle));
    return sort === 'name' ? list : [...list].sort((a, b) => b.combatWeight[4] - a.combatWeight[4] || a.name.localeCompare(b.name));
  }, [data, query, sort]);
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading label="Loading clamp table…" />;
  const focus = data.clampers.find(item => item.id === selected) || null;
  const pickStage = (value: number) => { setStage(value); saveStage(value); };
  return <>
    <ExplorerTopline section="PROFILES / CLAMPS" count={`${data.clampers.length} CLAMPERS · ${data.prey.length} PLAYABLES`} />
    <header className="directory-head clamp-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · CLAMP &amp; GRAB</div>
        <h1>Clamp Table <span lang="de">Clamp-Tabelle</span></h1>
        <p lang="de">Wer wen packen kann, und bis zu welcher Entwicklungsstufe. Jeder Clamper hat eine Grenze im Kampfgewicht (CW); alles bis dahin kann er packen. Dynasty-Anpassungen aus den Profilen sind eingerechnet.</p>
      </div>
      <div className="archive-metric"><strong>{data.clampers.length}</strong><span>clamping playables</span></div>
    </header>

    <nav className="clamper-cards" aria-label="Clampers">
      {data.clampers.map(clamper => <button type="button" key={clamper.id} className={focus?.id === clamper.id ? 'active' : ''} aria-current={focus?.id === clamper.id ? 'true' : undefined} onClick={() => go(focus?.id === clamper.id ? '/clamps' : `/clamps/${clamper.id}`)}>
        <span className="clamper-name"><b>{clamper.name}</b><i className={`ability ${clamper.ability}`}>{clamper.ability === 'grab' ? 'Grab' : 'Clamp'}</i></span>
        <span className="clamper-cap"><strong>{upTo(clamper.capacity[stage])}</strong><small>CW als {data.stages[stage]}</small></span>
        {(clamper.adjustments.length > 0 || clamper.buffs.length > 0) && <span className="clamper-flag">{clamper.adjustments.length > 0 ? 'Dynasty-angepasst' : ''}{clamper.buffs.map(buff => ` +${buff.bonus} ${buff.label}`)}</span>}
      </button>)}
    </nav>

    {focus && <ClamperDetail clamper={focus} data={data} stage={stage} />}

    <section className="filter-bar clamp-filters" aria-label="Clamp table filters">
      <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Beute suchen, z. B. Rex, Utah, Deinonychus…" aria-label="Search prey" /></label>
      <div className="stage-picker" role="radiogroup" aria-label="Growth stage of the clamper">
        <span>Clamper ist</span>
        <div>{data.stages.map((name, index) => <button type="button" role="radio" aria-checked={stage === index} key={name} className={stage === index ? 'active' : ''} onClick={() => pickStage(index)}>{name}</button>)}</div>
      </div>
      <label><span>Sortierung</span><select value={sort} onChange={event => setSort(event.target.value as 'name' | 'weight')}><option value="name">Name A–Z</option><option value="weight">Kampfgewicht (adult)</option></select></label>
    </section>

    <div className="clamp-legend" aria-label="Legend">
      <span>Feld = höchste Stufe der Beute, die noch passt:</span>
      {[4, 3, 2, 1, 0].map(index => <i key={index} className={`reach s${index}`}>{index === 4 ? 'Adult (alle)' : `bis ${data.stages[index]}`}</i>)}
      <i className="reach none">—  gar nicht</i>
      <i className="reach gap" title="Eine kleinere Stufe ist schwerer und passt nicht, z. B. Camptosaurus als Sub-Adult">* = eine Stufe darunter passt nicht</i>
    </div>

    <div className="clamp-table-wrap">
      <table className="clamp-table">
        <thead><tr>
          <th scope="col" className="prey-col">Beute <small>Kampfgewicht H / J / Ado / Sub / A</small></th>
          {columns.map(column => <th scope="col" key={column.key} className={focus?.id === column.clamper.id ? 'focus' : ''}>
            <button type="button" onClick={() => go(`/clamps/${column.clamper.id}`)} title={`${column.clamper.name}${column.buff ? ` mit ${column.buff.label}` : ''} als ${data.stages[stage]}: clampt ${upTo(capacityOf(column, stage))} CW`}>
              <b>{column.clamper.name}</b>{column.buff && <em>+ {column.buff.label}</em>}<small>{upTo(capacityOf(column, stage))}</small>
            </button>
          </th>)}
        </tr></thead>
        <tbody>
          {rows.map(prey => <tr key={prey.id}>
            <th scope="row" className="prey-col"><a href={`#/profiles/${prey.id}`}><b>{prey.name}</b><small>{[prey.tier, prey.diet].filter(Boolean).join(' · ')}</small></a><span className="cw-curve">{prey.combatWeight.map(cw).join(' / ')}</span></th>
            {columns.map(column => <ReachCell key={column.key} prey={prey} column={column} stage={stage} stages={data.stages} focus={focus?.id === column.clamper.id} />)}
          </tr>)}
        </tbody>
      </table>
      {!rows.length && <div className="catalog-empty"><strong>Keine Beute gefunden</strong><p>Versuch einen anderen Namen.</p></div>}
    </div>
    <p className="clamp-foot" lang="de">Regel: „bis 3,100“ heißt, Beute mit höchstens 3,100 Kampfgewicht passt (im Spiel: Kampfgewicht unter der Tragkraft 3,101, so schreiben es auch die Dynasty-Profile als „Clamp Weight: Up to 3100“). Ob du das Tier auch jagen darfst, regelt das Profil. Grab (Citipati, Hatzegopteryx) folgt derselben Tragkraft.</p>
  </>;
}

function ReachCell({ prey, column, stage, stages, focus }: { prey: ClampPrey; column: Column; stage: number; stages: string[]; focus: boolean }) {
  const capacity = capacityOf(column, stage);
  const reach = reachOf(capacity, prey.combatWeight);
  const who = `${column.clamper.name}${column.buff ? ` mit ${column.buff.label}` : ''} (${stages[stage]}, ${upTo(capacity)} CW)`;
  const title = reach.max < 0
    ? `${who} kann ${prey.name} in keiner Stufe clampen.`
    : `${who} clampt ${prey.name} bis ${stages[reach.max]} (${cw(prey.combatWeight[reach.max])} CW)${reach.gaps.length ? `, außer ${reach.gaps.map(index => stages[index]).join(', ')}` : ''}.`;
  return <td className={focus ? 'focus' : ''} title={title}>
    <span className={`reach ${reach.max < 0 ? 'none' : `s${reach.max}`}`}>{reach.max < 0 ? '—' : SHORT[reach.max]}{reach.gaps.length > 0 && '*'}</span>
  </td>;
}

function ClamperDetail({ clamper, data, stage }: { clamper: Clamper; data: ClampIndex; stage: number }) {
  const buff = clamper.buffs[0] || null;
  const [buffed, setBuffed] = useState(false);
  useEffect(() => { setBuffed(false); }, [clamper.id]);
  const column: Column = { key: clamper.id, clamper, buff: buffed ? buff : null };
  const capacity = capacityOf(column, stage);
  const groups = [4, 3, 2, 1, 0, -1].map(max => ({
    max,
    members: data.prey.map(prey => ({ prey, reach: reachOf(capacity, prey.combatWeight) }))
      .filter(item => item.reach.max === max)
      .sort((a, b) => max < 0 ? a.prey.name.localeCompare(b.prey.name) : b.prey.combatWeight[max] - a.prey.combatWeight[max] || a.prey.name.localeCompare(b.prey.name)),
  })).filter(group => group.members.length);
  return <section className="clamper-detail" aria-labelledby="clamper-detail-title">
    <header>
      <div>
        <div className="eyebrow">{clamper.ability === 'grab' ? 'GRAB' : 'CLAMP'} · {clamper.tier} · {clamper.habitat}</div>
        <h2 id="clamper-detail-title"><a href={`#/profiles/${clamper.id}`}>{clamper.name}</a> <span lang="de">als {data.stages[stage]}: clampt alles {upTo(capacity)} CW</span></h2>
      </div>
      <button type="button" className="clamp-close" onClick={() => go('/clamps')} aria-label="Close detail">×</button>
    </header>
    <div className="clamper-detail-grid">
      <div>
        <table className="capacity-table">
          <caption lang="de">Clamp-Grenze je Stufe des Clampers (max. CW)</caption>
          <tbody><tr>{data.stages.map((name, index) => <td key={name} className={index === stage ? 'current' : ''}><small>{name}</small><b>{clamper.capacity[index] > 0 ? cw(clamper.capacity[index] - 1 + (buffed && buff ? buff.bonus : 0)) : '—'}</b></td>)}</tr></tbody>
        </table>
        {buff && <label className="buff-toggle"><input type="checkbox" checked={buffed} onChange={event => setBuffed(event.target.checked)} /> <span lang="de">{buff.label} aktiv (+{buff.bonus})</span></label>}
        {clamper.adjustments.length > 0 && <div className="clamp-adjust"><strong>Dynasty-Anpassung</strong>{clamper.adjustments.map(text => <span key={text}>{text}</span>)}</div>}
        {clamper.notes.length > 0 && <ul className="clamp-notes" lang="de">{clamper.notes.map(note => <li key={note}>{note}</li>)}</ul>}
      </div>
      <div className="reach-groups">
        {groups.map(group => <div key={group.max} className="reach-group">
          <h3><span className={`reach ${group.max < 0 ? 'none' : `s${group.max}`}`}>{group.max < 0 ? '—' : SHORT[group.max]}</span>{group.max === 4 ? 'Bis Adult (alle Stufen)' : group.max < 0 ? 'Gar nicht' : `Bis ${data.stages[group.max]}`}<i>{group.members.length}</i></h3>
          <div className="reach-chips">{group.members.map(({ prey, reach }) => <a key={prey.id} href={`#/profiles/${prey.id}`} title={prey.combatWeight.map((value, index) => `${data.stages[index]} ${cw(value)}`).join(' · ')}>
            {prey.name}{group.max >= 0 && <small>{cw(prey.combatWeight[group.max])}</small>}{reach.gaps.length > 0 && <em lang="de">außer {reach.gaps.map(index => data.stages[index]).join(', ')}</em>}
          </a>)}</div>
        </div>)}
      </div>
    </div>
  </section>;
}
