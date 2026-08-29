// Save points, and the word "level".
//
// Two pieces of playtest feedback, one cause each.
//
// "Somebody said they went to level four" -- on a level called Level 1. The
// HUD read `LV 4`, which is the XP rank, and players read it as a stage
// number. Two meanings of one word, one of them wrong.
//
// "It needs more save points" -- Level 1 runs about half an hour behind four
// checkpoints, so a death at Gary Fog cost Ledger City and the whole Defense
// Grid, and a death on the warship's defense deck cost all six interior rooms
// plus the boarding run.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const onfoot = readFileSync('src/game/onfoot/OnFootGame.ts', 'utf8');
const main = readFileSync('src/main.ts', 'utf8');

// ---- the rank is not a level -------------------------------------------
const hud = game.split('private hud(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(hud.length > 0, 'could not find the HUD');
check(/RANK \$\{this\.xpLevel\}/.test(hud), 'the XP readout should say RANK, not LV');
check(
  !/`LV \$\{/.test(hud),
  'the HUD must not label the XP rank "LV" -- players read it as the stage number',
);

// ---- the interior remembers how far you got ----------------------------
const progress = readFileSync('src/game/content/CampaignProgress.ts', 'utf8');
check(/interiorRoom\?: number;/.test(progress), 'the checkpoint snapshot needs an interior room');
check(
  /interiorRoom: clamp\(safeCount\(snapshot\.interiorRoom, 0\)/.test(progress),
  'interiorRoom comes from local storage and must be bounded like every other saved field',
);
// Optional, so saves written before this change still parse.
check(
  /interiorRoom\?:/.test(progress),
  'interiorRoom must be optional or every existing save is rejected',
);

check(
  /coded:onfoot-room/.test(onfoot),
  'clearing a room should announce itself, or nothing can record it',
);
const advance = onfoot.split('private advanceRoom(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(/room: this\.roomIndex \+ 1/.test(advance), 'the room event should report the room being entered');

check(/coded:onfoot-room/.test(main), 'nothing listens for the room event');
check(/interiorRoom: room/.test(main), 'the room must be written into the stored checkpoint');
check(
  /onFoot\.show\(savedInteriorRoom\(\)\)/.test(main),
  'boarding should resume at the saved room, not always the docking bay',
);

// Resuming has to be bounded to real rooms even if a save says otherwise.
const reset = onfoot.split('private resetRun(')[1]?.split('\n  }\n')[0] ?? '';
check(
  /clamp\(Math\.floor\(startRoom\), 0, REGULATORY_INTERIOR_ROOMS\.length - 1\)/.test(reset),
  'the opening room must be clamped to the rooms that exist',
);

// ---- behavioural: a saved room survives a round trip -------------------
const bundle = await build({
  entryPoints: ['src/game/content/CampaignProgress.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const base = {
  planetKey: 'ledger_prime',
  missionKey: 'earth_ledger_prime',
  checkpointKey: 'earth.boarding_lock',
  checkpointLabel: 'BOARDING LOCK',
  resumeActKey: 'boarding',
  shipKey: 'player',
  weaponTier: 1,
  bombs: 2,
  score: 900,
  savedAt: Date.now(),
};

const saved = mod.recordMissionCheckpoint(mod.EMPTY_PROGRESS, { ...base, interiorRoom: 4 });
const reloaded = mod.parseCampaignProgress(JSON.stringify(saved));
check(
  mod.missionCheckpointFor(reloaded, 'ledger_prime')?.interiorRoom === 4,
  'the interior room did not survive being saved and reloaded',
);

// A save from before this feature must still load, and simply start at 0.
const legacy = mod.recordMissionCheckpoint(mod.EMPTY_PROGRESS, base);
const legacyBack = mod.missionCheckpointFor(mod.parseCampaignProgress(JSON.stringify(legacy)), 'ledger_prime');
check(!!legacyBack, 'a checkpoint with no interiorRoom must still parse');
check(legacyBack?.interiorRoom === 0, `a save with no room should resume at 0, got ${legacyBack?.interiorRoom}`);

// A hand-edited save naming room 900 must not be believed.
const absurd = mod.parseCampaignProgress(JSON.stringify(
  mod.recordMissionCheckpoint(mod.EMPTY_PROGRESS, { ...base, interiorRoom: 900 }),
));
const clamped = mod.missionCheckpointFor(absurd, 'ledger_prime')?.interiorRoom ?? 0;
check(clamped <= 16, `an edited save asked for room ${clamped}; it should be bounded`);

if (failures.length > 0) {
  console.error('checkpoints validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log('checkpoints: OK — every act resumable, interior rooms remembered, rank is not a level.');
