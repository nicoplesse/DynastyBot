// The Isle (Evrima) is a separate game from Path of Titans and Dynasty. Its short profiles are
// hand-written JSON under data/isle/ and are served as they are, without the Dynasty processor:
// basics.json holds the shared mechanics, playables/<id>.json one profile per playable.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultIsleDir = fileURLToPath(new URL('../../data/isle/', import.meta.url));
export const ISLE_STAGES = ['hatchling', 'juvenile', 'subadult', 'adult'];
export const ISLE_NUTRIENTS = ['alpha', 'beta', 'gamma'];
const PREDATOR_DIETS = new Set(['carnivore', 'omnivore']);

function growthTotal(minutes) {
  const values = ISLE_STAGES.map(stage => minutes?.[stage]);
  return values.every(value => typeof value === 'number') ? values.reduce((sum, value) => sum + value, 0) : null;
}

// Who eats whom follows from the nutrient lists: a predator that lists another playable by name
// hunts it for that nutrient.
function crossReference(playables) {
  const byName = new Map(playables.map(playable => [playable.name, playable]));
  const link = (playable, nutrient) => ({ id: playable.id, name: playable.name, diet: playable.diet, nutrient });
  const eats = new Map(playables.map(playable => [playable.id, []]));
  const eatenBy = new Map(playables.map(playable => [playable.id, []]));
  for (const hunter of playables) {
    if (!PREDATOR_DIETS.has(hunter.diet)) continue;
    for (const nutrient of ISLE_NUTRIENTS) {
      for (const food of hunter.nutrients[nutrient]) {
        const prey = byName.get(food);
        if (!prey || prey.id === hunter.id) continue;
        eats.get(hunter.id).push(link(prey, nutrient));
        eatenBy.get(prey.id).push(link(hunter, nutrient));
      }
    }
  }
  return { eats, eatenBy };
}

export async function loadIsle(isleDir = defaultIsleDir) {
  const basics = JSON.parse(await readFile(join(isleDir, 'basics.json'), 'utf8'));
  const directory = join(isleDir, 'playables');
  const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
  const playables = await Promise.all(files.map(async file => JSON.parse(await readFile(join(directory, file), 'utf8'))));
  playables.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const { eats, eatenBy } = crossReference(playables);
  return {
    basics,
    playables: playables.map(playable => ({
      ...playable,
      growthTotalMinutes: growthTotal(playable.stats.growthMinutes),
      eats: eats.get(playable.id),
      eatenBy: eatenBy.get(playable.id),
    })),
  };
}

export function isleSummary(playable) {
  const { id, name, nickname = null, diet, role, tagline, since = null, order, stats, growthTotalMinutes } = playable;
  return { id, name, nickname, diet, role, tagline, since, order, growthTotalMinutes, stats: { adultWeightKg: stats.adultWeightKg, sprintKmh: stats.sprintKmh, groupLimit: stats.groupLimit } };
}
