import fs from 'node:fs';

const rooms = fs.readFileSync(new URL('../src/game/onfoot/InteriorRooms.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/manifest.json', import.meta.url), 'utf8'));

const requiredRoomTokens = [
  "key: 'docking_bay'",
  "key: 'security_checkpoint'",
  "key: 'access_corridor'",
  "key: 'maintenance_shaft'",
  "key: 'field_control'",
  "key: 'defense_deck'",
  'enemies: [',
  'platforms: [',
];
for (const token of requiredRoomTokens) {
  if (!rooms.includes(token)) throw new Error(`L1-I missing authored room token: ${token}`);
}

const requiredRuntimeTokens = [
  'REGULATORY_INTERIOR_ROOMS',
  'advanceRoom',
  'roomCleared',
  'drawRoomBackground',
  // The interior used to end by pointing at an unbuilt corridor. It is built
  // now, so the last room hands off to the Ledger Defense Core instead.
  "next: 'core_access'",
  'atExit',
  'verticalCamera',
  "brightness(1.42)",
  'PLAYER_RENDER_SIZE = 84',
  "rgba(0,0,0,0.14)",
];
for (const token of requiredRuntimeTokens) {
  if (!runtime.includes(token)) throw new Error(`L1-I missing runtime token: ${token}`);
}

if (runtime.includes("rgba(0,0,0,0.42)")) {
  throw new Error('L1-I mobile visibility regression: heavy 42% vignette returned');
}

// Every room's art must be present AND complete before a room may point at it.
// This used to forbid two filenames outright, because their first delivery
// reached the repo truncated. That is the wrong shape of check -- the files
// are fine now, and a name-based ban would have to be edited every time art
// lands. What actually matters is that no room points at a partial file:
// Chromium DECODES a truncated WebP, reports naturalWidth 1024, and paints the
// fragment, so the runtime's `complete && naturalWidth > 0` guard cannot tell
// one from real art and the room draws a near-blank wash instead of falling
// back. So: read each referenced file's own declared length and check the
// bytes are all there.
const interior = manifest.interior ?? {};
for (const [key, entry] of Object.entries(interior)) {
  if (!entry?.src) throw new Error(`L1-I manifest missing src for interior.${key}`);
  const file = new URL(`../public${entry.src}`, import.meta.url);
  if (!fs.existsSync(file)) throw new Error(`L1-I runtime asset missing: ${entry.src}`);
}

for (const [, src] of rooms.matchAll(/backgroundSrc:\s*'([^']+)'/g)) {
  const file = new URL(`../public${src}`, import.meta.url);
  if (!fs.existsSync(file)) throw new Error(`L1-I: a room points at ${src}, which does not exist`);
  const bytes = fs.readFileSync(file);
  // RIFF: "RIFF" + uint32le payload length + "WEBP". The declared length
  // covers everything after those first 8 bytes.
  if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') {
    throw new Error(`L1-I: ${src} is not a WebP file`);
  }
  const declared = bytes.readUInt32LE(4) + 8;
  if (bytes.length !== declared) {
    throw new Error(
      `L1-I: a room points at ${src}, which is truncated -- ${bytes.length} of ${declared} bytes`,
    );
  }
}

if (rooms.includes("next: 'access_corridor'")) {
  throw new Error('L1-I: the interior must not hand off to a room it now contains');
}

console.log('L1-I validation passed: six authored warship rooms, readable mobile presentation, combat gate, manifest assets, and the core-access handoff are present.');
