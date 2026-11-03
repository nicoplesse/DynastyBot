// Aquatic Update: the user's own server suggestion, worked on in projects/aquatic-update/.
// The profile drafts stay hand-written Markdown, so they can be submitted as they are;
// profile-entwuerfe/index.json adds the card facts the app needs around them.
// A draft reads: "# Title", a German overview, a "---" line, then the English profile text.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultAquaticDir = fileURLToPath(new URL('../../projects/aquatic-update/profile-entwuerfe/', import.meta.url));
export const defaultRegionsFile = fileURLToPath(new URL('../../data/map/regions.json', import.meta.url));
export const AQUATIC_SIDES = ['prey', 'giant', 'hunter'];

export function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const LIST_ITEM = /^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/;

// Nested list items by indentation: a deeper item belongs to the last item above it.
function parseList(lines, start) {
  const root = { indent: -1, children: [] };
  const stack = [root];
  let index = start;
  while (index < lines.length) {
    const match = lines[index].match(LIST_ITEM);
    if (!match) break;
    const [, spaces, bullet, number, text] = match;
    const indent = spaces.length;
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1);
    const item = { text, indent, ordered: !bullet && Boolean(number), children: [] };
    parent.children.push(item);
    stack.push(item);
    index += 1;
  }
  const toBlock = items => ({
    type: 'list',
    ordered: items[0]?.ordered ?? false,
    items: items.map(item => ({ text: item.text, ...(item.children.length ? { children: toBlock(item.children) } : {}) })),
  });
  return { block: toBlock(root.children), next: index };
}

// The small Markdown subset the drafts use: headings, paragraphs, nested lists and tables.
export function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ type: 'heading', level: heading[1].length, text, id: slug(text) });
      index += 1;
      continue;
    }
    if (line.trim().startsWith('|') && lines[index + 1]?.trim().match(/^\|[\s:|-]+\|$/)) {
      const header = cells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(cells(lines[index])); index += 1; }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const { block, next } = parseList(lines, index);
      blocks.push(block);
      index = next;
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s/.test(lines[index]) && !LIST_ITEM.test(lines[index]) && !lines[index].trim().startsWith('|')) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

// Splits a draft into its title, the German overview and the English profile text.
export function parseDraft(markdown) {
  const text = markdown.replace(/\r\n/g, '\n');
  const title = text.match(/^#\s+(.+)$/m)?.[1].trim() || '';
  const body = text.replace(/^#\s+.+\n/m, '');
  const [overview, ...rest] = body.split(/^---\s*$/m);
  const profile = rest.join('---');
  const en = parseBlocks(profile);
  return {
    title,
    overview: parseBlocks(overview),
    profile: en,
    // The English text as written, for copying into the submission.
    markdown: profile.trim(),
    toc: en.filter(block => block.type === 'heading' && block.level === 2).map(block => ({ id: block.id, title: block.text })),
  };
}

const round = value => Math.round(value * 10000) / 10000;

export function polygonArea(points) {
  return Math.abs(points.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;
}

// Sutherland–Hodgman against one axis-aligned half-plane: keeps the side below ('low') or above the cut.
function clipHalf(points, axis, cut, half) {
  const k = axis === 'x' ? 0 : 1;
  const inside = point => half === 'low' ? point[k] <= cut : point[k] >= cut;
  const crossing = (from, to) => {
    const t = (cut - from[k]) / (to[k] - from[k]);
    return [from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])];
  };
  const kept = [];
  points.forEach((current, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    if (inside(current)) {
      if (!inside(previous)) kept.push(crossing(previous, current));
      kept.push(current);
    } else if (inside(previous)) kept.push(crossing(previous, current));
  });
  return kept;
}

// One of two equal-area halves of a POI outline, like the segmented Spinosaurus territories.
export function splitHalf(points, axis, half) {
  const k = axis === 'x' ? 0 : 1;
  let low = Math.min(...points.map(point => point[k]));
  let high = Math.max(...points.map(point => point[k]));
  const target = polygonArea(points) / 2;
  for (let step = 0; step < 40; step += 1) {
    const middle = (low + high) / 2;
    if (polygonArea(clipHalf(points, axis, middle, 'low')) < target) low = middle; else high = middle;
  }
  const cut = (low + high) / 2;
  return { cut: round(cut), points: clipHalf(points, axis, cut, half).map(([x, y]) => [round(x), round(y)]) };
}

function insidePolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function edgeDistance([x, y], points) {
  return Math.min(...points.map(([ax, ay], index) => {
    const [bx, by] = points[(index + 1) % points.length];
    const length = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length)) : 0;
    return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
  }));
}

// Label point: the inside grid point farthest from the outline, so thin or bent shapes still get a readable spot.
export function labelPoint(points) {
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = null;
  for (let i = 1; i < 24; i += 1) {
    for (let j = 1; j < 24; j += 1) {
      const point = [minX + (maxX - minX) * i / 24, minY + (maxY - minY) * j / 24];
      if (!insidePolygon(point, points)) continue;
      const distance = edgeDistance(point, points);
      if (!best || distance > best.distance) best = { point, distance };
    }
  }
  return (best?.point || points[0]).map(round);
}

// lebensraum.json: who lives where, resolved against the traced POI outlines of the shared map.
export function buildHabitat(habitat, regions, profileIds) {
  const regionById = new Map(regions.filter(region => region.shape?.type === 'polygon').map(region => [region.id, region]));
  const outline = id => {
    const region = regionById.get(id);
    if (!region) throw new Error(`Aquatic habitat: unknown map area ${id}`);
    return region;
  };
  const zoneOf = new Map(habitat.zones.flatMap(zone => zone.areas.map(id => [id, zone.id])));
  const areas = [...zoneOf.keys()].map(id => {
    const region = outline(id);
    return { id, name: region.name, zone: zoneOf.get(id), points: region.shape.points, anchor: region.anchor ? [region.anchor.x, region.anchor.y] : labelPoint(region.shape.points) };
  });
  const territories = habitat.territories.map(territory => {
    if (!zoneOf.has(territory.parent)) throw new Error(`Aquatic habitat: territory ${territory.id} lies outside the zones`);
    const { cut, points } = splitHalf(outline(territory.parent).shape.points, territory.axis, territory.half);
    return { ...territory, cut, points, anchor: labelPoint(points) };
  });
  for (const species of habitat.species) {
    if (!profileIds.includes(species.id)) throw new Error(`Aquatic habitat: ${species.id} has no draft`);
    for (const area of species.areas) {
      if (!zoneOf.has(area.id)) throw new Error(`Aquatic habitat: ${species.id} lives in ${area.id}, which is in no zone`);
      for (const role of area.roles) if (!habitat.roles[role]) throw new Error(`Aquatic habitat: unknown role ${role}`);
    }
  }
  const view = habitat.view ?? { x: 0, y: 0, width: 1, height: 1 };
  return { view, roles: habitat.roles, zones: habitat.zones, areas, territories, route: habitat.route, species: habitat.species };
}

// beziehungen.json: who hunts, flees from or defends against whom. Every row covers every other species.
export function buildRelations(relations, ids) {
  if (relations.order.length !== ids.length || !ids.every(id => relations.order.includes(id))) throw new Error('Aquatic relations: order must list every profile and extra once');
  for (const actor of relations.order) {
    for (const target of relations.order) {
      if (actor === target) continue;
      const cell = relations.relations[actor]?.[target];
      if (!cell) throw new Error(`Aquatic relations: ${actor} → ${target} missing`);
      if (!relations.kinds[cell[0]]) throw new Error(`Aquatic relations: unknown kind ${cell[0]} (${actor} → ${target})`);
    }
  }
  return { kinds: relations.kinds, order: relations.order, relations: relations.relations };
}

export async function loadAquatic(aquaticDir = defaultAquaticDir, regionsFile = defaultRegionsFile) {
  const meta = JSON.parse(await readFile(join(aquaticDir, 'index.json'), 'utf8'));
  const files = new Set((await readdir(aquaticDir)).filter(file => file.endsWith('.md')));
  const profiles = await Promise.all(meta.profiles.map(async profile => {
    const file = `${profile.id}.md`;
    if (!files.has(file)) throw new Error(`Aquatic draft missing: ${file}`);
    return { ...profile, file, draft: parseDraft(await readFile(join(aquaticDir, file), 'utf8')) };
  }));
  profiles.sort((a, b) => a.order - b.order);
  const { profiles: _profiles, ...overview } = meta;
  const { regions } = JSON.parse(await readFile(regionsFile, 'utf8'));
  const habitatFile = JSON.parse(await readFile(join(aquaticDir, 'lebensraum.json'), 'utf8'));
  const habitat = buildHabitat(habitatFile, regions, profiles.map(profile => profile.id));
  const relationsFile = JSON.parse(await readFile(join(aquaticDir, 'beziehungen.json'), 'utf8'));
  const relations = buildRelations(relationsFile, [...profiles, ...(meta.extras ?? [])].map(entry => entry.id));
  return { overview, profiles, habitat, relations };
}

export function aquaticSummary(profile) {
  const { draft: _draft, file: _file, ...summary } = profile;
  return summary;
}
