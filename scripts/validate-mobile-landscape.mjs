// Portrait is playable, and fullscreen is an option.
//
// This file used to assert a portrait GATE: a full-screen card telling the
// player to turn the phone sideways, with START behind it and an escape hatch
// in case the browser refused to rotate. The gate is gone -- the game plays
// portrait, the flight half is a vertical shooter and the warship interior
// scrolls -- so the checks are inverted: nothing may block portrait, and the
// fullscreen offer must stay out of the way.

import fs from 'node:fs';

const input = fs.readFileSync(new URL('../src/game/core/Input.ts', import.meta.url), 'utf8');
const landscape = fs.readFileSync(new URL('../src/game/ui/LandscapeMode.ts', import.meta.url), 'utf8');
const onFoot = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const game2a = fs.readFileSync(new URL('../src/game/core/Game2A.ts', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/landscape.css', import.meta.url), 'utf8');

const fail = (message) => { throw new Error(`mobile-landscape: ${message}`); };

// Tilt steering was removed: it was harder to aim than a finger and competed
// with touch for control. Steering is pointer/keyboard only.
for (const banned of ['deviceorientation', 'TILT_FULL_SCALE', 'calibrateTilt', 'gravityFromOrientation']) {
  if (input.includes(banned)) fail(`tilt steering is back (${banned}); controls are pointer + keyboard only`);
}
if (!/onPointerMove|onPointerDown/.test(input)) fail('pointer steering is missing');

// ---- nothing may block portrait ----------------------------------------
for (const banned of [
  'landscape-gate',
  'TURN PHONE SIDEWAYS',
  'PRESS START',
  'CONTINUE ANYWAY',
  'requiresLandscape',
]) {
  if (landscape.includes(banned)) fail(`the portrait gate is back (${banned}); portrait must be playable`);
  if (styles.includes(banned)) fail(`portrait gate styles are back (${banned})`);
}
// A gate would have to hide behind a dismissal flag; there should be none.
if (/dismissed/.test(landscape)) fail('a dismissable gate implies a gate; portrait needs no dismissing');

// Both orientations get a layout class, so the CSS can size for the one it has.
if (!/mobile-landscape-active/.test(landscape)) fail('landscape layout class is missing');
if (!/mobile-portrait-active/.test(landscape)) fail('portrait gets no layout class of its own');

// ---- fullscreen stays available, retryable, and out of the way ---------
for (const token of ["orientation.lock('landscape')", 'requestFullscreen', 'goFullscreen', 'isFullscreen()', 'fullscreenchange', 'isMobileLike()']) {
  if (!landscape.includes(token)) fail(`fullscreen must still be offered — missing ${token}`);
}
// A refused or exited fullscreen has to be retryable.
if (/lockAttempted/.test(landscape)) fail('fullscreen is latched to one attempt; it must be retryable');
if (!/\.fullscreen-nudge\.is-visible/.test(styles)) fail('fullscreen offer has no visible state');

// It is a DOM overlay above the canvas HUD, so where it sits matters. It used
// to be a bar pinned to the bottom CENTRE -- across the play area and the
// ship's own lane. Every canvas control lives in a corner: pause and map
// top-right, LOG and sound bottom-left, bomb and pulse bottom-right.
const nudge = /\.fullscreen-nudge\s*\{([^}]*)\}/.exec(styles)?.[1] ?? '';
if (!nudge) fail('fullscreen offer has no rule');
if (/left:\s*50%/.test(nudge)) fail('the fullscreen offer is back across the middle of the play area');
if (!/top:/.test(nudge)) fail('the fullscreen offer should be anchored to the top, clear of the three busy corners');
const size = Number(/width:\s*(\d+)px/.exec(nudge)?.[1]);
if (!(size > 0 && size <= 34)) fail(`the fullscreen offer is ${size}px wide; it should be a chip, not a bar`);

// ---- the on-foot camera still scrolls ----------------------------------
// Portrait sees less of a room at once, which is fine as long as it scrolls.
for (const token of ['worldScale()', 'visibleWorldWidth', 'cameraX', 'cameraY']) {
  if (!onFoot.includes(token)) fail(`missing scrolling on-foot camera token ${token}`);
}
if (!/innerHeight \/ 520/.test(onFoot)) fail('the landscape zoom-out is missing');

// ---- the developer panel is not one stray tap from the play area -------
// "ASSETS 56/56 loaded • missing 0 • errors 0" opened over a portrait game
// because the D button sits in a corner that is inside the battlefield there.
if (!/private readonly diagnostics = hasDiagnosticsFlag\(\);/.test(game2a)) {
  fail('the asset panel must be gated behind a diagnostics flag');
}
if (!/this\.diagnostics && inCircle\(this\.zone\.assets/.test(game2a)) {
  fail('the diagnostics button must not be tappable outside the debug route');
}
if (!/if \(this\.diagnostics\) this\.padButton\(this\.zone\.assets/.test(game2a)) {
  fail('the diagnostics button must not be drawn outside the debug route');
}
if (!/this\.showAssets && this\.diagnostics/.test(game2a)) {
  fail('the diagnostics panel must not open outside the debug route');
}
// A genuine asset failure still has to report itself to everyone.
if (!/this\.reportAssets \|\|/.test(game2a)) fail('a real asset failure must still report itself');

if (!main.includes("import './landscape.css'")) fail('landscape styles are not loaded');
if (!main.includes('new LandscapeMode()')) fail('fullscreen offer is not initialized');

console.log('mobile-landscape: OK — portrait plays, fullscreen is a corner chip, diagnostics are debug-only.');
