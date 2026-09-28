// One imported profile is usually one playable. A profile can instead split into several
// playables that share the official text but play differently (Megalania's arid and temperate
// variants): each gets data/raw/<slug>/variants/<variant>/variant.json with its own analog.json
// and playstyle.json next to it, and replaces the parent in the catalog.
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const exists = path => access(path).then(() => true, () => false);

export async function readVariants(directory) {
  const root = join(directory, 'variants');
  const entries = await readdir(root, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const variants = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const file = join(dir, 'variant.json');
    if (!await exists(file)) continue;
    variants.push({ ...JSON.parse(await readFile(file, 'utf8')), dir });
  }
  return variants.sort((a, b) => a.id.localeCompare(b.id));
}

// Every playable with the raw profile it comes from (`rawId`) and the directory that holds its
// curated analog.json and playstyle.json (`dir`).
export async function listPlayables(rawDir) {
  const playables = [];
  for (const entry of await readdir(rawDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'server-rules') continue;
    const directory = join(rawDir, entry.name);
    if (!await exists(join(directory, 'manifest.json'))) continue;
    const variants = await readVariants(directory);
    if (variants.length) for (const variant of variants) playables.push({ id: variant.id, rawId: entry.name, dir: variant.dir, variant: variant.variant });
    else playables.push({ id: entry.name, rawId: entry.name, dir: directory, variant: null });
  }
  return playables;
}
