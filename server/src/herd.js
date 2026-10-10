// "Meine Dinos": the player's own dinosaurs. Each one is a folder data/herd/<id>/ with
//   dino.json        structured record (genetics filled by the /aktualisiere skill, links and photo from the UI)
//   screenshots/     raw imported screenshots, stored byte for byte and never modified
//   photo-*.<ext>    optional photo of the dino
// A screenshot is "pending" until the skill has read it (processedAt stays null).
import { copyFile, mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const defaultHerdDir = fileURLToPath(new URL('../../data/herd/', import.meta.url));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const filePattern = /^(screenshots\/[a-z0-9-]+|photo-[a-z0-9-]+)\.(png|jpg|webp)$/;
const sexes = new Set(['female', 'male']);

export function herdError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function herdSlug(name) {
  return String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isHerdFile(file) { return typeof file === 'string' && filePattern.test(file); }

// Uploads are recognised by their bytes, so pasted clipboard images without a usable name work too.
export async function imageKind(path) {
  const handle = await open(path, 'r');
  const bytes = Buffer.alloc(12);
  try { await handle.read(bytes, 0, 12, 0); } finally { await handle.close(); }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function text(value, max = 400) {
  if (value == null) return '';
  if (typeof value !== 'string') throw herdError(400, 'Expected text.');
  return value.trim().slice(0, max);
}

function url(value, label) {
  const trimmed = text(value, 2000);
  if (!trimmed) return '';
  let parsed;
  try { parsed = new URL(trimmed); } catch { throw herdError(400, `${label} must be a full http(s) link.`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw herdError(400, `${label} must be a full http(s) link.`);
  return parsed.href;
}

function list(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw herdError(400, `${label} must be a list.`);
  return [...new Set(value.map(item => text(item, 120)).filter(Boolean))];
}

export function normalizeGenetics(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw herdError(400, 'Genetics must be an object.');
  const skins = value.skins || {};
  if (typeof skins !== 'object' || Array.isArray(skins)) throw herdError(400, 'Skins must be an object.');
  const pairs = (items, label, key, valueKey) => {
    if (items == null) return [];
    if (!Array.isArray(items)) throw herdError(400, `${label} must be a list.`);
    return items.map(item => typeof item === 'string' ? { [key]: text(item, 120), [valueKey]: '' } : { [key]: text(item?.[key], 120), [valueKey]: text(item?.[valueKey], 400) })
      .filter(item => item[key]);
  };
  return {
    bloodlines: list(value.bloodlines, 'Bloodlines'),
    skins: { dominant: list(skins.dominant, 'Dominant skins'), recessive: list(skins.recessive, 'Recessive skins') },
    mutations: pairs(value.mutations, 'Mutations', 'name', 'note'),
    extra: pairs(value.extra, 'Extra details', 'label', 'value'),
  };
}

async function knownPlayables(processedDir) {
  try {
    const index = JSON.parse(await readFile(join(processedDir, 'index.json'), 'utf8'));
    return new Map(index.profiles.map(profile => [profile.id, profile.name]));
  } catch { return null; }
}

export function createHerdStore({ herdDir = defaultHerdDir, processedDir } = {}) {
  const root = resolve(herdDir);

  async function playableId(value) {
    const id = text(value, 80);
    if (!id) return null;
    if (!idPattern.test(id)) throw herdError(400, 'Invalid playable.');
    const known = processedDir ? await knownPlayables(processedDir) : null;
    if (known && !known.has(id)) throw herdError(400, `Unknown playable: ${id}`);
    return id;
  }

  function folder(id) {
    if (!idPattern.test(id)) throw herdError(400, 'Invalid dino ID.');
    return join(root, id);
  }

  async function read(id) {
    try { return JSON.parse(await readFile(join(folder(id), 'dino.json'), 'utf8')); }
    catch (error) { throw error.code === 'ENOENT' ? herdError(404, 'Dino not found.') : error; }
  }

  async function write(dino) {
    dino.updatedAt = new Date().toISOString();
    const target = join(folder(dino.id), 'dino.json');
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(dino, null, 2) + '\n', 'utf8');
    await rename(temp, target);
    return dino;
  }

  async function all() {
    await mkdir(root, { recursive: true });
    const dinos = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
      try { dinos.push(await read(entry.name)); } catch { /* Skip incomplete folders. */ }
    }
    return dinos.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  // Resolves a dino by id or by name ("Malekit", "malekit").
  async function find(key) {
    const slug = herdSlug(key);
    if (!slug) throw herdError(404, 'Dino not found.');
    const dinos = await all();
    const match = dinos.find(dino => dino.id === slug) || dinos.find(dino => herdSlug(dino.name) === slug);
    if (!match) throw herdError(404, `Dino not found: ${key}`);
    return match;
  }

  // Creates the dino if needed and stores new screenshots and an optional photo next to it.
  async function addFiles({ id, name, playable, screenshots = [], photo = null, proofs = {} }) {
    // Optional links from the import form; empty fields keep what the dino already has.
    const links = { mutation: url(proofs.mutation, 'Mutation proof'), nesting: url(proofs.nesting, 'Nesting proof') };
    let dino;
    let created = false;
    if (id) dino = await read(id);
    else {
      const cleanName = text(name, 80);
      const slug = herdSlug(cleanName);
      if (!cleanName || !slug) throw herdError(400, 'Dino name is required and must contain Latin letters or numbers.');
      try { dino = await read(slug); }
      catch (error) {
        if (error.status !== 404) throw error;
        const now = new Date().toISOString();
        created = true;
        dino = { schemaVersion: 1, id: slug, name: cleanName, playableId: null, sex: null, photo: null, proofs: { mutation: '', nesting: '' }, notes: '', genetics: null, screenshots: [], createdAt: now, updatedAt: now };
        await mkdir(join(folder(slug), 'screenshots'), { recursive: true });
      }
    }
    if (playable !== undefined && text(playable, 80)) dino.playableId = await playableId(playable);
    if (links.mutation) dino.proofs.mutation = links.mutation;
    if (links.nesting) dino.proofs.nesting = links.nesting;
    await mkdir(join(folder(dino.id), 'screenshots'), { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const used = new Set(dino.screenshots.map(shot => shot.file));
    const copied = [];
    try {
      for (const upload of screenshots) {
        const kind = await imageKind(upload.path);
        if (!kind) throw herdError(400, `Unsupported or invalid image: ${upload.originalname}`);
        let suffix = 1;
        let file = `screenshots/${stamp}-${suffix}.${kind}`;
        while (used.has(file)) file = `screenshots/${stamp}-${++suffix}.${kind}`;
        used.add(file);
        await copyFile(upload.path, join(folder(dino.id), file));
        copied.push(file);
        dino.screenshots.push({ file, originalFileName: String(upload.originalname || ''), addedAt: new Date().toISOString(), processedAt: null, transcript: '' });
      }
      if (photo) {
        const kind = await imageKind(photo.path);
        if (!kind) throw herdError(400, `Unsupported or invalid photo: ${photo.originalname}`);
        const file = `photo-${stamp}.${kind}`;
        await copyFile(photo.path, join(folder(dino.id), file));
        copied.push(file);
        if (dino.photo && dino.photo !== file) await rm(join(folder(dino.id), dino.photo), { force: true });
        dino.photo = file;
      }
    } catch (error) {
      await Promise.all(copied.map(file => rm(join(folder(dino.id), file), { force: true })));
      if (created) await rm(folder(dino.id), { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return write(dino);
  }

  // Edits from the UI or the skill. Only the given fields change.
  async function update(id, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw herdError(400, 'Invalid update.');
    const dino = await read(id);
    if ('name' in patch) {
      const name = text(patch.name, 80);
      if (!name) throw herdError(400, 'Dino name is required.');
      dino.name = name;
    }
    if ('playableId' in patch) dino.playableId = await playableId(patch.playableId);
    if ('sex' in patch) {
      if (patch.sex != null && patch.sex !== '' && !sexes.has(patch.sex)) throw herdError(400, 'Sex must be female or male.');
      dino.sex = patch.sex || null;
    }
    if ('notes' in patch) dino.notes = text(patch.notes, 4000);
    if ('proofs' in patch) {
      const proofs = patch.proofs || {};
      dino.proofs = {
        mutation: 'mutation' in proofs ? url(proofs.mutation, 'Mutation proof') : dino.proofs.mutation,
        nesting: 'nesting' in proofs ? url(proofs.nesting, 'Nesting proof') : dino.proofs.nesting,
      };
    }
    if ('genetics' in patch) {
      const genetics = normalizeGenetics(patch.genetics);
      dino.genetics = genetics && { ...genetics, updatedAt: new Date().toISOString() };
    }
    if ('transcripts' in patch) {
      const transcripts = patch.transcripts || {};
      for (const [file, value] of Object.entries(transcripts)) {
        const shot = dino.screenshots.find(item => item.file === file);
        if (!shot) throw herdError(400, `Unknown screenshot: ${file}`);
        shot.transcript = text(value, 20000);
      }
    }
    if ('processed' in patch) {
      const files = patch.processed === 'pending' ? dino.screenshots.filter(shot => !shot.processedAt).map(shot => shot.file) : patch.processed;
      if (!Array.isArray(files)) throw herdError(400, 'Processed must be a list of screenshots or "pending".');
      const now = new Date().toISOString();
      for (const file of files) {
        const shot = dino.screenshots.find(item => item.file === file);
        if (!shot) throw herdError(400, `Unknown screenshot: ${file}`);
        shot.processedAt = now;
      }
    }
    return write(dino);
  }

  async function removeFile(id, file) {
    if (!isHerdFile(file)) throw herdError(400, 'Invalid file.');
    const dino = await read(id);
    if (dino.photo === file) dino.photo = null;
    else if (dino.screenshots.some(shot => shot.file === file)) dino.screenshots = dino.screenshots.filter(shot => shot.file !== file);
    else throw herdError(404, 'File not found.');
    await rm(join(folder(id), file), { force: true });
    return write(dino);
  }

  async function remove(id) {
    await read(id);
    await rm(folder(id), { recursive: true });
  }

  async function filePath(id, file) {
    if (!isHerdFile(file)) throw herdError(400, 'Invalid file.');
    const dino = await read(id);
    if (dino.photo !== file && !dino.screenshots.some(shot => shot.file === file)) throw herdError(404, 'File not found.');
    return join(folder(id), file);
  }

  return { root, all, read, find, addFiles, update, removeFile, remove, filePath, folder };
}
