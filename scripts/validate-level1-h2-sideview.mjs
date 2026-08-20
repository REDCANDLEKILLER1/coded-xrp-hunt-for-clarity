import fs from 'node:fs';

const room = fs.readFileSync(new URL('../src/game/onfoot/SideViewRoom.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');

const requiredRoomTokens = [
  "gravity: 1900",
  "jumpSpeed: 690",
  "coyoteSeconds: 0.1",
  "jumpBufferSeconds: 0.12",
  "worldWidth: 1680",
];
for (const token of requiredRoomTokens) {
  if (!room.includes(token)) throw new Error(`L1-H2 side-view validation missing: ${token}`);
}

const requiredRuntimeTokens = [
  'SIDEVIEW_ROOM',
  'tryJump',
  'grounded',
  'cameraX',
  'Liquidity Blast',
  'JUMP',
];
for (const token of requiredRuntimeTokens) {
  if (!runtime.includes(token)) throw new Error(`L1-H2 side-view runtime missing: ${token}`);
}

if (/top-down/i.test(runtime)) throw new Error('L1-H2 runtime still describes top-down gameplay');
console.log('L1-H2 side-view platforming validation passed.');
