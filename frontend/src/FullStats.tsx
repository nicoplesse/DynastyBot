import { useMemo, useState } from 'react';
import type { ProcessedProfile, SpeedMode, StatCurve } from './api';
import './full-stats.css';

const stages = ['Hatchling', 'Juvenile', 'Adolescent', 'Sub-Adult', 'Adult'];
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

function statValue(value: number | null | undefined) {
  return value == null ? 'Not specified' : numberFormat.format(value);
}

function curveLabel(key: string) {
  return key.replace(/^Core\.|^Multiplier\./, '').replace(/\./g, ' · ')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

function stageValue(values: Array<number | null>, stage: number) {
  return values[stage] ?? (values.length === 1 ? values[0] : null);
}

function durationLabel(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function MovementCard({ icon, title, mode, kind }: { icon: string; title: string; mode: SpeedMode; kind: 'land' | 'water' | 'air' }) {
  const secondary = kind === 'land'
    ? [{ label: 'Trot', value: mode.trot }, { label: 'Walk', value: mode.walk }]
    : [{ label: kind === 'air' ? 'Cruise flight' : 'Cruise swim', value: mode.cruise }];
  return <article className={`movement-card movement-${kind}`}>
    <div className="movement-card-head"><span aria-hidden="true">{icon}</span><h4>{title}</h4></div>
    <div className="movement-primary"><span>Sprint</span><strong>{numberFormat.format(mode.sprint)}</strong><small>game units/s</small></div>
    <div className="movement-secondary">
      {secondary.filter(item => item.value != null).map(item => <div key={item.label}><span>{item.label}</span><strong>{numberFormat.format(item.value!)}</strong></div>)}
      <div><span>Sprint duration</span><strong>{durationLabel(mode.sprintDurationSeconds)}</strong></div>
    </div>
  </article>;
}

function Status({ curve, stage }: { curve: StatCurve; stage: number }) {
  const changes = curve.adjustments.filter(item => item.stage === stage);
  if (!changes.length) return <span className="stat-status base">Default</span>;
  if (changes.some(item => item.current == null)) return <span className="stat-status unknown">Dynasty · value open</span>;
  return <span className="stat-status changed">Dynasty adjusted</span>;
}

export function FullStatsView({ profile }: { profile: ProcessedProfile }) {
  const [stage, setStage] = useState(4);
  const [group, setGroup] = useState('All stats');
  const [query, setQuery] = useState('');
  const { fullStats, stats } = profile;
  const groups = ['All stats', 'Adjusted', ...new Set(fullStats.curves.map(curve => curve.group))];
  const filtered = useMemo(() => fullStats.curves.filter(curve => {
    const matchingGroup = group === 'All stats' || (group === 'Adjusted' ? curve.adjustments.length > 0 : curve.group === group);
    const matchingText = `${curve.key} ${curveLabel(curve.key)} ${curve.adjustments.map(item => item.text).join(' ')}`.toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchingGroup && matchingText;
  }), [fullStats.curves, group, query]);
  const byKey = Object.fromEntries(fullStats.curves.map(curve => [curve.key, curve]));
  const headline = [
    { label: 'HEALTH', key: 'Core.MaxHealth' },
    { label: 'COMBAT WEIGHT', key: 'Core.CombatWeight' },
    { label: 'ARMOR', key: 'Core.Armor' },
    { label: 'STAMINA', key: 'Core.MaxStamina' },
  ];
  const adjustedCount = fullStats.curves.filter(curve => curve.adjustments.length).length;
  return <section className="stats-section full-stats" id="stats">
    <div className="detail-section-title"><span>02</span><h2>Playable Stats</h2></div>
    <p className="stat-intro">Complete public reference curves with Dynasty Realism adjustments applied where the imported profile gives a clear value.</p>
    <div className="stats-provenance">
      <div><span className="source-kicker">DEFAULT STAT REFERENCE</span><strong>{fullStats.baseline ? fullStats.baseline.title : 'Source pending'}</strong>
        {fullStats.baseline && <p>{fullStats.baseline.type} · updated {fullStats.baseline.updatedAt || 'date unknown'} · <a href={fullStats.baseline.url} target="_blank" rel="noreferrer">Open source ↗</a></p>}</div>
      <div><span className="source-kicker">DYNASTY OVERRIDES</span><strong>Imported profile</strong><p>{formatDate(profile.source.importedAt)} · <code>{profile.source.profileFile}</code></p></div>
    </div>
    <div className="stats-stage-head"><div><span className="source-kicker">GROWTH STAGE</span><h3>{stages[stage]} stats</h3></div><div className="stage-switch" role="group" aria-label="Growth stage">{stages.map((name, index) => <button type="button" key={name} className={stage === index ? 'selected' : ''} aria-pressed={stage === index} onClick={() => setStage(index)}>{name}</button>)}</div></div>
    <div className="stat-highlights">{headline.map(item => {
      const curve = byKey[item.key];
      const current = curve ? stageValue(curve.effectiveValues, stage) : null;
      const base = curve ? stageValue(curve.baseValues, stage) : null;
      return <div key={item.key}><span>{item.label}</span><strong>{statValue(current)}</strong>{current !== base && <small>Default {statValue(base)}</small>}</div>;
    })}</div>
    <div className="movement-panel">
      <div className="movement-heading"><div><span className="source-kicker">ADULT MOVEMENT</span><h3>Speed &amp; endurance</h3></div><p>Native game units per second · no km/h conversion</p></div>
      <div className="movement-grid">
        <MovementCard icon="◇" title="Land" mode={profile.speed.land} kind="land" />
        {profile.speed.water && <MovementCard icon="≈" title="Water" mode={profile.speed.water} kind="water" />}
        {profile.speed.air && <MovementCard icon="△" title="Air" mode={profile.speed.air} kind="air" />}
      </div>
      <div className="movement-sources"><span>Snapshot {formatDate(profile.speed.snapshotAt)}</span>{profile.speed.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.note}>{source.title} ↗</a>)}</div>
    </div>
    <div className="growth-detail"><span>Dynasty growth</span><div><strong>{stats.growthMinutes != null ? `${stats.growthMinutes} min total` : 'Not listed'}</strong>{stats.growthTime && <p>{stats.growthTime}</p>}</div></div>
    <div className="stat-legend"><span><i className="legend-default" /> Default reference</span><span><i className="legend-changed" /> Dynasty value</span><span><i className="legend-open" /> Dynasty change without exact value</span></div>
    {fullStats.warnings.length > 0 && <details className="stats-discrepancies"><summary>{fullStats.warnings.length} source difference{fullStats.warnings.length === 1 ? '' : 's'} to review</summary><p>The published reference and imported Dynasty wording differ. The displayed adult value follows the Dynasty profile when it is explicit.</p><ul>{fullStats.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    <div className="stats-browser-head"><div><h3>Stat directory</h3><p>{fullStats.curves.length} curves · {adjustedCount} with mapped Dynasty changes</p></div><div className="stats-tools"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a stat or ability…" aria-label="Search stats" /><select value={group} onChange={event => setGroup(event.target.value)} aria-label="Filter stat group">{groups.map(value => <option key={value}>{value}</option>)}</select></div></div>
    <div className="stat-table-wrap"><table className="stat-table"><thead><tr><th>STAT / CURVE</th><th>{stages[stage].toUpperCase()} DEFAULT</th><th>WITH DYNASTY</th><th>STATUS</th></tr></thead><tbody>{filtered.map(curve => {
      const base = stageValue(curve.baseValues, stage);
      const current = stageValue(curve.effectiveValues, stage);
      const notes = curve.adjustments.filter(item => item.stage === stage);
      return <tr key={curve.key} className={notes.length ? 'adjusted-row' : ''}><th scope="row"><strong>{curveLabel(curve.key)}</strong><small>{curve.key}</small>{notes.map((note, index) => <em key={index}>{note.text}{note.mismatch ? ' · previous value differs from reference' : ''}</em>)}</th><td>{statValue(base)}</td><td className={notes.length ? 'effective-value' : ''}>{statValue(current)}</td><td><Status curve={curve} stage={stage} /></td></tr>;
    })}</tbody></table>{!filtered.length && <div className="stat-empty">No stats match this search.</div>}</div>
    {fullStats.unmappedChanges.length > 0 && <details className="stats-unmapped"><summary>{fullStats.unmappedChanges.length} additional Dynasty change{fullStats.unmappedChanges.length === 1 ? '' : 's'} without a verified curve match</summary><p>These instructions are preserved from the imported profile. Their exact current value cannot be derived safely from the reference data.</p><ul>{fullStats.unmappedChanges.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
    <p className="stats-footnote">Numbers are a local snapshot, not a live game feed. Adult Dynasty values apply only to the stage stated or implied by the profile; other stages retain the published default unless specified. Ability choices and temporary buffs can change in-game results.</p>
  </section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
