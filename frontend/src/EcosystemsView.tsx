import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api, type Catalog, type CatalogItem, type Ecosystem, type EcosystemIndex, type EcosystemMember } from './api';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './ecosystems.css';

type EcoStyle = CSSProperties & { '--eco': string };

export function EcosystemsPage({ route }: { route: string }) {
  const [data, setData] = useState<{ index: EcosystemIndex; catalog: Catalog } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.ecosystems(), api.catalog()]).then(([index, catalog]) => setData({ index, catalog })).catch(cause => setError((cause as Error).message));
  }, []);
  const selected = route.split('/')[2] || null;
  useEffect(() => { window.scrollTo(0, 0); }, [selected]);
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading label="Loading ecosystems…" />;
  const { index, catalog } = data;
  const shown = selected ? index.ecosystems.filter(item => item.id === selected) : index.ecosystems;
  if (!shown.length) return <PageError message={`Unknown ecosystem "${selected}".`} />;
  return <>
    <ExplorerTopline section="PROFILES / ECOSYSTEMS" count={`${index.ecosystems.length} ECOSYSTEMS · ${catalog.count} PLAYABLES`} />
    <header className="directory-head eco-head">
      <div>
        <div className="eyebrow">DYNASTY REALISM · FOOD CHAINS</div>
        <h1>Ecosystems <span lang="de">Ökosysteme</span></h1>
        <p>Every playable in its home ecosystem, sorted by food chain: apex predators at the top, the smallest prey at the end.</p>
      </div>
      <div className="archive-metric"><strong>{index.ecosystems.length}</strong><span>ecosystems</span></div>
    </header>
    <EcosystemTabs ecosystems={index.ecosystems} selected={selected} total={catalog.count} />
    <p className="eco-sorting"><b>Sorting:</b> predators above plant-eaters, as in a real food chain; inside each level the stronger playable comes first (combat weight, then adult health).</p>
    {shown.map((ecosystem, position) => <EcosystemSection key={ecosystem.id} ecosystem={ecosystem} number={index.ecosystems.indexOf(ecosystem) + 1} index={index} catalog={catalog} divider={position > 0} />)}
  </>;
}

function EcosystemTabs({ ecosystems, selected, total }: { ecosystems: Ecosystem[]; selected: string | null; total: number }) {
  return <nav className="eco-tabs" aria-label="Ecosystems">
    <button type="button" className={!selected ? 'active' : ''} aria-current={!selected ? 'page' : undefined} onClick={() => go('/ecosystems')}><span className="eco-tab-symbol">◎</span><span className="eco-tab-text"><b>All</b><small lang="de">Alle</small></span><i>{total}</i></button>
    {ecosystems.map(ecosystem => <button type="button" key={ecosystem.id} className={selected === ecosystem.id ? 'active' : ''} aria-current={selected === ecosystem.id ? 'page' : undefined} style={{ '--eco': ecosystem.accent } as EcoStyle} title={ecosystem.de} onClick={() => go(`/ecosystems/${ecosystem.id}`)}>
      <span className="eco-tab-symbol">{ecosystem.symbol}</span><span className="eco-tab-text"><b>{ecosystem.label}</b><small lang="de">{ecosystem.de}</small></span><i>{ecosystem.count}</i>
    </button>)}
  </nav>;
}

function EcosystemSection({ ecosystem, number, index, catalog, divider }: { ecosystem: Ecosystem; number: number; index: EcosystemIndex; catalog: Catalog; divider: boolean }) {
  const byId = useMemo(() => new Map(catalog.profiles.map(profile => [profile.id, profile])), [catalog]);
  const levels = index.levels.map(level => ({ ...level, members: ecosystem.foodChain.filter(member => member.level === level.level) })).filter(level => level.members.length);
  const predators = ecosystem.foodChain.filter(member => member.level <= 4).length;
  const homeOf = new Map(index.ecosystems.map(item => [item.id, item]));
  return <section className={`eco-section ${divider ? 'with-divider' : ''}`} id={`eco-${ecosystem.id}`} style={{ '--eco': ecosystem.accent } as EcoStyle} aria-labelledby={`eco-title-${ecosystem.id}`}>
    <header className="eco-banner">
      <span className="eco-symbol" aria-hidden="true">{ecosystem.symbol}</span>
      <div className="eco-banner-copy">
        <span className="eco-kicker">ECOSYSTEM {String(number).padStart(2, '0')}</span>
        <h2 id={`eco-title-${ecosystem.id}`}>{ecosystem.label} <span lang="de">{ecosystem.de}</span></h2>
        <p>{ecosystem.description}</p>
      </div>
      <dl className="eco-stats">
        <div><dt>Playables</dt><dd>{ecosystem.count}</dd></div>
        <div><dt>Predators</dt><dd>{predators}</dd></div>
        <div><dt>Plant-eaters</dt><dd>{ecosystem.count - predators}</dd></div>
      </dl>
    </header>
    <ol className="food-chain">
      {levels.map((level, levelIndex) => <li key={level.level} className={`fc-level level-${level.level}`}>
        <div className="fc-rail">
          <span className="fc-dot">{level.level}</span>
          <div><strong>{level.label}</strong><small lang="de">{level.de}</small>{levelIndex === 0 && <em>Top of the food chain</em>}</div>
        </div>
        <div className="fc-members">{level.members.map(member => <EcoCard key={member.id} member={member} profile={byId.get(member.id)} />)}</div>
      </li>)}
    </ol>
    <div className="fc-end"><span>End of the food chain</span><small lang="de">Ende der Nahrungskette</small></div>
    {ecosystem.visitors.length > 0 && <div className="eco-visitors"><span>ALSO SEEN HERE</span>{ecosystem.visitors.map(visitor => <button type="button" key={visitor.id} onClick={() => go(`/profiles/${visitor.id}`)} title={`Home: ${homeOf.get(visitor.home)?.label}`} style={{ '--eco': homeOf.get(visitor.home)?.accent || '#9bbc7b' } as EcoStyle}><i>{homeOf.get(visitor.home)?.symbol}</i>{visitor.name}</button>)}</div>}
  </section>;
}

function EcoCard({ member, profile }: { member: EcosystemMember; profile: CatalogItem | undefined }) {
  const main = profile?.analog?.analogs[0];
  return <button type="button" className="eco-card" onClick={() => go(`/profiles/${member.id}`)} title={member.reason}>
    <span className="eco-card-image">
      {main?.photo ? <img src={main.photo.image} alt="" style={{ objectPosition: main.photo.focus }} loading="lazy" referrerPolicy="no-referrer" /> : <span className="eco-card-fallback">{member.name.charAt(0)}</span>}
      {profile?.cover && <img className="eco-card-ingame" src={api.imageUrl(member.id, profile.cover.file)} alt="" loading="lazy" />}
      <span className="eco-rank">#{member.rank}</span>
    </span>
    <span className="eco-card-body">
      <strong>{member.name}</strong>
      {main && <span className="eco-card-analog">≈ {main.share}% {main.animal}</span>}
      <span className="eco-card-meta">{[member.tier, member.diet].filter(Boolean).join(' · ')}<b>{member.combatWeight?.toLocaleString('en-US') ?? '—'} CW</b></span>
    </span>
  </button>;
}
