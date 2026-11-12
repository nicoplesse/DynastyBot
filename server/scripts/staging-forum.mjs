// Exports every Aquatic Update staging profile as a ready-to-post Discord forum post.
//
//   npm run staging:forum -w server
//
// Writes projects/aquatic-update/forum/ (not versioned, rebuilt on every run):
//   README.md                Overview: readiness, change degree and open points per profile
//   01-kaiwhekea/
//     00-post.txt            Post title, tags and the first message (status) of the forum post
//     01.txt, 02-titlecard.png, 03.txt …   the rest of the post, in posting order
// Each .txt is one Discord message (at most 2000 characters); each image is uploaded on its own.
// Readiness weights, map status and manual overrides live in staging/forum.json.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCORD_LIMIT, defaultStagingDir, loadStaging } from '../src/staging.js';
import { buildForumPost, loadForumConfig, NOTE_LABELS } from '../src/forum.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const rawDir = join(root, 'data', 'raw');
const outDir = join(root, 'projects', 'aquatic-update', 'forum');
const MARKER = '.generated';
const UPLOAD_LIMIT = 10 * 1024 * 1024; // Discord's upload limit without Nitro

if (existsSync(outDir)) {
  if (!existsSync(join(outDir, MARKER))) throw new Error(`${outDir} exists but was not made by this script; not touching it.`);
  await rm(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, MARKER), 'Made by npm run staging:forum -w server. Rebuilt on every run.\n');

const config = await loadForumConfig(defaultStagingDir);
const threads = await loadStaging(defaultStagingDir);
const pad = number => String(number).padStart(2, '0');
const posts = [];
const warnings = [];

for (const thread of threads) {
  const post = await buildForumPost(thread, { stagingDir: defaultStagingDir, rawDir, config });
  const dir = join(outDir, `${pad(post.order)}-${post.id}`);
  await mkdir(dir);
  const tags = [post.kind === 'changed' ? 'Changed profile' : 'New profile', post.ready.percent >= 90 ? 'Ready' : post.ready.percent >= 70 ? 'Almost ready' : 'Work in progress'];
  await writeFile(join(dir, '00-post.txt'), [
    `TITEL: ${post.title}`,
    `TAGS:  ${tags.join(', ')}`,
    '',
    '----- erste Nachricht (unter dem Titel einfügen) -----',
    post.status,
    '',
  ].join('\n'));
  if (post.status.length > DISCORD_LIMIT) warnings.push(`${post.name}: Status-Nachricht über ${DISCORD_LIMIT} Zeichen`);
  let index = 0;
  for (const step of post.steps) {
    index += 1;
    if (step.type === 'text') {
      if (step.text.length > DISCORD_LIMIT) warnings.push(`${post.name} ${pad(index)}.txt: ${step.text.length} Zeichen`);
      await writeFile(join(dir, `${pad(index)}.txt`), `${step.text}\n`);
    } else {
      const target = join(dir, `${pad(index)}-${step.role}${extname(step.file)}`);
      await copyFile(step.file, target);
      const { size } = await stat(target);
      if (size > UPLOAD_LIMIT) warnings.push(`${post.name} ${pad(index)}-${step.role}: ${(size / 1048576).toFixed(1)} MB, über Discords 10-MB-Grenze ohne Nitro`);
    }
  }
  posts.push({ ...post, dir: `${pad(post.order)}-${post.id}`, messages: post.steps.filter(step => step.type === 'text').length + 1, uploads: post.steps.filter(step => step.type === 'image').length });
}

const changeText = change => change.newSpecies ? '100 % (neue Art)' : `${change.percent} % (${change.label})`;
const lines = [
  '# Aquatic Update: Forum-Posts',
  '',
  `Erzeugt am ${new Date().toISOString().slice(0, 10)} mit \`npm run staging:forum -w server\` aus \`staging/\`. Der Ordner wird bei jedem Lauf neu gebaut, Änderungen hier gehen verloren.`,
  '',
  '## So postest du',
  '',
  '1. Im Forum einen neuen Post anlegen. Titel und Tags stehen oben in `00-post.txt`, darunter die erste Nachricht (Status).',
  '2. Dann die Dateien im Ordner der Reihe nach in den Post: `.txt` öffnen, alles kopieren, einfügen und senden; `.png` in Discord ziehen und senden.',
  '3. Die Banner der Original-Profile sind Bilder, die es hier nicht gibt. Sie stehen als `# Überschrift` oben in der nächsten Nachricht. Fehlende Bilder stehen als kursive Zeile „Image pending“ im Text. Die Quick Links fehlen, weil die Nachrichten-Links erst nach dem Posten existieren.',
  '',
  '## Übersicht',
  '',
  '| Profil | Art | Ready | Änderungsgrad | Nachrichten | Bilder |',
  '| --- | --- | --- | --- | --- | --- |',
  ...posts.map(post => `| [${post.name}](${post.dir}/) | ${post.kind === 'changed' ? 'geändert' : 'neu'} | ${post.ready.percent} %${post.ready.manual ? ' (von Hand)' : ''} | ${changeText(post.change)} | ${post.messages} | ${post.uploads} |`),
  '',
  '## So wird gerechnet',
  '',
  `**Ready** startet bei 100 % und zieht ab: je offene Entscheidung ${config.weights.decision}, je Prüfung im Spiel ${config.weights.ingame}, je optionale Frage ${config.weights.optional}, je Vorschlagswert ${config.weights.proposal}, fehlende Titelkarte ${config.weights.titlecard}, fehlende Karte ${config.weights.map}, fehlende Dimorphismus-Beispiele ${config.weights.dimorphism} Punkte. Gezählt werden die \`%% note\`-Zeilen der Staging-Dateien; reine Hinweise kosten nichts. Gewichte, Kartenstand und feste Werte stehen in \`staging/forum.json\`.`,
  '',
  '**Änderungsgrad** vergleicht den Discord-Text Zeile für Zeile mit dem heutigen Profil (`data/raw/<id>/profile.txt`): Anteil neuer oder umgeschriebener Wörter plus gestrichener alter Text. Unter 10 % leicht, ab 10 % mittel, ab 30 % stark, ab 60 % neu aufgebaut. Arten ohne heutiges Profil zählen als 100 %.',
  '',
  '## Offene Punkte je Profil',
  '',
];
for (const post of posts) {
  lines.push(`### ${post.name}: ${post.ready.percent} %`, '');
  if (!post.change.newSpecies) lines.push(`Änderungsgrad ${post.change.percent} %: ${post.change.rewritten} % des Texts neu oder umgeschrieben, ${post.change.removed} % des heutigen Texts gestrichen, Länge ×${post.change.growth}.`, '');
  if (!post.ready.deductions.length) lines.push('Nichts offen.', '');
  for (const entry of post.ready.deductions) lines.push(`- **−${entry.points}** ${entry.kind === 'image' ? entry.label : NOTE_LABELS[entry.kind]}: ${entry.text}`);
  if (post.raster.missing.length) lines.push(`- Nicht im Raster (ohne Abzug): ${post.raster.missing.join(', ')}`);
  lines.push('');
}
if (warnings.length) lines.push('## Warnungen', '', ...warnings.map(warning => `- ${warning}`), '');
await writeFile(join(outDir, 'README.md'), lines.join('\n'));

console.log(`Forum-Posts geschrieben: ${outDir}`);
for (const post of posts) console.log(`  ${post.dir.padEnd(18)} ready ${String(post.ready.percent).padStart(3)} %  Änderung ${changeText(post.change).padEnd(24)} ${post.messages} Nachrichten, ${post.uploads} Bilder`);
for (const warning of warnings) console.warn(`  ! ${warning}`);
