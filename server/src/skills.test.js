import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skills = join(root, '.claude', 'skills');
const exists = path => access(path).then(() => true, () => false);

test('both chat skills have valid frontmatter', async () => {
  for (const name of ['dino', 'dino-finder']) {
    const text = await readFile(join(skills, name, 'SKILL.md'), 'utf8');
    const front = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(front, `${name}: SKILL.md needs YAML frontmatter`);
    assert.match(front[1], new RegExp(`^name: ${name}$`, 'm'));
    assert.match(front[1], /^description: .{80,1024}$/m, `${name}: description missing or too long`);
    assert.ok(!/[<>]/.test(front[1]), `${name}: frontmatter must not contain angle brackets`);
  }
});

test('generated skill references cover every playable (run npm run skills:build)', async () => {
  const index = JSON.parse(await readFile(join(root, 'data', 'processed', 'index.json'), 'utf8'));
  for (const { id } of index.profiles) {
    assert.ok(await exists(join(skills, 'dino', 'references', 'dinos', id, 'card.md')), `dino skill lacks ${id}`);
    assert.ok(await exists(join(skills, 'dino-finder', 'references', 'dinos', `${id}.md`)), `dino-finder skill lacks ${id}`);
  }
  const catalog = await readFile(join(skills, 'dino-finder', 'references', 'catalog.md'), 'utf8');
  for (const { id } of index.profiles) assert.ok(catalog.includes(`| ${id} |`), `catalog lacks ${id}`);
});
