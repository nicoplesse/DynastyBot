import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { combineStats } from './stats-model.js';
import { buildMatchups } from './matchups.js';
import { attachAnalogRelatives, buildAnalogIndex, resolveAnalog } from './analogs.js';
import { buildEcosystemIndex, resolveEcosystem } from './ecosystems.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const defaultRawDir = join(projectRoot, 'data', 'raw');
const defaultProcessedDir = join(projectRoot, 'data', 'processed');

const youtubePattern = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})[^\s<>]*/g;
const sectionNames = new Map([
  ['overview', 'Overview'], ['genetics', 'Genetics'], ['group limits (in-game group)', 'Group Limits'],
  ['group limit', 'Group Limits'], ['group limits', 'Group Limits'],
  ['engagement limits (defence & hunts)', 'Engagement Limits'], ['engagement limits (defense & hunts)', 'Engagement Limits'],
  ['engagement limit', 'Engagement Limits'], ['engagement limits', 'Engagement Limits'],
  ['growing up', 'Growing Up'], ['general behavior', 'General Behavior'], ['general behaviour', 'General Behavior'],
  ['social interaction', 'Social Interaction'], ['social behavior', 'Social Behavior'], ['social behaviour', 'Social Behavior'],
  ['aggressive interaction', 'Aggressive Interaction'], ['cross-species interaction', 'Cross-Species Interaction'],
  ['aggressive behavior', 'Aggressive Behavior'], ['aggressive behaviour', 'Aggressive Behavior'],
  ['interspecies behavior', 'Interspecies Behavior'], ['interspecies behaviour', 'Interspecies Behavior'],
  ['predator reaction', 'Predator Reaction'], ['hunting strategy', 'Hunting Strategy'],
  ['courtship & parenthood', 'Courtship & Parenthood'], ['courtship and parenthood', 'Courtship & Parenthood'],
  ['courting & nesting behavior', 'Courtship & Nesting'], ['courtship & nesting behavior', 'Courtship & Nesting'],
  ['offspring behavior', 'Offspring Behavior'], ['orphaned behavior', 'Orphaned Behavior'],
  ['elderly', 'Elderly & Death'], ['preferred pois', 'Preferred POIs'], ['preferred poi', 'Preferred POIs'],
  ['preferred prey/diet', 'Preferred Prey & Diet'], ['nesting limits', 'Nesting Limits'],
  ['dimorphism', 'Dimorphism'], ['physical dimorphism', 'Physical Dimorphism'], ['notes', 'Notes'],
  ['resource map', 'Resource Map'], ['terminology', 'Terminology'], ['rule exemptions', 'Rule Exemptions'],
  ['dimorphism examples', 'Dimorphism Examples'], ['blight examples', 'Blight Examples'],
  ['profile specific unique feature', 'Profile Specific Feature'],
]);

const ruleTitles = {
  1: 'Creature Profile Rules', 2: 'Chat Rules', 3: 'Engagement Rules', 4: 'Hunting Rules',
  5: 'Body Down Rules', 6: 'Challenges & Body Contests', 7: 'Exploiting Rules',
  8: 'General Rules', 9: 'Nesting Rules',
};

function normalizeLine(value) {
  return value.replace(/[\u2060\u2068\u2069\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').trim();
}

function isNoise(line) {
  return !line || line === 'Bild' || line === 'Details' || line === 'OP' || line === 'YouTube' ||
    line === 'Dynasty Realism' || /Rollenicon/i.test(line) ||
    /^—?\s*\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}$/.test(line) ||
    /hat den Post-Titel zu .* geändert/i.test(line) || /^image(?:-\d+)?\.(?:png|jpe?g|webp)$/i.test(line);
}

function stripLinks(line) {
  return line.replace(/https?:\/\/[^\s<>]+/g, url => {
    youtubePattern.lastIndex = 0;
    return youtubePattern.test(url) ? url : '';
  }).trim();
}

function cleanLines(raw) {
  return raw.replace(/\r\n?/g, '\n').split('\n').map(normalizeLine).map(stripLinks);
}

function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function youtubeVideos(raw) {
  const videos = [];
  for (const match of raw.matchAll(youtubePattern)) {
    if (!videos.some(video => video.id === match[1])) videos.push({ id: match[1], url: `https://www.youtube.com/watch?v=${match[1]}` });
  }
  return videos;
}

function sectionHeading(line) {
  const withoutMarker = line.replace(/^✦\s*/, '').trim();
  const known = sectionNames.get(withoutMarker.toLowerCase());
  if (known) return known;
  if (line.startsWith('✦') && withoutMarker.length < 70) return withoutMarker;
  if (withoutMarker.length < 70 && /^[A-Z][A-Za-z0-9 &/()'’–-]+$/.test(withoutMarker) &&
    /\b(?:Behavior|Behaviour|Limits?|Interaction|Reaction|Strategy|Dimorphism|Genetics|Overview|Notes|Territories|Migration|Parenthood|Courtship|Nesting|Adoption|Infanticide|Standoffs|Sieges|Reunions|Death|Elderly)\b/i.test(withoutMarker)) return withoutMarker;
  if (/^[A-Z][A-Z &/()-]{4,50}$/.test(line)) return line.split(' ').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
  return null;
}

function blocksFromLines(lines) {
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list });
    list = [];
  };
  for (const source of lines) {
    const line = source.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return blocks;
}

function parseSections(lines) {
  const sections = [];
  let current = { id: 'profile', title: 'Profile', lines: [] };
  const push = () => {
    const blocks = blocksFromLines(current.lines);
    if (blocks.length) sections.push({ id: current.id, title: current.title, blocks });
  };
  for (const line of lines) {
    if (isNoise(line)) continue;
    const heading = sectionHeading(line);
    if (heading) {
      push();
      current = { id: slug(heading), title: heading, lines: [] };
    } else current.lines.push(line);
  }
  push();
  return sections;
}

function findLastIndex(lines, predicate) {
  for (let index = lines.length - 1; index >= 0; index--) if (predicate(lines[index])) return index;
  return -1;
}

function parseStats(lines) {
  const start = findLastIndex(lines, line => /^(Dynasty Adjusted Stats|Dynasty Adjused Stats|Dynasty Stats|Stats)$/i.test(line));
  if (start < 0) return { growthTime: null, growthMinutes: null, combatWeight: null, changes: [], sourceLabel: 'No stats section in imported profile' };
  const stop = lines.findIndex((line, index) => index > start && /^(Quick Links|Profile in Under 60 Seconds|Courtship Video|Dimorphism Examples|Preferred POIs?)$/i.test(line));
  const slice = lines.slice(start + 1, stop > start ? stop : lines.length);
  const growthIndex = slice.findIndex(line => /^Growth Time/i.test(line));
  const growthLine = growthIndex >= 0
    ? [slice[growthIndex], slice[growthIndex + 1]]
      .filter((line, index) => line && (index === 0 || !/^(Combat Weight|Adjusted Stats):/i.test(line)))
      .join(' ')
    : null;
  const combatLine = slice.find(line => /^Combat Weight:/i.test(line));
  const growthMatch = growthLine?.match(/=\s*(\d+)\s*(?:total)?/i);
  const combatMatch = combatLine?.match(/Combat Weight:\s*([\d,.]+)/i);
  const adjustedIndex = slice.findIndex(line => /^Adjusted Stats:/i.test(line));
  const changes = [];
  if (adjustedIndex >= 0) {
    const inline = slice[adjustedIndex].replace(/^Adjusted Stats:\s*/i, '').replace(/^[-*]\s*/, '').trim();
    const candidates = [inline];
    let seenChange = Boolean(inline);
    for (const line of slice.slice(adjustedIndex + 1)) {
      if (isNoise(line)) {
        if (seenChange) break;
        continue;
      }
      if (!line) { if (seenChange) break; continue; }
      if (sectionHeading(line) || /^https?:\/\//i.test(line) || /^(Table of Contents|Quick View|Quick Links|Profile in Under 60 Seconds|Dynasty Realism:)/i.test(line)) break;
      candidates.push(line);
      seenChange = true;
    }
    for (const candidate of candidates) {
      const text = candidate.replace(/^[-*•]\s*/, '').trim();
      if (!text || /^(none|no changes|to compensate:)$/i.test(text)) continue;
      const toFrom = text.match(/\bto:?\s+([\d,.]+%?)\s+from\s+([\d,.]+%?)/i);
      const fromTo = text.match(/\bfrom\s+([\d,.]+%?)\s+to:?\s+([\d,.]+%?)/i);
      const direction = /increase|improv|buff|boost|reduce.*cost|lower.*cost/i.test(text) ? 'up' : /decrease|reduc|lower|nerf/i.test(text) ? 'down' : 'changed';
      changes.push({
        text,
        current: toFrom?.[1] || fromTo?.[2] || null,
        previous: toFrom?.[2] || fromTo?.[1] || null,
        direction,
      });
    }
  }
  return {
    growthTime: growthLine?.replace(/^Growth Time:?\s*/i, '') || null,
    growthMinutes: growthMatch ? Number(growthMatch[1]) : null,
    combatWeight: combatMatch ? Number(combatMatch[1].replace(/,/g, '')) : null,
    changes,
    sourceLabel: 'Dynasty Adjusted Stats',
  };
}

function parseClassification(lines) {
  const match = lines.map(line => line.match(/^(Tiny|Small|Medium|Large|Apex|Giant)\s+(Nocturnal|Diurnal|Cathemeral|Cathermal|Catheremal)\s+(.+?)\s+(Carnivore|Herbivore|Omnivore)\.?$/i)).find(Boolean);
  if (!match) return { tier: null, activity: null, habitat: null, diet: null, label: null };
  const activity = match[2].replace(/^(Cathermal|Catheremal)$/i, 'Cathemeral');
  return { tier: match[1], activity, habitat: match[3], diet: match[4], label: `${match[1]} ${activity} ${match[3]} ${match[4]}` };
}

function parseSummary(lines, name) {
  const start = Math.max(0, lines.findIndex(line => line.toLowerCase() === name.toLowerCase()) + 1);
  const selected = [];
  let begun = false;
  for (const line of lines.slice(start, start + 35)) {
    if (!line) { if (begun) break; continue; }
    if (/^["“].+["”]$/.test(line)) continue;
    if (/^(Written by|With contributions|Includes ideas|Author:|Authors:|Photo:|Profile inspired|Copyright:)/i.test(line)) break;
    if (isNoise(line)) continue;
    begun = true; selected.push(line);
  }
  return selected.join(' ');
}

function parseCredits(lines) {
  return lines.slice(0, 45).filter(line => /^(Written by|With contributions|Includes ideas|Ideas from|Author:|Authors:|Photo:|Profile inspired)/i.test(line));
}

function parseQuickView(lines, statsStart) {
  const start = findLastIndex(lines, line => /^Profile - Quick View$/i.test(line));
  if (start < 0) return [];
  return lines.slice(start + 1, statsStart > start ? statsStart : lines.length).filter(line => line && !isNoise(line) && !sectionHeading(line));
}

const DRY_MOISTURE = new Set(['arid', 'semi-arid']);
const LIVE_ROLES = new Set(['territory', 'nesting', 'basking', 'resting', 'home']);
const MOISTURE_LABEL = { arid: 'Dry / Arid', 'semi-arid': 'Semi-arid', mesic: 'Mesic', wet: 'Wet', aquatic: 'Aquatic' };

async function loadRegions(mapFile) {
  const doc = await readFile(mapFile, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!doc) return { imageSize: null, byId: new Map(), list: [], meta: null, vocabulary: null };
  const list = Array.isArray(doc.regions) ? doc.regions : [];
  return { imageSize: doc.map?.imageSize || null, byId: new Map(list.map(region => [region.id, region])), list, meta: doc.map || null, vocabulary: doc.vocabulary || null };
}

function shapeCenter(shape) {
  if (!shape) return null;
  if ((shape.type === 'point' || shape.type === 'circle') && typeof shape.x === 'number' && typeof shape.y === 'number') {
    return { x: shape.x, y: shape.y };
  }
  if (shape.type === 'polygon' && Array.isArray(shape.points) && shape.points.length) {
    const valid = shape.points.filter(point => Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number');
    if (!valid.length) return null;
    return {
      x: valid.reduce((sum, point) => sum + point[0], 0) / valid.length,
      y: valid.reduce((sum, point) => sum + point[1], 0) / valid.length,
    };
  }
  return null;
}

function resolveRoutes(routeDoc, regions) {
  if (!routeDoc || !Array.isArray(routeDoc.routes)) return [];
  return routeDoc.routes.map(route => {
    const waypoints = (Array.isArray(route.via) ? route.via : []).map(regionId => {
      const region = regions.byId.get(regionId);
      const center = shapeCenter(region?.shape);
      if (!region || !center) return null;
      return { regionId, name: region.name, x: center.x, y: center.y, biome: region.biome || null, moisture: region.moisture || null };
    }).filter(Boolean);
    return { id: route.id || null, name: route.name || 'Migration route', role: route.role || 'migration', color: route.color || null, note: route.note || '', via: waypoints.map(w => w.regionId), waypoints };
  }).filter(route => route.waypoints.length >= 2);
}

function resolveMap(poiDoc, routeDoc, regions) {
  if (!regions) return null;
  const hasPois = poiDoc && Array.isArray(poiDoc.pois) && poiDoc.pois.length;
  const routes = resolveRoutes(routeDoc, regions);
  if (!hasPois && !routes.length) return null;
  const markers = (hasPois ? poiDoc.pois : []).map(poi => {
    const region = poi.regionId ? regions.byId.get(poi.regionId) : null;
    const base = region || {};
    const roles = Array.isArray(poi.roles) ? poi.roles : poi.role ? [poi.role] : [];
    return {
      regionId: poi.regionId || null,
      name: poi.label || base.name || poi.regionId || 'POI',
      shape: poi.shape || base.shape || null,
      biome: poi.biome || base.biome || null,
      moisture: poi.moisture || base.moisture || null,
      water: poi.water || base.water || null,
      terrain: poi.terrain || base.terrain || [],
      description: base.description || '',
      roles,
      claimable: typeof poi.claimable === 'boolean' ? poi.claimable : null,
      territoryTier: poi.territoryTier || null,
      variant: poi.variant || null,
      prey: poi.prey || null,
      season: poi.season || null,
      note: poi.note || '',
      unresolvedRegion: Boolean(poi.regionId && !region),
    };
  });
  return {
    image: (poiDoc && poiDoc.mapImage) || (routeDoc && routeDoc.mapImage) || null,
    imageSize: regions.imageSize,
    legend: (poiDoc && poiDoc.legend) || null,
    variants: (poiDoc && poiDoc.variants) || null,
    anyPoiHunting: (poiDoc && poiDoc.anyPoiHunting) || null,
    markers,
    routes,
  };
}

function summarizeHabitat(map, classification) {
  const biomes = new Set();
  const moisture = new Set();
  const regionIds = [];
  const roles = {};
  const variants = new Set();
  let isDry = false;
  let isAquatic = false;
  if (map) {
    for (const marker of map.markers) {
      if (marker.regionId) regionIds.push(marker.regionId);
      if (marker.biome) biomes.add(marker.biome);
      if (marker.moisture) moisture.add(marker.moisture);
      if (marker.variant && marker.variant !== 'both') variants.add(marker.variant);
      for (const role of marker.roles) (roles[role] ||= []).push(marker.regionId || marker.name);
      const livesHere = marker.roles.some(role => LIVE_ROLES.has(role));
      if (livesHere && (DRY_MOISTURE.has(marker.moisture) || marker.variant === 'arid')) isDry = true;
      if (livesHere && marker.moisture === 'aquatic') isAquatic = true;
    }
    for (const route of map.routes || []) {
      for (const wp of route.waypoints) {
        if (wp.regionId && !regionIds.includes(wp.regionId)) regionIds.push(wp.regionId);
        if (wp.biome) biomes.add(wp.biome);
        if (wp.moisture) moisture.add(wp.moisture);
        (roles.migration ||= []).push(wp.regionId || wp.name);
      }
    }
  }
  return {
    classification: classification.habitat || null,
    biomes: [...biomes],
    moisture: [...moisture],
    regions: regionIds,
    roles,
    variants: [...variants],
    isDry,
    isAquatic,
  };
}

function pushUnique(list, value) { if (!list.includes(value)) list.push(value); }

function accumulateMapIndex(index, profile) {
  const { map, habitat } = profile;
  index.dinos[profile.id] = {
    name: profile.name,
    classification: habitat?.classification || null,
    isDry: Boolean(habitat?.isDry),
    isAquatic: Boolean(habitat?.isAquatic),
    moisture: habitat?.moisture || [],
    biomes: habitat?.biomes || [],
    regions: habitat?.regions || [],
    variants: habitat?.variants || [],
  };
  if (habitat?.isDry) pushUnique(index.groups.dry, profile.id);
  if (habitat?.isAquatic) pushUnique(index.groups.aquatic, profile.id);
  if (!map) return;
  for (const marker of map.markers) {
    if (marker.regionId) {
      const bucket = (index.regions[marker.regionId] ||= { name: marker.name, biome: marker.biome || null, moisture: marker.moisture || null, dinoIds: [], roles: {} });
      pushUnique(bucket.dinoIds, profile.id);
      for (const role of marker.roles) { (bucket.roles[role] ||= []); pushUnique(bucket.roles[role], profile.id); }
    }
    if (!marker.roles.some(role => LIVE_ROLES.has(role))) continue;
    const moistures = new Set();
    if (marker.moisture) moistures.add(marker.moisture);
    if (marker.variant === 'arid') moistures.add('arid');
    for (const mo of moistures) {
      const bucket = (index.moisture[mo] ||= { label: MOISTURE_LABEL[mo] || mo, dinoIds: [] });
      pushUnique(bucket.dinoIds, profile.id);
    }
    if (marker.biome) pushUnique((index.biome[marker.biome] ||= { dinoIds: [] }).dinoIds, profile.id);
  }
  for (const route of map.routes || []) {
    for (const wp of route.waypoints) {
      const bucket = (index.regions[wp.regionId] ||= { name: wp.name, biome: wp.biome || null, moisture: wp.moisture || null, dinoIds: [], roles: {} });
      pushUnique(bucket.dinoIds, profile.id);
      (bucket.roles.migration ||= []); pushUnique(bucket.roles.migration, profile.id);
    }
  }
  if ((map.routes || []).length) pushUnique(index.groups.migration, profile.id);
}

function finalizeMapIndex(index) {
  index.generatedAt = new Date().toISOString();
  index.groups.dry.sort();
  index.groups.aquatic.sort();
  index.groups.migration.sort();
  for (const bucket of Object.values(index.moisture)) bucket.dinoIds.sort();
  for (const bucket of Object.values(index.biome)) bucket.dinoIds.sort();
  for (const bucket of Object.values(index.regions)) bucket.dinoIds.sort();
}

function resolveSpeed(speedDoc, profileId) {
  const entry = speedDoc?.profiles?.[profileId];
  if (!entry) return null;
  return {
    unit: speedDoc.unit,
    snapshotAt: speedDoc.snapshotAt,
    land: entry.land || null,
    water: entry.water || null,
    air: entry.air || null,
    sources: (entry.sourceRefs || []).map(ref => ({ id: ref, ...speedDoc.sources?.[ref] })).filter(source => source.title),
  };
}

// Dynasty's official title card (the dino in game with its name on it) is a ~1.615:1 banner.
const TITLE_CARD_RATIO = 1.615;

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// The curated data/reference/ingame-covers.json entry wins; a profile it doesn't list yet uses
// the first uploaded image shaped like a title card, then the first image as a last resort.
async function resolveIngameCover(manifest, directory, curated) {
  if (curated) {
    const known = curated.file && manifest.images.some(image => image.file === curated.file);
    return known ? { file: curated.file, kind: curated.kind || 'title-card', note: curated.note || null } : { file: null, kind: 'missing', note: curated.note || null };
  }
  for (const image of manifest.images) {
    const size = await readFile(join(directory, image.file)).then(pngSize).catch(() => null);
    // Skin sheets can share the ratio but are exported far wider than the ~1100–1520 px cards.
    if (size && size.width <= 1600 && Math.abs(size.width / size.height - TITLE_CARD_RATIO) < 0.03) return { file: image.file, kind: 'title-card', note: 'Detected by shape; not yet reviewed.' };
  }
  return manifest.images[0] ? { file: manifest.images[0].file, kind: 'unreviewed', note: 'No title card detected; first upload used.' } : { file: null, kind: 'missing', note: null };
}

function animalPhoto(entry) {
  if (!entry?.image) return null;
  return { image: entry.image, focus: entry.focus || '50% 40%', credit: { artist: entry.artist, license: entry.license, page: entry.page } };
}

function parseProfile(manifest, raw, reference = null, referenceFetchedAt = null, poiDoc = null, regions = null, routeDoc = null, speedDoc = null, ingame = null) {
  const lines = cleanLines(raw);
  const statsStart = findLastIndex(lines, line => /^(Dynasty Adjusted Stats|Dynasty Adjused Stats|Dynasty Stats|Stats)$/i.test(line));
  const quickStart = findLastIndex(lines, line => /^Profile - Quick View$/i.test(line));
  const quickLinks = lines.findIndex(line => /^Quick Links$/i.test(line));
  const contentEnd = [quickStart, statsStart, quickLinks].filter(index => index > 0).sort((a, b) => a - b)[0] || lines.length;
  const overviewStart = lines.findIndex(line => /^Overview$/i.test(line));
  const classificationStart = lines.findIndex(line => /^(Tiny|Small|Medium|Large|Apex|Giant)\s+(Nocturnal|Diurnal|Cathemeral|Cathermal|Catheremal)\s+.+\s+(Carnivore|Herbivore|Omnivore)\.?$/i.test(line));
  const contentStart = overviewStart >= 0 ? overviewStart : classificationStart >= 0 ? classificationStart + 1 : Math.min(45, lines.length);
  const aliases = lines.slice(0, 10).filter(line => /^["“].+["”]$/.test(line)).flatMap(line => line.replace(/["“”]/g, '').split(',').map(alias => alias.trim())).filter(Boolean);
  const coverFile = ingame ? ingame.file : manifest.images[0]?.file;
  const media = manifest.images.map((image, index) => ({
    ...image,
    role: image.file === coverFile ? 'cover' : index === manifest.images.length - 1 ? 'map-or-reference' : 'reference',
  })).sort((a, b) => (b.role === 'cover') - (a.role === 'cover'));
  const stats = parseStats(lines);
  const classification = parseClassification(lines);
  const map = resolveMap(poiDoc, routeDoc, regions);
  const habitat = summarizeHabitat(map, classification);
  return {
    schemaVersion: 1,
    id: manifest.id,
    name: manifest.name,
    aliases,
    summary: parseSummary(lines, manifest.name),
    credits: parseCredits(lines),
    classification,
    quickView: parseQuickView(lines, statsStart),
    stats,
    speed: resolveSpeed(speedDoc, manifest.id),
    fullStats: combineStats(stats, reference, referenceFetchedAt),
    sections: parseSections(lines.slice(contentStart, contentEnd)),
    videos: youtubeVideos(raw),
    media,
    ingame: ingame || (coverFile ? { file: coverFile, kind: 'unreviewed', note: null } : null),
    map,
    habitat,
    source: { importedAt: manifest.importedAt, profileFile: `data/raw/${manifest.id}/profile.txt`, statsSource: stats.sourceLabel },
  };
}

function parseRules(manifest, raw) {
  const lines = cleanLines(raw).filter(line => !isNoise(line) && !/^Quick Links$/i.test(line) && !/^Top$/i.test(line));
  const firstRule = lines.findIndex(line => /^1\.1\)/.test(line));
  const introduction = blocksFromLines(lines.slice(0, firstRule));
  const sections = Object.entries(ruleTitles).map(([major, title]) => ({ id: `rules-${major}`, number: Number(major), title, rules: [] }));
  for (const line of lines.slice(firstRule)) {
    const match = line.match(/^(\d+(?:\.\d+)+)\)\s*(.+)$/);
    if (!match) continue;
    const major = Number(match[1].split('.')[0]);
    const section = sections.find(item => item.number === major);
    if (section) section.rules.push({ number: match[1], text: match[2] });
  }
  return {
    schemaVersion: 1,
    id: 'server-rules',
    title: 'Server Rules',
    introduction,
    sections,
    media: manifest.images,
    source: { importedAt: manifest.importedAt, profileFile: 'data/raw/server-rules/profile.txt' },
  };
}

export async function buildProcessedData({ rawDir = defaultRawDir, processedDir = defaultProcessedDir } = {}) {
  const rawRoot = resolve(rawDir);
  const outputRoot = resolve(processedDir);
  const referenceFile = join(dirname(rawRoot), 'reference', 'baselines.json');
  const speedFile = join(dirname(rawRoot), 'reference', 'speeds.json');
  const references = await readFile(referenceFile, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const speeds = await readFile(speedFile, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const analogVocabulary = await readFile(join(dirname(rawRoot), 'reference', 'analog-vocabulary.json'), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const optionalReference = name => readFile(join(dirname(rawRoot), 'reference', name), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const animalPhotos = (await optionalReference('animal-photos.json'))?.animals || {};
  const ingameCovers = (await optionalReference('ingame-covers.json'))?.profiles || {};
  const ecosystemDoc = await optionalReference('ecosystems.json');
  const analogDocs = new Map();
  const regions = await loadRegions(join(dirname(rawRoot), 'map', 'regions.json'));
  const mapIndex = { schemaVersion: 1, generatedAt: null, dryMoisture: [...DRY_MOISTURE], groups: { dry: [], aquatic: [], migration: [] }, moisture: {}, biome: {}, regions: {}, dinos: {} };
  const profileOutput = join(outputRoot, 'profiles');
  await mkdir(rawRoot, { recursive: true });
  await rm(profileOutput, { recursive: true, force: true });
  await mkdir(profileOutput, { recursive: true });
  const entries = await readdir(rawRoot, { withFileTypes: true });
  const profiles = [];
  let rules = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    try {
      const directory = join(rawRoot, entry.name);
      const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
      const raw = await readFile(join(directory, 'profile.txt'), 'utf8');
      if (manifest.id === 'server-rules') {
        rules = parseRules(manifest, raw);
        await writeFile(join(outputRoot, 'rules.json'), JSON.stringify(rules, null, 2) + '\n');
      } else {
        const poiDoc = await readFile(join(directory, 'pois.json'), 'utf8').then(JSON.parse).catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        const routeDoc = await readFile(join(directory, 'routes.json'), 'utf8').then(JSON.parse).catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        const analogDoc = await readFile(join(directory, 'analog.json'), 'utf8').then(JSON.parse).catch(error => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        const ingame = await resolveIngameCover(manifest, directory, ingameCovers[manifest.id]);
        const profile = parseProfile(manifest, raw, references?.sources?.[manifest.id], references?.fetchedAt, poiDoc, regions, routeDoc, speeds, ingame);
        if (analogDoc) analogDocs.set(profile.id, analogDoc);
        profiles.push(profile);
        accumulateMapIndex(mapIndex, profile);
      }
    } catch { /* Incomplete raw imports remain untouched and are omitted. */ }
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  const matchups = buildMatchups(profiles);
  for (const profile of profiles) {
    profile.matchups = matchups[profile.id] || null;
    // Resolved after matchups so the analog's stat facts can reuse the parsed hunt/group traits.
    profile.analog = resolveAnalog(analogDocs.get(profile.id), profile, analogVocabulary);
    for (const analog of profile.analog?.analogs || []) analog.photo = animalPhoto(animalPhotos[analog.id]);
    profile.ecosystem = resolveEcosystem(ecosystemDoc, profile);
  }
  attachAnalogRelatives(profiles);
  for (const profile of profiles) await writeFile(join(profileOutput, `${profile.id}.json`), JSON.stringify(profile, null, 2) + '\n');
  const analogIndex = buildAnalogIndex(profiles, analogVocabulary);
  if (ecosystemDoc) await writeFile(join(outputRoot, 'ecosystems.json'), JSON.stringify(buildEcosystemIndex(profiles, ecosystemDoc), null, 2) + '\n');
  else await rm(join(outputRoot, 'ecosystems.json'), { force: true });
  await writeFile(join(outputRoot, 'analogs.json'), JSON.stringify(analogIndex, null, 2) + '\n');
  const speedKnown = profiles.length > 0 && profiles.every(profile => profile.speed?.land?.sprint > 0);
  const matchupMap = { schemaVersion: 2, generatedAt: new Date().toISOString(), speedKnown, methodology: 'intent-contact-pursuit-groups', dinos: matchups };
  await writeFile(join(outputRoot, 'matchups.json'), JSON.stringify(matchupMap, null, 2) + '\n');
  await writeFile(join(outputRoot, 'matchup-map.json'), JSON.stringify(matchupMap, null, 2) + '\n');
  const index = profiles.map(profile => ({
    id: profile.id, name: profile.name, aliases: profile.aliases, summary: profile.summary,
    classification: profile.classification, stats: { combatWeight: profile.stats.combatWeight, growthMinutes: profile.stats.growthMinutes, changeCount: profile.stats.changes.length },
    habitat: profile.habitat ? { classification: profile.habitat.classification, moisture: profile.habitat.moisture, biomes: profile.habitat.biomes, regions: profile.habitat.regions.length, isDry: profile.habitat.isDry, hasMap: Boolean(profile.map) } : null,
    matchups: profile.matchups ? { threats: profile.matchups.threats.length, opportunities: profile.matchups.opportunities.length } : null,
    analog: profile.analog ? {
      label: profile.analog.label, labelDe: profile.analog.labelDe, headline: profile.analog.headline,
      analogs: profile.analog.analogs.map(({ animal, de, archetype, archetypeLabel, archetypeDe, share, role, photo }) => ({ animal, de, archetype, archetypeLabel, archetypeDe, share, role, photo: photo ? { image: photo.image, focus: photo.focus } : null })),
      moods: profile.analog.moods.map(mood => mood.id), habitats: profile.analog.setting.habitats.map(habitat => habitat.id),
    } : null,
    ecosystem: profile.ecosystem ? { id: profile.ecosystem.id, level: profile.ecosystem.foodChain.level, also: profile.ecosystem.also.map(item => item.id) } : null,
    cover: profile.media.find(media => media.role === 'cover') || null, importedAt: profile.source.importedAt,
  }));
  const catalog = { schemaVersion: 1, generatedAt: new Date().toISOString(), count: index.length, profiles: index };
  await writeFile(join(outputRoot, 'index.json'), JSON.stringify(catalog, null, 2) + '\n');
  finalizeMapIndex(mapIndex);
  if (regions.list.length) {
    await writeFile(join(outputRoot, 'map.json'), JSON.stringify({ schemaVersion: 1, map: regions.meta, vocabulary: regions.vocabulary, regions: regions.list }, null, 2) + '\n');
    await writeFile(join(outputRoot, 'map-index.json'), JSON.stringify(mapIndex, null, 2) + '\n');
  } else {
    await rm(join(outputRoot, 'map.json'), { force: true });
    await rm(join(outputRoot, 'map-index.json'), { force: true });
  }
  if (!rules) await rm(join(outputRoot, 'rules.json'), { force: true });
  return { catalog, profiles, rules, mapIndex: regions.list.length ? mapIndex : null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildProcessedData();
  console.log(`Processed ${result.profiles.length} profiles${result.rules ? ' and server rules' : ''}.`);
}
