// Discord forum export of the Aquatic Update staging profiles: one forum post per profile, as a
// numbered sequence of text messages and image files, with a status message on top that says how
// ready the profile is and how much it changes the profile live today.
//
// Readiness starts at 100 % and loses points for every open point the staging file still notes
// (%% note) and for every image that is still missing. Change degree compares the staging text
// line by line with the imported live profile (data/raw/<id>/profile.txt).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DISCORD_LIMIT, parseStagingFile, splitMessage } from './staging.js';

export const DEFAULT_WEIGHTS = { decision: 8, optional: 3, ingame: 5, proposal: 3, titlecard: 10, dimorphism: 5, map: 10 };

// ---------- open points ----------

// What a staging note asks for. Notes that only explain a choice ("Folge für den Archiv-Tab",
// "Angepasst an …") cost nothing.
export function classifyNote(text) {
  if (/entscheid|widerspruch/i.test(text)) return 'decision';
  if (/im Spiel|im Mod nach/i.test(text)) return 'ingame';
  if (/^Offen\s*\(optional\)/i.test(text)) return 'optional';
  if (/^Offen\b/i.test(text)) return 'decision';
  if (/ist ein Vorschlag/i.test(text)) return 'proposal';
  return 'info';
}

export const NOTE_LABELS = { decision: 'offene Entscheidung', optional: 'optionale Frage', ingame: 'im Spiel prüfen', proposal: 'Vorschlagswert', info: 'Hinweis' };

// ---------- images ----------

// Width and height from a PNG header.
export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(12) !== 0x49484452) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// The uploads of an imported profile, sorted by shape: the shared base map is 948×874 (also as a
// larger export of the same ratio), dimorphism examples are wide strips, title cards ~1.6:1.
export function sortRawImages(images) {
  const roles = { map: null, dimorphism: null, titlecard: [] };
  for (const image of images) {
    if (!image.size) continue;
    const ratio = image.size.width / image.size.height;
    if (Math.abs(ratio - 948 / 874) < 0.02) roles.map ??= image.file;
    else if (ratio > 2) roles.dimorphism ??= image.file;
    else roles.titlecard.push(image.file);
  }
  return roles;
}

// Finds the file behind every image of a staging thread. status: ready (a finished file made for
// the update), live (the image of today's profile still fits) or pending (no image yet).
export function resolveImages(thread, { rawImages = null, stagingDir, rawDir, mapStatus = null }) {
  const raw = rawImages ? sortRawImages(rawImages) : { map: null, dimorphism: null, titlecard: [] };
  const rawPath = file => (file ? join(rawDir, thread.id, file) : null);
  return thread.messages.map(message => {
    if (message.type === 'titlecard') {
      const file = thread.cover ? join(rawDir, thread.cover) : null;
      return { role: 'titlecard', caption: `${thread.card}: ${thread.title}`, file, status: file ? 'live' : 'pending' };
    }
    if (message.type !== 'image') return null;
    if (message.src) return { role: /^Preferred POIs/i.test(message.caption) ? 'map' : 'image', caption: message.caption, file: join(stagingDir, message.src), status: 'ready' };
    if (/^Dimorphism/i.test(message.caption)) {
      const file = thread.kind === 'changed' ? rawPath(raw.dimorphism) : null;
      return { role: 'dimorphism', caption: message.caption, file, status: file ? 'live' : 'pending' };
    }
    if (/^Preferred POIs/i.test(message.caption)) {
      const usable = (mapStatus ?? (thread.kind === 'changed' ? 'live' : 'pending')) !== 'pending';
      const file = usable ? rawPath(raw.map) : null;
      return { role: 'map', caption: message.caption, file, status: file ? 'live' : 'pending' };
    }
    return { role: 'image', caption: message.caption, file: null, status: 'pending' };
  });
}

// ---------- change degree ----------

const normalize = line => line.replace(/\{\+\}\s*$/, '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9%]+/g, ' ').trim();
const words = line => line.split(' ').filter(Boolean);
// Only lines with some substance count; this drops Discord chrome such as "Bild", "OP" or "— 04:14".
const meaningful = text => text.split(/\r?\n/).map(normalize).filter(line => words(line).length >= 3);

function similarity(a, b) {
  if (a === b) return 1;
  const left = new Set(words(a)), right = new Set(words(b));
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

// Share of text in `lines` that has no close counterpart in `against`, weighted by length: a line
// found word for word counts 0, one with half its words changed counts half.
function unmatchedShare(lines, against) {
  let total = 0, unmatched = 0;
  for (const line of lines) {
    let best = 0;
    for (const other of against) { const value = similarity(line, other); if (value > best) best = value; if (best === 1) break; }
    total += line.length;
    unmatched += line.length * (1 - best);
  }
  return { total, unmatched };
}

export function changeLabel(percent) {
  if (percent >= 60) return 'neu aufgebaut';
  if (percent >= 30) return 'stark geändert';
  if (percent >= 10) return 'mittel geändert';
  return 'leicht geändert';
}

// Compares the Discord text of a staging thread with the live profile text. Without a live
// profile the playable is new to the server and counts as 100 % new.
export function changeDegree(thread, liveText) {
  if (!liveText) return { percent: 100, rewritten: 100, removed: null, growth: null, label: 'neue Art', newSpecies: true };
  const next = meaningful(thread.messages.filter(message => message.type === 'text').map(message => message.copy).join('\n'));
  const live = meaningful(liveText);
  const added = unmatchedShare(next, live);
  const dropped = unmatchedShare(live, next);
  const percent = Math.round(100 * (added.unmatched + dropped.unmatched) / (added.total + dropped.unmatched));
  return {
    percent,
    rewritten: Math.round(100 * added.unmatched / added.total),
    removed: Math.round(100 * dropped.unmatched / dropped.total),
    growth: Math.round(100 * added.total / dropped.total) / 100,
    label: changeLabel(percent),
    newSpecies: false,
  };
}

// ---------- readiness ----------

export function readiness(thread, images, { weights = DEFAULT_WEIGHTS, override = null } = {}) {
  const deductions = [];
  for (const text of thread.notes) {
    const kind = classifyNote(text);
    if (kind !== 'info' && weights[kind]) deductions.push({ kind, label: NOTE_LABELS[kind], text, points: weights[kind] });
  }
  for (const image of images.filter(Boolean)) {
    if (image.status !== 'pending') continue;
    deductions.push({ kind: 'image', role: image.role, label: `Bild fehlt: ${IMAGE_LABELS[image.role] || 'Bild'}`, text: image.caption, points: weights[image.role] ?? 0 });
  }
  const computed = Math.max(0, 100 - deductions.reduce((sum, entry) => sum + entry.points, 0));
  return { percent: Number.isFinite(override) ? override : computed, computed, manual: Number.isFinite(override), deductions };
}

export const IMAGE_LABELS = { titlecard: 'Titelkarte', dimorphism: 'Dimorphismus-Beispiele', map: 'Preferred-POIs-Karte', image: 'Bild' };
const IMAGE_LABELS_EN = { titlecard: 'title card', dimorphism: 'dimorphism examples', map: 'Preferred POIs map', image: 'image' };

// ---------- forum post ----------

const bar = percent => '▰'.repeat(Math.round(percent / 10)) + '▱'.repeat(10 - Math.round(percent / 10));
const CHANGE_EN = { 'neue Art': 'new species', 'neu aufgebaut': 'rebuilt', 'stark geändert': 'major changes', 'mittel geändert': 'moderate changes', 'leicht geändert': 'minor changes' };

export function forumTitle(thread, ready) {
  const name = thread.nickname ? `${thread.name} „${thread.nickname}“` : thread.name;
  return `${name} · ${ready.percent} % ready`.slice(0, 100);
}

// The first message of the forum post: what the thread is and where it stands, in English like
// the profile itself.
export function statusMessage(thread, ready, change) {
  const counts = {};
  for (const entry of ready.deductions) counts[entry.kind] = (counts[entry.kind] || 0) + 1;
  const open = [
    counts.decision && `${counts.decision} open decision${counts.decision > 1 ? 's' : ''}`,
    counts.optional && `${counts.optional} optional question${counts.optional > 1 ? 's' : ''}`,
    counts.ingame && `${counts.ingame} in-game check${counts.ingame > 1 ? 's' : ''}`,
    counts.proposal && `${counts.proposal} proposed value${counts.proposal > 1 ? 's' : ''}`,
  ].filter(Boolean);
  const missingImages = ready.deductions.filter(entry => entry.kind === 'image').map(entry => IMAGE_LABELS_EN[entry.role] || 'image');
  const changeLine = change.newSpecies
    ? '**Change:** new species, 100 % new profile'
    : `**Change:** ${change.percent} % · ${CHANGE_EN[change.label]} (${change.rewritten} % of the text new or rewritten, ${change.removed} % of today's text removed)`;
  return [
    `# ${thread.name}`,
    `**${thread.classification || thread.card}** · Aquatic Update draft · ${thread.kind === 'changed' ? 'changed profile' : 'new profile'}`,
    '',
    `**Ready:** ${ready.percent} % ${bar(ready.percent)}`,
    changeLine,
    `**Open:** ${open.length ? open.join(', ') : 'nothing'}`,
    `**Images missing:** ${missingImages.length ? missingImages.join(', ') : 'none'}`,
    '',
    '-# Draft for the Aquatic Update suggestion. Not live on the server.',
  ].join('\n');
}

// The posting order after the status message: text messages and image files. Banners become a
// heading on top of the next text message, a missing image becomes an italic placeholder line
// there; the Quick Links message is left out, since its message links only exist once posted.
// Neighbouring text is merged as long as it stays under Discord's limit.
export function forumSequence(thread, images) {
  const steps = [];
  let carry = [];
  const pushText = lines => {
    const all = [...carry, ...lines];
    carry = [];
    for (const part of splitMessage(all, DISCORD_LIMIT)) {
      const text = part.join('\n').replace(/^\n+|\n+$/g, '');
      if (text) steps.push({ type: 'text', text });
    }
  };
  thread.messages.forEach((message, index) => {
    if (message.type === 'banner') carry.push(`# ${message.title}`);
    else if (message.type === 'text') pushText(message.copy.split('\n'));
    else if (message.type === 'titlecard' || message.type === 'image') {
      const image = images[index];
      if (image?.file) {
        if (carry.length) pushText([]);
        steps.push({ type: 'image', role: image.role, caption: image.caption, file: image.file, status: image.status });
      } else carry.push(`*🖼 Image pending: ${image?.caption || message.caption}*`);
    }
  });
  if (carry.length) pushText([]);
  return steps;
}

// ---------- loading ----------

export async function loadForumConfig(stagingDir) {
  const path = join(stagingDir, 'forum.json');
  const config = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : {};
  return { maps: config.maps || {}, ready: config.ready || {}, weights: { ...DEFAULT_WEIGHTS, ...(config.weights || {}) } };
}

async function rawProfile(rawDir, id) {
  const dir = join(rawDir, id);
  if (!existsSync(join(dir, 'manifest.json'))) return null;
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const text = await readFile(join(dir, manifest.profileFile || 'profile.txt'), 'utf8');
  const images = await Promise.all((manifest.images || []).map(async image => {
    const buffer = await readFile(join(dir, image.file)).catch(() => null);
    return { file: image.file, size: buffer ? pngSize(buffer) : null };
  }));
  return { text, images };
}

// Everything the export needs for one staging thread.
export async function buildForumPost(thread, { stagingDir, rawDir, config }) {
  const raw = await rawProfile(rawDir, thread.id);
  const images = resolveImages(thread, { rawImages: raw?.images, stagingDir, rawDir, mapStatus: config.maps[thread.id] ?? null });
  const ready = readiness(thread, images, { weights: config.weights, override: config.ready[thread.id] });
  const change = changeDegree(thread, raw?.text ?? null);
  const status = statusMessage(thread, ready, change);
  return { id: thread.id, name: thread.name, order: thread.order, kind: thread.kind, title: forumTitle(thread, ready), status, ready, change, images: images.filter(Boolean), steps: forumSequence(thread, images), raster: thread.raster };
}

// ---------- ecosystem guide ----------

// The guide that opens the forum (staging/guide/ecosystem.md): same format as a profile, but text
// only and without a status message, since it is no profile.
export const GUIDE_FILE = join('guide', 'ecosystem.md');

export async function buildGuidePost(stagingDir) {
  const path = join(stagingDir, GUIDE_FILE);
  if (!existsSync(path)) return null;
  const thread = parseStagingFile('ecosystem-guide', await readFile(path, 'utf8'));
  const steps = forumSequence(thread, thread.messages.map(() => null));
  return { id: thread.id, name: thread.name, title: `Aquatic Update · ${thread.name}`, steps };
}
