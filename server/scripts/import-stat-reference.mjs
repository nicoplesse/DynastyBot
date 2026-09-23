import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// This is a one-time research import. The application never fetches stats at runtime.
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const host = 'https://nexlinkcore.com';
const directoryUrl = `${host}/guides/path-of-titans/curve-overrides/alderons/path-of-titans-achillobator`;
const names = {
  apatosaurus: 'PTApatosaurus', argentinosaurus: 'PTArgent', austroraptor: 'PTAustroraptor',
  citipati: 'TCCitipati', compsognathus: 'DivineCompy', deinosuchus: 'DivineDeino',
  dilophosaurus: 'PTDilophosaurus', dryosaurus: 'DivineDryo', giganotosaurus: 'PTGiga',
  halszkaraptor: 'DivineHalsz', kelenken: 'PTKelenken', lurdusaurus: 'PTLurdusaurus',
  maip: 'PTMaip', pachyrhinosaurus: 'PWPachyrhinosaurus',
  parasaurolophus: 'PTParasaurolophus', psittacosaurus: 'PTPsittacosaurus',
  quetzalcoatlus: 'PTQuetzalcoatlus', tenontosaurus: 'GTenontosaurus',
  therizinosaurus: 'PTTherizinosaurus', torvosaurus: 'PTTorvosaurus',
  tropeognathus: 'ArazoaTropeo', utahraptor: 'PTUtahraptor',
  yunnanosaurus: 'PTYunnano', yutyrannus: 'PTYutyrannus',
};

function decode(value) {
  return value.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

async function getPage(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'DynastyBot local reference import' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseCurves(html) {
  const curves = {};
  for (const match of html.matchAll(/<div class="ec-line">([\s\S]*?)<\/div><\/div>/g)) {
    const line = decode(match[1]);
    const stat = line.match(/([A-Za-z][A-Za-z0-9_.]*)",Values=\(([^)]*)\)/);
    if (!stat) continue;
    const values = stat[2].split(',').map(value => Number(value.trim()));
    if (values.length && values.every(Number.isFinite)) curves[stat[1]] = values;
  }
  return curves;
}

const catalog = JSON.parse(await readFile(join(projectRoot, 'data', 'processed', 'index.json'), 'utf8'));
const directory = await getPage(directoryUrl);
const links = [...directory.matchAll(/<a href="([^"]+)" class="guide-link">([^<]+)<\/a>/g)]
  .map(match => ({ url: `${host}${match[1]}`, title: decode(match[2]) }))
  .filter(link => link.url.includes('/curve-overrides/') && !link.url.includes('/critters/'));
const references = {};
const failures = [];
const work = [...catalog.profiles];
const workers = Array.from({ length: 4 }, async () => {
  while (work.length) {
    const profile = work.shift();
    const title = names[profile.id] || profile.name;
    const candidates = links.filter(link => link.title.toLowerCase() === title.toLowerCase());
    const link = candidates.find(item => item.url.includes('/alderons/')) || candidates[0];
    if (!link) { failures.push(`${profile.id}: no matching source for ${title}`); continue; }
    try {
      const html = await getPage(link.url);
      const curves = parseCurves(html);
      const date = html.match(/LAST UPDATED[\s\S]{0,500}?(\d{2}-\d{2}-\d{4})/i)?.[1] || null;
      if (Object.keys(curves).length < 10) throw new Error(`only ${Object.keys(curves).length} curves parsed`);
      references[profile.id] = {
        id: profile.id,
        sourceTitle: link.title,
        sourceUrl: link.url,
        sourceType: link.url.includes('/alderons/') ? 'Alderon default curves, third-party mirror' : 'Mod default curves, third-party mirror',
        sourceUpdatedAt: date,
        curves,
      };
      process.stdout.write(`${profile.id}: ${Object.keys(curves).length} curves\n`);
    } catch (error) { failures.push(`${profile.id}: ${error.message}`); }
  }
});
await Promise.all(workers);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  const output = { schemaVersion: 1, fetchedAt: new Date().toISOString(),
    explanation: 'Snapshot of publicly listed default curves. NexLink Core is an independent reference, not Alderon Games or a mod creator.',
    sources: Object.fromEntries(Object.entries(references).sort(([a], [b]) => a.localeCompare(b))),
  };
  const target = join(projectRoot, 'data', 'reference');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'baselines.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(`Imported ${Object.keys(references).length} baseline stat sheets.`);
}
