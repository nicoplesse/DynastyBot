// "Galerie": all of the player's own images in one folder, data/gallery/.
//   <name>.<png|jpg|jpeg|webp>  the images, stored byte for byte; an image saved into the folder by hand shows up too
//   gallery.json               what each image shows, keyed by file name:
//                              { dinos: [own dino ids], species: [playable ids], background, caption, addedAt, originalFileName }
// An image without dinos, species or the background flag is unclassified, and still listed.
// Dino photos and event photos only point here ("gallery/<name>"), so one image can be in the
// gallery and be the face of a dino at the same time.
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { imageKind } from './images.js';

export const defaultGalleryDir = fileURLToPath(new URL('../../data/gallery/', import.meta.url));
export const galleryPrefix = 'gallery/';
const indexFile = 'gallery.json';
const imageExtension = /\.(png|jpe?g|webp)$/i;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function galleryError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Hand-saved files keep their own names (spaces, capitals, umlauts); anything that could leave the folder is refused.
export function isGalleryName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 200 && imageExtension.test(name)
    && !/[\\/\u0000-\u001f]/.test(name) && !name.startsWith('.') && name.trim() === name;
}
export const isGalleryRef = value => typeof value === 'string' && value.startsWith(galleryPrefix) && isGalleryName(value.slice(galleryPrefix.length));
export const galleryName = ref => ref.slice(galleryPrefix.length);
export const galleryRef = name => `${galleryPrefix}${name}`;

function slug(value) {
  return String(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function text(value, max) {
  if (value == null) return '';
  if (typeof value !== 'string') throw galleryError(400, 'Expected text.');
  return value.trim().slice(0, max);
}

function ids(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw galleryError(400, `${label} must be a list.`);
  const list = [...new Set(value.map(item => text(item, 80)).filter(Boolean))];
  const bad = list.find(item => !idPattern.test(item));
  if (bad) throw galleryError(400, `Invalid ${label.toLowerCase()} ID: ${bad}`);
  return list;
}

const stored = value => Array.isArray(value) ? value.filter(item => typeof item === 'string' && idPattern.test(item)) : [];

async function knownPlayables(processedDir) {
  try {
    const index = JSON.parse(await readFile(join(processedDir, 'index.json'), 'utf8'));
    return new Set(index.profiles.map(profile => profile.id));
  } catch { return null; }
}

export function createGalleryStore({ galleryDir = defaultGalleryDir, processedDir } = {}) {
  const root = resolve(galleryDir);
  // Clicks in the gallery save one after the other, so quick changes never overwrite each other.
  let queue = Promise.resolve();
  const locked = task => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  function assertName(name) {
    if (!isGalleryName(name)) throw galleryError(400, 'Invalid image name.');
    return join(root, name);
  }

  async function files() {
    await mkdir(root, { recursive: true });
    return (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile() && isGalleryName(entry.name)).map(entry => entry.name);
  }

  async function readIndex() {
    try {
      const parsed = JSON.parse(await readFile(join(root, indexFile), 'utf8'));
      return { images: parsed && typeof parsed.images === 'object' && !Array.isArray(parsed.images) ? parsed.images : {} };
    } catch (error) {
      if (error.code === 'ENOENT') return { images: {} };
      throw error; // a broken gallery.json is never silently replaced
    }
  }

  // Entries of files that were deleted or renamed by hand are dropped, so a new file of that name starts unclassified.
  async function writeIndex(index) {
    const present = new Set(await files());
    const images = Object.fromEntries(Object.entries(index.images).filter(([name]) => present.has(name)).sort(([a], [b]) => a.localeCompare(b)));
    const target = join(root, indexFile);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify({ schemaVersion: 1, images }, null, 2) + '\n', 'utf8');
    // On Windows a virus scanner or Explorer preview may hold gallery.json for a moment; try again briefly.
    for (let attempt = 1; ; attempt += 1) {
      try { await rename(temp, target); return; }
      catch (error) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 10) { await rm(temp, { force: true }); throw error; }
        await new Promise(resolve => setTimeout(resolve, attempt * 30));
      }
    }
  }

  async function info(name) {
    try { return await stat(assertName(name)); }
    catch (error) { throw error.code === 'ENOENT' ? galleryError(404, `Image not found: ${name}`) : error; }
  }

  function entry(name, meta = {}, details) {
    const dinos = stored(meta.dinos);
    const species = stored(meta.species);
    const background = meta.background === true;
    return {
      file: name, dinos, species, background, caption: typeof meta.caption === 'string' ? meta.caption : '',
      addedAt: typeof meta.addedAt === 'string' && meta.addedAt ? meta.addedAt : details.mtime.toISOString(),
      originalFileName: typeof meta.originalFileName === 'string' ? meta.originalFileName : '',
      size: details.size, classified: dinos.length > 0 || species.length > 0 || background,
    };
  }

  // Newest first; a file saved by hand counts from its own date.
  async function list() {
    const index = await readIndex();
    const items = await Promise.all((await files()).map(async name => entry(name, index.images[name], await stat(join(root, name)))));
    return items.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.file.localeCompare(b.file));
  }

  async function get(name) {
    const details = await info(name);
    return entry(name, (await readIndex()).images[name], details);
  }

  async function path(name) {
    await info(name);
    return join(root, name);
  }

  async function speciesIds(value) {
    const list = ids(value, 'Species');
    const known = processedDir ? await knownPlayables(processedDir) : null;
    const unknown = known && list.find(id => !known.has(id));
    if (unknown) throw galleryError(400, `Unknown playable: ${unknown}`);
    return list;
  }

  async function freeName(base, kind, taken) {
    const clean = slug(base).slice(0, 80) || 'bild';
    let name = `${clean}.${kind}`;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${clean}-${n}.${kind}`;
    taken.add(name.toLowerCase()); // Windows treats Bild.png and bild.png as one file
    return name;
  }

  // Stores uploads under a readable name from the original file name; extra tags come from the server (dino photo, kill).
  function add(uploads, tags = {}) {
    return locked(async () => {
      const index = await readIndex();
      const taken = new Set((await files()).map(name => name.toLowerCase()));
      const added = [];
      try {
        for (const upload of uploads) {
          const kind = await imageKind(upload.path);
          if (!kind) throw galleryError(400, `Unsupported or invalid image: ${upload.originalname}`);
          const name = await freeName(String(upload.originalname || '').replace(/\.[^.]+$/, ''), kind, taken);
          await copyFile(upload.path, join(root, name));
          added.push(name);
          index.images[name] = {
            dinos: stored(tags.dinos), species: stored(tags.species), background: false, caption: text(tags.caption, 200),
            addedAt: new Date().toISOString(), originalFileName: String(upload.originalname || ''),
          };
        }
        await writeIndex(index);
      } catch (error) {
        await Promise.all(added.map(name => rm(join(root, name), { force: true })));
        throw error;
      }
      return Promise.all(added.map(async name => entry(name, index.images[name], await stat(join(root, name)))));
    });
  }

  // Moves a file from elsewhere on disk into the gallery (used once for the older per-dino photos).
  function move(source, base, meta = {}) {
    return locked(async () => {
      const kind = await imageKind(source);
      if (!kind) throw galleryError(400, `Unsupported or invalid image: ${source}`);
      const index = await readIndex();
      const name = await freeName(base, kind, new Set((await files()).map(item => item.toLowerCase())));
      try { await rename(source, join(root, name)); }
      catch (error) {
        if (error.code !== 'EXDEV') throw error;
        await copyFile(source, join(root, name));
        await rm(source);
      }
      index.images[name] = {
        dinos: stored(meta.dinos), species: stored(meta.species), background: meta.background === true, caption: text(meta.caption, 200),
        ...(meta.addedAt && { addedAt: meta.addedAt }), originalFileName: text(meta.originalFileName, 200),
      };
      await writeIndex(index);
      return entry(name, index.images[name], await stat(join(root, name)));
    });
  }

  // Changes what an image shows; only the given fields change. Own dinos are checked by the caller.
  async function classify(name, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw galleryError(400, 'Invalid update.');
    const changes = {};
    if ('dinos' in patch) changes.dinos = ids(patch.dinos, 'Dinos');
    if ('species' in patch) changes.species = await speciesIds(patch.species);
    if ('background' in patch) {
      if (typeof patch.background !== 'boolean') throw galleryError(400, 'Background must be true or false.');
      changes.background = patch.background;
    }
    if ('caption' in patch) changes.caption = text(patch.caption, 200);
    return locked(async () => {
      const details = await info(name);
      const index = await readIndex();
      const meta = { ...(index.images[name] || {}), ...changes };
      if (!meta.addedAt) meta.addedAt = details.mtime.toISOString();
      index.images[name] = meta;
      await writeIndex(index);
      return entry(name, meta, details);
    });
  }

  // Adds a dino and its species to an image, e.g. when it becomes that dino's photo.
  function tag(name, { dinos = [], species = [] }) {
    return locked(async () => {
      const details = await info(name);
      const index = await readIndex();
      const meta = { ...(index.images[name] || {}) };
      meta.dinos = [...new Set([...stored(meta.dinos), ...stored(dinos)])];
      meta.species = [...new Set([...stored(meta.species), ...stored(species)])];
      if (!meta.addedAt) meta.addedAt = details.mtime.toISOString();
      index.images[name] = meta;
      await writeIndex(index);
      return entry(name, meta, details);
    });
  }

  function remove(name) {
    return locked(async () => {
      await info(name);
      const index = await readIndex();
      await rm(join(root, name), { force: true });
      delete index.images[name];
      await writeIndex(index);
    });
  }

  return { root, list, get, path, add, move, classify, tag, remove };
}
