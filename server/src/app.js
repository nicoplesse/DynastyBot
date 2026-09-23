import express from 'express';
import multer from 'multer';
import { copyFile, mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { buildProcessedData } from './processor.js';
import { searchAnalogs } from './analogs.js';

const extensions = new Set(['png', 'jpg', 'jpeg', 'webp']);
const upload = multer({
  storage: multer.diskStorage({ destination: tmpdir(), filename: (_req, _file, done) => done(null, `dynasty-bot-${randomUUID()}`) }),
  limits: { fileSize: 100 * 1024 * 1024, fieldSize: 1024 * 1024 },
});

export function slugify(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function imageExtension(file) {
  const handle = await open(file.path, 'r');
  const bytes = Buffer.alloc(12);
  try { await handle.read(bytes, 0, 12, 0); } finally { await handle.close(); }
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const originalExt = file.originalname.split('.').pop()?.toLowerCase();
  if (!extensions.has(originalExt) || !(png || jpg || webp)) return null;
  if ((originalExt === 'png' && png) || (['jpg', 'jpeg'].includes(originalExt) && jpg) || (originalExt === 'webp' && webp)) return originalExt;
  return null;
}

function safeImagePath(file) {
  return typeof file === 'string' && /^images\/[a-z0-9-]+\.(png|jpg|jpeg|webp)$/.test(file);
}

function parseImages(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error();
    return parsed;
  } catch { throw httpError(400, 'Invalid image metadata.'); }
}

async function manifestAt(directory) {
  return JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function createApp({
  dataDir = fileURLToPath(new URL('../../data/raw/', import.meta.url)),
  processedDir = fileURLToPath(new URL('../../data/processed/', import.meta.url)),
} = {}) {
  const app = express();
  const rawDir = resolve(dataDir);
  const derivedDir = resolve(processedDir);

  app.get('/api/catalog', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'index.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/catalog/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw httpError(400, 'Invalid profile ID.');
      res.json(JSON.parse(await readFile(join(derivedDir, 'profiles', `${id}.json`), 'utf8')));
    } catch (error) { next(error); }
  });

  app.get('/api/ecosystems', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'ecosystems.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/rules', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'rules.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/map', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'map.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/map-index', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'map-index.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/analogs', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'analogs.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/analogs/search', async (req, res, next) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
      const limit = Math.min(61, Math.max(1, Number(req.query.limit) || 12));
      const index = JSON.parse(await readFile(join(derivedDir, 'analogs.json'), 'utf8'));
      res.json(searchAnalogs(index, query, { limit }));
    } catch (error) { next(error); }
  });

  app.get('/api/matchups', async (_req, res, next) => {
    try { res.json(JSON.parse(await readFile(join(derivedDir, 'matchups.json'), 'utf8'))); }
    catch (error) { next(error); }
  });

  app.get('/api/profiles', async (_req, res, next) => {
    try {
      await mkdir(rawDir, { recursive: true });
      const entries = await readdir(rawDir, { withFileTypes: true });
      const profiles = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        try {
          const manifest = await manifestAt(join(rawDir, entry.name));
          profiles.push({ id: entry.name, name: manifest.name, importedAt: manifest.importedAt, imageCount: manifest.images?.length || 0 });
        } catch { /* Skip incomplete folders without blocking imports. */ }
      }
      profiles.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
      res.json(profiles);
    } catch (error) { next(error); }
  });

  app.get('/api/profiles/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw httpError(400, 'Invalid profile ID.');
      const directory = join(rawDir, id);
      const manifest = await manifestAt(directory);
      const profile = await readFile(join(directory, 'profile.txt'), 'utf8');
      res.json({ manifest, profile });
    } catch (error) { next(error); }
  });

  app.get('/api/profiles/:id/images/:file', async (req, res, next) => {
    try {
      const { id, file } = req.params;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !safeImagePath(`images/${file}`)) throw httpError(400, 'Invalid image path.');
      const manifest = await manifestAt(join(rawDir, id));
      if (!manifest.images.some((image) => image.file === `images/${file}`)) throw httpError(404, 'Image not found.');
      res.sendFile(join(rawDir, id, 'images', file));
    } catch (error) { next(error); }
  });

  app.post('/api/profiles', upload.any(), async (req, res, next) => {
    let stage;
    let backup;
    try {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const uploaded = req.files || [];
      const profileFiles = uploaded.filter(file => file.fieldname === 'profile');
      const files = uploaded.filter(file => file.fieldname === 'images');
      const profileFile = profileFiles[0];
      const id = slugify(name);
      if (!name || !id) throw httpError(400, 'Playable name is required and must contain Latin letters or numbers.');
      if (profileFiles.length !== 1 || !profileFile.size || uploaded.length !== profileFiles.length + files.length) throw httpError(400, 'Exactly one raw profile is required.');
      const imageMetadata = parseImages(req.body.imageMetadata);
      if (imageMetadata.length !== files.length) throw httpError(400, 'Image metadata does not match uploaded images.');
      const retained = parseImages(req.body.retainedImages);
      await mkdir(rawDir, { recursive: true });
      const target = join(rawDir, id);
      let existing = null;
      try { existing = await manifestAt(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing && req.body.replace !== 'true') throw httpError(409, `${existing.name} already exists.`);
      if (!existing && retained.length) throw httpError(400, 'Cannot retain images from a missing profile.');
      if (existing && retained.length && req.body.sourceId !== id) throw httpError(400, 'Retained images do not belong to this profile.');

      stage = join(rawDir, `.stage-${randomUUID()}`);
      await mkdir(join(stage, 'images'), { recursive: true });
      await copyFile(profileFile.path, join(stage, 'profile.txt'));
      const images = [];
      const used = new Set();
      for (const item of retained) {
        if (!safeImagePath(item.file) || !existing?.images.some((image) => image.file === item.file)) throw httpError(400, 'Invalid retained image.');
        if (used.has(item.file)) throw httpError(400, 'Duplicate retained image.');
        used.add(item.file);
        await copyFile(join(target, item.file), join(stage, item.file));
        const original = existing.images.find((image) => image.file === item.file);
        images.push({ file: item.file, label: String(item.label || ''), originalFileName: original.originalFileName });
      }
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const extension = await imageExtension(file);
        if (!extension) throw httpError(400, `Unsupported or invalid image: ${file.originalname}`);
        const metadata = imageMetadata[index];
        const base = slugify(String(metadata.label || '')) || slugify(file.originalname.replace(/\.[^.]+$/, '')) || 'image';
        let candidate = `images/${base}.${extension}`;
        let suffix = 2;
        while (used.has(candidate)) candidate = `images/${base}-${suffix++}.${extension}`;
        used.add(candidate);
        await copyFile(file.path, join(stage, candidate));
        images.push({ file: candidate, label: String(metadata.label || ''), originalFileName: file.originalname });
      }
      const manifest = { schemaVersion: 1, id, name, importedAt: new Date().toISOString(), profileFile: 'profile.txt', images };
      await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      if (existing) {
        backup = join(rawDir, `.backup-${randomUUID()}`);
        await rename(target, backup);
      }
      try { await rename(stage, target); stage = null; }
      catch (error) {
        if (backup) { await rename(backup, target); backup = null; }
        throw error;
      }
      if (backup) { await rm(backup, { recursive: true, force: true }); backup = null; }
      await buildProcessedData({ rawDir, processedDir: derivedDir });
      res.status(existing ? 200 : 201).json(manifest);
    } catch (error) { next(error); }
    finally {
      if (stage) await rm(stage, { recursive: true, force: true }).catch(() => {});
      await Promise.all((req.files || []).map(file => rm(file.path, { force: true }).catch(() => {})));
    }
  });

  app.delete('/api/profiles/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw httpError(400, 'Invalid profile ID.');
      const directory = join(rawDir, id);
      await manifestAt(directory);
      await rm(directory, { recursive: true });
      await buildProcessedData({ rawDir, processedDir: derivedDir });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || (error.code === 'ENOENT' ? 404 : error instanceof multer.MulterError ? 400 : 500);
    res.status(status).json({ error: status === 500 ? 'Unexpected server error.' : error.message });
  });
  return app;
}
