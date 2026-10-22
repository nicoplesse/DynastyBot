import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  dietLabels, formatMinutes, formatNumber, formatWeight, isleApi, nestLabels, phaseLabels, threatLabels, traitLabels,
  type IsleBasics, type IsleBehavior, type IsleDiet, type IsleIndex, type IsleLink, type IslePlayable, type IsleSource, type IsleSummary, type IsleTraitId,
} from './isle';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './isle.css';

const DIETS: IsleDiet[] = ['carnivore', 'herbivore', 'omnivore'];
const TRAITS: IsleTraitId[] = ['activity', 'range', 'social', 'rest'];
const dietPlural: Record<IsleDiet, string> = { carnivore: 'Fleischfresser', herbivore: 'Pflanzenfresser', omnivore: 'Allesfresser' };
const patchOf = (since: string | null) => since?.match(/\d+\.\d+\.\d+/)?.[0] || null;
function formatDay(value: string) { return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)); }

// The Isle is a different game: its own tab with short profiles, kept apart from the Dynasty archive.
export function IslePage({ route }: { route: string }) {
  const id = route.split('/')[2] || null;
  return id ? <IsleDetail id={id} /> : <IsleDirectory />;
}

function useIsleIndex() {
  const [index, setIndex] = useState<IsleIndex | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { isleApi.index().then(setIndex).catch(cause => setError((cause as Error).message)); }, []);
  return { index, error };
}

function IsleDirectory() {
  const { index, error } = useIsleIndex();
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState<IsleDiet | 'all'>('all');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (index?.playables || []).filter(item => !needle || [item.name, item.nickname, item.role, item.tagline, item.essence, ...Object.values(item.traits)].join(' ').toLowerCase().includes(needle));
  }, [index, query]);
  if (error) return <PageError message={error} />;
  if (!index) return <PageLoading label="Lade The-Isle-Profile…" />;
  const { basics } = index;
  const groups = DIETS.filter(value => diet === 'all' || diet === value).map(value => ({ diet: value, items: filtered.filter(item => item.diet === value) })).filter(group => group.items.length);
  return <div className="isle" lang="de">
    <ExplorerTopline section="THE ISLE · EXKURS" count={`${index.count} PLAYABLES`} />
    <header className="isle-head">
      <div>
        <div className="isle-eyebrow">EXKURS · EIN ANDERES SPIEL</div>
        <h1>The Isle</h1>
        <p className="isle-sub">{basics.branch} · Patch {basics.patch} vom {formatDay(basics.patchDate)} · geprüft am {formatDay(basics.reviewedAt)}</p>
        <p className="isle-intro">{basics.intro}</p>
      </div>
      <div className="isle-metrics">
        <div><strong>{index.count}</strong><span>spielbare Tiere</span></div>
        <a href="#grundwissen" onClick={event => { event.preventDefault(); document.getElementById('grundwissen')?.scrollIntoView({ behavior: 'smooth' }); }}><strong>◈</strong><span>Grundwissen für alle Arten ↓</span></a>
      </div>
    </header>
    <section className="isle-filter" aria-label="Filter">
      <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, Rolle oder Verhalten suchen, z. B. nachtaktiv…" aria-label="The-Isle-Profile durchsuchen" /></label>
      <div className="isle-diets" role="group" aria-label="Ernährung">
        {(['all', ...DIETS] as const).map(value => <button type="button" key={value} className={`${diet === value ? 'active' : ''} ${value === 'all' ? '' : `diet-${value}`}`} aria-pressed={diet === value} onClick={() => setDiet(value)}>
          {value !== 'all' && <i className="isle-dot" aria-hidden="true" />}{value === 'all' ? 'Alle' : dietPlural[value]}
          <b>{value === 'all' ? filtered.length : filtered.filter(item => item.diet === value).length}</b>
        </button>)}
      </div>
    </section>
    {groups.length ? groups.map(group => <section className="isle-group" key={group.diet} aria-label={dietPlural[group.diet]}>
      <h2 className={`diet-${group.diet}`}><i className="isle-dot" aria-hidden="true" />{dietPlural[group.diet]}<b>{group.items.length}</b></h2>
      <div className="isle-grid">{group.items.map(item => <IsleCard key={item.id} item={item} />)}</div>
    </section>) : <div className="catalog-empty"><strong>Kein passendes Tier</strong><p>Versuch einen anderen Namen oder entferne den Filter.</p></div>}
    <IsleBasicsView basics={basics} />
  </div>;
}

function Monogram({ name, className }: { name: string; className: string }) {
  return <span className={className} aria-hidden="true">{name.slice(0, 2)}</span>;
}

function IsleCard({ item }: { item: IsleSummary }) {
  const patch = patchOf(item.since);
  return <button type="button" className={`isle-card diet-${item.diet}`} onClick={() => go(`/isle/${item.id}`)}>
    <div className="isle-card-top">
      <Monogram name={item.name} className="isle-mono" />
      <div><h3>{item.name}{item.nickname && <small>„{item.nickname}“</small>}</h3><span className="isle-role">{item.role}</span></div>
      {patch && <span className="isle-since" title={item.since || undefined}>seit {patch}</span>}
    </div>
    <p>{item.essence}</p>
    <div className="isle-card-traits">{(['activity', 'range', 'social'] as const).map(trait => <span key={trait}>{item.traits[trait]}</span>)}</div>
    <div className="isle-card-facts">
      <span><b>{formatMinutes(item.growthTotalMinutes)}</b>Wachstum</span>
      <span><b>{item.stats.groupLimit}</b>Gruppe max.</span>
      <span><b>{formatWeight(item.stats.adultWeightKg)}</b>Adult</span>
    </div>
  </button>;
}

function IsleBasicsView({ basics }: { basics: IsleBasics }) {
  return <section className="isle-basics" id="grundwissen">
    <div className="isle-section-head"><span aria-hidden="true">◈</span><div><div className="isle-eyebrow">GILT FÜR ALLE ARTEN</div><h2>Isle-Grundwissen</h2></div></div>
    <h3 className="isle-basics-title">Die vier Lebensphasen</h3>
    <ol className="isle-stages">{basics.stages.map((stage, index) => <li key={stage.id}>
      <span className="isle-stage-no">{index + 1}</span><h4>{stage.label}</h4><b>{stage.range}</b><p>{stage.text}</p>
    </li>)}</ol>
    <h3 className="isle-basics-title">Die drei Nährstoffe</h3>
    <div className="isle-nutrients">{basics.nutrients.map(nutrient => <div key={nutrient.id} className={`nut-${nutrient.id}`}>
      <strong>{nutrient.symbol}</strong><div><b>{nutrient.label}</b> <small>{nutrient.en}</small><p>{nutrient.bonus}</p></div>
    </div>)}</div>
    <div className="isle-topics">{basics.topics.map((topic, index) => <details key={topic.id} open={index === 0}>
      <summary>{topic.title}</summary><p>{topic.text}</p>
    </details>)}</div>
    <div className="isle-keys">
      <h3 className="isle-basics-title">Wichtige Tasten</h3>
      <dl>{basics.keys.map(entry => <Fragment key={entry.keys}><dt><kbd>{entry.keys}</kbd></dt><dd>{entry.text}</dd></Fragment>)}</dl>
    </div>
    <p className="isle-upcoming"><b>Noch nicht im Spiel:</b> {basics.upcoming}</p>
    <IsleSources sources={basics.sources} note="Werte sind Community-Daten für offizielle Servereinstellungen. Server mit eigenen Multiplikatoren weichen ab." />
  </section>;
}

function IsleSources({ sources, note }: { sources: IsleSource[]; note?: string }) {
  return <footer className="isle-sources"><strong>Quellen</strong>{note && <p>{note}</p>}<ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul></footer>;
}

function Jump({ id, children }: { id: string; children: ReactNode }) {
  return <a href={`#${id}`} onClick={event => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{children}</a>;
}

function SectionHead({ index, title }: { index: string; title: string }) {
  return <div className="detail-section-title"><span>{index}</span><h2>{title}</h2></div>;
}

function IsleDetail({ id }: { id: string }) {
  const { index, error: indexError } = useIsleIndex();
  const [playable, setPlayable] = useState<IslePlayable | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setPlayable(null); setError(''); isleApi.playable(id).then(setPlayable).catch(cause => setError((cause as Error).message)); window.scrollTo(0, 0); }, [id]);
  if (error || indexError) return <PageError message={error || indexError} />;
  if (!playable || !index) return <PageLoading label="Lade Profil…" />;
  const { basics } = index;
  const ids = new Map(index.playables.map(item => [item.name, item.id]));
  const { stats } = playable;
  return <div className="isle" lang="de">
    <ExplorerTopline section="THE ISLE / PROFIL" count={`${playable.position} VON ${playable.count}`} />
    <button className="back-link" type="button" onClick={() => go('/isle')}>← Alle The-Isle-Profile</button>
    <article className={`isle-detail diet-${playable.diet}`}>
      <header className="isle-hero">
        <Monogram name={playable.name} className="isle-hero-mono" />
        <div className="isle-hero-copy">
          <div className="isle-kicker">{dietLabels[playable.diet]} · {playable.role}</div>
          <h1>{playable.name}</h1>
          {playable.nickname && <p className="isle-nick">„{playable.nickname}“</p>}
          <p className="isle-tagline">{playable.tagline}</p>
          <p className="isle-summary">{playable.summary}</p>
          <div className="hero-pills">
            <span className="isle-pill-trait">{playable.behavior.traits.activity}</span>
            <span className="isle-pill-trait">{playable.behavior.traits.range}</span>
            <span>{dietLabels[playable.diet]}</span>
            <span>Gruppe max. {stats.groupLimit}</span>
            <span>{nestLabels[stats.nest]} · bis {stats.eggs} Eier</span>
            <span>Wachstum {formatMinutes(playable.growthTotalMinutes)}</span>
            {playable.since && <span>Seit {playable.since}</span>}
          </div>
        </div>
      </header>
      <dl className="isle-statstrip">
        <div><dt>Adult</dt><dd>{formatWeight(stats.adultWeightKg)}</dd></div>
        {stats.primeWeightKg && <div><dt>Prime Elder</dt><dd>{formatWeight(stats.primeWeightKg)}</dd></div>}
        <div><dt>Sprint</dt><dd>{formatNumber(stats.sprintKmh)} km/h</dd></div>
        <div><dt>Biss</dt><dd>{formatNumber(stats.bite)}</dd></div>
        <div><dt>Magen leer in</dt><dd>{formatMinutes(stats.hungerMinutes)}</dd></div>
        <div><dt>Durst nach</dt><dd>{formatMinutes(stats.thirstMinutes)}</dd></div>
      </dl>
      {playable.notes?.map(note => <p className="isle-note" key={note}><b>Hinweis:</b> {note}</p>)}
      <div className="isle-layout">
        <aside className="isle-toc"><strong>AUF DIESER SEITE</strong>
          <Jump id="isle-behavior">Verhalten</Jump><Jump id="isle-tips">Merke dir</Jump><Jump id="isle-hunt">{playable.hunt.title}</Jump>
          <Jump id="isle-growth">Aufwachsen</Jump><Jump id="isle-abilities">Fähigkeiten</Jump><Jump id="isle-food">Nahrung</Jump><Jump id="isle-sources">Quellen</Jump>
        </aside>
        <div className="isle-body">
          <section className="isle-section isle-behavior" id="isle-behavior">
            <SectionHead index="01" title="Verhalten in der Wildnis" />
            <Behavior behavior={playable.behavior} playables={index.playables} />
          </section>
          <section className="isle-tips" id="isle-tips"><h2>Merke dir</h2><ul>{playable.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></section>
          <section className="isle-section" id="isle-hunt">
            <SectionHead index="02" title={playable.hunt.title} />
            <p className="isle-prose">{playable.hunt.text}</p>
            <Relations playable={playable} basics={basics} />
          </section>
          <section className="isle-section" id="isle-growth">
            <SectionHead index="03" title="Aufwachsen" />
            <GrowthGuide playable={playable} basics={basics} />
          </section>
          <section className="isle-section" id="isle-abilities">
            <SectionHead index="04" title="Fähigkeiten" />
            <ul className="isle-abilities">{playable.abilities.map(ability => <li key={`${ability.keys}-${ability.name}`}>
              <Keycaps keys={ability.keys} />
              <div><h3>{ability.name}</h3><p>{ability.text}</p></div>
            </li>)}</ul>
            <p className="isle-legend">LMB / RMB = linke / rechte Maustaste. Belegung wie in den Standard-Einstellungen.</p>
          </section>
          <section className="isle-section" id="isle-food">
            <SectionHead index="05" title="Nahrung" />
            <div className="isle-food">{basics.nutrients.map(nutrient => <div key={nutrient.id} className={`nut-${nutrient.id}`}>
              <h3><strong>{nutrient.symbol}</strong> {nutrient.label}</h3>
              <p>{nutrient.bonus}</p>
              <ul>{playable.nutrients[nutrient.id].map(food => { const target = ids.get(food); return <li key={food}>{target ? <a href={`#/isle/${target}`}>{food}</a> : food}</li>; })}</ul>
            </div>)}</div>
            <p className="isle-legend">{playable.diet === 'carnivore' ? 'Tiernamen auf Deutsch, Playables sind verlinkt.' : 'Pflanzennamen wie im Spiel (englisch), Tiere auf Deutsch.'} Magen leer nach {formatMinutes(stats.hungerMinutes)}, Wasser leer nach {formatMinutes(stats.thirstMinutes)}.</p>
          </section>
          <section className="isle-section" id="isle-sources">
            <IsleSources sources={playable.sources} note={`Community-Daten zu Patch ${basics.patch}. Neue Patches können Werte ändern.`} />
          </section>
          <nav className="profile-pagination" aria-label="Benachbarte Profile">
            <button type="button" onClick={() => go(`/isle/${playable.previous.id}`)}>← <span>Zurück</span><strong>{playable.previous.name}</strong></button>
            <button type="button" onClick={() => go(`/isle/${playable.next.id}`)}><span>Weiter</span><strong>{playable.next.name}</strong> →</button>
          </nav>
        </div>
      </div>
    </article>
  </div>;
}

// The realism core of a profile: what the animal needs, what kills it, and the behaviour that
// follows from both, read as "because … so …" steps rather than as a list of stats.
function Behavior({ behavior, playables }: { behavior: IsleBehavior; playables: IsleSummary[] }) {
  const byId = new Map(playables.map(item => [item.id, item]));
  return <>
    <p className="isle-essence">{behavior.essence}</p>
    <dl className="isle-traits">{TRAITS.map(trait => <div key={trait}><dt>{traitLabels[trait]}</dt><dd>{behavior.traits[trait]}</dd></div>)}</dl>
    <div className="isle-pressures">
      <article className="isle-needs"><h3>Was du zum Leben brauchst</h3><p>{behavior.needs}</p></article>
      <article className="isle-threats"><h3>Was dir gefährlich wird</h3>
        <ul>{behavior.threats.map(threat => {
          const target = threat.id ? byId.get(threat.id) : undefined;
          return <li key={threat.name} className={`threat-${threat.level}`}>
            <div className="isle-threat-head">
              {target ? <a className={`diet-${target.diet}`} href={`#/isle/${target.id}`}><i className="isle-dot" aria-hidden="true" />{threat.name}</a> : <strong>{threat.name}</strong>}
              <span>{threatLabels[threat.level]}</span>
            </div>
            <p className="isle-threat-where">{threat.where}</p>
            <p>{threat.answer}</p>
          </li>;
        })}</ul>
      </article>
    </div>
    <h3 className="isle-subhead">Was daraus folgt</h3>
    <ol className="isle-logic">{behavior.logic.map(step => <li key={step.because}>
      <p><b>Weil</b>{step.because}</p>
      <span aria-hidden="true">→</span>
      <p><b>Darum</b>{step.so}</p>
    </li>)}</ol>
    <h3 className="isle-subhead">Dein Platz</h3>
    <p className="isle-prose">{behavior.home}</p>
    <h3 className="isle-subhead">Ein Tag in deinem Leben</h3>
    <ol className="isle-day">{behavior.day.map(step => <li key={step.phase} className={`phase-${step.phase}`}>
      <h4><i aria-hidden="true" />{phaseLabels[step.phase]}</h4><p>{step.text}</p>
    </li>)}</ol>
    <p className="isle-legend">Auf offiziellen Servern dauert ein Spieltag 60 Minuten: 30 Minuten Tag (6 bis 18 Uhr) und 30 Minuten Nacht. Wo du schläfst, loggst du auch aus.</p>
    <div className="isle-life">
      <article><h3>Gruppe & Nachwuchs</h3><p>{behavior.group}</p></article>
      <article className="isle-analog"><h3>Vorbild in der Natur: {behavior.analog.animals}</h3><p>{behavior.analog.text}</p></article>
    </div>
  </>;
}

// "Strg / Z + Strg" reads as two alternatives, the second a combination.
function Keycaps({ keys }: { keys: string }) {
  return <div className="isle-keycaps">{keys.split(' / ').map((alternative, altIndex) => <Fragment key={altIndex}>
    {altIndex > 0 && <i>oder</i>}
    {alternative.split(' + ').map((key, keyIndex) => <Fragment key={keyIndex}>{keyIndex > 0 && <i>+</i>}<kbd>{key}</kbd></Fragment>)}
  </Fragment>)}</div>;
}

function LinkChips({ links, basics }: { links: IsleLink[]; basics: IsleBasics }) {
  const symbols = new Map(basics.nutrients.map(nutrient => [nutrient.id, nutrient]));
  return <div className="isle-chips">{links.map(link => <a key={`${link.id}-${link.nutrient}`} className={`diet-${link.diet}`} href={`#/isle/${link.id}`} title={`${symbols.get(link.nutrient)?.label} (${symbols.get(link.nutrient)?.symbol})`}>
    <i className="isle-dot" aria-hidden="true" />{link.name}<b>{symbols.get(link.nutrient)?.symbol}</b>
  </a>)}</div>;
}

// Who hunts whom is read from the nutrient lists, so it stays in step with the diets.
function Relations({ playable, basics }: { playable: IslePlayable; basics: IsleBasics }) {
  if (!playable.eats.length && !playable.eatenBy.length) return null;
  return <div className="isle-relations">
    {playable.eats.length > 0 && <div><h3>Jagt diese Playables</h3><LinkChips links={playable.eats} basics={basics} /></div>}
    {playable.eatenBy.length > 0 && <div><h3>Steht auf dem Speiseplan von</h3><LinkChips links={playable.eatenBy} basics={basics} /></div>}
  </div>;
}

function GrowthGuide({ playable, basics }: { playable: IslePlayable; basics: IsleBasics }) {
  const minutes = playable.stats.growthMinutes;
  const known = playable.growthTotalMinutes;
  const stages = new Map(basics.stages.map(stage => [stage.id, stage]));
  return <>
    <div className="isle-growthbar" role="img" aria-label={known ? `Gesamtwachstum ${formatMinutes(known)}` : 'Wachstumszeiten noch unbekannt'}>
      {playable.growth.map(step => {
        const value = minutes[step.stage];
        return <span key={step.stage} className={`stage-${step.stage}`} style={{ flexGrow: known && value ? value : 1 }} title={`${stages.get(step.stage)?.label}: ${formatMinutes(value)}`}>
          {stages.get(step.stage)?.label} · {formatMinutes(value)}
        </span>;
      })}
    </div>
    <p className="isle-legend">{known ? <>Gesamt bis 100 %: <b>{formatMinutes(known)}</b> bei offiziellen Einstellungen.</> : 'Die Wachstumszeiten dieser Art sind noch nicht verlässlich erfasst.'} Prime Elder: fünf Bedingungen vor 75 %, siehe <a href="#/isle" onClick={event => { event.preventDefault(); go('/isle'); setTimeout(() => document.getElementById('grundwissen')?.scrollIntoView({ behavior: 'smooth' }), 120); }}>Grundwissen</a>.</p>
    <ol className="isle-timeline">{playable.growth.map(step => {
      const stage = stages.get(step.stage);
      return <li key={step.stage} className={`stage-${step.stage}`}>
        <div className="isle-timeline-head"><h3>{stage?.label}</h3><span>{stage?.range}</span><b>{formatMinutes(minutes[step.stage])}</b></div>
        <p>{step.text}</p>
      </li>;
    })}</ol>
  </>;
}
