// The level opens with an arrival, and the player can tune the tilt.
//
// "when the level starts and the 3D mode it needs to come in the music needs
// to start but the ships view needs to be us coming out of warp or going into
// warp drive and flying to a destination and then the battle starts but not
// just start the battle."
//
// Plus the settings the tilt needs to be usable on a real phone: sensitivity,
// and a recalibrate the player can reach without restarting the level.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/space3d/Settings.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
});
const {
  DEFAULT_SETTINGS, TILT_SCALE_BY_SENSITIVITY, SETTINGS_STORAGE_KEY,
  loadSettings, saveSettings, nextSensitivity, isTiltSensitivity,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const game = readFileSync('src/game/space3d/Space3DGame.ts', 'utf8');
const tilt = readFileSync('src/game/space3d/Tilt.ts', 'utf8');

/**
 * Strip comments, for any assertion about CODE.
 *
 * Three checks in this repo have now matched prose instead of code, and this
 * file produced two of them. Both directions bite: a POSITIVE check can pass
 * on a comment while the code does nothing, and a NEGATIVE check can fail on
 * correct code because someone documented the thing being forbidden.
 *
 * The positive case is the dangerous one here -- the checks that the arrival
 * travels and recycles dust are what stand between us and shipping a level
 * that quietly never starts, which is exactly the bug this validator was
 * written after.
 */
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const gameCode = codeOf(game);
if (gameCode.length < game.length * 0.4) failures.push('comment stripping ate the source — the scraper is broken');

// ---- settings survive anything that can be in storage ---------------------
//
// Storage can be absent, it can throw, and it can hold literally anything --
// an older build's shape, a half-written value, something pasted in. A
// settings module that throws on load takes the whole level with it, and a
// level that will not start is far worse than a slider that reverted.
{
  const store = (value) => ({ getItem: () => value, setItem: () => {} });

  check(loadSettings(null).tiltSensitivity === 'normal', 'no storage at all must fall back to the default');
  check(loadSettings(store(null)).tiltSensitivity === 'normal', 'an empty key must fall back to the default');
  for (const junk of ['', 'not json', '[]', 'null', '7', '"high"', '{}', '{"tiltSensitivity":null}',
    '{"tiltSensitivity":"enormous"}', '{"tiltSensitivity":5}', '{"tiltSensitivity":{"x":1}}']) {
    const loaded = loadSettings(store(junk));
    check(
      loaded.tiltSensitivity === DEFAULT_SETTINGS.tiltSensitivity,
      `storage containing ${junk} must fall back to the default, got ${JSON.stringify(loaded)}`,
    );
  }
  check(loadSettings(store('{"tiltSensitivity":"high"}')).tiltSensitivity === 'high', 'a valid setting must round-trip');

  // A storage that throws on read, and one that throws on write.
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  let threw = false;
  try { loadSettings(throwing); } catch { threw = true; }
  check(!threw, 'a storage that throws on read must not take the level down');
  threw = false;
  try { saveSettings({ tiltSensitivity: 'low' }, throwing); } catch { threw = true; }
  check(!threw, 'a storage that throws on write must not take the level down');

  check(typeof SETTINGS_STORAGE_KEY === 'string' && SETTINGS_STORAGE_KEY.length > 0, 'settings need a storage key');
  check(!isTiltSensitivity('medium') && isTiltSensitivity('low'), 'the sensitivity guard must actually discriminate');
}

// ---- the three settings are actually different ----------------------------
{
  const { low, normal, high } = TILT_SCALE_BY_SENSITIVITY;
  for (const [name, scale] of Object.entries(TILT_SCALE_BY_SENSITIVITY)) {
    check(scale.x > 0 && scale.y > 0, `${name} must have a positive full-scale`);
    check(Number.isFinite(scale.x) && Number.isFinite(scale.y), `${name} must be finite`);
  }
  // BIGGER degrees = LESS sensitive, because the number is how far you lean to
  // reach full rate. So HIGH must be the smallest.
  check(high.x < normal.x && normal.x < low.x, 'the three sensitivities must be ordered: HIGH needs less lean than LOW');
  check(high.y < normal.y && normal.y < low.y, 'the pitch axis must be ordered the same way');
  // NORMAL must be the tuning that shipped, so a player who never opens the
  // menu flies exactly what was tested.
  const shippedX = Number(/const TILT_FULL_SCALE_X = ([\d.]+);/.exec(tilt)?.[1]);
  const shippedY = Number(/const TILT_FULL_SCALE_Y = ([\d.]+);/.exec(tilt)?.[1]);
  check(Number.isFinite(shippedX) && Number.isFinite(shippedY), 'could not read the shipped tilt scale');
  check(normal.x === shippedX && normal.y === shippedY, `NORMAL (${normal.x}/${normal.y}) must equal the shipped tuning (${shippedX}/${shippedY})`);
  check(DEFAULT_SETTINGS.tiltSensitivity === 'normal', 'the default must be NORMAL');

  // The cycle must visit all three and come back.
  const seen = new Set();
  let value = 'normal';
  for (let i = 0; i < 3; i += 1) { seen.add(value); value = nextSensitivity(value); }
  check(seen.size === 3, `the sensitivity cycle only reaches ${seen.size} of 3 settings`);
  check(value === 'normal', 'the sensitivity cycle must return to where it started');
}

// ---- a bad scale must never reach the stick -------------------------------
//
// normalizeTilt divides by (fullScale - deadzone). A zero, negative or
// non-finite scale does not throw -- it silently produces NaN or an inverted
// stick, and the ship becomes unflyable in a way no error explains.
{
  const setScale = tilt.split('setScale(scale: { x: number; y: number }): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(setScale.includes('this.scale'), 'could not find setScale — the scraper is broken');
  check(/scale\.x > 0/.test(setScale) && /scale\.y > 0/.test(setScale), 'setScale must reject a non-positive scale');
  check(/Number\.isFinite/.test(setScale), 'setScale must reject a non-finite scale');
  // ...and the deadzone must stay below the tightest setting, or HIGH would
  // have a full-scale inside its own deadzone and produce no output at all.
  const deadzone = Number(/const TILT_DEADZONE_DEG = ([\d.]+);/.exec(tilt)?.[1]);
  check(Number.isFinite(deadzone), 'could not read the tilt deadzone');
  check(
    deadzone < TILT_SCALE_BY_SENSITIVITY.high.x,
    `the deadzone (${deadzone}) is not below the HIGH full-scale (${TILT_SCALE_BY_SENSITIVITY.high.x})`,
  );
}

// ---- the level opens with an arrival, not a firefight ---------------------
{
  check(/'arrival'/.test(gameCode), 'the transit needs an arrival mode');
  const seconds = Number(/const ARRIVAL_SECONDS = ([\d.]+);/.exec(game)?.[1]);
  check(Number.isFinite(seconds), 'ARRIVAL_SECONDS is missing');
  check(seconds >= 3, `a ${seconds}s arrival is a flicker, not an opening`);
  check(seconds <= 12, `a ${seconds}s arrival is a wait before the game starts`);

  const restart = game.split('private restart(): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(restart.includes('this.seedSky()'), 'could not find restart — the scraper is broken');
  check(/this\.mode = 'arrival'/.test(codeOf(restart)), 'a run must begin in the arrival, not already flying');

  // Squadrons must not scramble during the opening, or the battle starts under
  // the cinematic and the whole point is lost.
  const squadrons = game.split('private updateSquadrons(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(squadrons.length > 0, 'could not find updateSquadrons — the scraper is broken');
  check(/mode !== 'flying'/.test(codeOf(squadrons)), 'squadrons must only scramble once the arrival is over');

  // ...and the arrival must actually be TICKED.
  //
  // tick() gates update() on the mode. Omitting 'arrival' from that list threw
  // nothing and looked almost right: the arrival clock never advanced, so the
  // warp tunnel drew at full strength forever and the mode never became
  // 'flying'. The level quietly never started. Every mode with an update path
  // has to appear in the gate.
  const tick = game.split('private tick(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(tick.includes('this.update(dt)'), 'could not find tick — the scraper is broken');
  // COMMENTS STRIPPED FIRST. A first version of this matched the word
  // 'arrival' inside the comment explaining why arrival belongs in the gate,
  // so deleting it from the actual condition still passed -- the check was
  // reading the documentation of its own intent, exactly as the roll/lock
  // check in validate-space-flight once did.
  const tickCode = codeOf(tick);
  const gate = tickCode.split('this.update(dt)')[0];
  check(gate.length > 0, 'could not isolate the tick mode gate — the scraper is broken');
  for (const mode of ['arrival', 'flying', 'boss']) {
    check(
      gate.includes(`this.mode === '${mode}'`),
      `tick() does not update in '${mode}' mode — that mode would freeze on screen`,
    );
  }

  // The arrival must MOVE. An opening that does not travel is a still image.
  const arrival = game.split('private updateArrival(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(arrival.length > 0, 'could not find updateArrival — the scraper is broken');
  check(/this\.camera\.[xyz] \+=/.test(codeOf(arrival)), 'the arrival must actually travel');
  check(/recycleMotes/.test(codeOf(arrival)), 'the arrival must recycle dust, or there is no sense of speed');
  const multiplier = Number(/const ARRIVAL_SPEED_MULTIPLIER = ([\d.]+);/.exec(game)?.[1]);
  check(multiplier > 1, `an arrival at ${multiplier}x cruise is not dropping out of anything`);

  // THE ARCHITECTURAL RULE. Presentation may move the camera and the stars; it
  // may never invent, place, damage or spare a combatant.
  for (const forbidden of ['this.contacts.push', 'this.scramble', 'this.bolts.push', 'contact.hp', 'this.bossHp']) {
    check(!codeOf(arrival).includes(forbidden), `the arrival touches simulation state (${forbidden}) — presentation must stay separate`);
  }

  // ...and the same for the tunnel it draws.
  const tunnel = game.split('private drawWarpTunnel(w: number, h: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(tunnel.length > 0, 'could not find drawWarpTunnel — the scraper is broken');
  check(!/this\.camera\.(x|y|z|yaw|pitch) =/.test(codeOf(tunnel)), 'the tunnel must draw, not steer');
  check(/createRadialGradient\?\./.test(codeOf(tunnel)), 'the gradient must be optional-called: a stub context has none and a throw is worse than no glow');
}

// ---- the settings panel ----------------------------------------------------
{
  // One definition for paint and touch, the way the weapon buttons are done.
  // This is the classic way a touch control quietly stops working.
  const rows = game.split('private settingsRows(')[1]?.split('\n  }\n')[0] ?? '';
  check(rows.includes('sensitivity'), 'could not find settingsRows — the scraper is broken');
  const draw = game.split('private drawSettings(w: number, h: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  const tap = game.split('private tapSettings(clientX: number, clientY: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(/this\.settingsRows\(/.test(codeOf(draw)), 'the settings panel must draw from settingsRows');
  check(/this\.settingsRows\(/.test(codeOf(tap)), 'the settings hit test must come from settingsRows');

  check(/RECALIBRATE TILT/.test(draw), 'the panel needs a recalibrate control');
  check(/TILT SENSITIVITY/.test(draw), 'the panel needs the sensitivity control');
  check(/recalibrate\('player requested'\)/.test(codeOf(tap)), 'the recalibrate row must actually recalibrate');

  // ---- and it must not claim success before success exists ----------------
  //
  // The assertion that used to live here was `/TILT RECALIBRATED/.test(tap)`,
  // and it is what let the bug through: it pinned an acknowledgement without
  // asking whether the acknowledgement was TRUE.
  //
  // TiltSource.recalibrate only STARTS a calibration -- it sets the status to
  // 'calibrating' and returns. Neutral is latched later, inside onSample, once
  // 4+ readings hold within STABLE_SPREAD_DEG for SETTLE_MS, or at the
  // CALIBRATION_TIMEOUT_MS fallback. So the old toast fired at least 550ms
  // before it could be true, and in the four states where recalibrate() is a
  // no-op it was never true at all.
  // COMMENTS STRIPPED. The comment explaining why we no longer say
  // RECALIBRATED contains the word RECALIBRATED, so a raw grep fails on
  // correct code -- the third time in this repo that a check has read the
  // documentation of its own intent instead of the code.
  const tapCode = codeOf(tap);
  check(tapCode.includes('this.tilt.recalibrate'), 'comment stripping ate the tap handler — the scraper is broken');
  check(
    !/RECALIBRATED/.test(tapCode),
    'the press must not claim the calibration finished: recalibrate() only starts one',
  );
  check(
    /this\.toast\(`TILT \$\{this\.tiltReadout\(\)\}`\)/.test(tapCode),
    "the press must report the sensor's actual status, not a fixed string",
  );

  // A watcher must exist, must gate READY on the real status, and must be
  // bounded -- TiltSource latches neutral only from inside onSample, so a
  // sensor that goes silent stays 'calibrating' forever.
  const watch = game.split('private watchCalibration(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(watch.length > 0, 'a calibration watcher must exist');
  check(
    /this\.tilt\.status === 'ready'/.test(watch),
    'READY must be gated on the sensor actually reporting ready',
  );
  check(/TILT READY/.test(watch), 'the watcher must announce READY when the calibration lands');
  check(
    watch.indexOf("=== 'ready'") < watch.indexOf('TILT READY'),
    'READY is announced before the status is checked',
  );
  check(
    /this\.tiltWatch = Math\.max\(0, this\.tiltWatch - dt\)/.test(watch),
    'the watch must be bounded, or a silent sensor leaves the toast up forever',
  );
  const watchSeconds = Number(/const TILT_WATCH_SECONDS = ([\d.]+);/.exec(game)?.[1]);
  const timeoutMs = Number(/const CALIBRATION_TIMEOUT_MS = (\d+);/.exec(tilt)?.[1]);
  check(Number.isFinite(watchSeconds) && Number.isFinite(timeoutMs), 'could not read the watch and calibration timeouts');
  check(
    watchSeconds > timeoutMs / 1000,
    `the watch (${watchSeconds}s) expires before TiltSource's own fallback (${timeoutMs / 1000}s) — a normal calibration would report a failure`,
  );

  // Both clocks must run in EVERY mode. tick() skips update() in 'won' and
  // 'lost', so a countdown living in update() would hang the toast there and
  // leave the watch unresolved.
  const tickBody = game.split('private tick(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(/this\.settingsToast = Math\.max\(0, this\.settingsToast - dt\)/.test(tickBody), 'the toast countdown must run in tick(), not update()');
  check(/this\.watchCalibration\(dt\)/.test(tickBody), 'the calibration watch must run in tick(), not update()');
  check(/saveSettings\(/.test(gameCode), 'a changed setting must persist');

  // The overlay must claim pointers BEFORE the retry tap and the weapon
  // buttons, or a tap meant for a row also restarts the run or fires a missile.
  const down = game.split("this.canvas.addEventListener('pointerdown', (event) => {")[1]?.split('\n    });')[0] ?? '';
  check(down.includes('buttonAt'), 'could not find the pointerdown handler — the scraper is broken');
  // The CALL, not the flag. Looking for `this.settingsOpen` matched the
  // `settingsOpen = true` in the open-the-menu branch, so deleting the
  // intercept entirely still passed -- a check that could not fail.
  const settingsAt = down.indexOf('this.tapSettings(');
  const retryAt = down.indexOf("this.mode === 'won'");
  const buttonAt = down.indexOf('this.buttonAt(');
  check(settingsAt >= 0, 'the settings overlay must intercept pointer-down');
  check(retryAt >= 0 && buttonAt >= 0, 'could not locate the retry and weapon paths — the scraper is broken');
  check(settingsAt < retryAt, 'a tap in the settings panel must not also restart the run');
  check(settingsAt < buttonAt, 'a tap in the settings panel must not also reach a weapon button');
  // ...and it must RETURN, or the tap continues into the game anyway.
  const guard = down.slice(settingsAt - 120, settingsAt + 160);
  check(/return;/.test(guard), 'the settings intercept must return rather than falling through');

  // ...and the world must not run underneath it.
  const update = game.split('private update(dt: number): void {')[1]?.split('\n  }\n')[0] ?? '';
  check(/if \(this\.settingsOpen\) return;/.test(codeOf(update)), 'the fight must not continue while the settings are open');
}

if (failures.length > 0) {
  console.error('transit intro FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `transit-intro: OK — ${/const ARRIVAL_SECONDS = ([\d.]+);/.exec(game)[1]}s warp arrival before the first scramble, `
  + `3 tilt sensitivities (${TILT_SCALE_BY_SENSITIVITY.high.x}/${TILT_SCALE_BY_SENSITIVITY.normal.x}/${TILT_SCALE_BY_SENSITIVITY.low.x} deg), `
  + `settings survive any stored junk.`,
);
