import fs from 'node:fs';

const rooms = fs.readFileSync(new URL('../src/game/onfoot/InteriorRooms.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/assets/manifest.json', import.meta.url), 'utf8'));

const requiredRoomTokens = [
  "key: 'docking_bay'",
  "key: 'security_checkpoint'",
  "'/assets/interior/regulatory_docking_bay.webp'",
  "'/assets/interior/regulatory_security_checkpoint.webp'",
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
  "next: 'access_corridor'",
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

const interior = manifest.interior ?? {};
for (const key of ['regulatory_docking_bay', 'regulatory_security_checkpoint']) {
  if (!interior[key]?.src) throw new Error(`L1-I manifest missing interior.${key}`);
}

for (const key of ['regulatory_docking_bay', 'regulatory_security_checkpoint']) {
  const src = interior[key].src;
  const file = new URL(`../public${src}`, import.meta.url);
  if (!fs.existsSync(file)) throw new Error(`L1-I runtime asset missing: ${src}`);
}

console.log('L1-I validation passed: authored warship rooms, readable mobile presentation, combat gate, manifest assets, and access-corridor handoff are present.');
