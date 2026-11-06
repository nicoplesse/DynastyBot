// Aquatic Update staging: every profile of the suggestion as it would be posted in the Dynasty
// Discord forum, in English only. One file per profile in projects/aquatic-update/staging/.
//
// A staging file is the Discord text itself plus a few directive lines that stand for what the
// forum shows besides text:
//   ---                      front matter (name, title, order, kind, card, difficulty, cover)
//   %% titlecard             the profile's title card image
//   %% banner <Section>      a section banner image (starts a new message)
//   %% image <caption>       any other image (dimorphism examples, the POI map)
//   %% post                  a new message group with the author line, as after a time gap
//   %% quicklinks            the closing Quick Links message, built from the banners
//   %% note <text>           a staging-only note for the author, never part of the Discord text
// A line ending in {+} differs from the profile live today (only marked in changed profiles).
// Text is cut into messages of at most 2000 characters, Discord's limit per message.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultStagingDir = fileURLToPath(new URL('../../projects/aquatic-update/staging/', import.meta.url));
export const DISCORD_LIMIT = 2000;
const CHANGED = /\s*\{\+\}\s*$/;

export function slug(text) {
  return text.toLowerCase().replace(/✦/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Front matter: "key: value" lines between two "---" lines at the top of the file.
export function parseFrontMatter(text) {
  const source = text.replace(/\r\n/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: source };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (pair) meta[pair[1]] = pair[2].trim();
  }
  return { meta, body: source.slice(match[0].length) };
}

// The Discord text of a message: change markers removed, surrounding blank lines trimmed.
const discordText = lines => lines.map(line => line.replace(CHANGED, '')).join('\n').replace(/^\n+|\n+$/g, '');

// Cuts one run of text into messages of at most `limit` characters. Breaks prefer the line
// before a heading, then a blank line, then any line; a single over-long line stays whole.
export function splitMessage(lines, limit = DISCORD_LIMIT) {
  const parts = [];
  let current = [];
  const length = candidate => discordText(candidate).length;
  for (const line of lines) {
    if (current.length && length([...current, line]) > limit) {
      let cut = -1;
      for (let index = current.length - 1; index > 0; index -= 1) {
        if (/^#{1,3}\s/.test(current[index])) { cut = index; break; }
      }
      if (cut < 0) for (let index = current.length - 1; index > 0; index -= 1) if (!current[index].trim()) { cut = index; break; }
      if (cut < 0 || length(current.slice(0, cut)) < limit / 3) cut = current.length;
      parts.push(current.slice(0, cut));
      current = current.slice(cut);
    }
    current.push(line);
  }
  if (current.some(line => line.trim())) parts.push(current);
  return parts.filter(part => part.some(line => line.trim()));
}

const textMessage = (lines, header) => {
  const text = lines.join('\n').replace(/^\n+|\n+$/g, '');
  const copy = discordText(lines);
  return { type: 'text', header, text, copy, chars: copy.length, changed: lines.some(line => CHANGED.test(line)) };
};

// Headings inside the text: "## Genetics" (level 2) and "### ✦ Courtship" (level 3). The "# Name"
// that opens the thread is not a section.
function headings(text) {
  return text.split('\n').flatMap(line => {
    const match = line.replace(CHANGED, '').match(/^(#{2,3})\s+(.*)$/);
    if (!match) return [];
    const title = match[2].replace(/\*\*/g, '').replace(/^✦\s*/, '').trim();
    return [{ level: match[1].length, title, id: slug(title) }];
  });
}

export function parseThread(body) {
  const messages = [];
  const notes = [];
  let buffer = [];
  let header = true;
  const flush = () => {
    for (const part of splitMessage(buffer)) {
      messages.push(textMessage(part, header));
      header = false;
    }
    buffer = [];
  };
  const push = message => { flush(); messages.push({ ...message, header }); header = false; };
  for (const line of body.split('\n')) {
    const directive = line.match(/^%%\s*(\w+)\s*(.*)$/);
    if (!directive) { buffer.push(line); continue; }
    const [, name, rest] = directive;
    if (name === 'post') { flush(); header = true; }
    else if (name === 'banner') push({ type: 'banner', title: rest.trim(), id: slug(rest) });
    else if (name === 'image') push({ type: 'image', caption: rest.trim() });
    else if (name === 'titlecard') push({ type: 'titlecard' });
    else if (name === 'quicklinks') push({ type: 'quicklinks' });
    else if (name === 'note') { flush(); messages.push({ type: 'note', text: rest.trim(), header: false }); notes.push(rest.trim()); }
    else throw new Error(`Staging: unknown directive "%% ${name}"`);
  }
  flush();
  // Outline: banners as chapters, headings inside them as sections.
  const outline = [];
  for (const message of messages) {
    if (message.type === 'banner') outline.push({ level: 1, title: message.title, id: message.id });
    if (message.type === 'text') outline.push(...headings(message.text));
  }
  const links = messages.filter(message => message.type === 'banner' && message.id !== 'overview').map(message => ({ title: message.title, id: message.id }));
  return { messages, outline, links, notes };
}

// The grid every Dynasty profile follows (Tylosaurus, Parasaurolophus, Leedsichthys 2025/26).
export const RASTER = [
  { group: 'Overview', label: 'Overview', kind: 'banner', any: ['Overview'] },
  { group: 'Overview', label: 'Genetics', kind: 'heading', any: ['Genetics'] },
  { group: 'Overview', label: 'Group Limits (In-Game Group)', kind: 'heading', any: ['Group Limits (In-Game Group)'] },
  { group: 'Overview', label: 'Engagement Limits (Defence & Hunts)', kind: 'heading', any: ['Engagement Limits (Defence & Hunts)'] },
  { group: 'Overview', label: 'Preferred Prey / Diet', kind: 'heading', any: ['Preferred Prey', 'Preferred Diet'] },
  { group: 'Overview', label: 'Nesting Limits', kind: 'heading', any: ['Nesting Limits'] },
  { group: 'Overview', label: 'Physical Dimorphism', kind: 'heading', any: ['Physical Dimorphism'] },
  { group: 'Banner', label: 'Growing Up', kind: 'banner', any: ['Growing Up'] },
  { group: 'Banner', label: 'General Behavior', kind: 'banner', any: ['General Behavior'] },
  { group: 'Banner', label: 'Social Interaction', kind: 'banner', any: ['Social Interaction'] },
  { group: 'Banner', label: 'Aggressive Interaction', kind: 'banner', any: ['Aggressive Interaction'] },
  { group: 'Banner', label: 'Cross-Species Interaction', kind: 'banner', any: ['Cross-Species Interaction'] },
  { group: 'Banner', label: 'Hunting Strategy / Predator Reaction', kind: 'banner', any: ['Hunting Strategy', 'Predator Reaction'] },
  { group: 'Banner', label: 'Courtship & Parenthood', kind: 'banner', any: ['Courtship & Parenthood'] },
  { group: 'Banner', label: 'Elderly', kind: 'banner', any: ['Elderly'] },
  { group: 'Banner', label: 'Profile Notes', kind: 'banner', any: ['Profile Notes'] },
  { group: 'Banner', label: 'Rules & Clarifications', kind: 'banner', any: ['Rules & Clarifications'] },
  { group: '✦', label: 'Offspring Behavior (Nested)', kind: 'heading', any: ['Offspring Behavior (Nested)'] },
  { group: '✦', label: 'Orphaned Behavior (Wild Spawn)', kind: 'heading', any: ['Orphaned Behavior (Wild Spawn)'] },
  { group: '✦', label: 'Downtime Behavior', kind: 'heading', any: ['Downtime Behavior'] },
  { group: '✦', label: 'Courtship', kind: 'heading', any: ['Courtship'] },
  { group: '✦', label: 'Nesting', kind: 'heading', any: ['Nesting'] },
  { group: '✦', label: 'Parenthood', kind: 'heading', any: ['Parenthood'] },
  { group: '✦', label: 'Offspring Maturity', kind: 'heading', any: ['Offspring Maturity'] },
  { group: '✦', label: 'Adoption', kind: 'heading', any: ['Adoption'] },
  { group: '✦', label: 'Death', kind: 'heading', any: ['Death'] },
  { group: 'Ende', label: 'Rule Exemptions', kind: 'heading', any: ['RULE EXEMPTIONS', 'Rule Exemptions'] },
  { group: 'Ende', label: 'Preferred POIs', kind: 'heading', any: ['Preferred POIs'] },
  { group: 'Ende', label: 'Profile - Quick View', kind: 'heading', any: ['Profile - Quick View'] },
  { group: 'Ende', label: 'Dynasty Adjusted Stats', kind: 'heading', any: ['Dynasty Adjusted Stats'] },
  { group: 'Ende', label: 'Quick Links', kind: 'quicklinks', any: ['Quick Links'] },
];

// Checks a thread against the grid: which parts exist, and whether the banners keep their order.
export function checkRaster(thread) {
  const banners = thread.messages.filter(message => message.type === 'banner').map(message => message.title.toLowerCase());
  const titles = new Set(thread.outline.filter(entry => entry.level > 1).map(entry => entry.title.toLowerCase()));
  const hasQuickLinks = thread.messages.some(message => message.type === 'quicklinks');
  const items = RASTER.map(item => {
    const names = item.any.map(name => name.toLowerCase());
    const found = item.kind === 'banner' ? names.find(name => banners.includes(name))
      : item.kind === 'quicklinks' ? (hasQuickLinks ? 'quick links' : undefined)
        : names.find(name => titles.has(name));
    return { group: item.group, label: item.label, ok: Boolean(found) };
  });
  const order = RASTER.filter(item => item.kind === 'banner')
    .map(item => banners.findIndex(name => item.any.map(entry => entry.toLowerCase()).includes(name)))
    .filter(index => index >= 0);
  const inOrder = order.every((value, index) => index === 0 || value > order[index - 1]);
  return { items, inOrder, missing: items.filter(item => !item.ok).map(item => item.label) };
}

// The classification is the first bold line under the Overview banner, as in every profile.
function classification(messages) {
  const start = messages.findIndex(message => message.type === 'banner' && message.id === 'overview');
  const next = messages.slice(start + 1).find(message => message.type === 'text');
  return next?.text.match(/^\*\*(.+?)\*\*/m)?.[1].trim() ?? null;
}

export function parseStagingFile(id, text) {
  const { meta, body } = parseFrontMatter(text);
  const thread = parseThread(body);
  const difficulty = Number.parseInt(meta.difficulty, 10);
  return {
    id,
    name: meta.name || id,
    title: meta.title || (meta.name || id).toUpperCase(),
    nickname: meta.nickname || null,
    order: Number.parseInt(meta.order, 10) || 99,
    kind: meta.kind === 'changed' ? 'changed' : 'new',
    card: meta.card || 'Profile',
    difficulty: Number.isFinite(difficulty) ? Math.min(5, Math.max(1, difficulty)) : null,
    difficultyLabel: meta.difficulty?.replace(/^\d+\s*/, '') || null,
    cover: meta.cover || null,
    source: meta.source || null,
    classification: classification(thread.messages),
    ...thread,
    chars: thread.messages.reduce((sum, message) => sum + (message.chars || 0), 0),
    textMessages: thread.messages.filter(message => message.type === 'text').length,
    overLimit: thread.messages.filter(message => message.chars > DISCORD_LIMIT).length,
    raster: checkRaster(thread),
  };
}

export async function loadStaging(stagingDir = defaultStagingDir) {
  const files = (await readdir(stagingDir)).filter(file => file.endsWith('.md') && file !== 'README.md');
  const threads = await Promise.all(files.map(async file => ({
    ...parseStagingFile(file.replace(/\.md$/, ''), await readFile(join(stagingDir, file), 'utf8')),
    updatedAt: (await stat(join(stagingDir, file))).mtime.toISOString(),
  })));
  return threads.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function stagingSummary(thread) {
  const { messages: _messages, outline: _outline, links: _links, ...summary } = thread;
  return { ...summary, raster: { inOrder: thread.raster.inOrder, missing: thread.raster.missing } };
}
