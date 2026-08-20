import fs from 'node:fs';

const onFoot = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');
const rooms = fs.readFileSync(new URL('../src/game/onfoot/InteriorRooms.ts', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const combined = `${onFoot}\n${rooms}\n${main}`;

const required = [
  "'/assets/characters/xrpman_onfoot_proto_sheet.png'",
  "const GREEN = '#00ff00'",
  "const BLUE = '#36a3ff'",
  'moveSpeed: 270',
  'blastCooldown: 0.18',
  "window.dispatchEvent(new CustomEvent('coded:onfoot-defeat'",
  "window.addEventListener('coded:boarding-complete'",
  "missionCheckpointFor(loadCampaignProgress(), 'ledger_prime')",
];

const failures = required.filter((needle) => !combined.includes(needle));
if (failures.length) {
  console.error('L1-H2 validation failed:');
  for (const item of failures) console.error(`- missing ${item}`);
  process.exit(1);
}

console.log('L1-H2 validation passed: accepted side-view movement, Liquidity Blast, boarding handoff, palette, and defeat checkpoint wiring remain present.');
