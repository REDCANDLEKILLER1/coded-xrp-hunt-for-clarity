import fs from 'node:fs';

const room = fs.readFileSync(new URL('../src/game/onfoot/InteriorRooms.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');

const requiredRoomTokens = [
  'gravity: 1900',
  'jumpSpeed: 690',
  'coyoteSeconds: 0.1',
  'jumpBufferSeconds: 0.12',
  'moveSpeed: 270',
];
for (const token of requiredRoomTokens) {
  if (!room.includes(token)) throw new Error(`L1-H2 side-view validation missing: ${token}`);
}

const requiredRuntimeTokens = [
  'tryJump',
  'grounded',
  'cameraX',
  'fireLiquidityBlast',
  'JUMP',
  'REGULATORY_INTERIOR_ROOMS',
];
for (const token of requiredRuntimeTokens) {
  if (!runtime.includes(token)) throw new Error(`L1-H2 side-view runtime missing: ${token}`);
}

if (/top-down/i.test(runtime)) throw new Error('L1-H2 runtime still describes top-down gameplay');
console.log('L1-H2 side-view platforming validation passed.');
