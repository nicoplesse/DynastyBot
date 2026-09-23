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

function relationEvidence(attacker, target) {
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
    else if (/(?:do not|may not|cannot|never) hunt|excluding?|flee(?:s|ing)? from|avoid(?:s|ing)?/i.test(text)) {
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

function coordinatedPower(combatWeight, groupSize) {
  return combatWeight * (1 + 0.55 * Math.max(0, groupSize - 1));
}

function fightAnalysis(attacker, target) {
  const attackGroup = Math.max(1, attacker.huntGroupSize || 1);
  const defendGroup = Math.max(1, target.engagementLimit || 1);
  const soloRatio = target.cw ? attacker.cw / target.cw : 1;
  const cappedRatio = attacker.huntGroupUnlimited || target.engagementUnlimited ? null : coordinatedPower(attacker.cw, attackGroup) / Math.max(1, coordinatedPower(target.cw, defendGroup));
  let verdict = attacker.huntGroupUnlimited && !target.engagementUnlimited ? 'attacker-advantage'
    : target.engagementUnlimited && !attacker.huntGroupUnlimited ? 'defender-advantage'
      : attacker.huntGroupUnlimited && target.engagementUnlimited ? 'close'
        : cappedRatio >= 1.3 ? 'attacker-advantage' : cappedRatio >= 0.82 ? 'close' : 'defender-advantage';
  if (target.tags.includes('armored') || target.tags.includes('dangerous-defender') || target.standsGround) {
    if (verdict === 'attacker-advantage' && cappedRatio < 1.55) verdict = 'close';
  }
  const unlimitedLabel = attacker.huntGroupUnlimited || target.engagementUnlimited
    ? `The profile limits are ${attacker.huntGroupUnlimited ? 'unlimited hunters' : `${attackGroup} attacker${attackGroup === 1 ? '' : 's'}`} vs ${target.engagementUnlimited ? 'unlimited eligible defenders' : `${defendGroup} defender${defendGroup === 1 ? '' : 's'}`}; no invented numeric swarm is used.` : null;
  const label = unlimitedLabel || (verdict === 'attacker-advantage'
    ? `At the legal limits (${attackGroup} attacker${attackGroup === 1 ? '' : 's'} vs ${defendGroup} defender${defendGroup === 1 ? '' : 's'}), the attacking side has the stronger combat envelope.`
    : verdict === 'defender-advantage'
      ? `Even at the legal group cap (${attackGroup} vs ${defendGroup}), a committed straight fight favours ${target.name}.`
      : `The legal groups (${attackGroup} vs ${defendGroup}) produce a close fight; positioning and the first clean hit matter more than raw weight.`);
  return {
    verdict, attackerCombatWeight: attacker.cw, targetCombatWeight: target.cw, attackerGroupLimit: attackGroup,
    targetDefenderLimit: defendGroup, attackerGroupUnlimited: attacker.huntGroupUnlimited, targetDefendersUnlimited: target.engagementUnlimited,
    soloWeightRatio: Number(soloRatio.toFixed(2)), cappedPowerRatio: cappedRatio == null ? null : Number(cappedRatio.toFixed(2)), label,
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

function dangerBand(score, conditional) {
  if (conditional) return 'conditional';
  if (score >= 78) return 'severe';
  if (score >= 62) return 'high';
  if (score >= 47) return 'meaningful';
  return 'conditional';
}

function matchupEntry(attacker, target, direction) {
  const relation = relationEvidence(attacker, target);
  const intent = canInitiateHunt(attacker, target, relation);
  if (!intent.allowed) return null;
  const encounter = encounterAnalysis(attacker, target, relation);
  const chase = chaseAnalysis(attacker, target);
  const fight = fightAnalysis(attacker, target);
  const explicitBonus = preferenceBonus(attacker, target, relation);
  let score = 34 + explicitBonus;
  score += encounter.level === 'frequent' ? 15 : encounter.level === 'possible' ? 6 : -14;
  score += chase.verdict === 'attacker-faster' ? 16 : chase.verdict === 'attacker-edge' || chase.verdict === 'approach-advantage' ? 9 : chase.verdict === 'target-can-disengage' ? -18 : 3;
  score += fight.verdict === 'attacker-advantage' ? 18 : fight.verdict === 'close' ? 8 : -17;
  if (attacker.tags.includes('ambush')) score += 7;
  if (attacker.tags.includes('endurance') && chase.attackerDurationSeconds > chase.targetDurationSeconds) score += 6;
  if (!intent.explicit && attacker.cw > target.cw * 4) score -= 15;
  const conditional = Boolean(intent.conditional || encounter.level === 'rare' || (chase.verdict === 'target-can-disengage' && relation.type !== 'hunt' && relation.type !== 'aggression'));
  if (encounter.level === 'rare') score = Math.min(score, 44);
  const band = dangerBand(score, conditional);
  if (!intent.explicit && encounter.level === 'rare') return null;
  if (!intent.explicit && chase.verdict === 'target-can-disengage' && chase.speedMarginPct <= -15) return null;
  if (score < 43 && !intent.explicit) return null;
  if (direction === 'threat' && band === 'conditional' && encounter.level === 'rare' && !intent.explicit) return null;

  const facts = [intent.reason, chase.label, fight.label, encounter.label];
  if (target.tags.includes('armored') || target.tags.includes('dangerous-defender') || target.standsGround) facts.push(`${target.name}'s profile describes a committed or dangerous defence; it should not be treated as passive prey.`);
  if (attacker.tags.includes('ambush')) facts.push(`${attacker.name} has an explicit ambush style, so raw top speed understates the opening danger.`);
  if (attacker.companion) facts.push(`Its maximum hunting setup includes ${attacker.companion.count} ${attacker.companion.name} companion${attacker.companion.count === 1 ? '' : 's'}; the model never assumes an unlimited swarm.`);

  const headline = direction === 'threat'
    ? band === 'conditional' ? `${attacker.name} matters only if it gets the right opening` : `${attacker.name} can create a ${band === 'severe' ? 'very narrow escape window' : band === 'high' ? 'real pursuit problem' : 'credible fight'}`
    : fight.verdict === 'defender-advantage' ? `${target.name} is legal quarry, but not a comfortable fight` : chase.verdict === 'target-can-disengage' ? `${target.name} can usually refuse the chase` : `${target.name} is a realistic hunting opportunity`;
  const summary = direction === 'threat'
    ? `${attacker.name} is ${intent.explicit ? 'linked by a specific profile rule' : 'inside the legal hunt range'}. ${chase.label} ${fight.label}`
    : `${intent.explicit ? 'A profile rule names or prioritises this matchup.' : `${target.name} is within the legal hunt ceiling.`} ${chase.label} ${fight.label}`;

  return {
    id: direction === 'threat' ? attacker.id : target.id,
    name: direction === 'threat' ? attacker.name : target.name,
    direction,
    band,
    kind: relation.type === 'aggression' ? 'territorial-rival' : relation.type === 'conditional' ? 'conditional' : direction === 'threat' ? 'predator' : fight.verdict === 'defender-advantage' ? 'risky-quarry' : 'quarry',
    headline, summary, score: Math.round(score), intent, chase, fight, encounter, facts,
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
    ...traits,
  };
}

function survivalSummary(unit, threats) {
  if (!threats.length) return `${unit.name} has no routine direct counter in the current profiles. The remaining danger is conditional: a bad ambush, isolation from legal defenders, or a profile-specific territory rule.`;
  const severe = threats.filter(entry => entry.band === 'severe' || entry.band === 'high');
  const escape = threats.filter(entry => entry.chase.verdict === 'target-can-disengage');
  if (severe.length) {
    const escapeNote = escape.length
      ? ` Against ${escape.length} listed threat${escape.length === 1 ? '' : 's'}, speed still provides a reliable disengage option.`
      : ' None of those matchups offers a reliable speed-based disengage once contact is forced.';
    return `${unit.name} has ${severe.length} high-priority matchup${severe.length === 1 ? '' : 's'} where legal group size, pursuit and profile intent align.${escapeNote}`;
  }
  return `${unit.name}'s listed dangers are situational rather than automatic losses. Speed, stamina or low encounter overlap prevents raw combat weight from becoming a routine counter.`;
}

export function buildMatchups(profiles) {
  const units = profiles.map(unitFromProfile);
  const result = {};
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
    const threatLimit = Math.max(6, Math.min(8, threats.filter(entry => entry.intent.explicit).length));
    const opportunityLimit = Math.max(6, Math.min(8, opportunities.filter(entry => entry.intent.explicit).length));
    const actionableThreats = threats.slice(0, threatLimit);
    result[subject.id] = {
      schemaVersion: 2,
      speedKnown: Boolean(subject.landSpeed?.sprint),
      summary: survivalSummary(subject, actionableThreats),
      threats: actionableThreats,
      opportunities: opportunities.slice(0, opportunityLimit),
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
        groups: 'Only the profile engagement and hunting limits are compared; arbitrary swarm sizes are never assumed.',
        encounter: 'Mapped area overlap lowers or raises relevance, but an explicit cross-species rule can override sparse map overlap.',
      },
    };
  }
  return result;
}
