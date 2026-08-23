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
}

walk(ROOT);

if (errors.length > 0) {
  console.error('Asset integrity validation FAILED:');
  for (const e of errors) console.error('  - ' + e);
  console.error(`\n${errors.length} of ${checked} runtime images are unusable. Replace them with complete files.`);
  process.exit(1);
}

console.log(`Asset integrity validation OK — ${checked} runtime images are complete and well-formed.`);
