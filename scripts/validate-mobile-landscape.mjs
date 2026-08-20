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

if (!main.includes("import './landscape.css'")) throw new Error('mobile-landscape: landscape styles are not loaded');
if (!main.includes('new LandscapeMode()')) throw new Error('mobile-landscape: landscape gate is not initialized');
if (!styles.includes('.landscape-gate.is-visible')) throw new Error('mobile-landscape: portrait rotate gate styles missing');

console.log('Mobile landscape validation passed: portrait gate, fullscreen/orientation attempt, calibrated four-axis tilt, and zoomed-out on-foot camera are wired.');
