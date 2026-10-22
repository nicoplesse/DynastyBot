import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reach } from './foodweb.js';

// Control examples straight from the profiles (run npm run process after changing food-web.json).
const processed = fileURLToPath(new URL('../../data/processed/', import.meta.url));
const web = JSON.parse(await readFile(join(processed, 'foodweb.json'), 'utf8'));
const setupIndex = (hunter, id) => web.hunters[hunter].setups.findIndex(setup => setup.id === id);
const verdict = (hunter, target, setup) => web.hunters[hunter].edges.find(edge => edge.t === target)?.per[setupIndex(hunter, setup)] || null;

test('habitat decides what a hunter can reach at all', () => {
  assert.equal(reach({ habitat: 'Terrestrial' }, { habitat: 'Aquatic' }), 'none');
  assert.equal(reach({ habitat: 'Semi-Aquatic' }, { habitat: 'Aquatic Filter Feeder' }), 'ok');
  assert.equal(reach({ habitat: 'Aquatic' }, { habitat: 'Terrestrial' }), 'water');
  assert.equal(reach({ habitat: 'Terrestrial' }, { habitat: 'Aerial' }), 'ground');
  assert.equal(reach({ habitat: 'Aerial' }, { habitat: 'Aquatic' }), 'none');
  assert.equal(web.hunters.tyrannosaurus.edges.some(edge => edge.t === 'tylosaurus'), false, 'a Rex never reaches a Tylosaurus');
});

test('every carnivore is in the web and every rule cites its profile section', () => {
  for (const node of Object.values(web.nodes).filter(item => item.diet === 'Carnivore')) assert.ok(web.hunters[node.id], `${node.id} is missing`);
  for (const [id, hunter] of Object.entries(web.hunters)) {
    if (hunter.none) { assert.ok(hunter.noneSection, id); continue; }
    assert.ok(hunter.setups.length, `${id} has setups`);
    for (const quote of hunter.quotes) assert.ok(quote.section, `${id}: quote without section`);
    for (const edge of hunter.edges) assert.equal(edge.per.length, hunter.setups.length, `${id} → ${edge.t}`);
  }
  assert.equal(web.hunters.leedsichthys.none.includes('Krill'), true);
  assert.equal(web.hunters.lambeosaurus, undefined, 'herbivores do not hunt');
});

test('Daspletosaurus: Lambeosaurus first, Parasaurolophus only for a full pack', () => {
  assert.deepEqual([verdict('daspletosaurus', 'lambeosaurus', 'solo').k, verdict('daspletosaurus', 'lambeosaurus', 'solo').r], ['priority', 1]);
  assert.equal(verdict('daspletosaurus', 'parasaurolophus', 'solo').k, 'locked', 'solo is capped at Large');
  assert.equal(verdict('daspletosaurus', 'parasaurolophus', 'pair').r, 2, 'a pair may hunt it, but only as a herbivore');
  assert.equal(verdict('daspletosaurus', 'parasaurolophus', 'pack').r, 1);
  assert.equal(verdict('daspletosaurus', 'kelenken', 'solo').k, 'legal', 'carnivores come after herbivores');
});

test('named preferences, exceptions and never rules', () => {
  assert.equal(verdict('kelenken', 'latenivenatrix', 'cast').r, 1);
  assert.equal(verdict('kelenken', 'achillobator', 'cast').r, 2);
  assert.equal(verdict('kelenken', 'maip', 'cast').k, 'never');
  assert.equal(verdict('tyrannosaurus', 'compsognathus', 'solo').k, 'never');
  assert.equal(verdict('tyrannosaurus', 'giganotosaurus', 'solo').k, 'special');
  assert.equal(verdict('tyrannosaurus', 'eotriceratops', 'solo').r, 1);
  assert.equal(verdict('achillobator', 'deinonychus', 'solo').k, 'legal');
  assert.equal(verdict('achillobator', 'deinonychus', 'lateni').k, 'never', 'not with Latenivenatrix companions');
  assert.equal(verdict('achillobator', 'eotriceratops', 'lateni').r, 1);
  assert.equal(verdict('quetzalcoatlus', 'allosaurus', 'group').k, 'never');
  assert.equal(verdict('tropeognathus', 'hatzegopteryx', 'small').k, 'locked');
  assert.equal(verdict('tropeognathus', 'hatzegopteryx', 'big').k, 'special');
});

test('young-only rules keep the adult verdict visible', () => {
  const amarga = verdict('allosaurus', 'amargasaurus', 'solo');
  assert.equal(amarga.r, 1);
  assert.ok(amarga.c.includes('Adulte: Rang 3'));
  const kelenken = verdict('deinonychus', 'kelenken', 'small');
  assert.equal(kelenken.k, 'legal', 'adult Kelenken are ordinary Medium prey');
  assert.ok(kelenken.c.some(text => text.startsWith('Jungtiere:')));
});

test('special setups only hunt what they exist for', () => {
  assert.equal(verdict('torvosaurus', 'apatosaurus', 'mob').r, 1);
  assert.equal(verdict('torvosaurus', 'lambeosaurus', 'mob').k, 'out');
  assert.equal(verdict('tyrannotitan', 'argentinosaurus', 'solo').k, 'locked');
  assert.equal(verdict('tyrannotitan', 'giganotosaurus', 'mob').k, 'out');
  assert.equal(verdict('suchomimus', 'deinosuchus-shore', 'small').k, 'locked', 'Deinosuchus needs a snare of 3');
  assert.equal(verdict('megalania-arid', 'megalania-temperate', 'solo').k, 'allowed', 'the opposite variant is hunted');
  assert.equal(web.hunters['spinosaurus-freshwater'].edges.some(edge => edge.t === 'spinosaurus-saltwater'), false, 'variants of one species do not hunt each other');
  assert.equal(verdict('latenivenatrix', 'tyrannotitan', 'six').k, 'locked', 'Apex needs Achillobator companions');
});

test('aquatic hunters take land prey only at the water', () => {
  const para = verdict('tylosaurus', 'parasaurolophus', 'pair');
  assert.equal(para.r, 2);
  assert.deepEqual(para.c, ['am Strand oder schwimmend']);
  assert.equal(verdict('tylosaurus', 'achillobator', 'pair').k, 'special');
});
