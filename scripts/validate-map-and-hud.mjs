// Star map fit, and how much screen the info takes.
//
// The map used to be a 980x590 minimum inside `overflow: auto`. On any screen
// smaller than that -- a landscape phone is about 1000x447 CSS pixels -- it
// overflowed, and the browser painted the scrollbars in `scrollbar-color:
// #00ff88`. Two bright green bars hugging the bottom and right edges, with
// nothing to say what they were. Planet positions are percentages, so the map
// scales to any box on its own and the minimums bought nothing.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const style = readFileSync('src/style.css', 'utf8');
const landscape = readFileSync('src/landscape.css', 'utf8');
const onfoot = readFileSync('src/game/onfoot/OnFootGame.ts', 'utf8');
// Strip comments before scanning: this file's own explanation of the bug
// quotes `scrollbar-color: #00ff88`, and the first draft failed on that.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const css = stripComments(`${style}\n${landscape}`);

// ---- the map fits, and never paints a scrollbar ---------------------------
check(!/scrollbar-color/.test(css), 'the map must not style a scrollbar -- it should not have one');
check(
  !/\.star-map\s*\{[^}]*min-(width|height)\s*:\s*[1-9]/.test(style),
  '.star-map must not carry a pixel minimum; it has to fit whatever box it gets',
);
// The standalone `.map-scroll { ... }` rule, not the `.star-map-panel, .map-scroll`
// group above it that only sets sizing.
const mapScroll = [...stripComments(style).matchAll(/(^|\n)\.map-scroll\s*\{([^}]*)\}/g)]
  .map((m) => m[2])
  .find((body) => /overflow/.test(body)) ?? '';
check(/overflow:\s*hidden/.test(mapScroll), '.map-scroll must not scroll');

// Planets are positioned as percentages -- that is what lets the map scale.
const planets = readFileSync('src/game/content/CampaignPlanets.ts', 'utf8');
const xs = [...planets.matchAll(/\bx:\s*(\d+)/g)].map((m) => Number(m[1]));
check(xs.length >= 10, `expected 10 planets, found ${xs.length}`);
check(Math.max(...xs) <= 100, 'planet x positions are percentages and must stay within 100');

// ---- the info panel leaves the map room ----------------------------------
// A panel cannot simply be laid over the map instead: four planets sit between
// 75% and 93% of its width, and a panel on top of them cannot be tapped through.
check(Math.max(...xs) > 75, 'this check assumes planets reach the right edge; re-derive it if the map is re-laid out');

const short = landscape.split('@media (pointer: coarse) and (orientation: landscape) {')[1]
  ?.split('\n@media')[0] ?? '';
check(short.length > 0, 'could not find the coarse-pointer landscape block');
const cols = /\.campaign-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\([^,]+,\s*([\d.]+)vw\)/.exec(short);
check(!!cols, 'the landscape layout should size the mission panel in vw');
if (cols) {
  const vw = Number(cols[1]);
  check(vw <= 24, `the mission panel takes ${vw}vw of a landscape phone; the map needs that width`);
}
check(/\.campaign-subtitle[^}]*display:\s*none/.test(short) || /\.eyebrow,?\s*\n?\s*\.campaign-subtitle\s*\{\s*display:\s*none/.test(short),
  'the landscape header should drop its subtitle');

// ---- the on-foot HUD is a strip, not a panel over the room ---------------
const hud = onfoot.split('private drawHud(')[1]?.split('\n  }\n')[0] ?? '';
check(hud.length > 0, 'could not find drawHud');
check(
  !/c\.strokeRect\(12, 10,/.test(hud) && !/c\.fillRect\(12, 10,/.test(hud),
  'the on-foot HUD must not draw a bordered panel box over the room art',
);
check(/shadowColor/.test(hud), 'HUD text over art needs a shadow to stay legible without a panel behind it');

// Platform markers: the collision edge still has to be findable, but the blue
// wireframe box read as leftover debug geometry once the rooms had real art.
const platform = onfoot.split('private drawPlatform(')[1]?.split('\n  }\n')[0] ?? '';
check(platform.length > 0, 'could not find drawPlatform');
check(!/strokeRect/.test(platform), 'platforms must not be outlined -- it reads as a debug box over the art');
// The fill, not the shadow -- the glow is deliberately brighter than the lip.
const lip = /fillStyle = 'rgba\(0,255,0,([\d.]+)\)'/.exec(platform);
check(!!lip, 'the standable edge still needs a green lip -- the painted ledge and the collision line differ');
if (lip) check(Number(lip[1]) <= 0.3, `the platform lip at ${lip[1]} alpha is still stamping wireframe over the art`);

if (failures.length > 0) {
  console.error('map-and-hud validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log('map-and-hud: OK — map fits with no scrollbar, panel <= 24vw, HUD is a strip.');
