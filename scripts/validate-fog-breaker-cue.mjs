// The fog never stalls the mission.
//
// Two moments used to wait for the player to press the special: the fog gate
// before the final assault, and the warship's shield cover. Playtesting found
// what a blinking button could not fix -- people did not connect a stalled
// route to that button, and flew around an empty sky for minutes waiting for
// something to happen. The fog gate was a puzzle nobody knew they were being
// asked.
//
// Both cut themselves now. This file used to assert the gate existed; it
// asserts it cannot come back.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- behavioural: the warship reports its shield cover ------------------
const bundle = await build({
  entryPoints: ['src/game/content/RegulatoryWarship.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const { RegulatoryWarshipDirector } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const director = new RegulatoryWarshipDirector();
check(director.phase === 'batteries', `fresh warship should start in the batteries phase, got "${director.phase}"`);
check(director.shieldCovered === false, 'the batteries phase has no shield cover');

// Negative control: hammering a system that is not exposed must not advance us.
director.hit('shield_relay', 999);
check(director.phase === 'batteries', 'shield relay took damage while still covered by the batteries phase');

for (const key of ['port_battery', 'starboard_battery']) director.hit(key, 999);
check(director.phase === 'shield', `both batteries down should enter the shield phase, got "${director.phase}"`);
check(director.shieldCovered === true, 'the shield phase starts with the relay covered');

// The relay is still invulnerable until the cover is cut -- that part of the
// beat is intact, it just is not waiting on a button any more.
director.hit('shield_relay', 999);
check(director.phase === 'shield', 'a covered relay must not be destroyable');

check(director.exposeShieldRelay() === true, 'cutting the cover should expose the relay');
check(director.shieldCovered === false, 'an exposed relay is no longer covered');
check(director.exposeShieldRelay() === false, 'cutting an already-exposed relay must be a no-op');
director.hit('shield_relay', 999);
check(director.phase === 'engines', 'an exposed relay should be destroyable and advance the phase');

// ---- source: nothing waits on the player pressing anything -------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');

check(/FOG_AUTO_CUT_SECONDS/.test(game), 'the fog must cut itself on a timer');
const seconds = Number(/const FOG_AUTO_CUT_SECONDS = ([\d.]+);/.exec(game)?.[1]);
check(seconds > 0 && seconds <= 5, `a ${seconds}s auto-cut is either instant or another wait`);

check(/private cutFogGate\(\): void \{/.test(game), 'cutFogGate is missing');
check(/if \(this\.fogCutClock >= FOG_AUTO_CUT_SECONDS\) this\.cutFogGate\(\);/.test(game),
  'the fog gate must cut itself once its timer runs out');
check(/this\.warshipDirector\.exposeShieldRelay\(\)/.test(game), 'the shield cover must cut itself too');

// The special must not gate anything. This is the whole point of the change.
const special = game.split('private useSpecial(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(special.length > 0, 'useSpecial is missing');
check(!/fogGateActive = false/.test(special), 'the pulse must not be what opens the fog gate');
check(!/exposeShieldRelay/.test(special), 'the pulse must not be what exposes the shield relay');

// The button says PULSE. Reading FOG BREAK is what sent people hunting for
// something to break fog with.
check(/const label = 'PULSE';/.test(game), "the special button should always read PULSE");
check(!/'FOG BREAK'/.test(game), 'the FOG BREAK label is back');

// And nothing tells the player to press it.
check(!/USE FOG BREAKER/.test(game), 'the HUD must not instruct the player to press the pulse');
const warship = readFileSync('src/game/content/RegulatoryWarship.ts', 'utf8');
check(!/USE FOG BREAKER/.test(warship), 'the warship objective must not instruct the player to press the pulse');

// The blink existed only to nag about a press that no longer matters.
const cue = game.split('private specialCue(')[1]?.split('\n  }\n')[0] ?? '';
check(/blocked: false/.test(cue), 'nothing blocks on the pulse any more, so nothing should report blocked');

// The timers have to reset with the run, or a later gate opens instantly.
check((game.match(/this\.fogCutClock = 0;/g) ?? []).length >= 3,
  'the fog timer must be cleared everywhere the gate is');

// The Fog Breaker stays an upgrade -- it just does not unlock anything.
check(/hasFogBreaker\(this\.progress\)/.test(game), 'the Fog Breaker should still upgrade the pulse');

if (failures.length > 0) {
  console.error('fog-breaker-cue: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`fog-breaker-cue: OK — fog cuts itself in ${seconds}s, the button is only a pulse.`);
