// Fog Breaker teaching cue.
//
// Two moments in Level 1 stall until the player taps the Fog Breaker: the fog
// gate before the final assault, and the warship's shield phase. Playtesting
// found that a player who does not already know that just sees the mission
// stop. This locks in the signal that teaches it.
//
// The warship half is a real behavioural test against the bundled director.
// The HUD half is a source check, because drawSpecialButton() only exists as
// canvas pixels.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- behavioural: the warship reports when it is waiting on the pulse ------
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
check(director.needsFogBreaker === false, 'batteries phase must not ask for the Fog Breaker');

// Negative control: hammering a system that is not exposed must not advance us.
director.hit('shield_relay', 999);
check(director.phase === 'batteries', 'shield relay took damage while still covered by the batteries phase');

for (const key of ['port_battery', 'starboard_battery']) director.hit(key, 999);
check(director.phase === 'shield', `both batteries down should enter the shield phase, got "${director.phase}"`);
check(director.needsFogBreaker === true, 'shield phase must ask for the Fog Breaker before the relay is exposed');

// The relay stays invulnerable until the pulse lands -- that stall is the
// whole reason the button has to nag.
director.hit('shield_relay', 999);
check(director.needsFogBreaker === true, 'shield relay must stay covered until the Fog Breaker fires');
check(director.phase === 'shield', 'shield relay must not be destroyable before the Fog Breaker exposes it');

check(director.exposeShieldWithFogBreaker() === true, 'Fog Breaker should expose the shield relay');
check(director.needsFogBreaker === false, 'exposed shield relay must stop asking for the Fog Breaker');
check(director.exposeShieldWithFogBreaker() === false, 'a second Fog Breaker pulse must not re-expose an exposed relay');

director.hit('shield_relay', 999);
check(director.phase === 'engines', `exposed relay should be destroyable, got phase "${director.phase}"`);
check(director.needsFogBreaker === false, 'engines phase must not ask for the Fog Breaker');

director.reset();
check(director.needsFogBreaker === false, 'reset warship must not ask for the Fog Breaker');

// ---- source: the HUD actually wires the cue up ----------------------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');

check(/this\.drawSpecialButton\(\)/.test(game), 'HUD must draw the special button through drawSpecialButton()');
check(/private specialCue\(\)/.test(game), 'Game2A must expose a specialCue() helper');
check(/fogGateActive && this\.missionDirector\.currentAct\?\.key === 'final_assault'/.test(game), 'specialCue must treat the final-assault fog gate as blocking');
check(/this\.warshipDirector\.needsFogBreaker/.test(game), 'specialCue must treat the warship shield phase as blocking');
check(/TAP TO BREAK THE FOG/.test(game), 'a blocked Fog Breaker must caption itself');
check(/CHARGING \$\{Math\.floor\(this\.special\)\}%/.test(game), 'a blocked but uncharged Fog Breaker must show its charge');

// The blink has to be driven by the clock, or it is not a blink.
check(/Math\.sin\(this\.clock \* Math\.PI \* 5\)/.test(game), 'the Fog Breaker blink must be driven by the game clock');

// The toast left the flight lane: it is pinned to the bottom strip now.
check(/const y = this\.h - height - 34;/.test(game), 'mission toast must sit in the bottom strip, clear of the FULLSCREEN nudge');
check(!/const y = this\.zone\.assets\.y \+ this\.zone\.assets\.h \+ 8;/.test(game), 'mission toast must not return to the upper-right flight lane');

if (failures.length) {
  console.error('fog-breaker-cue: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('fog-breaker-cue: OK');
