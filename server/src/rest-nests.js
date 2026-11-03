// Rest nests ("Ruhenester"): may a playable place an in-game nest just to rest or sleep in?
//
// Server rule 9.8 allows decorative/resting nests without offspring for everyone, but profiles
// override server rules (1.1), so the curated source data/reference/rest-nests.json rates each
// playable from its own profile: a rest nest the profile describes, a fixed home where one fits,
// a nomad that only rests briefly, or a profile that speaks against it. Every rating carries
// verbatim profile quotes and the general rules carry rule numbers; a quote that is not in the
// profile or a rule number that does not exist fails the build.

const normalize = text => text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function profileSegments(profile) {
  const segments = [{ section: 'Quick View', text: (profile.quickView || []).join(' ') }];
  for (const section of profile.sections || []) {
    segments.push({ section: section.title, text: section.blocks.map(block => block.type === 'list' ? block.items.join(' ') : block.text).join(' ') });
  }
  return segments.map(segment => ({ ...segment, text: normalize(segment.text) }));
}

// The section a verbatim quote comes from, or null; shared with the temperature map (thermo.js).
export function quoteSection(profile, quote) {
  const needle = normalize(quote);
  return profileSegments(profile).find(segment => segment.text.includes(needle))?.section || null;
}

// A quote that is not verbatim in the profile is a data error.
function locate(profile, quote) {
  const section = quoteSection(profile, quote);
  if (!section) throw new Error(`rest-nests: quote is not in the ${profile.id} profile: "${quote.slice(0, 90)}…"`);
  return section;
}

export function buildRestNests(profiles, doc, rules) {
  if (!doc) return null;
  const verdicts = doc.verdicts || [];
  const known = new Set(verdicts.map(verdict => verdict.id));
  const ruleText = new Map((rules?.sections || []).flatMap(section => section.rules.map(rule => [rule.number, rule.text])));
  const generalRules = (doc.rules || []).map(rule => {
    if (!ruleText.has(rule.number)) throw new Error(`rest-nests: server rule ${rule.number} does not exist`);
    return { number: rule.number, de: rule.de, text: ruleText.get(rule.number) };
  });
  const rows = profiles.map(profile => {
    const family = profile.variant?.parentId || profile.id;
    const entry = doc.playables?.[profile.id] || doc.playables?.[family];
    if (!entry) throw new Error(`rest-nests: ${profile.id} has no curated entry`);
    if (!known.has(entry.verdict)) throw new Error(`rest-nests: ${profile.id} has unknown verdict ${entry.verdict}`);
    if (!entry.quotes?.length) throw new Error(`rest-nests: ${profile.id} needs at least one profile quote`);
    return {
      id: profile.id, name: profile.name, family,
      variant: profile.variant ? { label: profile.variant.label, de: profile.variant.de } : null,
      tier: profile.classification?.tier || null, diet: profile.classification?.diet || null,
      habitat: profile.classification?.habitat || null, activity: profile.classification?.activity || null,
      verdict: entry.verdict, life: entry.life, where: entry.where, hint: entry.hint,
      quotes: entry.quotes.map(text => ({ text, section: locate(profile, text) })),
    };
  });
  const counts = Object.fromEntries(verdicts.map(verdict => [verdict.id, rows.filter(row => row.verdict === verdict.id).length]));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note: 'Rule 9.8 allows a resting nest for every playable; the verdict says how well it fits the profile, which overrides server rules (1.1). Every verdict cites verbatim profile quotes.',
    verdicts: verdicts.map(verdict => ({ ...verdict, count: counts[verdict.id] })),
    rules: generalRules,
    playables: rows,
  };
}
