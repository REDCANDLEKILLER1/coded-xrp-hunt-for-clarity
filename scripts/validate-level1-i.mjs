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

// Interior art stays tracked in the manifest so the files are not orphaned,
// but no ROOM may point at one until it is a complete file. The two originals
// are truncated and, critically, still decode: Chromium reports naturalWidth
// 1024 and paints the fragment, so the runtime's `complete && naturalWidth > 0`
// guard cannot tell them from real art. Rooms draw the procedural interior
// instead until usable bytes land.
const interior = manifest.interior ?? {};
for (const key of ['regulatory_docking_bay', 'regulatory_security_checkpoint']) {
  if (!interior[key]?.src) throw new Error(`L1-I manifest missing interior.${key}`);
  const file = new URL(`../public${interior[key].src}`, import.meta.url);
  if (!fs.existsSync(file)) throw new Error(`L1-I runtime asset missing: ${interior[key].src}`);
}

// Match an actual assignment, not a mention: the room file documents these
// filenames in a comment explaining why nothing points at them.
const truncated = ['regulatory_docking_bay.webp', 'regulatory_security_checkpoint.webp'];
for (const name of truncated) {
  if (new RegExp(`backgroundSrc:\\s*'[^']*${name.replace('.', '\\.')}'`).test(rooms)) {
    throw new Error(`L1-I: a room points at ${name}, which is truncated and decodes to a blank wash`);
  }
}

if (rooms.includes("next: 'access_corridor'")) {
  throw new Error('L1-I: the interior must not hand off to a room it now contains');
}

console.log('L1-I validation passed: six authored warship rooms, readable mobile presentation, combat gate, manifest assets, and the core-access handoff are present.');
