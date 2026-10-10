// Organic matchup model.
//
// A matchup is only useful when four independent questions are answered:
//   1. Intent: does the other profile actually hunt, challenge or avoid this playable?
//   2. Contact: do their mapped ranges overlap often enough for that behaviour to matter?
//   3. Pursuit: can the attacker close the speed gap before its legal sprint ends?
//   4. Fight: what can the legal engagement groups do, rather than an impossible swarm?
//
// The result deliberately keeps a short list of actionable encounters and preserves the
// profile sentences that caused each verdict. This makes the generated map useful to both
// the UI and a future recommendation agent without pretending that combat weight is fate.

import { combatSide, evaluateFight, presentEntry, survivalSummary } from '../../shared/combat-sim.mjs';
import { combatKit } from './combat.js';

const TIER_RANK = { Tiny: 1, Small: 2, Medium: 3, Large: 4, Apex: 5, Giant: 6 };
const TIER_NAME = Object.fromEntries(Object.entries(TIER_RANK).map(([name, rank]) => [rank, name]));
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const SAUROPODS = new Set(['amargasaurus', 'apatosaurus', 'argentinosaurus', 'yunnanosaurus']);
const PROFILE_SPELLINGS = {
  kaiwhekea: ['Kaiwheka'],
  metriacanthosaurus: ['Metricanthosaurus'],
  leedsichthys: ['Leedsicthys'],
  compsognathus: ['Compsagnathus'],
};
const SIGNAL_SECTIONS = /quick view|engagement|preferred prey|hunting|predator reaction|cross-species|interspecies|territor|rule exemption|general behavior|general behaviour|mutated|genetics/i;

const cap = value => value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function linesFromBlock(block) {
  const values = block.type === 'list' ? block.items : [block.text];
  return values.flatMap(value => value.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)).map(text => text.trim()).filter(Boolean);
}

function evidenceSegments(profile) {
  const segments = (profile.quickView || []).map(text => ({ section: 'Quick View', text }));
  for (const section of profile.sections || []) {
    if (!SIGNAL_SECTIONS.test(section.title)) continue;
    for (const block of section.blocks || []) for (const text of linesFromBlock(block)) segments.push({ section: section.title, text });
  }
  return segments;
}

function profileText(profile) {
  return evidenceSegments(profile).map(segment => segment.text).join(' \n ');
}

function numberValue(value) {
  if (!value) return null;
  return Number(value) || WORD_NUM[value.toLowerCase()] || null;
}

function maximumFrom(text, patterns, fallback = 1) {
  const values = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = numberValue(match[1]);
      if (value) values.push(value);
    }
  }
  return values.length ? Math.max(...values) : fallback;
}

function combatTraits(profile) {
  const text = profileText(profile);
  const quick = (profile.quickView || []).join(' ');
  const has = pattern => pattern.test(text);
  const tierMatches = [
    ...text.matchAll(/hunt(?:s|ing)?\s+(?:up to and including|up to|any)\s+(Tiny|Small|Medium|Large|Apex|Giant)\s+tier/gi),
    ...text.matchAll(/hunt\s+(?:up to\s+)?(?:solo\s+)?(Tiny|Small|Medium|Large|Apex|Giant)(?:es)?\b/gi),
  ];
  let huntTier = tierMatches.length ? Math.max(...tierMatches.map(match => TIER_RANK[cap(match[1])])) : null;
  if (/may hunt any tier|hunt any tier|up to any tier/i.test(text)) huntTier = TIER_RANK.Giant;

  const engagementPatterns = [
    /(?:can have|up to)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.]{0,70}\b(?:in|enter|actively in)\s+(?:an\s+)?engagement/gi,
    /(?:engagement limit of|active defenders?[^.]{0,20}(?:up to|max(?:imum)? of))\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/gi,
    /with\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.]{0,35}actively (?:chasing|defending|engaging)/gi,
  ];
  const quickEngagementLimit = maximumFrom(quick, engagementPatterns, 0);
  const engagementLimit = quickEngagementLimit || maximumFrom(text, engagementPatterns, 1);
  let huntGroupSize = maximumFrom(quick, [
    /(?:can have|up to|group(?:ings)? of)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\+|\s*[-–]\s*\d+)?\b[^.]{0,80}\b(?:hunting party|\bhunt\b|hunt(?:ing)?\s+(?:party|group)|may hunt)/gi,
    /hunting party of\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/gi,
    /with\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:members|individuals)[^.]{0,40}hunt/gi,
  ], profile.classification.diet === 'Carnivore' && huntTier ? 1 : 0);
  for (const match of quick.matchAll(/\b(\d+)\s*[-–]\s*(\d+)\b[^.]{0,70}(?:may hunt|hunting party|in a hunt)/gi)) huntGroupSize = Math.max(huntGroupSize, Number(match[2]));
  const companion = quick.match(/hunt alongside up to\s+(\d+|one|two|three|four|five|six)\s+([A-Z][a-z]+)/i);
  const companionCount = companion ? numberValue(companion[1]) : 0;
  if (companionCount) huntGroupSize = Math.max(huntGroupSize, engagementLimit + companionCount);

  const tags = [];
  if (has(/ambush|lie in wait|surprise attack|strike(?:s|ing)? from (?:cover|hiding|the shadows|the water)|silently (?:slip|stalk|approach)|stalk(?:s|ing)? and ambush/i)) tags.push('ambush');
  if (has(/causes? bleed|inflict(?:s|ing)? bleed|bleed(?:ing)? (?:damage|wounds|out)|serrated teeth|deep (?:bleeding )?wounds|h[ae]morrhage|bleed them out/i)) tags.push('bleed');
  if (has(/pounce|leaps? onto|latch(?:es|ing)? onto|pins? (?:them|prey|it) (?:down|to)|sickle (?:claw|talon)/i)) tags.push('pounce');
  if (has(/venom|toxic bite|injects? (?:venom|toxin)/i)) tags.push('venom');
  if (has(/armou?red|osteoderm|tail club|bony (?:plates|armou?r)|heavily armou?red|thick (?:bony )?(?:hide|scales|armou?r)|thagomizer/i)) tags.push('armored');
  if (has(/endurance hunter|run down their prey|pursue their prey effortlessly|over long distances|excellent stamina/i)) tags.push('endurance');
  if (has(/charge(?:s|d)?|gore|horns?|tail (?:club|whip|smash|swipe|spike|lash)|trample|powerful kick|thagomizer|stand(?:s)? (?:its|their) ground/i)) tags.push('dangerous-defender');

  const excludedGroups = [];
  if (/(?:do not|may not|cannot|never|excluding?) hunt[^.]{0,100}sauropods|excluding sauropods/i.test(text)) excludedGroups.push('sauropods');
  if (/(?:do not|may not|cannot|never|excluding?) hunt[^.]{0,100}apex carnivores|excluding[^.]{0,40}carnivores/i.test(text)) excludedGroups.push('apex-carnivores');
  if (/except small carnivores/i.test(text)) excludedGroups.push('small-carnivores');
  const preferredGroups = [];
  if (/target carnivores first|must target carnivores|prioriti[sz]e carnivores/i.test(text)) preferredGroups.push('carnivores');
  if (/prioriti[sz]e medium|speciali[sz]e in medium/i.test(text)) preferredGroups.push('medium-or-smaller');

  return {
    huntTier,
    huntGroupSize: Math.max(0, huntGroupSize),
    engagementLimit: Math.max(1, engagementLimit),
    engagementUnlimited: /unlimited[^.]{0,45}(?:in an engagement|individuals in an engagement|adults in an engagement)|can have unlimited[^.]{0,25}engagement/i.test(quick),
    huntGroupUnlimited: /unlimited[^.]{0,50}(?:hunting party|individuals in a hunting party)/i.test(quick),
    companion: companion ? { count: companionCount, name: companion[2] } : null,
    tags,
    excludedGroups,
    preferredGroups,
    fleesFromApex: /flee(?:s|ing)? from (?:all )?(?:adult )?Apex|will always flee from Apex|flee from .*Apex/i.test(text),
    standsGround: /will not flee|rarely flees|stands? (?:its|their) ground|stand its ground/i.test(text),
  };
}

function targetPattern(unit) {
  const labels = [unit.name, unit.id.replace(/-/g, ' '), ...(unit.aliases || []), ...(PROFILE_SPELLINGS[unit.id] || [])].filter(label => label && label.length > 3);
  return new RegExp(`\\b(?:${labels.map(escapeRegExp).join('|')})(?:es|s)?\\b`, 'i');
}

// Variants split from one profile share its text, which names the rival variant by rule
// ("cannibalize other adults of the opposite variant") rather than by a playable name.
function siblingVariantEvidence(attacker, target) {
  if (!attacker.parentId || attacker.parentId !== target.parentId) return null;
  const rules = attacker.segments.filter(segment => /(?:hunt|cannibali[sz]e|kill)[^.]{0,80}\b(?:opposite|different|other) variants?\b/i.test(segment.text));
  // Without such a rule the variants are simply one species; same-species conflict stays in specialRisks.
  if (!rules.length) return { type: 'avoid', evidence: [] };
  return { type: 'hunt', evidence: rules.slice(0, 2).map(segment => ({ profileId: attacker.id, profileName: attacker.name, section: segment.section, text: segment.text.slice(0, 420) })) };
}

function relationEvidence(attacker, target) {
  const sibling = siblingVariantEvidence(attacker, target);
  if (sibling) return sibling;
  const pattern = targetPattern(target);
  const mentions = attacker.segments.filter(segment => pattern.test(segment.text));
  const evidence = [];
  let type = null;
  for (const segment of mentions) {
    const text = segment.text;
    let current = null;
    const targetSource = targetPattern(target).source;
    const passiveTarget = new RegExp(`(?:hunted|attacked|targeted|challenged)\\s+by\\s+(?:[^.]{0,30})${targetSource}|${targetSource}[^.]{0,40}(?:hunts?|attacks?|targets?)\\s+${escapeRegExp(attacker.name)}`, 'i');
    const cooperative = new RegExp(`(?:hunt(?:ing)?|travel(?:ing)?|group(?:ed|ing)?)\\s+(?:alongside|with)\\s+(?:[^.]{0,35})${targetSource}|(?:defend|adopt|tolerat|group with)(?:[^.]{0,35})${targetSource}`, 'i');
    const directHunt = new RegExp(`(?:hunt(?:s|ed|ing)?|prioriti[sz](?:e|es|ed|ing)?|kill(?:s|ed|ing)?|cannibali[sz](?:e|es|ed|ing)?)(?:[^.]{0,160})${targetSource}|(?:target(?:s|ed|ing)?(?:[^.]{0,45})(?:first|such as|including|prefer)|priority targets?(?:\\s+are|\\s+include)?)(?:[^.]{0,180})${targetSource}|${targetSource}(?:[^.]{0,45})(?:is|are|must be|will be)\\s+(?:hunted|targeted|killed|cannibali[sz]ed)`, 'i');
    const directAggression = new RegExp(`(?:attack(?:s|ed|ing)?|aggress(?:es|ed|ing)?|challenge(?:s|d|ing)?|drive(?:s|n|ing)?\\s+out|push(?:es|ed|ing)?\\s+out|expel(?:s|led|ling)?|not tolerate)(?:[^.]{0,100})${targetSource}`, 'i');
    if (passiveTarget.test(text)) current = 'avoid';
    else if (cooperative.test(text)) current = 'tolerate';
    else if (/(?:do(?:es)? not|may not|cannot|never)\s+(?:bother\s+(?:to\s+hunt|with)|hunt)|excluding?|flee(?:s|ing)? from|avoid(?:s|ing)?/i.test(text)) {
      current = /unless|except|desperate hunger|deathscar|albino|offspring|adolescent|juvenile|hatchling|young/i.test(text) ? 'conditional' : 'avoid';
    } else if (directHunt.test(text)) current = 'hunt';
    else if (directAggression.test(text)) current = 'aggression';
    else if (/tolerat|ignore|passive|share kills|group with|adopt/i.test(text)) current = 'tolerate';
    if (!current) continue;
    const priority = ['hunt', 'aggression', 'conditional', 'avoid', 'tolerate'];
    if (!type || priority.indexOf(current) < priority.indexOf(type)) type = current;
    evidence.push({ profileId: attacker.id, profileName: attacker.name, section: segment.section, text: text.slice(0, 420) });
  }
  const joined = mentions.map(segment => segment.text).join(' ');
  const targetSource = targetPattern(target).source;
  const cooperativeRelationship = new RegExp(`(?:hunt(?:ing)?|travel(?:ing)?|group(?:ed|ing)?)\\s+(?:alongside|with)\\s+(?:[^.]{0,35})${targetSource}|mutualistic[^.]{0,50}${targetSource}|${targetSource}[^.]{0,35}companion`, 'i').test(joined);
  const strictHostility = new RegExp(`(?:hunt(?:s|ed|ing)?|kill(?:s|ed|ing)?|attack(?:s|ed|ing)?|challenge(?:s|d|ing)?)\\s+(?!alongside|with)(?:[^.]{0,12})${targetSource}`, 'i').test(joined);
  if (cooperativeRelationship && !strictHostility) type = 'tolerate';
  return { type, evidence: evidence.slice(0, 2) };
}

function excludedByGroup(attacker, target) {
  if (attacker.excludedGroups.includes('sauropods') && SAUROPODS.has(target.id)) return 'This profile explicitly excludes sauropods from its hunts.';
  if (attacker.excludedGroups.includes('apex-carnivores') && target.diet === 'Carnivore' && target.tierRank >= TIER_RANK.Apex) return 'This profile excludes Apex carnivores from normal hunts.';
  if (attacker.excludedGroups.includes('small-carnivores') && target.diet === 'Carnivore' && target.tierRank <= TIER_RANK.Small) return 'This profile excludes Small carnivores from normal hunts.';
  return null;
}

function canInitiateHunt(attacker, target, relation) {
  const groupExclusion = excludedByGroup(attacker, target);
  if (relation.type === 'avoid' || groupExclusion) return { allowed: false, reason: groupExclusion || 'The profile explicitly avoids or excludes this target.' };
  if (relation.type === 'hunt' || relation.type === 'aggression') return { allowed: true, explicit: true, reason: relation.type === 'hunt' ? 'The profile names this playable as prey or a target.' : 'The profile names a direct aggression or rivalry rule.' };
  if (relation.type === 'conditional') return { allowed: true, explicit: true, conditional: true, reason: 'Only a stated condition turns this into a legal hunt or attack.' };
  if (attacker.habitat !== 'Aquatic' && target.habitat === 'Aquatic') return { allowed: false, reason: 'A terrestrial profile has no routine way to initiate a hunt against an aquatic target.' };
  if (!attacker.airSpeed && target.airSpeed) return { allowed: false, reason: 'A terrestrial hunter cannot routinely force a grounded fight against an aerial target.' };
  if (attacker.diet !== 'Carnivore' || !attacker.huntTier) return { allowed: false, reason: 'No profile rule allows this playable to initiate a hunt.' };
  if (target.tierRank > attacker.huntTier) return { allowed: false, reason: `Its normal hunt ceiling is ${TIER_NAME[attacker.huntTier]}, below this target.` };
  return { allowed: true, explicit: false, reason: `Its profile permits hunting through ${TIER_NAME[attacker.huntTier]} tier.` };
}

const sharedRegions = (a, b) => [...a].filter(value => b.has(value));

function encounterAnalysis(attacker, target, relation) {
  const shared = sharedRegions(attacker.regions, target.regions);
  const union = new Set([...attacker.regions, ...target.regions]);
  const overlap = union.size ? shared.length / union.size : 0;
  const incompatible = (attacker.habitat === 'Aquatic' && !target.waterSpeed) || (target.habitat === 'Aquatic' && !attacker.waterSpeed);
  let level = shared.length >= 4 || overlap >= 0.3 ? 'frequent' : shared.length ? 'possible' : 'rare';
  if (incompatible && !relation.type) level = 'rare';
  const label = level === 'frequent' ? `${shared.length} shared mapped areas make contact plausible.`
    : level === 'possible' ? shared.length ? `They overlap in ${shared.length} mapped area${shared.length === 1 ? '' : 's'}, so the matchup is situational.` : 'A direct profile rule creates contact despite little mapped-range overlap.'
      : 'Their mapped ranges and movement niches rarely produce a meaningful encounter.';
  return { level, sharedRegions: shared, overlap: Number(overlap.toFixed(3)), label };
}

function movementMode(attacker, target) {
  const bothAquatic = attacker.waterSpeed && target.waterSpeed && (/Aquatic/i.test(attacker.habitat || '') || /Aquatic/i.test(target.habitat || ''));
  if (bothAquatic) return 'water';
  if (attacker.airSpeed) return 'air-to-land';
  return 'land';
}

function chaseAnalysis(attacker, target) {
  const mode = movementMode(attacker, target);
  const attackSpeed = mode === 'water' ? attacker.waterSpeed.sprint : mode === 'air-to-land' ? attacker.airSpeed.sprint : attacker.landSpeed.sprint;
  const targetSpeed = mode === 'water' ? target.waterSpeed.sprint : target.landSpeed.sprint;
  const attackDuration = mode === 'water' ? attacker.waterSpeed.sprintDurationSeconds : mode === 'air-to-land' ? attacker.airSpeed.sprintDurationSeconds : attacker.landSpeed.sprintDurationSeconds;
  const targetDuration = mode === 'water' ? target.waterSpeed.sprintDurationSeconds : target.landSpeed.sprintDurationSeconds;
  const marginPct = targetSpeed ? ((attackSpeed - targetSpeed) / targetSpeed) * 100 : 0;
  const durationMarginPct = targetDuration ? ((attackDuration - targetDuration) / targetDuration) * 100 : 0;
  let verdict;
  if (mode === 'air-to-land' && target.landSpeed.sprint >= attacker.landSpeed.sprint * 1.05 && target.landSpeed.sprintDurationSeconds > attacker.landSpeed.sprintDurationSeconds) verdict = 'target-can-disengage';
  else if (mode === 'air-to-land') verdict = 'approach-advantage';
  else if (marginPct >= 8) verdict = 'attacker-faster';
  else if (marginPct >= -3 && (marginPct >= 3 || durationMarginPct >= 25)) verdict = 'attacker-edge';
  else if ((marginPct <= -2 && durationMarginPct <= -10) || (marginPct <= -8 && durationMarginPct < 30)) verdict = 'target-can-disengage';
  else verdict = 'close-chase';
  const modeLabel = mode === 'water' ? 'in water' : mode === 'air-to-land' ? 'while approaching from the air' : 'on land';
  const label = verdict === 'attacker-faster' ? `${attacker.name} is ${Math.abs(marginPct).toFixed(0)}% faster ${modeLabel}; a clean escape is unlikely once spotted.`
    : verdict === 'attacker-edge' ? `The speed gap is small (${attackSpeed} vs ${targetSpeed}), but ${attacker.name} has the pursuit edge ${modeLabel}.`
      : verdict === 'target-can-disengage' && mode === 'air-to-land' ? `${attacker.name} can arrive from the air, but ${target.name}'s ${target.landSpeed.sprint} land speed and longer sprint let it disengage after the opening pass.`
        : verdict === 'target-can-disengage' ? `${target.name} is ${Math.abs(marginPct).toFixed(0)}% faster ${modeLabel} and can normally refuse this fight.`
        : verdict === 'approach-advantage' ? `${attacker.name} can approach at ${attackSpeed} flight units/s, but landing the opening attack still matters.`
          : `This is a close chase ${modeLabel}: ${attackSpeed} vs ${targetSpeed} units/s, with stamina likely deciding it.`;
  return {
    mode, verdict, attackerSpeed: attackSpeed, targetSpeed, speedMarginPct: Number(marginPct.toFixed(1)),
    attackerDurationSeconds: attackDuration, targetDurationSeconds: targetDuration, durationMarginPct: Number(durationMarginPct.toFixed(1)), label,
  };
}

// One compact combat card per profile; hunting parties attack, engagement limits defend.
function rosterStats(unit) {
  const rotation = unit.kit.rotation;
  return {
    id: unit.id, name: unit.name, cw: unit.kit.cw, hp: unit.kit.hp, armor: unit.kit.armor,
    dps: rotation?.dps || 0, primary: rotation?.primary || null, burst: rotation?.burst || null,
    attacks: rotation?.attacks || [], bleedPerSecond: rotation?.bleedPerSecond || 0, bleedHealRate: unit.kit.bleedHealRate,
    estimated: Boolean(rotation?.estimated),
    huntLimit: Math.max(1, unit.huntGroupSize || 1), huntUnlimited: unit.huntGroupUnlimited,
    engagementLimit: Math.max(1, unit.engagementLimit || 1), engagementUnlimited: unit.engagementUnlimited,
  };
}

function preferenceBonus(attacker, target, relation) {
  if (relation.type === 'hunt') return 22;
  if (relation.type === 'aggression') return 16;
  let bonus = 0;
  if (attacker.preferredGroups.includes('carnivores') && target.diet === 'Carnivore') bonus += 12;
  if (attacker.preferredGroups.includes('medium-or-smaller') && target.tierRank <= TIER_RANK.Medium) bonus += 8;
  return bonus;
}

// The reader plays solo by default: they face the opponent's full legal group, and they hunt alone.
const RESERVE_FAMILIES = 6;
const DEFAULT_SETUP = { threat: ['max', 1], opportunity: [1, 'max'] };
// The most attacker-friendly setup decides whether a counterpart can appear at all.
const WIDEST_SETUP = ['max', 1];

function matchupEntry(attacker, target, direction) {
  const relation = relationEvidence(attacker, target);
  const intent = canInitiateHunt(attacker, target, relation);
  if (!intent.allowed) return null;
  const encounter = encounterAnalysis(attacker, target, relation);
  const chase = chaseAnalysis(attacker, target);
  const explicitBonus = preferenceBonus(attacker, target, relation);
  let baseScore = 34 + explicitBonus;
  baseScore += encounter.level === 'frequent' ? 15 : encounter.level === 'possible' ? 6 : -14;
  baseScore += chase.verdict === 'attacker-faster' ? 16 : chase.verdict === 'attacker-edge' || chase.verdict === 'approach-advantage' ? 9 : chase.verdict === 'target-can-disengage' ? -18 : 3;
  if (attacker.tags.includes('ambush')) baseScore += 7;
  if (attacker.tags.includes('endurance') && chase.attackerDurationSeconds > chase.targetDurationSeconds) baseScore += 6;
  if (!intent.explicit && attacker.cw > target.cw * 4) baseScore -= 15;
  const conditional = Boolean(intent.conditional || encounter.level === 'rare' || (chase.verdict === 'target-can-disengage' && relation.type !== 'hunt' && relation.type !== 'aggression'));
  if (!intent.explicit && encounter.level === 'rare') return null;
  if (!intent.explicit && chase.verdict === 'target-can-disengage' && chase.speedMarginPct <= -15) return null;

  const sides = { attacker: combatSide(rosterStats(attacker), 'attacker'), target: combatSide(rosterStats(target), 'defender') };
  const core = {
    direction, attackerName: attacker.name, targetName: target.name, chaseVerdict: chase.verdict, chaseLabel: chase.label,
    baseScore, scoreCap: encounter.level === 'rare' ? 44 : null, conditional, explicit: Boolean(intent.explicit),
    relationKind: relation.type === 'aggression' ? 'territorial-rival' : relation.type === 'conditional' ? 'conditional' : null,
    summaryLead: direction === 'threat'
      ? `${attacker.name} is ${intent.explicit ? 'linked by a specific profile rule' : 'inside the legal hunt range'}.`
      : `${intent.explicit ? 'A profile rule names or prioritises this matchup.' : `${target.name} is within the legal hunt ceiling.`}`,
  };
  if (!presentEntry(core, evaluateFight(sides.attacker, sides.target, ...WIDEST_SETUP)).visible) return null;
  const fight = evaluateFight(sides.attacker, sides.target, ...DEFAULT_SETUP[direction]);
  const legal = evaluateFight(sides.attacker, sides.target, 'max', 'max');
  const shown = presentEntry(core, fight);
  const duel = fight.duel;

  const facts = [intent.reason, chase.label, fight.label, encounter.label];
  if (sides.attacker.primary && sides.target.primary) facts.push(`One-on-one, a ${attacker.name} ${sides.attacker.primary.label.toLowerCase()} lands ${duel.attackerHit} on ${target.name} (${duel.attackerHitsToKill} to kill); a ${target.name} ${sides.target.primary.label.toLowerCase()} lands ${duel.defenderHit} back (${duel.defenderHitsToKill} to kill).`);
  if (duel.attackerBleedOutpacesHeal) facts.push(`${attacker.name}'s bleed builds faster than ${target.name} heals it, blocks its healing and ignores armour; that pressure comes on top of the direct damage.`);
  if (target.tags.includes('armored') || target.tags.includes('dangerous-defender') || target.standsGround) facts.push(`${target.name}'s profile describes a committed or dangerous defence; it should not be treated as passive prey.`);
  if (attacker.tags.includes('ambush')) facts.push(`${attacker.name} has an explicit ambush style, so raw top speed understates the opening danger.`);
  if (attacker.companion) facts.push(`Its maximum hunting setup includes ${attacker.companion.count} ${attacker.companion.name} companion${attacker.companion.count === 1 ? '' : 's'}; the model never assumes an unlimited swarm.`);

  return {
    id: direction === 'threat' ? attacker.id : target.id,
    name: direction === 'threat' ? attacker.name : target.name,
    family: direction === 'threat' ? attacker.parentId || attacker.id : target.parentId || target.id,
    direction,
    band: shown.band,
    kind: shown.kind,
    headline: shown.headline, summary: shown.summary, score: shown.score, visible: shown.visible,
    intent, chase, encounter, facts,
    fight: {
      ...fight,
      attackerCombatWeight: attacker.cw, targetCombatWeight: target.cw,
      attackerGroupLimit: sides.attacker.limit, targetDefenderLimit: sides.target.limit,
      attackerGroupUnlimited: sides.attacker.unlimited, targetDefendersUnlimited: sides.target.unlimited,
      legal: { verdict: legal.verdict, label: legal.label, attackers: legal.attackers, defenders: legal.defenders },
    },
    attackerId: attacker.id, targetId: target.id, core,
    tags: [...new Set([...attacker.tags, ...(target.tags.includes('dangerous-defender') ? ['dangerous-defender'] : [])])],
    evidence: relation.evidence,
    confidence: relation.evidence.length ? 'profile-specific' : encounter.level === 'rare' ? 'low' : 'derived',
  };
}

function specialRisks(unit) {
  const selected = [];
  const seen = new Set();
  for (const segment of unit.segments) {
    const matches = segment.text.match(new RegExp(targetPattern(unit).source, 'gi')) || [];
    const conspecific = matches.length >= 2 || /(?:other|rival|unrelated|same[- ]species|own kind|own species|conspecific)[^.]{0,35}(?:offspring|adult|individual|pack|pair|group|male|female|kind|species)/i.test(segment.text);
    if (!conspecific) continue;
    if (!/(albino|melan|mutation|variant|blight|cannibali[sz]|infanticide|territor|challenge|rival)/i.test(segment.text)) continue;
    if (!/(hunt|kill|cannibali[sz]|attack|aggress|challenge|drive|flee|avoid|not tolerate|expel)/i.test(segment.text)) continue;
    const normalized = segment.text.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const title = /albino|melan|mutation|blight/i.test(segment.text) ? 'Mutation-specific risk'
      : /variant/i.test(segment.text) ? 'Variant conflict'
        : /cannibali[sz]|infanticide/i.test(segment.text) ? 'Cannibalism / offspring risk' : 'Same-species territory risk';
    selected.push({ title, summary: segment.text.slice(0, 480), evidence: { profileId: unit.id, profileName: unit.name, section: segment.section, text: segment.text.slice(0, 480) } });
    if (selected.length === 3) break;
  }
  return selected;
}

function unitFromProfile(profile) {
  const traits = combatTraits(profile);
  const unknownMovement = { sprint: 0, sprintDurationSeconds: 0 };
  return {
    profile,
    id: profile.id,
    name: profile.name,
    aliases: profile.aliases || [],
    parentId: profile.variant?.parentId || null,
    tier: profile.classification.tier,
    tierRank: TIER_RANK[profile.classification.tier] || 3,
    diet: profile.classification.diet,
    habitat: profile.classification.habitat,
    cw: profile.stats.combatWeight || 0,
    regions: new Set((profile.habitat?.regions || []).map(region => {
      if (/^rex-(?:northern|southern)-redwoods$/.test(region)) return 'redwoods';
      if (/^rex-(?:western|eastern)-hills$/.test(region)) return 'hollow-hills';
      if (/^rex-(?:upper|lower)-wollemi$/.test(region)) return 'wollemi-forest';
      return region;
    })),
    landSpeed: profile.speed?.land || unknownMovement,
    waterSpeed: profile.speed?.water || null,
    airSpeed: profile.speed?.air || null,
    segments: evidenceSegments(profile),
    kit: combatKit(profile),
    ...traits,
  };
}

export function buildMatchups(profiles) {
  const units = profiles.map(unitFromProfile);
  const result = {};
  const familyOf = new Map(units.map(unit => [unit.id, unit.parentId || unit.id]));
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  for (const subject of units) {
    const threats = [];
    const opportunities = [];
    for (const other of units) {
      if (other.id === subject.id) continue;
      const threat = matchupEntry(other, subject, 'threat');
      if (threat) threats.push(threat);
      const opportunity = matchupEntry(subject, other, 'opportunity');
      if (opportunity) opportunities.push(opportunity);
    }
    const relevance = entry => entry.intent.explicit ? 1 : 0;
    threats.sort((a, b) => relevance(b) - relevance(a) || b.score - a.score || b.encounter.sharedRegions.length - a.encounter.sharedRegions.length);
    opportunities.sort((a, b) => relevance(b) - relevance(a) || b.score - a.score || b.encounter.sharedRegions.length - a.encounter.sharedRegions.length);
    // Variants of one profile (megalania-arid / -temperate) share one slot, so a split profile
    // cannot crowd other counterparts out of the bounded lists.
    const familyCount = entries => new Set(entries.map(entry => familyOf.get(entry.id))).size;
    const takeFamilies = (entries, limit) => {
      const kept = [], families = new Set();
      for (const entry of entries) {
        const family = familyOf.get(entry.id);
        if (!families.has(family) && families.size >= limit) continue;
        families.add(family);
        kept.push(entry);
      }
      return kept;
    };
    const threatLimit = Math.max(6, Math.min(8, familyCount(threats.filter(entry => entry.intent.explicit))));
    const opportunityLimit = Math.max(6, Math.min(8, familyCount(opportunities.filter(entry => entry.intent.explicit))));
    // The default lists read "you solo"; the reserve holds counterparts that only surface with
    // other group sizes, so the browser can re-rank without a second request.
    const actionableThreats = takeFamilies(threats.filter(entry => entry.visible), threatLimit);
    const shownOpportunities = takeFamilies(opportunities.filter(entry => entry.visible), opportunityLimit);
    const reserve = {
      threats: takeFamilies(threats.filter(entry => !actionableThreats.includes(entry)), RESERVE_FAMILIES),
      opportunities: takeFamilies(opportunities.filter(entry => !shownOpportunities.includes(entry)), RESERVE_FAMILIES),
    };
    const listed = [...actionableThreats, ...shownOpportunities, ...reserve.threats, ...reserve.opportunities];
    result[subject.id] = {
      schemaVersion: 3,
      speedKnown: Boolean(subject.landSpeed?.sprint),
      summary: survivalSummary(subject.name, actionableThreats, 'Played solo against their full legal groups'),
      threats: actionableThreats,
      opportunities: shownOpportunities,
      reserve,
      listLimits: { threats: threatLimit, opportunities: opportunityLimit },
      // Combat cards for the subject and every listed counterpart, so the browser can re-run any fight.
      roster: Object.fromEntries([subject.id, ...listed.map(entry => entry.id)].map(id => [id, rosterStats(unitById.get(id))])),
      specialRisks: specialRisks(subject),
      traits: {
        tier: subject.tier,
        diet: subject.diet,
        habitat: subject.habitat,
        combatWeight: subject.cw,
        sprintSpeed: subject.landSpeed.sprint,
        sprintDurationSeconds: subject.landSpeed.sprintDurationSeconds,
        waterSprintSpeed: subject.waterSpeed?.sprint || null,
        airSprintSpeed: subject.airSpeed?.sprint || null,
        huntTier: subject.huntTier ? TIER_NAME[subject.huntTier] : null,
        huntGroupSize: subject.huntGroupSize,
        engagementLimit: subject.engagementLimit,
        huntGroupUnlimited: subject.huntGroupUnlimited,
        engagementUnlimited: subject.engagementUnlimited,
        tags: subject.tags,
        excludedGroups: subject.excludedGroups,
        preferredGroups: subject.preferredGroups,
      },
      methodology: {
        intent: 'Profile-specific hunt, prey, rivalry and avoidance rules are checked before tier eligibility.',
        pursuit: 'Relevant land, water or flight caps and sprint duration determine whether contact can be forced.',
        groups: 'By default you are solo and the other side brings its full legal group; both sides can be set to any size up to the profile caps. Unlimited groups are never turned into an invented number.',
        fight: 'Every hit is resolved as damage × (attacker CW ÷ victim CW) ÷ victim armour from the adult stat curves. Each side focus-fires one target at a time with its best spammable attack plus up to two stronger abilities. Times assume every swing lands, so agile, smaller players outperform them by dodging. Bleed stacks, ignores armour and blocks healing; it is shown as pressure and only converted into health when you switch on the estimate, because that rate is not documented.',
        encounter: 'Mapped area overlap lowers or raises relevance, but an explicit cross-species rule can override sparse map overlap.',
      },
    };
  }
  return result;
}
