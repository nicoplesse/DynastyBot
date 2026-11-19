import { open } from 'node:fs/promises';

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
