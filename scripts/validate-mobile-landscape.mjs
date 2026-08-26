import fs from 'node:fs';

const input = fs.readFileSync(new URL('../src/game/core/Input.ts', import.meta.url), 'utf8');
const landscape = fs.readFileSync(new URL('../src/game/ui/LandscapeMode.ts', import.meta.url), 'utf8');
const onFoot = fs.readFileSync(new URL('../src/game/onfoot/OnFootGame.ts', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/landscape.css', import.meta.url), 'utf8');

for (const token of [
  "window.addEventListener('deviceorientation'",
  'TILT_DEADZONE',
  'TILT_FULL_SCALE',
  "innerWidth > innerHeight",
  'calibrateTilt()',
]) {
  if (!input.includes(token)) throw new Error(`mobile-landscape: missing tilt input token ${token}`);
}

for (const token of [
  "orientation.lock('landscape')",
  'requestFullscreen',
  'TURN PHONE SIDEWAYS',
  'isMobileLike()',
]) {
  if (!landscape.includes(token)) throw new Error(`mobile-landscape: missing landscape gate token ${token}`);
}

for (const token of [
  'worldScale()',
  'visibleWorldWidth',
  'cameraY',
  'innerHeight / 520',
  '0.62',
  '0.74',
]) {
  if (!onFoot.includes(token)) throw new Error(`mobile-landscape: missing zoomed-out on-foot token ${token}`);
}

// The gate must never be the only way forward. iOS Safari exposes neither
// element fullscreen nor screen.orientation.lock, and rotation-locked devices
// stay portrait regardless, so an escape path is mandatory.
for (const token of [
  'dismissed',
  'landscape-gate__skip',
  'CONTINUE ANYWAY',
  'revealFallback',
  'canLockOrientation',
]) {
  if (!landscape.includes(token)) {
    throw new Error(`mobile-landscape: portrait gate has no escape path — missing ${token}`);
  }
}
if (!/requiresLandscape\s*=[^;]*!this\.dismissed/.test(landscape)) {
  throw new Error('mobile-landscape: refresh() does not honour the dismissed escape, gate can trap the player');
}
if (!/if \(innerHeight > innerWidth\) this\.revealFallback\(\);/.test(landscape)) {
  throw new Error('mobile-landscape: failed orientation lock does not reveal the manual-rotate fallback');
}
if (!styles.includes('.landscape-gate__fallback')) {
  throw new Error('mobile-landscape: escape-path styles missing');
}

if (!main.includes("import './landscape.css'")) throw new Error('mobile-landscape: landscape styles are not loaded');
if (!main.includes('new LandscapeMode()')) throw new Error('mobile-landscape: landscape gate is not initialized');
if (!styles.includes('.landscape-gate.is-visible')) throw new Error('mobile-landscape: portrait rotate gate styles missing');

console.log('Mobile landscape validation passed: portrait gate with escape path, fullscreen/orientation attempt, calibrated four-axis tilt, and zoomed-out on-foot camera are wired.');
