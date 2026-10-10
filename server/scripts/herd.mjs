// Command line for "Meine Dinos", used by the /aktualisiere skill:
//   node server/scripts/herd.mjs list                 all dinos with pending screenshots (JSON)
//   node server/scripts/herd.mjs show <name|id>       one dino with absolute screenshot paths (JSON)
//   node server/scripts/herd.mjs apply <name|id> <payload.json>
//                                                     validated update, then prints what changed
// The payload may hold playableId, sex, genetics, proofs, notes, transcripts and processed
// ("pending" marks every unread screenshot as read). Screenshots themselves are never touched.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHerdStore } from '../src/herd.js';

const processedDir = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const store = createHerdStore({ processedDir });
const [command, key, payloadFile] = process.argv.slice(2);

async function playableNames() {
  try {
    const index = JSON.parse(await readFile(join(processedDir, 'index.json'), 'utf8'));
    return Object.fromEntries(index.profiles.map(profile => [profile.id, profile.name]));
  } catch { return {}; }
}

function summary(dino) {
  const g = dino.genetics;
  return {
    bloodlines: g?.bloodlines || [], dominant: g?.skins.dominant || [], recessive: g?.skins.recessive || [],
    mutations: (g?.mutations || []).map(item => item.name), extra: (g?.extra || []).map(item => `${item.label}: ${item.value}`),
    playableId: dino.playableId, sex: dino.sex, proofs: dino.proofs,
  };
}

function changes(before, after) {
  const lines = [];
  for (const field of Object.keys(after)) {
    const a = JSON.stringify(before[field]);
    const b = JSON.stringify(after[field]);
    if (a !== b) lines.push(`${field}: ${a} → ${b}`);
  }
  return lines;
}

try {
  const names = await playableNames();
  if (command === 'list') {
    const dinos = await store.all();
    console.log(JSON.stringify(dinos.map(dino => ({
      id: dino.id, name: dino.name, playable: dino.playableId ? names[dino.playableId] || dino.playableId : null,
      pending: dino.screenshots.filter(shot => !shot.processedAt).length, screenshots: dino.screenshots.length,
      hasGenetics: !!dino.genetics, updatedAt: dino.updatedAt,
    })).sort((a, b) => b.pending - a.pending || b.updatedAt.localeCompare(a.updatedAt)), null, 2));
  } else if (command === 'show' && key) {
    const dino = await store.find(key);
    const folder = store.folder(dino.id);
    console.log(JSON.stringify({
      ...dino,
      playableName: dino.playableId ? names[dino.playableId] || null : null,
      screenshots: dino.screenshots.map(shot => ({ ...shot, path: join(folder, shot.file), pending: !shot.processedAt })),
      playables: names,
    }, null, 2));
  } else if (command === 'apply' && key && payloadFile) {
    const dino = await store.find(key);
    const payload = JSON.parse(await readFile(payloadFile, 'utf8'));
    const updated = await store.update(dino.id, payload);
    const diff = changes(summary(dino), summary(updated));
    const read = updated.screenshots.filter(shot => shot.processedAt && !dino.screenshots.find(old => old.file === shot.file)?.processedAt).length;
    console.log(`Updated ${updated.name} (data/herd/${updated.id}/dino.json)`);
    console.log(diff.length ? diff.map(line => `  ${line}`).join('\n') : '  no field changes');
    console.log(`  screenshots marked as read: ${read}, still pending: ${updated.screenshots.filter(shot => !shot.processedAt).length}`);
  } else {
    console.error('Usage: herd.mjs list | show <name|id> | apply <name|id> <payload.json>');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
