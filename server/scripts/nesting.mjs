// Command line for the /nesting skill (Discord nesting posts):
//   node server/scripts/nesting.mjs info <playable|dino> [dino]
//        profile facts for the post (egg limits, /rolleggs, nest POIs, subspecies, tagline),
//        the matching "My Dinos" entry prefilled as mother or father, and the config (JSON)
//   node server/scripts/nesting.mjs render <payload.json>
//        fills .claude/skills/nesting/template.md and prints the post; length and warnings go
//        to stderr. The first render writes postedAt into the payload so later renders (egg
//        claims) keep the same expiry timestamp.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHerdStore } from '../src/herd.js';
import { parentFromHerd, renderPost, resolvePlayable, speciesFacts } from '../src/nesting.js';

const processedDir = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const skillDir = fileURLToPath(new URL('../../.claude/skills/nesting/', import.meta.url));
const store = createHerdStore({ processedDir });
const [command, ...args] = process.argv.slice(2);

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const loadProfile = (id) => readJson(join(processedDir, 'profiles', `${id}.json`));

async function findDino(term) {
  try { return await store.find(term); } catch { return null; }
}

try {
  const config = await readJson(join(skillDir, 'config.json'));
  if (command === 'info' && args.length) {
    const index = await readJson(join(processedDir, 'index.json'));
    let dino = null;
    let candidates = [];
    for (const term of args) {
      const found = !dino && await findDino(term);
      if (found) { dino = found; continue; }
      const matches = resolvePlayable(term, index.profiles);
      if (matches.length) candidates = matches;
    }
    if (dino?.playableId && (!candidates.length || candidates.some(item => item.id === dino.playableId))) {
      candidates = index.profiles.filter(item => item.id === dino.playableId);
    }
    const result = { config, dino: null, species: null, candidates: [], herdOfSpecies: [] };
    if (dino) {
      const { role, parent, missing } = parentFromHerd(dino, config.owner);
      result.dino = { id: dino.id, name: dino.name, playableId: dino.playableId, sex: dino.sex, role, parent, missing, extra: dino.genetics?.extra || [] };
      if (candidates.length === 1 && dino.playableId && dino.playableId !== candidates[0].id) {
        result.warning = `${dino.name} ist als ${dino.playableId} eingetragen, nicht als ${candidates[0].id}.`;
      }
    }
    if (candidates.length === 1) {
      result.species = speciesFacts(await loadProfile(candidates[0].id));
      const herd = await store.all();
      result.herdOfSpecies = herd.filter(item => item.playableId === candidates[0].id).map(item => ({ name: item.name, sex: item.sex }));
    } else {
      result.candidates = candidates.map(item => ({ id: item.id, name: item.name }));
    }
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'render' && args[0]) {
    const payload = await readJson(args[0]);
    const profile = payload.playableId ? await loadProfile(payload.playableId) : null;
    const template = await readFile(join(skillDir, 'template.md'), 'utf8');
    const { post, length, warnings, postedAt } = renderPost(template, payload, { profile, config });
    if (!payload.postedAt) await writeFile(args[0], JSON.stringify({ ...payload, postedAt }, null, 2));
    console.log(post);
    console.error(`\n--- ${length}/${config.maxLength || 2000} Zeichen · postedAt ${postedAt}`);
    for (const warning of warnings) console.error(`! ${warning}`);
  } else {
    console.error('Usage: nesting.mjs info <playable|dino> [dino] | render <payload.json>');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
