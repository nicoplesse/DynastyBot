// "Meine Dinos": the player's own dinosaurs. Each one is a folder data/herd/<id>/ with
//   dino.json        structured record (genetics filled by the /aktualisiere skill, links and photo from the UI;
//                    bonds and character for social playables, from the UI or the skill; family for the ID file)
//   screenshots/     raw imported screenshots, stored byte for byte and never modified
// The dino's photo and the evidence photos of notable kills (family.events[].photo) live in the gallery
// (data/gallery/, see gallery.js) and are stored here as references "gallery/<name>". Older records may still
// name a file in the dino's folder (photo-*.<ext>, events/*.<ext>) until moveImagesToGallery has run.
// A dead dino keeps its folder; diedAt (YYYY-MM-DD) marks it as deceased, deathCause says how it died.
// A screenshot is "pending" until the skill has read it (processedAt stays null).
import { copyFile, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { imageKind } from './images.js';
import { createGalleryStore, galleryName, galleryRef, isGalleryRef } from './gallery.js';

export { imageKind };
export const defaultHerdDir = fileURLToPath(new URL('../../data/herd/', import.meta.url));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const filePattern = /^(screenshots\/[a-z0-9-]+|events\/[a-z0-9-]+|photo-[a-z0-9-]+)\.(png|jpg|webp)$/;
const eventPhotoPattern = /^events\/[a-z0-9-]+\.(png|jpg|webp)$/;
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

export function isHerdFile(file) { return typeof file === 'string' && (filePattern.test(file) || isGalleryRef(file)); }

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

// Relationships to other dinos (pair bonds, harem, family …), written in the player's own words.
export function normalizeBonds(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw herdError(400, 'Bonds must be a list.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw herdError(400, 'Each bond must be an object.');
    if (item.sex != null && item.sex !== '' && !sexes.has(item.sex)) throw herdError(400, 'Bond sex must be female or male.');
    return { name: text(item.name, 80), sex: item.sex || null, kind: text(item.kind, 60), status: text(item.status, 60), bloodline: text(item.bloodline, 120), note: text(item.note, 400) };
  }).filter(item => item.name);
}

export function normalizeCharacter(value) {
  if (value == null) return { traits: [], text: '' };
  if (typeof value !== 'object' || Array.isArray(value)) throw herdError(400, 'Character must be an object.');
  return { traits: list(value.traits, 'Character traits'), text: text(value.text, 2000) };
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function day(value, label, required = false) {
  const trimmed = text(value, 10);
  if (!trimmed && !required) return '';
  if (!datePattern.test(trimmed) || Number.isNaN(Date.parse(trimmed))) throw herdError(400, `${label} must be a date like 2026-10-29.`);
  return trimmed;
}

const eventKinds = new Set(['apex', 'giant', 'event']);
// Only some kills come with a photo of the moment; it is an image in the gallery (older records: the dino's events/ folder).
function eventPhoto(value) {
  const file = text(value, 220);
  if (file && !eventPhotoPattern.test(file) && !isGalleryRef(file)) throw herdError(400, 'Event photo must be a gallery image.');
  return file;
}

// Clutch number, counted across all of the dino's mates (1st clutch, 2nd clutch …); empty = unknown.
function clutchNo(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 999) throw herdError(400, 'Offspring clutch must be a whole number from 1.');
  return number;
}

// The family file (catalogue number, origin, siblings, calves, chronicle). Mates stay in bonds;
// each calf names its mother, so calves hang under the right mate in the family tree.
// Siblings share the dino's parents and stand beside it under them (half siblings name the other parent).
// clutches lists laid clutches by number, so a clutch without a calf still counts. hatchedAt (optional) dates the hatch
// for the Tylo age; without it the age counts from the day the dino joined the register.
export function normalizeFamily(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw herdError(400, 'Family must be an object.');
  const entries = (items, label) => {
    if (items == null) return [];
    if (!Array.isArray(items)) throw herdError(400, `${label} must be a list.`);
    return items.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw herdError(400, `Each ${label.toLowerCase()} entry must be an object.`);
      return item;
    });
  };
  const offspring = entries(value.offspring, 'Offspring').map(item => {
    if (item.sex != null && item.sex !== '' && !sexes.has(item.sex)) throw herdError(400, 'Offspring sex must be female or male.');
    return { name: text(item.name, 80), sex: item.sex || null, mother: text(item.mother, 80), clutch: clutchNo(item.clutch), born: day(item.born, 'Offspring born'), status: text(item.status, 60), note: text(item.note, 400) };
  }).filter(item => item.name);
  const siblings = entries(value.siblings, 'Siblings').map(item => {
    if (item.sex != null && item.sex !== '' && !sexes.has(item.sex)) throw herdError(400, 'Sibling sex must be female or male.');
    // A half sibling names the parent it does not share (e.g. the mother's other mate as father).
    const parents = Object.fromEntries(['mother', 'father'].map(field => [field, text(item[field], 80)]).filter(([, value]) => value));
    return { name: text(item.name, 80), sex: item.sex || null, status: text(item.status, 60), note: text(item.note, 400), ...parents };
  }).filter(item => item.name);
  // Clutches laid so far, also those no calf came from yet: they count for the Tylo age like any other.
  const clutches = entries(value.clutches, 'Clutches').map(item => ({ clutch: clutchNo(item.clutch), mate: text(item.mate, 80), date: day(item.date, 'Clutch date'), note: text(item.note, 400) }))
    .filter(item => item.clutch).sort((a, b) => a.clutch - b.clutch);
  const log = entries(value.log, 'Log').map(item => ({ date: day(item.date, 'Log date', true), text: text(item.text, 400), place: text(item.place, 80) }))
    .filter(item => item.text).sort((a, b) => a.date.localeCompare(b.date));
  // Notable kills and events, kept apart from the chronicle the way orca catalogues log exceptional
  // predation: another apex predator, a giant herbivore, or an unusual event (stranding, rescue …).
  const events = entries(value.events, 'Events').map(item => {
    const kind = item.kind || 'event';
    if (!eventKinds.has(kind)) throw herdError(400, `Event kind must be one of ${[...eventKinds].join(', ')}.`);
    return {
      date: day(item.date, 'Event date', true), kind, subject: text(item.subject, 80), playableId: text(item.playableId, 60),
      outcome: text(item.outcome, 60), technique: text(item.technique, 80), partners: text(item.partners, 120), place: text(item.place, 80), note: text(item.note, 400),
      photo: eventPhoto(item.photo),
    };
  }).filter(item => item.subject).sort((a, b) => a.date.localeCompare(b.date));
  return {
    catalogId: text(value.catalogId, 16), subspecies: text(value.subspecies, 40), origin: text(value.origin, 200),
    hatchedAt: day(value.hatchedAt, 'Hatched at'),
    mother: text(value.mother, 80), father: text(value.father, 80), siblings, offspring, clutches, log, events,
  };
}

async function knownPlayables(processedDir) {
  try {
    const index = JSON.parse(await readFile(join(processedDir, 'index.json'), 'utf8'));
    return new Map(index.profiles.map(profile => [profile.id, profile.name]));
  } catch { return null; }
}

// The gallery sits next to the herd folder (data/herd → data/gallery) unless one is passed in.
export function createHerdStore({ herdDir = defaultHerdDir, processedDir, gallery } = {}) {
  const root = resolve(herdDir);
  const pictures = gallery || createGalleryStore({ galleryDir: join(dirname(root), 'gallery'), processedDir });

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

  async function write(dino, { touch = true } = {}) {
    if (touch) dino.updatedAt = new Date().toISOString();
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

  // Resolves a dino by id or by name ("Malekit", "malekit"). A name can come back after a death
  // ("Neuer Malekith"): the living namesake wins over the dead.
  async function find(key) {
    const slug = herdSlug(key);
    if (!slug) throw herdError(404, 'Dino not found.');
    const matches = (await all()).filter(dino => dino.id === slug || herdSlug(dino.name) === slug);
    const match = matches.find(dino => !dino.diedAt) || matches.find(dino => dino.id === slug) || matches[0];
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
      // Screenshots go to the living dino of that name; a dead namesake stays untouched and the new one gets a free id.
      const dinos = await all();
      dino = dinos.find(item => !item.diedAt && (item.id === slug || herdSlug(item.name) === slug));
      if (!dino) {
        const taken = new Set(dinos.map(item => item.id));
        let newId = slug;
        for (let n = 2; taken.has(newId); n += 1) newId = `${slug}-${n}`;
        const now = new Date().toISOString();
        created = true;
        dino = { schemaVersion: 1, id: newId, name: cleanName, playableId: null, sex: null, photo: null, proofs: { mutation: '', nesting: '' }, notes: '', genetics: null, bonds: [], character: normalizeCharacter(null), screenshots: [], createdAt: now, updatedAt: now };
        await mkdir(join(folder(newId), 'screenshots'), { recursive: true });
      }
    }
    if (playable !== undefined && text(playable, 80)) dino.playableId = await playableId(playable);
    if (links.mutation) dino.proofs.mutation = links.mutation;
    if (links.nesting) dino.proofs.nesting = links.nesting;
    await mkdir(join(folder(dino.id), 'screenshots'), { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const used = new Set(dino.screenshots.map(shot => shot.file));
    const copied = [];
    let galleryImage = null;
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
      // A new photo goes into the gallery, tagged with the dino; an older gallery photo stays there.
      if (photo) {
        const kind = await imageKind(photo.path);
        if (!kind) throw herdError(400, `Unsupported or invalid photo: ${photo.originalname}`);
        [galleryImage] = await pictures.add([photo], { dinos: [dino.id], species: dino.playableId ? [dino.playableId] : [] });
        if (dino.photo && !isGalleryRef(dino.photo)) await rm(join(folder(dino.id), dino.photo), { force: true });
        dino.photo = galleryRef(galleryImage.file);
      }
    } catch (error) {
      await Promise.all(copied.map(file => rm(join(folder(dino.id), file), { force: true })));
      if (galleryImage) await pictures.remove(galleryImage.file).catch(() => {});
      if (created) await rm(folder(dino.id), { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return write(dino);
  }

  // Edits from the UI or the skill. Only the given fields change.
  async function update(id, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw herdError(400, 'Invalid update.');
    const dino = await read(id);
    let picked = null;
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
    // A dino that died stays in the herd with its date of death; empty = alive.
    if ('diedAt' in patch) dino.diedAt = day(patch.diedAt, 'Died at');
    if ('deathCause' in patch) dino.deathCause = text(patch.deathCause, 200);
    if ('notes' in patch) dino.notes = text(patch.notes, 4000);
    // Picks a gallery image as the dino's photo (null unlinks it; the image stays in the gallery).
    if ('photo' in patch) {
      if (patch.photo == null || patch.photo === '') dino.photo = null;
      else {
        if (!isGalleryRef(patch.photo)) throw herdError(400, 'Photo must be a gallery image.');
        await pictures.get(galleryName(patch.photo)).catch(error => { throw error.status === 404 ? herdError(400, `Unknown gallery image: ${galleryName(patch.photo)}`) : error; });
        dino.photo = patch.photo;
        picked = galleryName(patch.photo);
      }
    }
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
    if ('bonds' in patch) dino.bonds = normalizeBonds(patch.bonds);
    if ('character' in patch) dino.character = normalizeCharacter(patch.character);
    if ('family' in patch) dino.family = normalizeFamily(patch.family);
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
    const saved = await write(dino);
    if (picked) await pictures.tag(picked, { dinos: [dino.id], species: dino.playableId ? [dino.playableId] : [] });
    return saved;
  }

  const eventCaption = (dino, event) => [`${dino.name}: ${event.subject}`, event.outcome].filter(Boolean).join(' ');

  // Sets the evidence photo of one notable event, found by its date or subject (the only event if none is given).
  // The photo goes into the gallery, tagged with the dino; an older evidence photo stays there.
  async function setEventPhoto(id, match, upload) {
    const dino = await read(id);
    const events = dino.family?.events || [];
    const key = text(match, 80).toLowerCase();
    const hits = key ? events.filter(item => item.date === key || item.subject.toLowerCase() === key) : events;
    if (!hits.length) throw herdError(404, key ? `No event matches ${match}.` : `${dino.name} has no notable events yet.`);
    if (hits.length > 1) throw herdError(400, `Several events match; name one by date or subject: ${hits.map(item => `${item.date} ${item.subject}`).join(', ')}`);
    const kind = await imageKind(upload.path);
    if (!kind) throw herdError(400, `Unsupported or invalid photo: ${upload.originalname}`);
    const event = hits[0];
    const [image] = await pictures.add([upload], { dinos: [dino.id], species: [dino.playableId, event.playableId].filter(Boolean), caption: eventCaption(dino, event) });
    const previous = event.photo;
    event.photo = galleryRef(image.file);
    const saved = await write(dino);
    if (previous && !isGalleryRef(previous)) await rm(join(folder(dino.id), previous), { force: true });
    return { dino: saved, event, previous, image };
  }

  const eventWith = (dino, file) => (dino.family?.events || []).find(item => item.photo === file);

  // A gallery photo is only unlinked here; the image itself stays in the gallery.
  async function removeFile(id, file) {
    if (!isHerdFile(file)) throw herdError(400, 'Invalid file.');
    const dino = await read(id);
    if (dino.photo === file) dino.photo = null;
    else if (eventWith(dino, file)) eventWith(dino, file).photo = '';
    else if (dino.screenshots.some(shot => shot.file === file)) dino.screenshots = dino.screenshots.filter(shot => shot.file !== file);
    else throw herdError(404, 'File not found.');
    if (!isGalleryRef(file)) await rm(join(folder(id), file), { force: true });
    return write(dino);
  }

  async function remove(id) {
    await read(id);
    await rm(folder(id), { recursive: true });
  }

  async function filePath(id, file) {
    if (!isHerdFile(file)) throw herdError(400, 'Invalid file.');
    const dino = await read(id);
    if (dino.photo !== file && !dino.screenshots.some(shot => shot.file === file) && !eventWith(dino, file)) throw herdError(404, 'File not found.');
    return isGalleryRef(file) ? pictures.path(galleryName(file)) : join(folder(id), file);
  }

  // Where each gallery image is used: as a dino's photo or as the evidence photo of a notable kill.
  async function galleryUses() {
    const uses = new Map();
    const note = (ref, use) => { if (isGalleryRef(ref)) uses.set(galleryName(ref), [...(uses.get(galleryName(ref)) || []), use]); };
    for (const dino of await all()) {
      note(dino.photo, { dinoId: dino.id, dinoName: dino.name, kind: 'photo' });
      for (const event of dino.family?.events || []) note(event.photo, { dinoId: dino.id, dinoName: dino.name, kind: 'event', date: event.date, subject: event.subject });
    }
    return uses;
  }

  // Before a gallery image is deleted, every dino that points at it lets go.
  async function unlinkGallery(name) {
    const ref = galleryRef(name);
    const unlinked = [];
    for (const dino of await all()) {
      let changed = false;
      if (dino.photo === ref) { dino.photo = null; changed = true; unlinked.push({ dinoId: dino.id, dinoName: dino.name, kind: 'photo' }); }
      for (const event of dino.family?.events || []) {
        if (event.photo !== ref) continue;
        event.photo = '';
        changed = true;
        unlinked.push({ dinoId: dino.id, dinoName: dino.name, kind: 'event', date: event.date, subject: event.subject });
      }
      if (changed) await write(dino);
    }
    return unlinked;
  }

  // One-time move of the older per-dino photos (photo-*.<ext>, events/*.<ext>) into the gallery, tagged with
  // the dino and its species. Herd stamps are UTC, so the stamp in the old name becomes the gallery date.
  async function moveImagesToGallery() {
    const moved = [];
    const stampDate = file => {
      const match = basename(file).match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z` : undefined;
    };
    const stampOf = file => basename(file).replace(/\.[^.]+$/, '').replace(/^photo-/, '');
    for (const dino of await all()) {
      const species = dino.playableId ? [dino.playableId] : [];
      let changed = false;
      if (dino.photo && !isGalleryRef(dino.photo)) {
        const image = await pictures.move(join(folder(dino.id), dino.photo), `${dino.id}-photo-${stampOf(dino.photo)}`, { dinos: [dino.id], species, addedAt: stampDate(dino.photo), originalFileName: dino.photo });
        moved.push({ dino: dino.name, kind: 'photo', from: `data/herd/${dino.id}/${dino.photo}`, to: image.file });
        dino.photo = galleryRef(image.file);
        changed = true;
      }
      for (const event of dino.family?.events || []) {
        if (!event.photo || isGalleryRef(event.photo)) continue;
        const image = await pictures.move(join(folder(dino.id), event.photo), `${dino.id}-${herdSlug(event.subject)}-${stampOf(event.photo)}`, {
          dinos: [dino.id], species: [...new Set([...species, event.playableId].filter(Boolean))], caption: eventCaption(dino, event),
          addedAt: stampDate(event.photo), originalFileName: event.photo,
        });
        moved.push({ dino: dino.name, kind: 'event', from: `data/herd/${dino.id}/${event.photo}`, to: image.file });
        event.photo = galleryRef(image.file);
        changed = true;
      }
      if (!changed) continue;
      await write(dino, { touch: false });
      await rmdir(join(folder(dino.id), 'events')).catch(() => {}); // only if it is empty now
    }
    return moved;
  }

  return { root, gallery: pictures, all, read, find, addFiles, update, setEventPhoto, removeFile, remove, filePath, folder, galleryUses, unlinkGallery, moveImagesToGallery };
}
