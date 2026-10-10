import { useMemo, useState } from 'react';
import { combatSide, evaluateFight, MAX_PICKABLE_GROUP, presentEntry, survivalSummary, type BleedModel, type CombatStats, type GroupChoice } from '../../shared/combat-sim.mjs';
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

const VERDICT: Record<string, string> = {
  'attacker-advantage': 'Attacker wins clearly', close: 'Too close to call', 'defender-advantage': 'Defender holds',
};

interface Setup { you: GroupChoice; them: GroupChoice; bleed: BleedModel }
const DEFAULT_SETUP: Setup = { you: 1, them: 'max', bleed: 'off' };
const SETUP_KEY = 'dynasty.matchupSetup';
const THEM_CHOICES: GroupChoice[] = [1, 2, 3, 4, 5, 'max'];

function readSetup(): Setup {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null');
    if (saved && (saved.you === 'max' || Number.isFinite(saved.you)) && (saved.them === 'max' || Number.isFinite(saved.them))) return { ...DEFAULT_SETUP, ...saved };
  } catch { /* storage can be blocked; the default setup still renders */ }
  return DEFAULT_SETUP;
}

function writeSetup(setup: Setup) {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch { /* per-viewer convenience only */ }
}

function go(path: string) { window.location.hash = `#${path}`; }

function duration(seconds: number | null) {
  if (seconds == null) return '—';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

const choiceLabel = (choice: GroupChoice) => choice === 'max' ? 'Legal max' : choice === 1 ? 'Solo' : String(choice);

// The reader is the target of a threat and the attacker of a hunt.
function orient(entry: MatchupEntry, you: GroupChoice, them: GroupChoice): [GroupChoice, GroupChoice] {
  return entry.direction === 'threat' ? [them, you] : [you, them];
}

function reevaluate(entry: MatchupEntry, roster: Record<string, CombatStats>, you: GroupChoice, them: GroupChoice, bleed: BleedModel): MatchupEntry {
  const attacker = roster[entry.attackerId], target = roster[entry.targetId];
  if (!attacker || !target || !entry.core) return entry;
  const fight = evaluateFight(combatSide(attacker, 'attacker'), combatSide(target, 'defender'), ...orient(entry, you, them), { bleed });
  return { ...entry, ...presentEntry(entry.core, fight), fight: { ...entry.fight, ...fight } };
}

function rankedList(entries: MatchupEntry[], limit: number) {
  const sorted = entries.filter(entry => entry.visible).sort((a, b) =>
    Number(Boolean(b.intent.explicit)) - Number(Boolean(a.intent.explicit)) || b.score - a.score || b.encounter.sharedRegions.length - a.encounter.sharedRegions.length);
  const kept: MatchupEntry[] = [], families = new Set<string>();
  for (const entry of sorted) {
    const family = entry.family || entry.id;
    if (!families.has(family) && families.size >= limit) continue;
    families.add(family);
    kept.push(entry);
  }
  return kept;
}

function groupOptions(limit: number, unlimited: boolean): GroupChoice[] {
  const top = unlimited ? MAX_PICKABLE_GROUP : Math.min(limit, MAX_PICKABLE_GROUP);
  return [...Array.from({ length: top }, (_, index) => index + 1), 'max'];
}

function GroupSelect({ label, value, options, onChange }: { label: string; value: GroupChoice; options: GroupChoice[]; onChange: (choice: GroupChoice) => void }) {
  return <label className="group-select"><span>{label}</span><select value={String(value)} onChange={event => onChange(event.target.value === 'max' ? 'max' : Number(event.target.value))}>
    {options.map(option => <option key={String(option)} value={String(option)}>{choiceLabel(option)}</option>)}
  </select></label>;
}

function FightBlock({ entry, roster, you, them, onYou, onThem, custom, onReset }: {
  entry: MatchupEntry; roster: Record<string, CombatStats>; you: GroupChoice; them: GroupChoice;
  onYou: (choice: GroupChoice) => void; onThem: (choice: GroupChoice) => void; custom: boolean; onReset: () => void;
}) {
  const fight = entry.fight;
  const attacker = roster[entry.attackerId], target = roster[entry.targetId];
  if (!attacker || !target || !fight.duel) return <div><span>LEGAL GROUPS</span><strong>{fight.attackerGroupUnlimited ? 'Unlimited' : fight.attackerGroupLimit} vs {fight.targetDefendersUnlimited ? 'Unlimited' : fight.targetDefenderLimit}</strong><p>{fight.label}</p></div>;
  const threat = entry.direction === 'threat';
  const yourStats = threat ? target : attacker, theirStats = threat ? attacker : target;
  const duel = fight.duel;
  const sim = fight.sim;
  const bars = sim ? [
    { name: attacker.name, count: fight.attackers, share: sim.attackerHpShare },
    { name: target.name, count: fight.defenders, share: sim.defenderHpShare },
  ] : [];
  const bleedLines = [
    duel.attackerBleed > 0 && `${attacker.name} builds ${duel.attackerBleed.toFixed(2)} bleed/s on ${target.name} (heals ${target.bleedHealRate.toFixed(3)}/s)${duel.attackerBleedOutpacesHeal ? ', so it stacks' : ''}.`,
    duel.defenderBleed > 0 && `${target.name} builds ${duel.defenderBleed.toFixed(2)} bleed/s back (heals ${attacker.bleedHealRate.toFixed(3)}/s)${duel.defenderBleedOutpacesHeal ? ', so it stacks' : ''}.`,
  ].filter(Boolean);
  return <div className="om-fight">
    <div className="om-fight-head">
      <span>FIGHT{custom && <em> · custom</em>}</span>
      <div className="om-fight-controls">
        <GroupSelect label={yourStats.name} value={you} options={groupOptions(threat ? yourStats.engagementLimit : yourStats.huntLimit, threat ? yourStats.engagementUnlimited : yourStats.huntUnlimited)} onChange={onYou} />
        <b>vs</b>
        <GroupSelect label={theirStats.name} value={them} options={groupOptions(threat ? theirStats.huntLimit : theirStats.engagementLimit, threat ? theirStats.huntUnlimited : theirStats.engagementUnlimited)} onChange={onThem} />
        {custom && <button type="button" onClick={onReset}>Reset</button>}
      </div>
    </div>
    <strong className={`verdict verdict-${fight.verdict}`}>{VERDICT[fight.verdict] || fight.verdict}</strong>
    <p>{fight.label}</p>
    {bars.length > 0 && <div className="om-bars">{bars.map(bar => <div key={bar.name + bar.count}><small>{bar.count}× {bar.name}</small><i><b style={{ width: `${Math.round(bar.share * 100)}%` }} /></i><em>{Math.round(bar.share * 100)}%</em></div>)}</div>}
    <table className="om-duel"><tbody>
      <tr><th /><th>{attacker.name}</th><th>{target.name}</th></tr>
      <tr><td>Main hit</td><td>{attacker.primary ? `${attacker.primary.label} ${duel.attackerHit}` : '—'}</td><td>{target.primary ? `${target.primary.label} ${duel.defenderHit}` : '—'}</td></tr>
      <tr><td>Hits to kill 1</td><td>{duel.attackerHitsToKill ?? '—'}</td><td>{duel.defenderHitsToKill ?? '—'}</td></tr>
      <tr><td>Biggest hit</td><td>{attacker.burst ? `${attacker.burst.label} ${duel.attackerBurst}${attacker.burst.situational ? '*' : ''}` : '—'}</td><td>{target.burst ? `${target.burst.label} ${duel.defenderBurst}${target.burst.situational ? '*' : ''}` : '—'}</td></tr>
      <tr><td>Damage/s · 1 on 1</td><td>{duel.attackerDps} · {duration(duel.attackerTimeToKill)}</td><td>{duel.defenderDps} · {duration(duel.defenderTimeToKill)}</td></tr>
    </tbody></table>
    {bleedLines.length > 0 && <p className="om-bleed">{bleedLines.join(' ')} {fight.bleed === 'assumed' ? 'Included under the assumed 1% max health per bleed point.' : 'Not counted in the time-to-kill; switch on the bleed estimate above to include it.'}</p>}
    {(attacker.estimated || target.estimated) && <p className="om-note">A Dynasty buff without a number applies here; the pre-buff value is used as a floor.</p>}
  </div>;
}

function MatchupCard({ entry, roster, setup }: { entry: MatchupEntry; roster: Record<string, CombatStats>; setup: Setup }) {
  const [override, setOverride] = useState<{ you: GroupChoice; them: GroupChoice } | null>(null);
  const you = override?.you ?? setup.you, them = override?.them ?? setup.them;
  const shown = override ? reevaluate(entry, roster, you, them, setup.bleed) : entry;
  const bandLabel = shown.direction === 'threat' ? THREAT_BAND[shown.band] : OPPORTUNITY_BAND[shown.band];
  return <article className={`organic-matchup direction-${shown.direction} band-${shown.band}`}>
    <div className="om-head">
      <button type="button" onClick={() => go(`/profiles/${shown.id}`)}><span>{shown.name}</span><i aria-hidden="true">↗</i></button>
      <div className="om-badges"><span className="om-band">{bandLabel}</span><span>{KIND[shown.kind] || shown.kind}</span>{shown.confidence === 'profile-specific' && <span className="profile-proof">Profile-specific</span>}</div>
    </div>
    <h4>{shown.headline}</h4>
    <p className="om-summary">{shown.summary}</p>
    <div className="om-factors">
      <FightBlock entry={shown} roster={roster} you={you} them={them} custom={Boolean(override)} onReset={() => setOverride(null)}
        onYou={choice => setOverride({ you: choice, them })} onThem={choice => setOverride({ you, them: choice })} />
      <div><span>PURSUIT</span><strong>{shown.chase.mode === 'water' ? 'Water' : shown.chase.mode === 'air-to-land' ? 'Air → land' : 'Land'} · {shown.chase.attackerSpeed.toLocaleString('en-US')} vs {shown.chase.targetSpeed.toLocaleString('en-US')}</strong><p>{shown.chase.label}</p></div>
      <div><span>CONTACT</span><strong>{shown.encounter.level} · {shown.encounter.sharedRegions.length} shared area{shown.encounter.sharedRegions.length === 1 ? '' : 's'}</strong><p>{shown.encounter.label}</p></div>
    </div>
    {shown.evidence.length > 0 && <details className="om-evidence"><summary>Why the profile creates this matchup</summary>{shown.evidence.map((proof, index) => <blockquote key={`${proof.profileId}-${proof.section}-${index}`}><span>{proof.profileName} · {proof.section}</span><p>{proof.text}</p></blockquote>)}</details>}
  </article>;
}

function MatchupList({ title, note, entries, empty, roster, setup }: { title: string; note: string; entries: MatchupEntry[]; empty: string; roster: Record<string, CombatStats>; setup: Setup }) {
  const setupKey = `${setup.you}-${setup.them}-${setup.bleed}`;
  return <section className="organic-list"><div className="organic-list-head"><div><h3>{title}</h3><p>{note}</p></div><b>{entries.length}</b></div>{entries.length ? <div className="organic-stack">{entries.map(entry => <MatchupCard key={`${entry.id}-${setupKey}`} entry={entry} roster={roster} setup={setup} />)}</div> : <p className="om-empty">{empty}</p>}</section>;
}

function SetupBar({ setup, onChange, you }: { setup: Setup; onChange: (setup: Setup) => void; you: CombatStats }) {
  const yourTop = you.huntUnlimited || you.engagementUnlimited ? MAX_PICKABLE_GROUP : Math.min(MAX_PICKABLE_GROUP, Math.max(you.huntLimit, you.engagementLimit));
  const yourChoices: GroupChoice[] = [...Array.from({ length: yourTop }, (_, index) => index + 1), 'max'];
  const pick = (field: 'you' | 'them', choices: GroupChoice[]) => <div className="setup-choices" role="group">
    {choices.map(choice => <button key={String(choice)} type="button" className={setup[field] === choice ? 'active' : ''} onClick={() => onChange({ ...setup, [field]: choice })}>{choiceLabel(choice)}</button>)}
  </div>;
  return <div className="fight-setup">
    <div><span>YOUR GROUP</span>{pick('you', yourChoices)}<small>Capped per card by your hunting party or engagement limit.</small></div>
    <div><span>THEIR GROUP</span>{pick('them', THEM_CHOICES)}<small>Capped per card by each opponent's legal limit.</small></div>
    <label className="bleed-toggle"><input type="checkbox" checked={setup.bleed === 'assumed'} onChange={event => onChange({ ...setup, bleed: event.target.checked ? 'assumed' : 'off' })} /><span><b>Estimate bleed damage</b>Assumes 1 bleed point = 1% max health per second. Stacking, armour-piercing and heal-blocking are confirmed; that rate is not.</span></label>
  </div>;
}

export function MatchupsView({ matchups, name, id }: { matchups: Matchups; name: string; id: string }) {
  const traits = matchups.traits;
  const [setup, setSetup] = useState<Setup>(readSetup);
  const change = (next: Setup) => { setSetup(next); writeSetup(next); };
  const roster = matchups.roster;
  const self = roster?.[id] || null;
  const lists = useMemo(() => {
    if (!roster || !matchups.reserve) return { threats: matchups.threats, opportunities: matchups.opportunities };
    const run = (entries: MatchupEntry[]) => entries.map(entry => reevaluate(entry, roster, setup.you, setup.them, setup.bleed));
    return {
      threats: rankedList(run([...matchups.threats, ...matchups.reserve.threats]), matchups.listLimits.threats),
      opportunities: rankedList(run([...matchups.opportunities, ...matchups.reserve.opportunities]), matchups.listLimits.opportunities),
    };
  }, [matchups, roster, setup]);
  const setupText = `${setup.you === 1 ? 'Solo' : `In a group of ${choiceLabel(setup.you).toLowerCase()}`} against ${setup.them === 'max' ? 'their full legal groups' : setup.them === 1 ? 'single opponents' : `groups of ${setup.them}`}`;
  const summary = roster ? survivalSummary(name, lists.threats, setupText) : matchups.summary;
  return <section className="matchups organic-matchups" id="counters">
    <div className="detail-section-title"><span>⚔</span><h2>Threat &amp; Hunt Map</h2></div>
    <div className="matchup-brief"><div><span className="source-kicker">SURVIVAL READ</span><h3>{name}: what can actually force a fight?</h3><p>{summary}</p></div><div className="brief-metrics">
      <span><small>LAND SPRINT</small><strong>{traits.sprintSpeed?.toLocaleString('en-US') || '—'}</strong><em>{duration(traits.sprintDurationSeconds)}</em></span>
      <span><small>HUNT CEILING</small><strong>{traits.huntTier || 'None'}</strong><em>{traits.huntGroupUnlimited ? 'unlimited party' : traits.huntGroupSize ? `up to ${traits.huntGroupSize}` : 'non-hunter'}</em></span>
      <span><small>DEFENCE LIMIT</small><strong>{traits.engagementUnlimited ? 'Unlimited' : traits.engagementLimit}</strong><em>active participants</em></span>
      {self && <span><small>COMBAT KIT</small><strong>{self.dps} dmg/s</strong><em>{self.hp} HP · armour {self.armor} · {self.attacks.join(' + ') || 'no attacks'}</em></span>}
    </div></div>
    {self && <SetupBar setup={setup} onChange={change} you={self} />}
    <details className="methodology"><summary>How this map decides relevance</summary><div>{Object.entries(matchups.methodology).map(([key, value], index) => <p key={key}><b>0{index + 1} · {key.toUpperCase()}</b>{value}</p>)}</div></details>
    <div className="organic-columns">
      <MatchupList title={`Direct dangers to ${name}`} note="Only opponents with a plausible reason, contact window and a fight that holds up in the group sizes above." entries={lists.threats} roster={roster || {}} setup={setup} empty="No routine direct counter survives the intent, pursuit, fight and encounter checks in this setup." />
      <MatchupList title="Hunts & risky interactions" note="Legal targets and territorial conflicts, with difficult prey labelled as such instead of easy wins." entries={lists.opportunities} roster={roster || {}} setup={setup} empty="This profile does not initiate player hunts or direct cross-species conflicts in this setup." />
    </div>
    {matchups.specialRisks.length > 0 && <section className="special-risks"><div className="organic-list-head"><div><h3>Conditional profile risks</h3><p>Same-species, mutation and variant rules that a generic pairwise chart would miss.</p></div><b>{matchups.specialRisks.length}</b></div><div className="special-risk-grid">{matchups.specialRisks.map((risk, index) => <article key={`${risk.title}-${index}`}><span>{risk.title}</span><p>{risk.summary}</p><small>{risk.evidence.profileName} · {risk.evidence.section}</small></article>)}</div></section>}
  </section>;
}
