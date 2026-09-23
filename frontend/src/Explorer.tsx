import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { api, type Ecosystem, type Catalog, type CatalogItem, type ContentBlock, type ProcessedProfile, type RulesData } from './api';
import { FullStatsView } from './FullStats';
import { MapView } from './MapView';
import { MatchupsView } from './MatchupsView';
import { PlaysLikeView } from './PlaysLikeView';
import { AnimalFinder } from './AnimalFinder';
import { ProfileShowcase } from './Showcase';
import { EcosystemsPage } from './EcosystemsView';
import { ExplorerTopline, PageError, PageLoading, go } from './ui';
import './explorer.css';

export function Explorer({ route }: { route: string }) {
  const active = route.startsWith('/rules') ? 'rules' : route.startsWith('/animals') ? 'animals' : route.startsWith('/ecosystems') ? 'ecosystems' : 'profiles';
  return <div className="app-shell explorer-shell">
    <ExplorerNav active={active} route={route} />
    <main className="explorer-main">{active === 'rules' ? <RulesPage /> : active === 'animals' ? <AnimalFinder route={route} /> : active === 'ecosystems' ? <EcosystemsPage route={route} /> : <ProfilesPage profileId={route.split('/')[2] || null} />}</main>
  </div>;
}


function JumpLink({ id, children }: { id: string; children: ReactNode }) {
  return <a href={`#${id}`} onClick={event => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }}>{children}</a>;
}

// Profiles opens a sub-menu: the full directory, the ecosystem overview and one entry per ecosystem.
function ExplorerNav({ active, route }: { active: 'profiles' | 'rules' | 'animals' | 'ecosystems'; route: string }) {
  const [open, setOpen] = useState(true);
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  useEffect(() => { api.ecosystems().then(index => setEcosystems(index.ecosystems)).catch(() => setEcosystems([])); }, []);
  const inProfiles = active === 'profiles' || active === 'ecosystems';
  const sub = (path: string) => route === path;
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark" aria-hidden="true">D</div><div><strong>DYNASTY BOT</strong><span>REALISM ARCHIVE</span></div></div>
    <div className="nav-caption">WORKSPACE</div>
    <nav aria-label="Main navigation">
      <button className="nav-item" onClick={() => go('/import')}><span className="nav-symbol">↧</span> Import</button>
      <div className="nav-divider" />
      <div className="nav-group">
        <div className="nav-row">
          <button className={`nav-item ${inProfiles ? 'active' : ''}`} aria-current={inProfiles ? 'page' : undefined} onClick={() => go('/profiles')}><span className="nav-symbol">▤</span> Profiles</button>
          <button type="button" className={`nav-toggle ${open ? 'open' : ''}`} aria-expanded={open} aria-controls="nav-profiles-sub" aria-label={open ? 'Collapse profile views' : 'Expand profile views'} onClick={() => setOpen(value => !value)}>▾</button>
        </div>
        {open && <div className="nav-sub" id="nav-profiles-sub">
          <button type="button" className={sub('/profiles') ? 'active' : ''} onClick={() => go('/profiles')}><i>▦</i>All profiles</button>
          <button type="button" className={sub('/ecosystems') ? 'active' : ''} onClick={() => go('/ecosystems')}><i>◎</i>Ecosystems</button>
          {ecosystems.map(ecosystem => <button type="button" key={ecosystem.id} className={sub(`/ecosystems/${ecosystem.id}`) ? 'active' : ''} style={{ '--eco': ecosystem.accent } as CSSProperties} onClick={() => go(`/ecosystems/${ecosystem.id}`)} title={ecosystem.de}><i>{ecosystem.symbol}</i>{ecosystem.label}</button>)}
        </div>}
      </div>
      <button className={`nav-item ${active === 'rules' ? 'active' : ''}`} aria-current={active === 'rules' ? 'page' : undefined} onClick={() => go('/rules')}><span className="nav-symbol">≡</span> Rules</button>
      <button className={`nav-item ${active === 'animals' ? 'active' : ''}`} aria-current={active === 'animals' ? 'page' : undefined} onClick={() => go('/animals')}><span className="nav-symbol">≈</span> Animal Finder</button>
      <button className="nav-item" disabled><span className="nav-symbol">◇</span> Playable Finder <span className="soon">Soon</span></button>
      <button className="nav-item" disabled><span className="nav-symbol">▢</span> Chat <span className="soon">Soon</span></button>
    </nav>
    <div className="sidebar-foot"><span className="status-dot" /> STRUCTURED ARCHIVE <small>Generated views read from processed data.</small></div>
  </aside>;
}

function ProfilesPage({ profileId }: { profileId: string | null }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.catalog().then(setCatalog).catch(cause => setError((cause as Error).message)); }, []);
  if (error) return <PageError message={error} />;
  if (!catalog) return <PageLoading label="Loading profiles…" />;
  return profileId ? <ProfileDetail id={profileId} catalog={catalog} /> : <ProfileDirectory catalog={catalog} />;
}

function ProfileDirectory({ catalog }: { catalog: Catalog }) {
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState('All');
  const [tier, setTier] = useState('All');
  const [ecosystem, setEcosystem] = useState('All');
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  useEffect(() => { api.ecosystems().then(index => setEcosystems(index.ecosystems)).catch(() => setEcosystems([])); }, []);
  const filtered = useMemo(() => catalog.profiles.filter(profile => {
    const haystack = [profile.name, ...profile.aliases, profile.summary, profile.classification.label, ...(profile.analog ? [profile.analog.label, profile.analog.labelDe, ...profile.analog.analogs.flatMap(item => [item.archetypeLabel, item.archetypeDe || ''])] : [])].join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (diet === 'All' || profile.classification.diet === diet) && (tier === 'All' || profile.classification.tier === tier) && (ecosystem === 'All' || profile.ecosystem?.id === ecosystem);
  }), [catalog, query, diet, tier, ecosystem]);
  const diets = ['All', ...new Set(catalog.profiles.map(item => item.classification.diet).filter((value): value is string => !!value))];
  const tiers = ['All', 'Tiny', 'Small', 'Medium', 'Large', 'Apex', 'Giant'].filter(value => value === 'All' || catalog.profiles.some(item => item.classification.tier === value));
  return <>
    <ExplorerTopline section="PROFILES" count={`${catalog.count} PLAYABLES`} />
    <header className="directory-head"><div><div className="eyebrow">DYNASTY REALISM · PLAYABLE LIBRARY</div><h1>Profiles</h1><p>Browse behavior, server adjustments, maps, references and profile rules.</p></div><div className="directory-actions"><button type="button" className="eco-link" onClick={() => go('/ecosystems')}><span><i aria-hidden="true">◎</i> By ecosystem →</span><b lang="de">Nach Ökosystem</b></button><div className="archive-metric"><strong>{catalog.count}</strong><span>structured profiles</span></div></div></header>
    <section className="filter-bar" aria-label="Profile filters">
      <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search profiles, aliases, traits or real animals…" aria-label="Search profiles" /></label>
      <label><span>Diet</span><select value={diet} onChange={event => setDiet(event.target.value)}>{diets.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>Tier</span><select value={tier} onChange={event => setTier(event.target.value)}>{tiers.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>Ecosystem</span><select value={ecosystem} onChange={event => setEcosystem(event.target.value)}><option value="All">All</option>{ecosystems.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </section>
    <div className="results-line"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'profile' : 'profiles'}<span>Stats reflect the latest imported Dynasty profile</span></div>
    {filtered.length ? <section className="profile-grid" aria-label="Playable profiles">{filtered.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</section> : <div className="catalog-empty"><strong>No matching profiles</strong><p>Try a different name or remove a filter.</p></div>}
  </>;
}

// The card leads with the real animal the profile mostly plays like; the in-game title card is the
// fallback for profiles without a curated analog photo.
function ProfileCard({ profile }: { profile: CatalogItem }) {
  const main = profile.analog?.analogs[0];
  const image = main?.photo
    ? <img src={main.photo.image} alt={main.animal} style={{ objectPosition: main.photo.focus }} loading="lazy" referrerPolicy="no-referrer" />
    : profile.cover ? <img src={api.imageUrl(profile.id, profile.cover.file)} alt="" loading="lazy" /> : <span>{profile.name.charAt(0)}</span>;
  return <button className="profile-card" type="button" onClick={() => go(`/profiles/${profile.id}`)}>
    <div className="card-image">{image}<div className="card-scrim" /><span className="tier-badge">{profile.classification.tier || 'Profile'}</span>{main && <span className="card-share" title={`Plays mostly like a ${main.animal}`}>{main.share != null && <b>{main.share}%</b>}{main.animal}</span>}</div>
    <div className="card-content"><div className="card-title"><h2>{profile.name}</h2><span aria-hidden="true">↗</span></div>{profile.analog && <div className="card-analog" title={profile.analog.headline}>≈ {profile.analog.label}</div>}<p>{profile.classification.label || profile.summary}</p><div className="card-stats"><span><b>{profile.stats.combatWeight?.toLocaleString('en-US') || '—'}</b> Combat Weight</span><span><b>{profile.stats.growthMinutes || '—'}m</b> Growth</span></div></div>
  </button>;
}

function ProfileDetail({ id, catalog }: { id: string; catalog: Catalog }) {
  const [profile, setProfile] = useState<ProcessedProfile | null>(null);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  useEffect(() => { setProfile(null); setError(''); api.processedProfile(id).then(setProfile).catch(cause => setError((cause as Error).message)); window.scrollTo(0, 0); }, [id]);
  if (error) return <PageError message={error} />;
  if (!profile) return <PageLoading label="Loading profile…" />;
  const currentIndex = catalog.profiles.findIndex(item => item.id === id);
  const previous = catalog.profiles[(currentIndex - 1 + catalog.profiles.length) % catalog.profiles.length];
  const next = catalog.profiles[(currentIndex + 1) % catalog.profiles.length];
  return <>
    <ExplorerTopline section="PROFILES / DETAIL" count={`${currentIndex + 1} OF ${catalog.count}`} />
    <button className="back-link" type="button" onClick={() => go('/profiles')}>← All profiles</button>
    <article className="profile-detail">
      <header className="profile-hero with-showcase">
        <ProfileShowcase profile={profile} onOpen={setLightbox} />
        <div className="hero-copy"><div className="profile-kicker">{profile.classification.label || 'Dynasty Realism Profile'}</div><h1>{profile.name}</h1>{profile.analog && <p className="hero-analog"><JumpLink id="plays-like">≈ Plays like <b>{profile.analog.label}</b></JumpLink></p>}{profile.ecosystem && <p className="hero-analog hero-ecosystem"><a href={`#/ecosystems/${profile.ecosystem.id}`} title={profile.ecosystem.reason}>◎ Ecosystem <b>{profile.ecosystem.label}</b> · food chain level {profile.ecosystem.foodChain.level}: {profile.ecosystem.foodChain.label}</a></p>}{profile.aliases.length > 0 && <p className="aliases">Also known as {profile.aliases.join(', ')}</p>}<p className="hero-summary">{profile.summary}</p><div className="hero-pills">{[profile.classification.tier, profile.classification.activity, profile.classification.habitat, profile.classification.diet].filter(Boolean).map(value => <span key={value}>{value}</span>)}</div></div>
      </header>
      <div className="profile-layout">
        <aside className="profile-toc"><strong>ON THIS PROFILE</strong>{profile.analog && <JumpLink id="plays-like">Plays Like</JumpLink>}<JumpLink id="quick-view">Quick View</JumpLink><JumpLink id="stats">Playable Stats</JumpLink>{profile.map && <JumpLink id="map">Territory Map</JumpLink>}{profile.matchups && <JumpLink id="counters">Counters</JumpLink>}{profile.media.length > 1 && <JumpLink id="media">Images</JumpLink>}{profile.videos.length > 0 && <JumpLink id="videos">Videos</JumpLink>}{profile.sections.map(section => <JumpLink key={section.id} id={section.id}>{section.title}</JumpLink>)}</aside>
        <div className="profile-body">
          {profile.analog && <PlaysLikeView analog={profile.analog} name={profile.name} />}
          <section className="quick-view" id="quick-view"><SectionTitle index="01" title="Quick View" /><ul>{profile.quickView.length ? profile.quickView.map((item, index) => <li key={index}><span>✓</span><RichText text={item} /></li>) : <li><span>✓</span><RichText text={profile.summary} /></li>}</ul></section>
          <FullStatsView profile={profile} />
          {profile.map && <MapView profileId={profile.id} name={profile.name} map={profile.map} />}
          {profile.matchups && <MatchupsView matchups={profile.matchups} name={profile.name} />}
          {profile.media.length > 1 && <section className="media-section" id="media"><SectionTitle index="03" title="Profile Images" /><div className="media-grid">{profile.media.slice(1).map((media, index) => <button type="button" key={media.file} onClick={() => setLightbox(api.imageUrl(profile.id, media.file))}><img src={api.imageUrl(profile.id, media.file)} alt={`${profile.name} reference ${index + 1}`} loading="lazy" /><span>{media.label || (media.role === 'map-or-reference' ? 'Map or profile reference' : `Profile reference ${index + 1}`)}</span></button>)}</div></section>}
          {profile.videos.length > 0 && <section className="video-section" id="videos"><SectionTitle index="04" title="Videos" /><div className="video-grid">{profile.videos.map(video => <div className="video-card" key={video.id}><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}`} title={`${profile.name} YouTube video`} loading="lazy" allowFullScreen /><a href={video.url} target="_blank" rel="noreferrer">Open on YouTube ↗</a></div>)}</div></section>}
          <div className="profile-sections">{profile.sections.map((section, index) => <section id={section.id} key={`${section.id}-${index}`}><h2>{section.title}</h2>{section.blocks.map((block, blockIndex) => <Content key={blockIndex} block={block} />)}</section>)}</div>
          {profile.credits.length > 0 && <footer className="profile-credits"><strong>Profile credits</strong>{profile.credits.map((credit, index) => <span key={index}>{credit}</span>)}</footer>}
          <nav className="profile-pagination" aria-label="Adjacent profiles"><button onClick={() => go(`/profiles/${previous.id}`)}>← <span>Previous</span><strong>{previous.name}</strong></button><button onClick={() => go(`/profiles/${next.id}`)}><span>Next</span><strong>{next.name}</strong> →</button></nav>
        </div>
      </div>
    </article>
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setLightbox(null)}><button type="button" aria-label="Close image" onClick={() => setLightbox(null)}>×</button><img src={lightbox} alt="Full size" referrerPolicy="no-referrer" /></div>}
  </>;
}

function RulesPage() {
  const [rules, setRules] = useState<RulesData | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.rules().then(setRules).catch(cause => setError((cause as Error).message)); }, []);
  if (error) return <PageError message={error} />;
  if (!rules) return <PageLoading label="Loading rules…" />;
  const normalized = query.trim().toLowerCase();
  const matches = rules.sections.map(section => ({ ...section, rules: section.rules.filter(rule => !normalized || `${rule.number} ${rule.text} ${section.title}`.toLowerCase().includes(normalized)) })).filter(section => section.rules.length);
  const total = rules.sections.reduce((sum, section) => sum + section.rules.length, 0);
  const visible = matches.reduce((sum, section) => sum + section.rules.length, 0);
  return <>
    <ExplorerTopline section="SERVER RULES" count={`${total} RULES`} />
    <header className="rules-head"><div><div className="eyebrow">DYNASTY REALISM · RULEBOOK</div><h1>Server Rules</h1><p>Search and navigate the complete imported server rule set.</p></div><div className="rules-updated"><span>RAW SOURCE UPDATED</span><strong>{formatDate(rules.source.importedAt)}</strong></div></header>
    <div className="rules-search"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search rules, topics or rule numbers…" aria-label="Search server rules" /></label>{query && <span>{visible} matches</span>}</div>
    <div className="rules-layout"><aside className="rules-toc"><strong>RULE SECTIONS</strong>{rules.sections.map(section => <JumpLink key={section.id} id={section.id}><span>0{section.number}</span>{section.title}<b>{section.rules.length}</b></JumpLink>)}</aside><article className="rules-content">{!query && <section className="rules-intro"><div className="rule-priority">Profiles override server rules where they conflict.</div>{rules.introduction.map((block, index) => <Content key={index} block={block} />)}</section>}{matches.length ? matches.map(section => <section className="rule-section" id={section.id} key={section.id}><div className="rule-section-head"><span>0{section.number}</span><div><div className="eyebrow">SECTION {section.number}</div><h2>{section.title}</h2></div><b>{section.rules.length}</b></div><ol>{section.rules.map(rule => <li key={rule.number}><span>{rule.number}</span><p><RichText text={rule.text} /></p></li>)}</ol></section>) : <div className="catalog-empty"><strong>No matching rules</strong><p>Try another phrase or rule number.</p></div>}<p className="provenance">Structured from <code>{rules.source.profileFile}</code>. The original raw file remains unchanged.</p></article></div>
  </>;
}

function Content({ block }: { block: ContentBlock }) {
  return block.type === 'list' ? <ul className="content-list">{block.items.map((item, index) => <li key={index}><RichText text={item} /></li>)}</ul> : <p><RichText text={block.text} /></p>;
}

function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]+[^\s]*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('http')) parts.push(<a key={match.index} href={token} target="_blank" rel="noreferrer">YouTube ↗</a>);
    else if (token.startsWith('**') || token.startsWith('__')) parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    else parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    last = match.index! + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function SectionTitle({ index, title }: { index: string; title: string }) { return <div className="detail-section-title"><span>{index}</span><h2>{title}</h2></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
