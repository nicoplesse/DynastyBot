import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildView, escapeDiscord, fillTemplate, parentFromHerd, renderPost, resolvePlayable } from './nesting.js';

const templateFile = new URL('../../.claude/skills/nesting/template.md', import.meta.url);
const configFile = new URL('../../.claude/skills/nesting/config.json', import.meta.url);

const profile = {
  id: 'tyrannotitan',
  name: 'Tyrannotitan',
  aliases: ['TT', 'Titan'],
  analog: { label: 'Tiger + Great white shark', headline: 'A nocturnal tiger.' },
  map: { markers: [{ name: 'Cedrus Forest', roles: ['territory', 'nesting'] }, { name: 'Mudflats', roles: ['hunting'] }] },
  sections: [{ id: 'nesting-limits', blocks: [{ type: 'paragraph', text: 'Dry Season: 1-4 🥚. You must use the bot command /rolleggs Tyrannotitan.' }] }],
};

test('nesting: template subset handles sections, inverted sections, lists and standalone tag lines', () => {
  const out = fillTemplate('{{! note }}\n# {{title}}\n{{#items}}\n- {{.}}\n{{/items}}\n{{^empty}}\nnone\n{{/empty}}\n{{#obj}}{{a}}-{{title}}{{/obj}}', {
    title: 'T', items: ['x', 'y'], empty: [], obj: { a: 1 },
  });
  assert.equal(out, '# T\n- x\n- y\nnone\n1-T');
});

test('nesting: escapes Discord markdown in names but keeps single pipes', () => {
  assert.equal(escapeDiscord('Tear_Drop_ | 360-731-796'), 'Tear\\_Drop\\_ | 360-731-796');
  assert.equal(escapeDiscord('a||b'), 'a\\|\\|b');
});

test('nesting: My Dinos entry becomes the mother or father block, missing traits are reported', () => {
  const { role, parent, missing } = parentFromHerd({
    name: 'Malenia', sex: 'female', proofs: { mutation: 'https://discord.com/x' },
    genetics: { bloodlines: ['Blooming Buds'], skins: { dominant: ['Tragopan'], recessive: ['Melanistic'] }, mutations: [{ name: 'Albino' }], extra: [{ label: 'Augenfarbe', value: 'Red' }] },
  }, { player: 'TheNPCC | 039-974-634' });
  assert.equal(role, 'mother');
  assert.equal(parent.eyes, 'Red');
  assert.equal(parent.bloodline, 'Blooming Buds');
  assert.deepEqual(parent.mutations, [{ name: 'Albino', proof: 'https://discord.com/x' }]);
  assert.deepEqual(missing, ['subspecies']);
});

test('nesting: playable lookup by id, alias and prefix', () => {
  const profiles = [{ id: 'tyrannotitan', name: 'Tyrannotitan', aliases: ['TT'] }, { id: 'deinosuchus-shore', name: 'Deinosuchus (Shore)' }, { id: 'deinosuchus-ocean', name: 'Deinosuchus (Ocean)' }];
  assert.equal(resolvePlayable('TT', profiles)[0].id, 'tyrannotitan');
  assert.equal(resolvePlayable('deinosuchus', profiles).length, 2);
});

test('nesting: view keeps expiry stable, fills egg slots and warns about a missing egg roll', () => {
  const payload = { season: 'dry', eggs: 3, postedAt: '2026-10-06T12:00:00.000Z', mother: { name: 'M', player: 'a' }, father: { name: 'F', discordId: '123456789012345678' }, claims: [{ player: 'Kid_1', name: 'Ash', sex: 'M' }] };
  const { view, warnings } = buildView(payload, { profile, config: { expiresMinutes: 30 } });
  assert.equal(view.expires, `<t:${Date.parse('2026-10-06T12:30:00Z') / 1000}:R>`);
  assert.equal(view.slots.length, 3);
  assert.equal(view.slots[0].taken.who, 'Kid\\_1');
  assert.equal(view.parents[1].player, '<@123456789012345678>');
  assert.ok(warnings.some(line => line.includes('/rolleggs')));
});

test('nesting: the real template renders a Discord post under the length limit', async () => {
  const [template, config] = await Promise.all([readFile(templateFile, 'utf8'), readFile(configFile, 'utf8').then(JSON.parse)]);
  const payload = {
    season: 'rainy', clutch: 2, eggs: 2, eggRoll: 'https://discord.com/roll', postedAt: '2026-10-06T12:00:00.000Z',
    mother: { name: 'Malenia', player: 'TheNPCC | 039-974-634', dominant: ['Tragopan'], subspecies: 'Carolinii' },
    father: { name: 'Bruce', player: 'Lemon_17 | 133-580-567', dominant: ['Melanistic'], mutations: [{ name: 'Melanism', proof: 'https://discord.com/m' }] },
    claims: [{ player: 'A', name: 'Ash', sex: 'male' }, { player: 'B', name: 'Ivy' }],
  };
  const { post, length, warnings } = renderPost(template, payload, { profile, config });
  assert.ok(length <= 2000);
  assert.match(post, /^## ⟡ Tyrannotitan Nest ⟡\n-# 🌧️ Rainy Season ・ Clutch 2 ・ 2 eggs\n> \*A nocturnal tiger\.\*/);
  assert.match(post, /♂ \*\*Father\*\* ┆ \*\*Bruce\*\*\n-# Lemon\\_17 \| 133-580-567/);
  assert.match(post, /✧ `\[M\]` \[Melanism\]\(<https:\/\/discord\.com\/m>\)/);
  assert.match(post, /⤷ \*\*Ash\*\* ♂ ┆ A\n⤷ \*\*Ivy\*\* ┆ B/);
  assert.match(post, /This nest is full/);
  assert.doesNotMatch(post, /\{\{|\{profile\}|\n{3,}|plays like/);
  assert.ok(!warnings.some(line => line.includes('/rolleggs')));
});

test('nesting: clutch number is optional', () => {
  const { view } = buildView({ season: 'dry', eggs: 1 }, { profile });
  assert.equal(view.clutch, null);
  assert.equal(fillTemplate('{{seasonLabel}}{{#clutch}} ・ Clutch {{clutch}}{{/clutch}} ・ {{eggs}} {{eggWord}}', view), 'Dry Season ・ 1 egg');
});
