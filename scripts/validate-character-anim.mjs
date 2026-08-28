// XRPMan's animation.
//
// He used to stand bolt upright through running, jumping and firing, because
// the only character art was a six-frame proto sheet whose frames are all the
// same standing pose. These strips are cut from the real sheets the owner
// uploaded, and this locks in that they are wired to distinct states.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const runtime = readFileSync('src/game/onfoot/OnFootGame.ts', 'utf8');

// ---- every strip is registered, and is a real spritesheet ---------------
const expected = { xrpman_idle: 6, xrpman_run: 8, xrpman_jump: 8, xrpman_fire: 7 };
for (const [key, frames] of Object.entries(expected)) {
  const entry = manifest.characters?.[key];
  check(!!entry, `manifest is missing characters.${key}`);
  if (!entry) continue;
  check(entry.type === 'spritesheet', `characters.${key}: type should be spritesheet, got "${entry.type}"`);
  check(entry.sheet?.frames === frames, `characters.${key}: expected ${frames} frames, got ${entry.sheet?.frames}`);
  check(entry.sheet?.frameWidth === 128 && entry.sheet?.frameHeight === 128,
    `characters.${key}: cells should be 128x128`);
  // The strip on disk has to be exactly as wide as it claims, or the game
  // slices the wrong cells and the animation silently drifts.
  const file = readFileSync(`public${entry.src}`);
  check(file.subarray(1, 4).toString() === 'PNG', `${entry.src} is not a PNG (sprites need alpha; JPEG has none)`);
  // Completeness first. The width below is read out of IHDR, which survives
  // truncation intact -- exactly the trap that let two half-downloaded room
  // WebPs pass for weeks. A PNG is only whole if it ends in IEND.
  check(
    file.subarray(-8, -4).toString() === 'IEND',
    `${entry.src} is truncated -- no IEND chunk, so ${file.length} bytes is not the whole file`,
  );
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  check(width === frames * 128, `${entry.src}: is ${width}px wide, expected ${frames * 128}`);
  check(height === 128, `${entry.src}: is ${height}px tall, expected 128`);
  // Colour type 6 is RGBA. Without alpha he ships with a grey card behind him.
  check(file[25] === 6, `${entry.src}: colour type ${file[25]}, expected 6 (RGBA) -- the sprite needs transparency`);
}

// ---- the states are actually distinguished -----------------------------
const pose = runtime.split('private currentPose(')[1]?.split('\n  }\n')[0] ?? '';
check(pose.length > 0, 'currentPose() is missing');
for (const [key, why] of [
  ["'fire'", 'firing'],
  ["'jump'", 'being off the ground'],
  ["'run'", 'running'],
  ["'idle'", 'standing still'],
]) {
  check(pose.includes(key), `currentPose must return ${key} for ${why}`);
}
// Firing beats airborne beats running: whichever the body is most committed to.
check(
  pose.indexOf("'fire'") < pose.indexOf("'jump'") && pose.indexOf("'jump'") < pose.indexOf("'run'"),
  'pose priority should be fire, then airborne, then running',
);
// The run cycle must follow distance travelled, not wall-clock, or the legs
// cycle at a fixed rate while he skates at a different speed.
check(/this\.stride/.test(pose), 'the run cycle must be driven by stride, not by a timer');
check(/vy/.test(pose), 'the jump pose must depend on vertical velocity, not just on being airborne');

// Raw sheet uploads must not stay in the repo.
check(!/\.\/[0-9]{5}\.png/.test(runtime), 'runtime should not reference raw uploads');

if (failures.length > 0) {
  console.error('character-anim validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log('character-anim: OK — idle/run/jump/fire strips wired to distinct states.');
