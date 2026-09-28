// Minimal PNG codec for the shared-projection map images (8-bit RGB / RGBA, non-interlaced).
import zlib from 'node:zlib';

export function decodePNG(buf) {
  let p = 8, W = 0, H = 0, colorType = 2; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = W * bpp, full = Buffer.alloc(H * stride);
  let pos = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[pos++]; const o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? full[o + x - bpp] : 0;
      const b = y > 0 ? full[o - stride + x] : 0;
      const c = x >= bpp && y > 0 ? full[o - stride + x - bpp] : 0;
      let v = raw[pos++];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      full[o + x] = v;
    }
  }
  if (bpp === 3) return { W, H, data: full };
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0, j = 0; i < full.length; i += 4, j += 3) { rgb[j] = full[i]; rgb[j + 1] = full[i + 1]; rgb[j + 2] = full[i + 2]; }
  return { W, H, data: rgb };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Encode raw RGB (channels = 3) or RGBA (channels = 4) to PNG.
export function encodePNG(W, H, data, channels = 3) {
  const stride = W * channels, raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Bilinear resample of an RGB image to W x H.
export function resample(img, W, H) {
  if (img.W === W && img.H === H) return img;
  const out = Buffer.alloc(W * H * 3), sx = img.W / W, sy = img.H / H;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(img.H - 1, (y + 0.5) * sy - 0.5), y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(img.H - 1, y0 + 1), ty = Math.max(0, fy - y0);
    for (let x = 0; x < W; x++) {
      const fx = Math.min(img.W - 1, (x + 0.5) * sx - 0.5), x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(img.W - 1, x0 + 1), tx = Math.max(0, fx - x0);
      for (let c = 0; c < 3; c++) {
        const a = img.data[(y0 * img.W + x0) * 3 + c], b = img.data[(y0 * img.W + x1) * 3 + c];
        const d = img.data[(y1 * img.W + x0) * 3 + c], e = img.data[(y1 * img.W + x1) * 3 + c];
        out[(y * W + x) * 3 + c] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty);
      }
    }
  }
  return { W, H, data: out };
}
