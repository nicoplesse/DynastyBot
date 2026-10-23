// Builds the reference files of the two Claude skills in .claude/skills/ from data/processed/:
//   dino         – questions about one playable (profile, rules, play guide, map, matchups)
//   dino-finder  – which playable fits a wish, for a solo player who plays animal-like
// SKILL.md files are hand-written and left alone; only each skill's references/ folder is
// regenerated. Every skill is also packed as dist/skills/<name>.zip for upload to claude.ai.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../', import.meta.url));
const processed = join(root, 'data', 'processed');
const skillsDir = join(root, '.claude', 'skills');
const distDir = join(root, 'dist', 'skills');

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

const DE = {
  activity: { Nocturnal: 'nachtaktiv', Diurnal: 'tagaktiv', Cathemeral: 'tag- & nachtaktiv', Crepuscular: 'dämmerungsaktiv' },
  habitat: { Terrestrial: 'Land', Aquatic: 'Wasser', 'Semi-Aquatic': 'Land & Wasser', Aerial: 'Luft', 'Terrestrial & Semi-Aquatic': 'Land (teils Wasser)' },
  diet: { Carnivore: 'Fleisch', Herbivore: 'Pflanzen', Omnivore: 'Allesfresser', Piscivore: 'Fisch' },
  solo: { solo: 'Solo spielbar', 'solo-possible': 'Solo eingeschränkt', group: 'Gruppentier' },
  role: { territory: 'Revier', hunting: 'Jagd', nesting: 'Nisten', courtship: 'Balz', migration: 'Wanderung', neutral: 'Neutral', basking: 'Sonnen', resting: 'Rast' },
  band: { severe: 'sehr hoch', high: 'hoch', meaningful: 'spürbar', moderate: 'mäßig', low: 'gering' },
};
const de = (table, value) => DE[table][value] ?? (value?.includes(' & ') ? value.split(' & ').map(v => DE[table][v] ?? v).join(' & ') : value) ?? '–';
const cell = text => String(text ?? '–').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const words = text => String(text).split(/\s+/).filter(Boolean).length;

function blockText(block) {
  if (block.type === 'list') return block.items.map(item => `- ${item}`).join('\n');
  return block.text ?? '';
}

function adultStat(profile, key) {
  const curve = profile.fullStats?.curves?.find(c => c.key === key);
  return curve ? curve.effectiveValues.at(-1) : null;
}

function speedLine(speed) {
  if (!speed) return 'unbekannt';
  const mode = (label, m) => m && `${label} Sprint ${m.sprint ?? '?'}${m.sprintDurationSeconds ? ` (${Math.round(m.sprintDurationSeconds)} s)` : ''}`;
  return [mode('Land', speed.land), mode('Wasser', speed.water), mode('Luft', speed.air)].filter(Boolean).join(' · ') || 'unbekannt';
}

function poiLines(profile) {
  const markers = profile.map?.markers ?? [];
  if (!markers.length) return ['Keine Karte hinterlegt.'];
  // Group POIs by their exact role set so a POI appears once: "Revier + Jagd + Nisten: …".
  const byRoles = new Map();
  for (const marker of markers) {
    const key = (marker.roles?.length ? marker.roles : ['sonstiges']).map(role => de('role', role)).join(' + ');
    if (!byRoles.has(key)) byRoles.set(key, []);
    byRoles.get(key).push(marker);
  }
  const lines = [...byRoles].map(([roles, list]) => `- **${roles}:** ${list.map(m => m.name).join(', ')}`);
  const details = markers.filter(m => m.note || m.prey?.length || m.season || m.variant || m.claimable != null);
  for (const m of details) {
    const bits = [m.variant && `Variante ${m.variant}`, m.season && `Saison ${m.season}`, m.claimable === false && 'nicht beanspruchbar', m.territoryTier && `Revier-Tier ${m.territoryTier}`, m.prey?.length && `Beute: ${m.prey.join(', ')}`, m.note].filter(Boolean);
    if (bits.length) lines.push(`  - ${m.name}: ${bits.join(' · ')}`);
  }
  for (const route of profile.map?.routes ?? []) lines.push(`- **Route ${route.name}:** ${route.waypoints.map(w => w.name).join(' → ')}${route.note ? ` (${route.note})` : ''}`);
  if (profile.map.provisional) lines.unshift(`> **Vorläufige Karte:** Das Profil nennt die Karte nur vorübergehend („${profile.map.provisional.quote}“), Dynasty hat eine überarbeitete Karte angekündigt. Die POIs folgen bis zum Profil-Update der alten Karte und können sich noch ändern.`, '');
  return lines;
}

function matchupLine(m) {
  return `- **${m.name}** (${de('band', m.band)}): ${m.headline}`;
}

function analogLines(analog) {
  if (!analog) return ['Kein Tier-Analog hinterlegt.'];
  const lines = [`**${analog.labelDe} (${analog.label})**: ${analog.headline}`, '', analog.playsLike];
  lines.push('', ...analog.analogs.map(a => `- ${a.de} / ${a.animal} – ${a.share} %: ${a.covers}`));
  if (analog.setting?.note) lines.push(`- Lebensraum: ${analog.setting.label}. ${analog.setting.note}`);
  if (analog.notLike?.length) lines.push(`- Anders als die Tiere: ${analog.notLike.join(' ')}`);
  if (analog.twist) lines.push(`- Besonderheit: ${analog.twist}`);
  return lines;
}

// Solo or group (modes.json): whether the real animal changes with the way you play.
function modeLines(profile) {
  const modes = profile.modes;
  if (!modes) return [];
  const verdict = { same: 'Gleiches Tier', rebalanced: 'Anders gewichtet', different: 'Anderes Tier' }[modes.verdict];
  const lines = ['## Solo oder Gruppe', '', `**${verdict}:** ${modes.note}`];
  if (modes.changes) {
    const own = modes[modes.changes];
    lines.push('', `**${modes.changes === 'solo' ? 'Solo' : 'In der Gruppe'} spielt er sich wie:**`, ...analogLines(own.analog));
    if (own.summary) lines.push('', own.summary);
    lines.push('', `Das Tier oben unter „Spielt sich wie“ gilt ${modes.changes === 'solo' ? 'in der Gruppe' : 'solo'}.`);
  }
  return [...lines, ''];
}

function playstyleLines(profile) {
  const ps = profile.playstyle;
  if (!ps) return ['Kein Spielleitfaden hinterlegt.'];
  return [
    `**Solo-Eignung: ${de('solo', ps.solo.fit)}** – ${ps.solo.note}`, '',
    ps.summary, '',
    ...ps.parts.flatMap(part => [`### ${part.title}${part.fixed ? ' (läuft wie im Profil)' : ''}`, part.text, '']),
  ];
}

function header(profile) {
  const c = profile.classification;
  const t = profile.matchups?.traits ?? {};
  const eco = profile.ecosystem;
  return [
    `# ${profile.name} – Steckbrief`, '',
    `- **Aliase:** ${profile.aliases?.length ? profile.aliases.join(', ') : '–'}`,
    profile.variant && `- **Variante:** ${profile.variant.de ?? profile.variant.label} „${profile.variant.title}“ des ${profile.variant.parentName}-Profils (gemeinsamer offizieller Text; eigene POIs, Tiere, Leitfaden und Matchups). Gegenstück: ${profile.variant.siblings.map(s => `${s.name} (\`${s.id}\`)`).join(', ')}. ${profile.variant.note}`,
    `- **Klasse:** ${c.label} (Tier ${c.tier}, ${de('activity', c.activity)}, ${de('habitat', c.habitat)}, ${de('diet', c.diet)})`,
    eco && `- **Ökosystem:** ${eco.de} (${eco.label}); Nahrungskette: ${eco.foodChain.de} (Stufe ${eco.foodChain.level} von 7)${eco.also?.length ? `; auch: ${eco.also.map(a => a.de ?? a.label ?? a).join(', ')}` : ''}`,
    `- **Werte (adult, Dynasty):** Kampfgewicht ${profile.stats.combatWeight ?? '?'}, Leben ${adultStat(profile, 'Core.MaxHealth') ?? '?'}, Ausdauer ${adultStat(profile, 'Core.MaxStamina') ?? '?'}, Wachstum ${profile.stats.growthMinutes ?? '?'} min`,
    `- **Tempo:** ${speedLine(profile.speed)}`,
    `- **Jagd & Kampf:** jagt bis ${t.huntTier ?? '–'}; Jagdgruppe max ${t.huntGroupUnlimited ? 'unbegrenzt' : t.huntGroupSize || '–'}; Kampf max ${t.engagementUnlimited ? 'unbegrenzt' : t.engagementLimit ?? '–'} (Gruppengröße: siehe Quick View)${t.tags?.length ? `; Stil: ${t.tags.join(', ')}` : ''}`,
    `- **Solo-Eignung:** ${profile.playstyle ? de('solo', profile.playstyle.solo.fit) : '–'}`,
  ].filter(Boolean);
}

function card(profile, { sectionFiles, forFinder }) {
  const m = profile.matchups ?? { threats: [], opportunities: [], specialRisks: [] };
  const lines = [
    ...header(profile), '',
    `Kurzbeschreibung (offiziell): ${profile.summary}`, '',
    '## Quick View (offiziell)', '', ...profile.quickView.map(q => `- ${q}`), '',
    `## Spielleitfaden „So spielst du ${profile.name}“ (persönlich, nicht offiziell – das Profil gilt immer)`, '', ...playstyleLines(profile),
    '## Spielt sich wie (echte Tiere)', '', ...analogLines(profile.analog), '',
    ...modeLines(profile),
    '## Karte & POIs', '', ...poiLines(profile), '',
    '## Matchups (Auszug)', '',
    '**Gefährlich für dich:**', ...(m.threats.slice(0, 6).map(matchupLine)), '',
    '**Beute & Chancen:**', ...(m.opportunities.slice(0, 6).map(matchupLine)), '',
    ...(m.specialRisks?.length ? ['**Besondere Risiken:**', ...m.specialRisks.map(r => `- ${r.title}: ${r.summary}`), ''] : []),
  ];
  if (!forFinder) {
    lines.push('Alle Matchups mit Tempo- und Kampfvergleich: `matchups.md`. Alle Werte je Wachstumsstufe: `stats.md`.', '');
    lines.push('## Dynasty-Anpassungen', '', ...(profile.stats.changes?.length ? profile.stats.changes.map(c => `- ${c.text}`) : ['- keine']), '');
    lines.push('## Profilabschnitte (volle offizielle Texte in `sections/`)', '', '| Datei | Abschnitt | Wörter |', '|---|---|---|');
    for (const s of sectionFiles) lines.push(`| sections/${s.file} | ${cell(s.title)} | ${s.words} |`);
    lines.push('');
  } else {
    lines.push('Für Detailfragen (Regeln, Jagd, Nisten, volle Profiltexte) ist der Skill `/dino` zuständig.', '');
  }
  return lines.join('\n');
}

function statsFile(profile) {
  const fs = profile.fullStats;
  const lines = [`# ${profile.name} – Werte je Wachstumsstufe`, '', 'Stufen: Hatchling, Juvenile, Adolescent, Sub-Adult, Adult. „Dynasty“ = nach Server-Anpassung, „Basis“ = Alderon-Standard (Quelle: ' + (fs?.baseline?.url ?? '–') + ').', ''];
  if (!fs?.curves?.length) return [...lines, 'Keine Werte hinterlegt.'].join('\n');
  for (const group of [...new Set(fs.curves.map(c => c.group))]) {
    lines.push(`## ${group}`, '', '| Wert | Dynasty (5 Stufen) | Basis Adult |', '|---|---|---|');
    for (const c of fs.curves.filter(c => c.group === group)) {
      const base = c.baseValues.at(-1) === c.effectiveValues.at(-1) ? '=' : c.baseValues.at(-1);
      lines.push(`| ${c.key} | ${c.effectiveValues.join(' / ')} | ${base} |`);
    }
    lines.push('');
  }
  if (fs.unmappedChanges?.length) lines.push('## Nicht zugeordnete Anpassungen', '', ...fs.unmappedChanges.map(c => `- ${c.text ?? c}`), '');
  return lines.join('\n');
}

function matchupsFile(profile) {
  const m = profile.matchups;
  if (!m) return `# ${profile.name} – Matchups\n\nKeine Daten.`;
  const entry = x => [`### ${x.name} – ${de('band', x.band)} (${x.kind})`, x.headline, '', x.summary, x.chase?.label ? `- Verfolgung: ${x.chase.label}` : null, x.fight?.verdict ? `- Kampf (du solo gegen ihre volle legale Gruppe): ${x.fight.label} (Kampfgewicht ${x.fight.attackerCombatWeight} vs ${x.fight.targetCombatWeight})` : null,
    x.fight?.legal ? `- Kampf (beide Seiten legal max): ${x.fight.legal.label}` : null,
    x.fight?.duel?.attackerHit ? `- Treffer 1 gegen 1 (Schaden × CW-Verhältnis ÷ Armor): ${x.fight.duel.attackerHit} pro Haupttreffer vom Angreifer (${x.fight.duel.attackerHitsToKill} bis zum Kill), ${x.fight.duel.defenderHit} zurück (${x.fight.duel.defenderHitsToKill} bis zum Kill)` : null, x.intent?.reason ? `- Profilbezug: ${x.intent.reason}` : null, ''].filter(v => v !== null);
  return [`# ${profile.name} – Matchups`, '', m.summary, '', '## Gefahren (wer dir gefährlich wird)', '', ...m.threats.flatMap(entry), '## Chancen (wen du jagen/schlagen kannst)', '', ...m.opportunities.flatMap(entry),
    ...(m.specialRisks?.length ? ['## Besondere Risiken', '', ...m.specialRisks.map(r => `- **${r.title}:** ${r.summary}`)] : []),
    '', `_Methode: ${m.methodology ? Object.values(m.methodology).join(' ') : 'Kampfgewicht, Tempo, Gruppengrößen und Profilregeln.'}_`].join('\n');
}

function slug(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}

async function writeProfileFiles(dir, profile) {
  const sectionFiles = [];
  await mkdir(join(dir, 'sections'), { recursive: true });
  for (const [index, section] of profile.sections.entries()) {
    const file = `${String(index + 1).padStart(2, '0')}-${section.id}.md`;
    const text = section.blocks.map(blockText).join('\n\n');
    await writeFile(join(dir, 'sections', file), `# ${profile.name} – ${section.title}\n\n${text}\n`);
    sectionFiles.push({ file, title: section.title, words: words(text) });
  }
  await writeFile(join(dir, 'card.md'), card(profile, { sectionFiles }));
  await writeFile(join(dir, 'stats.md'), statsFile(profile));
  await writeFile(join(dir, 'matchups.md'), matchupsFile(profile));
}

function lookupTable(profiles) {
  const lines = ['# Dino-Verzeichnis', '', 'Suche den Dino über Name, Alias oder Tier-Analog. Pfad: `references/dinos/<id>/card.md`.', '', '| id | Name | Aliase | Klasse | Spielt sich wie |', '|---|---|---|---|---|'];
  for (const p of profiles) lines.push(`| ${p.id} | ${p.name} | ${cell(p.aliases?.join(', ') || '–')} | ${p.classification.label} | ${cell(p.analog ? `${p.analog.labelDe} (${p.analog.label})` : '–')} |`);
  return lines.join('\n') + '\n';
}

async function writeRules(dir, rules) {
  await mkdir(dir, { recursive: true });
  const index = ['# Server-Regeln (Dynasty Realism) – Übersicht', '', 'Profilregeln haben Vorrang vor Server-Regeln, wenn sie sich widersprechen.', '', '| Datei | Abschnitt | Regeln |', '|---|---|---|', '| rules/00-introduction.md | Einleitung (Körperlängen, Grundsätze) | – |'];
  await writeFile(join(dir, '00-introduction.md'), `# ${rules.title} – Einleitung\n\n${rules.introduction.map(blockText).join('\n\n')}\n`);
  for (const section of rules.sections) {
    const file = `${String(section.number).padStart(2, '0')}-${slug(section.title)}.md`;
    const body = section.rules.map(rule => `**${rule.number}** ${rule.text}`).join('\n\n');
    await writeFile(join(dir, file), `# ${section.number}. ${section.title}\n\n${body}\n`);
    index.push(`| rules/${file} | ${section.number}. ${section.title} | ${section.rules.length} |`);
  }
  await writeFile(join(dir, 'README.md'), index.join('\n') + '\n');
}

function firstSentence(text, max = 170) {
  const sentence = String(text).split(/(?<=[.!?])\s/)[0];
  return sentence.length > max ? sentence.slice(0, max - 1).replace(/\s+\S*$/, '') + ' …' : sentence;
}

function catalog(profiles, analogs) {
  const lines = ['# Dino-Katalog für die Auswahl', '',
    `Alle ${profiles.length} Playables in einer Zeile. Spalten: Tier = Spielgröße (Tiny < Small < Medium < Large < Apex); Aktiv = Tageszeit; Raum = Land/Wasser/Luft; Solo = Solo-Eignung laut Spielleitfaden; Jagdgruppe = max. Tiere in einer Jagd (Gruppengröße steht im Steckbrief); Jagt bis = höchste erlaubte Beute-Stufe. Steckbrief: \`references/dinos/<id>.md\`.`, '',
    '| id | Name | Tier | Kost | Aktiv | Raum | Ökosystem | Solo | Jagdgruppe | Jagt bis | Spielt sich wie (solo) | Kurz |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const p of profiles) {
    const c = p.classification;
    const t = p.matchups?.traits ?? {};
    lines.push(`| ${p.id} | ${p.name} | ${c.tier} | ${de('diet', c.diet)} | ${de('activity', c.activity)} | ${de('habitat', c.habitat)} | ${p.ecosystem?.de ?? '–'} | ${p.playstyle ? de('solo', p.playstyle.solo.fit) : '–'} | ${c.diet === 'Herbivore' ? '–' : t.huntGroupUnlimited ? 'unbegrenzt' : t.huntGroupSize || '–'} | ${c.diet === 'Herbivore' ? '–' : t.huntTier ?? '–'} | ${cell((p.modes?.solo.analog ?? p.analog)?.analogs.map(a => `${a.de} ${a.share}%`).join(' + '))} | ${cell(firstSentence(p.modes?.solo.summary ?? p.playstyle?.summary ?? p.summary))} |`);
  }
  const bySolo = fit => profiles.filter(p => p.playstyle?.solo.fit === fit).map(p => p.name).join(', ');
  lines.push('', '## Nach Solo-Eignung', '', `- **Solo spielbar:** ${bySolo('solo')}`, `- **Solo eingeschränkt:** ${bySolo('solo-possible')}`, `- **Gruppentier:** ${bySolo('group')}`);
  const names = ids => ids.map(id => profiles.find(p => p.id === id)?.name ?? id).join(', ');
  if (analogs?.archetypes) {
    lines.push('', '## Tiertypen → Playables', '', 'Für grobe Wünsche wie „irgendwas Katzenhaftes“ oder „wie ein Wolf“ (Anteil am Analog in %).', '');
    for (const type of Object.values(analogs.archetypes)) lines.push(`- ${type.de} / ${type.label}: ${type.dinos.map(d => `${d.name} (${d.animal} ${d.share}%)`).join(', ')}`);
  }
  if (analogs?.moods) {
    lines.push('', '## Spielstil-Merkmale → Playables', '');
    for (const mood of Object.values(analogs.moods)) lines.push(`- ${mood.de} / ${mood.label}: ${names(mood.dinoIds)}`);
  }
  lines.push('', 'Konkrete Tierarten (z. B. Orca, Uhu, Komodowaran) stehen in `animals.md`.');
  return lines.join('\n') + '\n';
}

function animalsFile(profiles, analogs) {
  const lines = ['# Echte Tiere → Playables', '', 'Für Wünsche wie „ich will wie ein Orca spielen“. Primäre Analogien zuerst. Fehlt ein Tier, nimm den passenden Tiertyp aus `catalog.md`.', ''];
  if (analogs?.animals) {
    for (const [id, animal] of Object.entries(analogs.animals)) {
      const names = (animal.dinoIds ?? animal.dinos ?? []).map(d => profiles.find(p => p.id === (d.id ?? d))?.name ?? d.id ?? d);
      if (names.length) lines.push(`- ${animal.de ?? id} / ${animal.label ?? animal.animal ?? id}: ${names.join(', ')}`);
    }
  }
  return lines.join('\n') + '\n';
}

function ecosystemsFile(ecosystems) {
  const lines = ['# Ökosysteme & Nahrungsketten', '', 'Pro Ökosystem die Playables, die dort zu Hause sind, von der Spitze der Nahrungskette (Stufe 1) bis zur kleinsten Beute (Stufe 7).', ''];
  for (const eco of ecosystems.ecosystems) {
    lines.push(`## ${eco.de} (${eco.label})`, '', eco.description, '', ...eco.foodChain.map(e => `${e.rank}. ${e.name} – Stufe ${e.level}, ${e.tier}, ${de('diet', e.diet)}, Kampfgewicht ${e.combatWeight}`));
    if (eco.visitors?.length) lines.push('', `Besucher: ${eco.visitors.map(v => v.name).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Migration routes (same data as the website's route map): every named route with its POIs,
// which POIs follow each other and who walks it; then per POI who passes there.
function routesFile(index, regionName) {
  const usage = { full: 'ganze Route', partial: 'nur ein Teilstück', profile: 'laut Profiltext' };
  const lines = ['# Migrationsrouten', '', 'Aus den Profilkarten nachgezeichnet (weiße bzw. rosa Routenlinien). Wandern ist nur in den aktiven Stunden erlaubt (Regel 1.4). Die Reihenfolge der POIs steht unter „Verbindungen“: dort geht die Route von einem POI direkt in den nächsten über.', ''];
  for (const route of index.routes) {
    lines.push(`## ${route.de} (${route.name})`, '', route.note, '');
    lines.push(`- **Wer:** ${route.members.map(m => `${m.name} (${usage[m.usage]}${m.note ? `: ${m.note}` : ''})`).join(', ')}`);
    lines.push(`- **POIs:** ${route.regions.map(regionName).join(', ')}${route.landmarks.length ? `; vorbei an ${route.landmarks.map(regionName).join(', ')}` : ''}`);
    lines.push(`- **Verbindungen:** ${route.links.map(([a, b]) => `${regionName(a)} ↔ ${regionName(b)}`).join('; ')}`);
    for (const m of route.members.filter(m => m.usage === 'partial')) lines.push(`- **${m.name} nur durch:** ${m.regions.map(regionName).join(', ')}`);
    lines.push('');
  }
  lines.push('## Wer zieht wo durch (pro POI)', '');
  for (const poi of Object.values(index.pois).filter(p => !p.landmark).sort((a, b) => b.routes.length - a.routes.length)) {
    lines.push(`- **${poi.name}** – ${poi.routes.length} Route(n): ${poi.playables.map(id => index.playables[id]?.name || id).join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

// Clamp overview (same data as the website's clamp table): per clamper the heaviest clampable
// combat weight and, grouped by stage, how far up each playable can still be clamped.
function clampsFile(index) {
  const short = ['Hatchling', 'Juvenile', 'Adolescent', 'Sub-Adult', 'Adult'];
  const reach = (capacity, weights) => {
    const fits = weights.map(weight => capacity > 0 && weight < capacity);
    return { max: fits.lastIndexOf(true), gaps: fits.slice(0, Math.max(fits.lastIndexOf(true), 0)).flatMap((fit, i) => fit ? [] : [short[i]]) };
  };
  const lines = ['# Clamp-Tabelle', '', 'Wer wen clampen (packen) kann, und bis zu welcher Entwicklungsstufe der Beute. Regel: Beute passt, solange ihr Kampfgewicht unter der Tragkraft (Carry Capacity) des Clampers liegt. Dynasty schreibt das als „Clamp Weight: Up to X“ (= Tragkraft X + 1). Profil-Anpassungen sind eingerechnet. Ob die Beute auch gejagt werden darf, regelt das Profil.', ''];
  for (const clamper of index.clampers) {
    const columns = [{ label: '', bonus: 0 }, ...clamper.buffs.map(buff => ({ label: ` mit ${buff.label}`, bonus: buff.bonus }))];
    for (const { label, bonus } of columns) {
      lines.push(`## ${clamper.name}${label} (${clamper.ability === 'grab' ? 'Grab' : 'Clamp'})`, '');
      lines.push(`Clamp-Grenze je eigener Stufe (max. Kampfgewicht der Beute): ${clamper.capacity.map((cap, i) => `${short[i]} ${cap > 0 ? cap - 1 + bonus : '–'}`).join(' · ')}`);
      if (clamper.adjustments.length) lines.push(`Dynasty-Anpassung: ${clamper.adjustments.join('; ')}`);
      for (const note of clamper.notes) lines.push(`- ${note}`);
      const capacity = clamper.capacity.at(-1) + bonus;
      lines.push('', `Als Adult (bis ${capacity - 1} CW):`);
      for (const max of [4, 3, 2, 1, 0, -1]) {
        const members = index.prey.map(prey => ({ prey, ...reach(capacity, prey.combatWeight) })).filter(item => item.max === max);
        if (!members.length) continue;
        const title = max === 4 ? 'Bis Adult (alle Stufen)' : max < 0 ? 'Gar nicht' : `Bis ${short[max]}`;
        lines.push(`- **${title}:** ${members.sort((a, b) => max < 0 ? a.prey.name.localeCompare(b.prey.name) : b.prey.combatWeight[max] - a.prey.combatWeight[max]).map(item => max < 0 ? item.prey.name : `${item.prey.name} ${item.prey.combatWeight[max]}${item.gaps.length ? ` (außer ${item.gaps.join(', ')})` : ''}`).join(', ')}`);
      }
      lines.push('');
    }
  }
  lines.push('## Kampfgewicht aller Playables je Stufe', '', '| Playable | Hatchling | Juvenile | Adolescent | Sub-Adult | Adult |', '|---|---|---|---|---|---|');
  for (const prey of index.prey) lines.push(`| ${prey.name} | ${prey.combatWeight.join(' | ')} |`);
  return lines.join('\n') + '\n';
}

// Minimal ZIP writer (deflate), so packaging needs no extra dependency.
async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path));
    else out.push(path);
  }
  return out.sort();
}

async function zipDir(dir, prefix, target) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const file of await listFiles(dir)) {
    const name = Buffer.from(`${prefix}/${relative(dir, file).split(sep).join('/')}`, 'utf8');
    const data = await readFile(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x5b21, 12); // fixed timestamp keeps builds reproducible
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0x5b21, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centrals.length / 2, 8); end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.concat([...locals, ...centrals, end]));
}

export async function buildSkills() {
  const index = await readJson(join(processed, 'index.json'));
  const profiles = [];
  for (const { id } of index.profiles) profiles.push(await readJson(join(processed, 'profiles', `${id}.json`)));
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  const rules = await readJson(join(processed, 'rules.json'));
  const analogs = await readJson(join(processed, 'analogs.json'));
  const ecosystems = await readJson(join(processed, 'ecosystems.json'));
  const clamps = await readJson(join(processed, 'clamps.json'));
  const migration = await readJson(join(processed, 'migration.json'));
  const world = await readJson(join(processed, 'map.json'));
  const regionNames = new Map(world.regions.map(region => [region.id, region.name]));

  const dinoRefs = join(skillsDir, 'dino', 'references');
  await rm(dinoRefs, { recursive: true, force: true });
  await mkdir(dinoRefs, { recursive: true });
  await writeFile(join(dinoRefs, 'dinos.md'), lookupTable(profiles));
  await writeFile(join(dinoRefs, 'clamps.md'), clampsFile(clamps));
  await writeFile(join(dinoRefs, 'routes.md'), routesFile(migration, id => regionNames.get(id) || id));
  await writeRules(join(dinoRefs, 'rules'), rules);
  for (const profile of profiles) await writeProfileFiles(join(dinoRefs, 'dinos', profile.id), profile);

  const finderRefs = join(skillsDir, 'dino-finder', 'references');
  await rm(finderRefs, { recursive: true, force: true });
  await mkdir(join(finderRefs, 'dinos'), { recursive: true });
  await writeFile(join(finderRefs, 'catalog.md'), catalog(profiles, analogs));
  await writeFile(join(finderRefs, 'ecosystems.md'), ecosystemsFile(ecosystems));
  await writeFile(join(finderRefs, 'animals.md'), animalsFile(profiles, analogs));
  for (const profile of profiles) await writeFile(join(finderRefs, 'dinos', `${profile.id}.md`), card(profile, { forFinder: true }));

  for (const name of ['dino', 'dino-finder']) await zipDir(join(skillsDir, name), name, join(distDir, `${name}.zip`));
  return { profiles: profiles.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { profiles } = await buildSkills();
  console.log(`Built skills dino and dino-finder for ${profiles} playables → .claude/skills/, dist/skills/*.zip`);
}
