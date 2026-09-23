import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const batches = [
  ['tylosaurus', 'kaiwhekea', 'eurhinosaurus'],
  ['deinosuchus', 'suchomimus', 'sarcosuchus', 'austroraptor', 'concavenator'],
  ['deinocheirus', 'lurdusaurus', 'halszkaraptor'],
  ['hatzegopteryx', 'quetzalcoatlus', 'thalassodromeus', 'tropeognathus', 'rhamphorhynchus'],
  ['tyrannosaurus', 'giganotosaurus', 'tyrannotitan', 'torvosaurus', 'daspletosaurus', 'maip'],
  ['allosaurus', 'pycnonemosaurus', 'yutyrannus', 'metriacanthosaurus', 'ceratosaurus', 'alioramus', 'dilophosaurus'],
  ['achillobator', 'utahraptor', 'kelenken', 'latenivenatrix', 'deinonychus', 'compsognathus'],
  ['argentinosaurus', 'apatosaurus', 'amargasaurus', 'yunnanosaurus', 'therizinosaurus'],
  ['eotriceratops', 'pachyrhinosaurus', 'albertaceratops', 'styracosaurus', 'psittacosaurus'],
  ['parasaurolophus', 'lambeosaurus', 'iguanodon', 'tenontosaurus', 'camptosaurus', 'dryosaurus', 'barsboldia'],
  ['stegosaurus', 'kentrosaurus', 'anodontosaurus', 'pachycephalosaurus', 'struthiomimus', 'citipati'],
];

test('all requested profiles resolve to unique polygon POI areas', async () => {
  const regionsDoc = JSON.parse(await readFile(join(projectRoot, 'data', 'map', 'regions.json'), 'utf8'));
  const regions = new Map(regionsDoc.regions.map(region => [region.id, region]));
  const ids = batches.flat();
  assert.equal(ids.length, 58);

  for (const id of ids) {
    const poiDoc = JSON.parse(await readFile(join(projectRoot, 'data', 'raw', id, 'pois.json'), 'utf8'));
    assert.equal(poiDoc.source, 'curated-areas', `${id} should be protected from auto-detection`);
    assert.ok(poiDoc.pois.length > 0, `${id} needs at least one POI area`);
    assert.equal(new Set(poiDoc.pois.map(poi => poi.regionId)).size, poiDoc.pois.length, `${id} has duplicate POI areas`);
    for (const poi of poiDoc.pois) {
      const region = regions.get(poi.regionId);
      assert.ok(region, `${id} references missing region ${poi.regionId}`);
      assert.equal(region.shape?.type, 'polygon', `${id}/${poi.regionId} must resolve to an area`);
      assert.ok(region.shape.points.length >= 3, `${id}/${poi.regionId} needs a valid polygon`);
    }
  }
});

test('Tyrannosaurus uses the six territory subdivisions shown on its map', async () => {
  const poiDoc = JSON.parse(await readFile(join(projectRoot, 'data', 'raw', 'tyrannosaurus', 'pois.json'), 'utf8'));
  assert.deepEqual(poiDoc.pois.map(poi => poi.regionId), [
    'rex-northern-redwoods', 'rex-southern-redwoods',
    'rex-western-hills', 'rex-eastern-hills',
    'rex-upper-wollemi', 'rex-lower-wollemi',
  ]);
});
