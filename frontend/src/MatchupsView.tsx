import { type MatchupBand, type MatchupEntry, type Matchups } from './api';
import './matchups.css';
import './matchup-opportunities.css';

const THREAT_BAND: Record<MatchupBand, string> = {
  severe: 'Severe danger',
  high: 'High danger',
  meaningful: 'Meaningful',
  conditional: 'Conditional',
};

const OPPORTUNITY_BAND: Record<MatchupBand, string> = {
  severe: 'Strong fit',
  high: 'Favourable',
  meaningful: 'Viable',
  conditional: 'Conditional',
};

const KIND: Record<string, string> = {
  predator: 'Predator', quarry: 'Quarry', 'risky-quarry': 'Risky quarry',
  'territorial-rival': 'Territorial rival', conditional: 'Conditional rule',
};

function go(path: string) { window.location.hash = `#${path}`; }

function duration(seconds: number | null) {
  if (seconds == null) return '—';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function MatchupCard({ entry }: { entry: MatchupEntry }) {
  const bandLabel = entry.direction === 'threat' ? THREAT_BAND[entry.band] : OPPORTUNITY_BAND[entry.band];
  return <article className={`organic-matchup direction-${entry.direction} band-${entry.band}`}>
    <div className="om-head">
      <button type="button" onClick={() => go(`/profiles/${entry.id}`)}><span>{entry.name}</span><i aria-hidden="true">↗</i></button>
      <div className="om-badges"><span className="om-band">{bandLabel}</span><span>{KIND[entry.kind] || entry.kind}</span>{entry.confidence === 'profile-specific' && <span className="profile-proof">Profile-specific</span>}</div>
    </div>
    <h4>{entry.headline}</h4>
    <p className="om-summary">{entry.summary}</p>
    <div className="om-factors">
      <div><span>PURSUIT</span><strong>{entry.chase.mode === 'water' ? 'Water' : entry.chase.mode === 'air-to-land' ? 'Air → land' : 'Land'} · {entry.chase.attackerSpeed.toLocaleString('en-US')} vs {entry.chase.targetSpeed.toLocaleString('en-US')}</strong><p>{entry.chase.label}</p></div>
      <div><span>LEGAL GROUPS</span><strong>{entry.fight.attackerGroupUnlimited ? 'Unlimited' : entry.fight.attackerGroupLimit} vs {entry.fight.targetDefendersUnlimited ? 'Unlimited' : entry.fight.targetDefenderLimit}</strong><p>{entry.fight.label}</p></div>
      <div><span>CONTACT</span><strong>{entry.encounter.level} · {entry.encounter.sharedRegions.length} shared area{entry.encounter.sharedRegions.length === 1 ? '' : 's'}</strong><p>{entry.encounter.label}</p></div>
    </div>
    {entry.evidence.length > 0 && <details className="om-evidence"><summary>Why the profile creates this matchup</summary>{entry.evidence.map((proof, index) => <blockquote key={`${proof.profileId}-${proof.section}-${index}`}><span>{proof.profileName} · {proof.section}</span><p>{proof.text}</p></blockquote>)}</details>}
  </article>;
}

function MatchupList({ title, note, entries, empty }: { title: string; note: string; entries: MatchupEntry[]; empty: string }) {
  return <section className="organic-list"><div className="organic-list-head"><div><h3>{title}</h3><p>{note}</p></div><b>{entries.length}</b></div>{entries.length ? <div className="organic-stack">{entries.map(entry => <MatchupCard key={entry.id} entry={entry} />)}</div> : <p className="om-empty">{empty}</p>}</section>;
}

export function MatchupsView({ matchups, name }: { matchups: Matchups; name: string }) {
  const traits = matchups.traits;
  return <section className="matchups organic-matchups" id="counters">
    <div className="detail-section-title"><span>⚔</span><h2>Threat &amp; Hunt Map</h2></div>
    <div className="matchup-brief"><div><span className="source-kicker">SURVIVAL READ</span><h3>{name}: what can actually force a fight?</h3><p>{matchups.summary}</p></div><div className="brief-metrics">
      <span><small>LAND SPRINT</small><strong>{traits.sprintSpeed?.toLocaleString('en-US') || '—'}</strong><em>{duration(traits.sprintDurationSeconds)}</em></span>
      <span><small>HUNT CEILING</small><strong>{traits.huntTier || 'None'}</strong><em>{traits.huntGroupUnlimited ? 'unlimited party' : traits.huntGroupSize ? `up to ${traits.huntGroupSize}` : 'non-hunter'}</em></span>
      <span><small>DEFENCE LIMIT</small><strong>{traits.engagementUnlimited ? 'Unlimited' : traits.engagementLimit}</strong><em>active participants</em></span>
    </div></div>
    <details className="methodology"><summary>How this map decides relevance</summary><div>{Object.entries(matchups.methodology).map(([key, value], index) => <p key={key}><b>0{index + 1} · {key.toUpperCase()}</b>{value}</p>)}</div></details>
    <div className="organic-columns">
      <MatchupList title={`Direct dangers to ${name}`} note="Only opponents with a plausible reason, contact window and legal path to pressure you." entries={matchups.threats} empty="No routine direct counter survives the intent, pursuit, group-limit and encounter checks." />
      <MatchupList title="Hunts & risky interactions" note="Legal targets and territorial conflicts, with difficult prey labelled as such instead of easy wins." entries={matchups.opportunities} empty="This profile does not initiate player hunts or direct cross-species conflicts." />
    </div>
    {matchups.specialRisks.length > 0 && <section className="special-risks"><div className="organic-list-head"><div><h3>Conditional profile risks</h3><p>Same-species, mutation and variant rules that a generic pairwise chart would miss.</p></div><b>{matchups.specialRisks.length}</b></div><div className="special-risk-grid">{matchups.specialRisks.map((risk, index) => <article key={`${risk.title}-${index}`}><span>{risk.title}</span><p>{risk.summary}</p><small>{risk.evidence.profileName} · {risk.evidence.section}</small></article>)}</div></section>}
  </section>;
}
