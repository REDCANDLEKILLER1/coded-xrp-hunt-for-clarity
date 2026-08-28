// Runtime asset integrity gate.
//
// existsSync and a .webp extension are not evidence that an image will decode.
// Two Regulatory Warship interior backgrounds shipped truncated: valid RIFF/VP8
// headers, correct dimensions in the header, ~91% of the payload missing. Every
// existing check passed and both rooms rendered as flat fill in game.
//
// This walks every runtime image, parses the container, and asserts the file
// actually holds the bytes its own header declares.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, relative } from 'node:path';

const ROOT = 'public/assets';
const errors = [];
let checked = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(webp|png)$/i.test(entry)) inspect(full);
  }
}

function inspect(path) {
  checked += 1;
  const rel = relative('.', path);
  const buf = readFileSync(path);

  if (buf.length === 0) {
    errors.push(`${rel}: file is empty`);
    return;
  }

  if (/\.webp$/i.test(path)) inspectWebp(rel, buf);
  else inspectPng(rel, buf);
}

function inspectWebp(rel, buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    errors.push(`${rel}: not a valid RIFF/WEBP container`);
    return;
  }

  // The RIFF size field counts every byte after itself, so the complete file is
  // that value plus the 8-byte 'RIFF' + size preamble.
  const declaredTotal = buf.readUInt32LE(4) + 8;
  if (buf.length < declaredTotal) {
    errors.push(
      `${rel}: TRUNCATED — header declares ${declaredTotal} bytes, file holds ${buf.length} (${declaredTotal - buf.length} missing)`,
    );
    return;
  }

  // Walk the chunk table so a chunk that overruns the file is caught too.
  let offset = 12;
  while (offset + 8 <= declaredTotal) {
    const tag = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const payloadEnd = offset + 8 + size;
    if (payloadEnd > buf.length) {
      errors.push(`${rel}: chunk '${tag.trim()}' declares ${size} bytes but only ${buf.length - offset - 8} remain`);
      return;
    }
    // Lossy keyframes carry the first partition size in the frame header; if
    // even that is short nothing can be decoded.
    if (tag === 'VP8 ' && size >= 10) {
      const d = buf.subarray(offset + 8, payloadEnd);
      const tmp = d[0] | (d[1] << 8) | (d[2] << 16);
      const firstPartition = (tmp >> 5) & 0x7ffff;
      if (firstPartition > d.length - 10) {
        errors.push(`${rel}: VP8 first partition needs ${firstPartition} bytes, only ${d.length - 10} present`);
        return;
      }
    }
    offset = payloadEnd + (size % 2); // chunks are word-aligned
  }
}

// Generated art arrives rendered on solid black. Pasted in unprocessed it draws
// a black rectangle around the effect -- which happened once with the Clarity
// Lance beam and is invisible to a size or checksum check. Sprites must carry
// real transparency; backgrounds and interiors are full-bleed by design.
const SPRITE_DIRS = /\/(projectiles|pickups|vfx|ships|enemies|bosses|special|characters)\//;

/**
 * Whether a sprite's border is see-through.
 *
 * Checking only that an alpha CHANNEL exists catches nothing -- every PNG the
 * asset pipeline writes is RGBA, black box or not. So this decodes the image
 * and reads the actual border pixels: a keyed sprite fades to nothing at its
 * edges, a raw render-on-black is opaque all the way to the corners.
 *
 * Returns null when the format is outside what this can decode (interlaced,
 * 16-bit, palette), which is treated as "cannot judge" rather than a failure.
 */
function pngBorderIsOpaque(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const depth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (depth !== 8 || interlace !== 0 || (colorType !== 4 && colorType !== 6)) return null;

  const channels = colorType === 6 ? 4 : 2;
  let idat = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.subarray(off + 4, off + 8).toString('latin1');
    if (tag === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    if (tag === 'IEND') break;
    off += 12 + len;
  }
  let raw;
  try { raw = inflateSync(Buffer.concat(idat)); } catch { return null; }

  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;

  const alphaAt = [];
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos]; pos += 1;
    const line = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    prev = line;
    if (y === 0 || y === height - 1) {
      for (let x = 0; x < width; x++) alphaAt.push(line[x * channels + channels - 1]);
    } else {
      alphaAt.push(line[channels - 1], line[(width - 1) * channels + channels - 1]);
    }
  }
  return alphaAt.every((a) => a > 250);
}

function inspectPng(rel, buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) {
    errors.push(`${rel}: not a valid PNG signature`);
    return;
  }
  let offset = 8;
  let sawIend = false;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset);
    const tag = buf.toString('ascii', offset + 4, offset + 8);
    const next = offset + 12 + size; // length + type + data + crc
    if (next > buf.length) {
      errors.push(`${rel}: TRUNCATED — chunk '${tag}' overruns the file`);
      return;
    }
    if (tag === 'IEND') { sawIend = true; break; }
    offset = next;
  }
  if (!sawIend) errors.push(`${rel}: TRUNCATED — no IEND chunk, the file ends mid-stream`);
  if (sawIend && SPRITE_DIRS.test(`/${rel.replace(/\\/g, '/')}`) && pngBorderIsOpaque(buf) === true) {
    errors.push(`${rel}: sprite has no transparency — it will draw as a black box; key the background out`);
  }
}

walk(ROOT);

if (errors.length > 0) {
  console.error('Asset integrity validation FAILED:');
  for (const e of errors) console.error('  - ' + e);
  console.error(`\n${errors.length} of ${checked} runtime images are unusable. Replace them with complete files.`);
  process.exit(1);
}

console.log(`Asset integrity validation OK — ${checked} runtime images are complete and well-formed.`);
