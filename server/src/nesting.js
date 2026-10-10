// Nesting posts for Discord, used by the /nesting skill through server/scripts/nesting.mjs.
// The layout lives in .claude/skills/nesting/template.md (a small Mustache subset), the
// channel ids and house rules in .claude/skills/nesting/config.json. This module
// gathers profile and "My Dinos" facts (info) and fills the template from a payload (render).
import { herdSlug } from './herd.js';

const pick = (value) => (typeof value === 'string' ? value.trim() : '');
const listOf = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(pick).filter(Boolean);

// Discord markdown would turn names like "Raiden_Gaming_1123" into italics. A single "|"
// (as in "Name | 123-456-789") is harmless; only "||" starts a spoiler.
export function escapeDiscord(value) {
  return String(value ?? '').replace(/([\\*_~`])/g, '\\$1').replace(/\|\|/g, '\\|\\|');
}

// {{path}}, {{#path}}…{{/path}} (list or truthy), {{^path}}…{{/path}} (falsy), {{! comment}}.
// Lines holding only a section tag or a comment disappear completely, like in Mustache.
export function fillTemplate(template, view) {
  const source = template
    .replace(/\{\{![\s\S]*?\}\}[ \t]*\r?\n?/g, '')
    .replace(/^[ \t]*(\{\{[#^/][^}]*\}\})[ \t]*\r?\n/gm, '$1');
  const lookup = (stack, path) => {
    if (path === '.') return stack[stack.length - 1];
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      let value = stack[index];
      let found = true;
      for (const key of path.split('.')) {
        if (value !== null && typeof value === 'object' && key in value) value = value[key];
        else { found = false; break; }
      }
      if (found) return value;
    }
    return undefined;
  };
  const truthy = (value) => (Array.isArray(value) ? value.length > 0 : !!value);
  const render = (text, stack) => {
    let output = '';
    let rest = text;
    const open = /\{\{([#^]?)\s*([\w.]+)\s*\}\}/;
    for (let match = rest.match(open); match; match = rest.match(open)) {
      output += rest.slice(0, match.index);
      rest = rest.slice(match.index + match[0].length);
      const [, kind, path] = match;
      if (!kind) {
        const value = lookup(stack, path);
        output += value === undefined || value === null || value === false ? '' : String(value);
        continue;
      }
      const close = `{{/${path}}}`;
      let depth = 1;
      let cursor = 0;
      let end = -1;
      const tags = new RegExp(`\\{\\{([#^/])\\s*${path.replace(/\./g, '\\.')}\\s*\\}\\}`, 'g');
      for (let tag = tags.exec(rest); tag; tag = tags.exec(rest)) {
        depth += tag[1] === '/' ? -1 : 1;
        if (depth === 0) { end = tag.index; cursor = tag.index + tag[0].length; break; }
      }
      if (end < 0) throw new Error(`Template: ${close} is missing.`);
      const inner = rest.slice(0, end);
      rest = rest.slice(cursor);
      const value = lookup(stack, path);
      if (kind === '^') { if (!truthy(value)) output += render(inner, stack); continue; }
      if (Array.isArray(value)) output += value.map(item => render(inner, [...stack, item])).join('');
      else if (value) output += render(inner, typeof value === 'object' ? [...stack, value] : stack);
    }
    return output + rest;
  };
  return render(source, [view])
    .split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionText(profile, id) {
  const section = profile.sections?.find(item => item.id === id);
  if (!section) return '';
  return section.blocks.map(block => block.text || (block.items || []).join(' ')).filter(Boolean).join(' ').trim();
}

const extraPatterns = {
  subspecies: /subspec|unterart/i,
  eyes: /eye|auge/i,
  colours: /colou?r|farbe|pigment/i,
};

function extraValue(dino, field) {
  return pick(dino.genetics?.extra?.find(item => extraPatterns[field].test(item.label))?.value);
}

// A parent block prefilled from "My Dinos"; the skill asks for whatever lands in missing.
export function parentFromHerd(dino, owner = {}) {
  const genetics = dino.genetics || {};
  const parent = {
    name: dino.name,
    player: pick(owner.player),
    discordId: pick(owner.discordId),
    dominant: listOf(genetics.skins?.dominant),
    recessive: listOf(genetics.skins?.recessive),
    subspecies: extraValue(dino, 'subspecies'),
    eyes: extraValue(dino, 'eyes'),
    colours: extraValue(dino, 'colours'),
    bloodline: listOf(genetics.bloodlines).join(', '),
    mutations: (genetics.mutations || []).map(item => ({ name: item.name, proof: pick(dino.proofs?.mutation) })),
  };
  const missing = ['dominant', 'subspecies', 'eyes'].filter(key => !(Array.isArray(parent[key]) ? parent[key].length : parent[key]));
  return { role: dino.sex === 'female' ? 'mother' : dino.sex === 'male' ? 'father' : null, parent, missing };
}

export function resolvePlayable(term, profiles) {
  const slug = herdSlug(term);
  if (!slug) return [];
  const exact = profiles.filter(profile => profile.id === slug || herdSlug(profile.name) === slug);
  if (exact.length) return exact;
  const alias = profiles.filter(profile => (profile.aliases || []).some(name => herdSlug(name) === slug));
  if (alias.length) return alias;
  return profiles.filter(profile => profile.id.startsWith(slug) || herdSlug(profile.name).startsWith(slug));
}

// Everything the skill needs to write the species part of a post, straight from the profile.
export function speciesFacts(profile) {
  const nesting = sectionText(profile, 'nesting-limits');
  return {
    id: profile.id,
    name: profile.name,
    classification: profile.classification?.label || '',
    playsLike: profile.analog?.label || '',
    tagline: profile.analog?.headline || '',
    nestingLimits: nesting,
    rollEggs: /\/rolleggs|must roll for the number/i.test(nesting),
    mutationSkins: sectionText(profile, 'genetics'),
    dimorphism: sectionText(profile, 'physical-dimorphism'),
    offspring: (sectionText(profile, 'offspring-behavior-nested') || sectionText(profile, 'offspring-behavior')).slice(0, 900),
    nestingSection: sectionText(profile, 'nesting').slice(0, 900),
  };
}

const seasons = {
  dry: { icon: '☀️', label: 'Dry Season' },
  rainy: { icon: '🌧️', label: 'Rainy Season' },
};

function mention(id, fallback) {
  return /^\d{15,21}$/.test(pick(id)) ? `<@${pick(id)}>` : escapeDiscord(fallback);
}

function channel(id, fallback) {
  return /^\d{15,21}$/.test(pick(id)) ? `<#${pick(id)}>` : fallback;
}

// "M", "male", "boar" … become ♂ so egg claims read like the parent headers.
function sexSymbol(value) {
  const sex = pick(value);
  if (/^(m|male|man|männlich|boar|stag|buck|bull|sire|♂)$/i.test(sex)) return '♂';
  if (/^(f|w|female|weiblich|sow|doe|hen|cow|dam|♀)$/i.test(sex)) return '♀';
  return escapeDiscord(sex);
}

function joinSkins(value) {
  const items = listOf(value);
  return items.length ? items.map(escapeDiscord).join(', ') : '';
}

function parentView(parent, role) {
  const mutations = (parent.mutations || [])
    .map(item => (typeof item === 'string' ? { name: item } : item))
    .filter(item => pick(item.name))
    .map(item => (pick(item.proof) ? `[${escapeDiscord(item.name)}](<${pick(item.proof)}>)` : escapeDiscord(item.name)));
  const player = pick(parent.player);
  const details = [
    ['SS', escapeDiscord(pick(parent.subspecies))],
    ['EC', escapeDiscord(pick(parent.eyes))],
    ['Colours', escapeDiscord(pick(parent.colours))],
    ['Bloodline', escapeDiscord(pick(parent.bloodline))],
    ['M', mutations.join(', ')],
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));
  return {
    role: role === 'mother' ? 'Mother' : 'Father',
    icon: role === 'mother' ? '♀' : '♂',
    name: escapeDiscord(pick(parent.name) || 'TBA'),
    player: pick(parent.discordId) ? `<@${pick(parent.discordId)}>${player ? ` · ${escapeDiscord(player)}` : ''}` : escapeDiscord(player),
    dominant: joinSkins(parent.dominant) || 'Default',
    recessive: joinSkins(parent.recessive) || 'none',
    details,
  };
}

export function buildView(payload, { profile, config = {}, now = Date.now() }) {
  const facts = profile ? speciesFacts(profile) : { name: payload.species || 'Dino' };
  const warnings = [];
  const season = seasons[payload.season] || null;
  if (!season) warnings.push('season fehlt (dry oder rainy).');
  const eggs = Number.parseInt(payload.eggs, 10);
  if (!(eggs > 0)) warnings.push('eggs fehlt oder ist 0.');
  if (facts.rollEggs && !pick(payload.eggRoll)) warnings.push(`${facts.name} muss die Eier mit /rolleggs würfeln, und der Roll-Link gehört in den Post.`);
  for (const role of ['mother', 'father']) {
    if (!pick(payload[role]?.name)) warnings.push(`${role}: Name fehlt.`);
    if (!pick(payload[role]?.player) && !pick(payload[role]?.discordId)) warnings.push(`${role}: Spieler (@Name | ID) fehlt.`);
  }
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const slots = Array.from({ length: Math.max(eggs || 0, claims.length) }, (_, index) => {
    const claim = claims[index];
    const taken = claim && (pick(claim.player) || pick(claim.discordId) || pick(claim.name));
    return {
      n: index + 1,
      taken: taken ? {
        who: mention(claim.discordId, pick(claim.player)),
        name: escapeDiscord(pick(claim.name)),
        sex: sexSymbol(claim.sex),
      } : null,
    };
  });
  const postedAt = Number.isFinite(Date.parse(payload.postedAt)) ? Date.parse(payload.postedAt) : now;
  const expiresAt = Math.round(postedAt / 1000) + 60 * (Number(config.expiresMinutes) || 30);
  const channels = config.channels || {};
  const profileChannel = config.profileChannels?.[profile?.id];
  const vars = {
    species: escapeDiscord(facts.name),
    profile: profileChannel ? `<#${profileChannel}>` : `**${escapeDiscord(facts.name)}**`,
    geneticsRolls: channel(channels.geneticsRolls, '#genetics-rolls'),
    nestingChat: channel(channels.nestingChat, '#nesting-chat'),
  };
  const fill = (text) => String(text).replace(/\{(\w+)\}/g, (all, key) => (key in vars ? vars[key] : all));
  const rules = [...listOf(config.houseRules), ...listOf(payload.rules)].map(fill);
  return {
    view: {
      ...vars,
      seasonIcon: season?.icon || '🥚',
      seasonLabel: season?.label || 'Season',
      clutch: Number.parseInt(payload.clutch, 10) || null,
      eggs: eggs || 0,
      eggWord: eggs === 1 ? 'egg' : 'eggs',
      claimed: slots.filter(slot => slot.taken).length,
      full: eggs > 0 && slots.filter(slot => slot.taken).length >= eggs,
      slots,
      eggRoll: pick(payload.eggRoll) ? `<${pick(payload.eggRoll)}>` : '',
      tagline: escapeDiscord(pick(payload.tagline) || facts.tagline || ''),
      note: pick(payload.note),
      speciesNote: pick(payload.speciesNote),
      parents: [parentView(payload.mother || {}, 'mother'), parentView(payload.father || {}, 'father')],
      rules,
      expires: `<t:${expiresAt}:R>`,
      expiresAt: `<t:${expiresAt}:t>`,
      ping: /^\d{15,21}$/.test(pick(config.nestingRoleId)) ? `<@&${pick(config.nestingRoleId)}>` : '@Nesting',
    },
    warnings,
    postedAt: new Date(postedAt).toISOString(),
  };
}

export function renderPost(template, payload, options) {
  const { view, warnings, postedAt } = buildView(payload, options);
  const post = fillTemplate(template, view);
  const max = Number(options.config?.maxLength) || 2000;
  if (post.length > max) warnings.push(`Post hat ${post.length} Zeichen, Discord erlaubt ${max} (ohne Nitro). Kürzen: speciesNote, note oder Regeln.`);
  if (!/^\d{15,21}$/.test(pick(options.config?.nestingRoleId))) warnings.push('nestingRoleId fehlt in config.json: "@Nesting" pingt nur, wenn du die Rolle beim Einfügen neu auswählst.');
  return { post, length: post.length, warnings, postedAt };
}
