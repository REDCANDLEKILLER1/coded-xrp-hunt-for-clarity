// Reading a ship against black.
//
// Playtest: the ships look like floating circles, and the boss disappears
// behind its own shield.
//
// Both were literal. Every hull -- the player's and every drone's -- carried
// an unconditional ring at 0.58x its draw size in the hull's accent colour,
// stroked 2px. Enemies draw at 19-23px, so that ring was a 13px-radius circle
// around a 20px sprite: the circle is what you see. The player's was the same
// ring, which meant the ship wore a shield indicator whether or not it had a
// shield, in whatever colour the hull happened to be. And the escort shield
// was a solid #36a3ff disc at 0.34-0.50 alpha across 0.86x the boss, painted
// OVER the boss, during the phase where reading the attack tell matters most.
//
// This file does not grep for any of that. It runs the real renderer against a
// recording 2D context and asks what actually got painted: which paths were
// filled, at what opacity, in what colour, over what.
//
// Rules under test:
//   1. Nothing is filled over a hull, ever.
//   2. A shield is an outline, it is thin, and it moves.
//   3. The player's shield is green, only shows when there IS one, and does
//      not depend on the hull you picked.
//   4. An enemy shield is red.
//   5. The one always-on light is a rim -- transparent at the centre, so it
//      cannot become a disc -- and it is dim enough that the sprite wins.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ---- a 2D context that remembers -----------------------------------------
//
// State is stacked properly through save/restore and points are pushed
// through the transform, because the renderer translates and rotates and an
// op recorded in local coordinates would tell us nothing about where it
// landed. Paths accumulate from beginPath and are attached to the fill() or
// stroke() that consumes them, so "was this circle filled or stroked" is a
// question the recording can answer.
const IDENTITY = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

function recorder() {
  const ops = [];
  let state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: 'left' };
  let matrix = IDENTITY;
  const stack = [];
  let path = [];
  const snapshot = () => ({ ...state });
  const gradient = (radius) => ({ __gradient: true, radius, stops: [], addColorStop(offset, color) { this.stops.push([offset, String(color)]); } });

  const ctx = {
    save() { stack.push({ state: { ...state }, matrix }); },
    restore() { const top = stack.pop(); if (top) { state = top.state; matrix = top.matrix; } },
    translate(x, y) { matrix = mul(matrix, [1, 0, 0, 1, x, y]); },
    rotate(a) { matrix = mul(matrix, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    scale(x, y) { matrix = mul(matrix, [x, 0, 0, y, 0, 0]); },
    setTransform() { matrix = IDENTITY; },
    beginPath() { path = []; },
    closePath() {},
    moveTo(x, y) { path.push({ type: 'move', ...apply(matrix, x, y) }); },
    lineTo(x, y) { path.push({ type: 'line', ...apply(matrix, x, y) }); },
    arc(x, y, r, start, end) {
      path.push({ type: 'arc', ...apply(matrix, x, y), r: r * scaleOf(matrix), start, end, full: Math.abs(end - start) >= Math.PI * 1.99 });
    },
    rect(x, y, w, h) { path.push({ type: 'rect', ...apply(matrix, x, y), w, h }); },
    fill() { ops.push({ op: 'fill', path: path.slice(), state: snapshot() }); },
    stroke() { ops.push({ op: 'stroke', path: path.slice(), state: snapshot() }); },
    fillRect(x, y, w, h) { ops.push({ op: 'fillRect', ...apply(matrix, x, y), w, h, state: snapshot() }); },
    strokeRect(x, y, w, h) { ops.push({ op: 'strokeRect', ...apply(matrix, x, y), w, h, state: snapshot() }); },
    clearRect() {},
    fillText(text, x, y) { ops.push({ op: 'text', text: String(text), ...apply(matrix, x, y), state: snapshot() }); },
    strokeText() {},
    measureText: () => ({ width: 10 }),
    drawImage(_img, x, y, w, h) { ops.push({ op: 'image', ...apply(matrix, x ?? 0, y ?? 0), w, h, state: snapshot() }); },
    createLinearGradient: () => gradient(0),
    createRadialGradient: (_x0, _y0, _r0, _x1, _y1, r1) => gradient(r1),
    createPattern: () => null,
    clip() {},
    setLineDash() {},
    ellipse(x, y, rx, _ry, _rot, start, end) {
      path.push({ type: 'arc', ...apply(matrix, x, y), r: rx * scaleOf(matrix), start, end, full: Math.abs(end - start) >= Math.PI * 1.99 });
    },
    canvas: null,
  };
  for (const key of ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin', 'shadowBlur', 'shadowColor', 'globalCompositeOperation', 'imageSmoothingEnabled', 'filter']) {
    Object.defineProperty(ctx, key, { get: () => state[key], set: (v) => { state[key] = v; }, enumerable: true });
  }
  return { ctx, ops, reset: () => { ops.length = 0; } };
}

const rec = recorder();

// ---- DOM stub -------------------------------------------------------------
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => rec.ctx, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 393, height: 793 }), setPointerCapture() {}, releasePointerCapture() {} });
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.Image = class {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance ?? { now: () => 0 };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.screen = { width: 393, height: 793, orientation: { angle: 0 } };
globalThis.devicePixelRatio = 1;
globalThis.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, createElement: stubCanvas, body: { appendChild() {} } };
globalThis.innerWidth = 393;
globalThis.innerHeight = 793;
globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h),
  localStorage: globalThis.localStorage, devicePixelRatio: 1, innerWidth: 393, innerHeight: 793 };
globalThis.location = { search: '', pathname: '/' };

const bundle = await build({ entryPoints: ['src/game/core/Game2A.ts'], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { Game2A } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const game = new Game2A(stubCanvas());
game.deployTestMode();
game.reset();

// No sprites load in Node, so every hull falls through to its vector fallback.
// That is the harder case for these rules, not the easier one: the fallback
// draws a filled silhouette, so "nothing is filled over a hull" has to hold
// with a fill already on the screen.
const hex = (s) => String(s).trim().toLowerCase();
const isGreen = (s) => hex(s) === '#00ff00';
const isRed = (s) => /^#(ff3355|f35)$/.test(hex(s));
/** Circles this op painted, ignoring the tiny arcs that make up glyphs. */
const circles = (ops, kind) => ops.filter((o) => o.op === kind).flatMap((o) => o.path.filter((p) => p.type === 'arc').map((p) => ({ ...p, state: o.state })));

const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- 1. no shield: no ring at all ----------------------------------------
game.shield = 0;
game.shieldMax = 3;
game.clock = 1;
rec.reset();
game.drawPlayer();
const bare = rec.ops.slice();
const bareRings = circles(bare, 'stroke').filter((c) => near(c.x, game.player.x, 2) && near(c.y, game.player.y, 2) && c.full);
check(
  bareRings.length === 0,
  `a player with no shield must not wear a shield ring -- ${bareRings.length} full circle(s) stroked around the ship`,
);

// ---- 2. shield up: one thin green outline, nothing filled over it ---------
game.shield = 3;
game.shieldMax = 3;
rec.reset();
game.drawPlayer();
const shielded = rec.ops.slice();
const rings = circles(shielded, 'stroke').filter((c) => near(c.x, game.player.x, 2) && near(c.y, game.player.y, 2));
check(rings.length > 0, 'a live shield has to be drawn');
check(rings.some((c) => c.full), 'the shield needs a closed ring, not only a partial arc');
for (const ring of rings) {
  check(isGreen(ring.state.strokeStyle), `the player shield is locked to #00FF00; found ${ring.state.strokeStyle}`);
  check(ring.state.lineWidth <= 2, `the shield outline must stay thin; found lineWidth ${ring.state.lineWidth}`);
}
// The bubble, restated as a measurement: no fill whose path is a circle
// sitting on the ship. The vector-fallback hull IS a filled polygon, which is
// why this looks at arcs only.
const playerFills = circles(shielded, 'fill').filter((c) => near(c.x, game.player.x, 2) && near(c.y, game.player.y, 2) && c.r > 6);
for (const disc of playerFills) {
  check(
    disc.state.fillStyle?.__gradient === true,
    `a solid disc was filled over the player at r=${disc.r.toFixed(1)}, alpha ${disc.state.globalAlpha} -- that is the bubble`,
  );
}

// ---- 3. the shield moves --------------------------------------------------
//
// A still ring reads as a lid welded on. Two frames a beat apart must not
// paint the same geometry.
const ringsAt = (t) => { game.clock = t; rec.reset(); game.drawPlayer(); return circles(rec.ops, 'stroke').filter((c) => near(c.x, game.player.x, 2)); };
const frameA = ringsAt(0.4);
const frameB = ringsAt(0.9);
check(frameA.length === frameB.length && frameA.length > 0, 'could not compare two shield frames');
check(
  frameA.some((c, i) => Math.abs(c.r - frameB[i].r) > 0.05 || Math.abs(c.start - frameB[i].start) > 0.05),
  'the shield outline is identical frame to frame -- it has to ripple or sweep, or it reads as a lid',
);

// ---- 4. the shield colour does not follow the hull ------------------------
//
// The old ring took `def.accent`, so it was green only on the default ship.
const registryBundle = await build({ entryPoints: ['src/game/content/registry.ts'], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const { SHIPS: shipKeys, BOSSES: bossDefs } = await import(`data:text/javascript;base64,${Buffer.from(registryBundle.outputFiles[0].text).toString('base64')}`);
const accents = new Set(Object.values(shipKeys).map((s) => hex(s.accent)));
check(accents.size > 1, 'the ship roster should have more than one accent colour, or this check proves nothing');
for (const key of Object.keys(shipKeys)) {
  game.selectedShipKey = key;
  game.clock = 1;
  rec.reset();
  game.drawPlayer();
  const hullRings = circles(rec.ops, 'stroke').filter((c) => near(c.x, game.player.x, 2) && c.full);
  check(hullRings.length > 0, `${key}: no shield ring drawn`);
  check(hullRings.every((c) => isGreen(c.state.strokeStyle)), `${key}: the shield took the hull accent instead of #00FF00`);
}
game.selectedShipKey = Object.keys(shipKeys)[0];

// ---- 5. the rim light is a rim, and it is dim ----------------------------
const glows = rec.ops.filter((o) => o.op === 'fill' && o.state.fillStyle?.__gradient === true);
check(glows.length > 0, 'the hull needs a rim light, or it is a black shape on a black background');
for (const glow of glows) {
  const stops = glow.state.fillStyle.stops;
  check(stops.length >= 3, 'a rim light needs an inner, a peak and an outer stop');
  check(hex(stops[0][1]) === 'transparent', 'the rim light must be transparent at the centre, or it is a disc under the ship');
  check(hex(stops[stops.length - 1][1]) === 'transparent', 'the rim light must fall away to nothing at its outer edge');
  check(glow.state.globalAlpha <= 0.3, `the rim light must not overpower the sprite; alpha ${glow.state.globalAlpha}`);
}

// ---- 6. enemies: no ring by default, red outline when shielded -----------
game.spawnDrone?.();
if (game.drones.length === 0) {
  // Fall back to driving the wave loop until something spawns.
  for (let i = 0; i < 400 && game.drones.length === 0; i += 1) game.update(0.05);
}
check(game.drones.length > 0, 'could not get an enemy on the field');
const drone = game.drones[0];
if (drone) {
  drone.escort = false;
  rec.reset();
  game.drawDrone(drone);
  const droneRings = circles(rec.ops, 'stroke').filter((c) => near(c.x, drone.x, 2) && near(c.y, drone.y, 2) && c.full);
  check(droneRings.length === 0, `an unshielded enemy must not wear a ring -- that is the floating circle (${droneRings.length} found)`);

  // An escort holds the boss's shield up. Those are the ships to shoot, so
  // those are the ships that show one. The boss is a REAL one -- a hand-rolled
  // stand-in has no bossKey, and the shield now sizes itself off the def.
  game.wave = 6;
  game.startBossIfReady();
  check(!!game.boss?.bossKey, 'could not spawn a real boss -- the boss-shield checks below would be testing a stub');
  if (game.boss) {
    game.boss.state = 'fight';
    game.boss.x = 200;
    game.boss.y = 260;
  }
  game.drones.push(drone);
  drone.escort = true;
  drone.stance = 'holding';
  check(game.bossShielded() === true, 'a live escort should be holding a shield -- the enemy-shield check needs one');
  rec.reset();
  game.drawDrone(drone);
  const escortRings = circles(rec.ops, 'stroke').filter((c) => near(c.x, drone.x, 2) && near(c.y, drone.y, 2));
  check(escortRings.length > 0, 'an escort holding the boss shield must show one');
  for (const ring of escortRings) {
    check(isRed(ring.state.strokeStyle), `an enemy shield is red; found ${ring.state.strokeStyle}`);
    check(ring.state.lineWidth <= 2, `an enemy shield outline must stay thin; found ${ring.state.lineWidth}`);
  }
  const escortFills = circles(rec.ops, 'fill').filter((c) => near(c.x, drone.x, 2) && c.r > 6 && c.state.fillStyle?.__gradient !== true);
  check(escortFills.length === 0, 'an enemy shield must not be a filled bubble over the hull');

  // ---- 7. the boss shield stops covering the boss ------------------------
  const boss = game.boss;
  rec.reset();
  game.drawBossShield(boss);
  const bossFills = circles(rec.ops, 'fill').filter((c) => near(c.x, boss.x, 4) && c.r > 20);
  check(
    bossFills.length === 0,
    `the escort shield still fills a disc over the boss (r=${bossFills[0]?.r.toFixed(1)}, alpha ${bossFills[0]?.state.globalAlpha}) -- the boss has to stay visible through it`,
  );
  const bossRings = circles(rec.ops, 'stroke').filter((c) => near(c.x, boss.x, 4) && c.r > 20);
  check(bossRings.length > 0, 'the escort shield still has to be visible');
  for (const ring of bossRings) {
    check(isRed(ring.state.strokeStyle), `the escort shield should read as an enemy shield; found ${ring.state.strokeStyle}`);
    check(ring.state.lineWidth <= 2, `the escort shield outline must stay thin; found ${ring.state.lineWidth}`);
  }
  // Outside the boss, not across it -- checked for every boss in the roster,
  // not just the one that happened to spawn. Today's radius comes off the
  // drawn size so this holds by construction; the old one came off the
  // collision box, which is ~25% smaller and cleared the art only by luck.
  // The check is here so a bigger boss, or a smaller ring, cannot quietly
  // start striking through a sprite.
  for (const [key, def] of Object.entries(bossDefs)) {
    boss.bossKey = key;
    rec.reset();
    game.drawBossShield(boss);
    const art = Math.max(def.draw.w, def.draw.h) / 2;
    const ringsFor = circles(rec.ops, 'stroke').filter((c) => near(c.x, boss.x, 4));
    check(ringsFor.length > 0, `${key}: no shield outline drawn`);
    check(
      ringsFor.every((c) => c.r >= art),
      `${key}: the shield cuts across the sprite -- smallest ring r=${Math.min(...ringsFor.map((c) => c.r)).toFixed(1)} against a ${art.toFixed(1)} half-silhouette`,
    );
  }
  // The count is the instruction; it survived the redraw.
  check(rec.ops.some((o) => o.op === 'text' && /SHIELDED/.test(o.text)), 'the shield still has to say what to shoot instead');
}

// ---- 8. nobody reintroduces a hardcoded hull ring ------------------------
//
// Source-level, and deliberately narrow: the two rings this PR removed were
// both `arc(<actor>, ..., * 0.58, 0, Math.PI * 2)`.
const source = readFileSync('src/game/core/Game2A.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(!/\* 0\.58, 0, Math\.PI \* 2\)/.test(source), 'the unconditional 0.58x hull ring is back');

if (failures.length) {
  console.error('ship-readability: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('ship-readability: OK — hulls wear a rim light, shields are thin moving outlines (green yours, red theirs), nothing is filled over a ship.');
