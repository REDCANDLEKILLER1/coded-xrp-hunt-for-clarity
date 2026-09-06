// Nine rungs that are actually a ladder.
//
// The old five-rung ladder was one gun that grew. Every rung fired `bb_shot`
// except the last, pierce was the only new mechanic in it, and CLARITY LANCE
// at the top was measurably a DOWNGRADE -- 11.5 dps against QUAD's 33.3 at
// zero barrels -- granted automatically at rank 12 with no way to decline.
//
// Everything here is measured through the SHIPPED `currentVolley()`, driven on
// a real Game2A. This file does not re-implement the barrel rule: the previous
// generation of this check did, and could therefore not see a change to the
// real one at all.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) };
const noopCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 })
  : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; } });
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => noopCtx, addEventListener() {}, removeEventListener() {},
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

const load = async (entry) => {
  const b = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
};
const { Game2A } = await load('src/game/core/Game2A.ts');
const { WEAPONS, PROJECTILES, ENEMIES } = await load('src/game/content/registry.ts');
const { EARTH_ENEMIES } = await load('src/game/content/EarthThreats.ts');

const gameSrc = readFileSync('src/game/core/Game2A.ts', 'utf8');
const code = gameSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const MAX_BARRELS = Number(/const MAX_BARRELS = (\d+);/.exec(code)?.[1]);
check(MAX_BARRELS > 0, 'MAX_BARRELS is missing');

const ladder = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
check(ladder.length >= 9, `the ladder has ${ladder.length} rungs; the plan is nine`);
check(ladder.every((w, i) => w.tier === i + 1), `tiers are not 1..${ladder.length} in order`);

// CLARITY LANCE is retired. Naming it here so a future re-add has to argue.
check(!ladder.some((w) => w.label === 'CLARITY LANCE'),
  'CLARITY LANCE is back; it was a measured downgrade granted with no way to decline');

// ---- drive the real volley ----------------------------------------------
const g = new Game2A(stubCanvas());
g.deployTestMode();
g.reset();
const volleyOf = (tier, barrels) => {
  g.baseWeaponTier = tier;
  g.xpLevel = 1;
  g.barrels = barrels;
  return g.currentVolley();
};
check(volleyOf(1, 0).length > 0, 'the shipped currentVolley returned nothing -- this file would prove nothing');

// ---- effectiveness against ONE CENTRED target ---------------------------
//
// Centred and single on purpose. Pierce and splash are multi-target bonuses,
// so requiring the ladder to be monotone WITHOUT them means no rung is carried
// by a bonus a lone enemy never sees.
const narrowest = Math.min(...[...Object.values(ENEMIES), ...Object.values(EARTH_ENEMIES)].map((d) => d.hitbox.w));
check(narrowest > 0, 'could not read an enemy hitbox');
const centred = (weapon, barrels) => {
  const lanes = volleyOf(weapon.tier, barrels);
  const boltHalf = (PROJECTILES[weapon.projectileKey]?.hitbox.w ?? 5) / 2;
  const reach = narrowest / 2 + boltHalf;
  let damage = 0;
  for (const lane of lanes) {
    const off = Math.abs(lane.offsetX);
    if (off <= reach) damage += weapon.damage;
    else if (weapon.splash && off <= weapon.splash) damage += weapon.splashDamage ?? 0;
  }
  return damage / weapon.fireRate;
};

const barrelCounts = Array.from({ length: MAX_BARRELS + 1 }, (_, i) => i);
for (const barrels of barrelCounts) {
  for (let i = 1; i < ladder.length; i += 1) {
    const below = centred(ladder[i - 1], barrels);
    const above = centred(ladder[i], barrels);
    check(above > below,
      `at ${barrels} barrels ${ladder[i].label} (${above.toFixed(1)}) is not better than ${ladder[i - 1].label} (${below.toFixed(1)})`);
  }
}
// Stronger, and the reason the above holds: a rung at its WORST must beat the
// rung below at its BEST, so no barrel count can invert the order.
for (let i = 1; i < ladder.length; i += 1) {
  const belowBest = Math.max(...barrelCounts.map((b) => centred(ladder[i - 1], b)));
  const aboveWorst = Math.min(...barrelCounts.map((b) => centred(ladder[i], b)));
  check(aboveWorst > belowBest,
    `${ladder[i].label} at its worst (${aboveWorst.toFixed(1)}) does not beat ${ladder[i - 1].label} at its best (${belowBest.toFixed(1)})`);
}

// ---- every barrel buys a lane -------------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts.slice(1)) {
    const before = volleyOf(weapon.tier, barrels - 1).length;
    const after = volleyOf(weapon.tier, barrels).length;
    check(after > before, `${weapon.label}: barrel ${barrels} adds no lane (${before} -> ${after})`);
  }
}

// ---- no hole across the aim point ---------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts) {
    const offsets = volleyOf(weapon.tier, barrels).map((s) => s.offsetX).sort((a, b) => a - b);
    for (let i = 1; i < offsets.length; i += 1) {
      if (offsets[i - 1] >= 0 || offsets[i] <= 0) continue;
      const gap = offsets[i] - offsets[i - 1];
      check(gap <= narrowest,
        `${weapon.label} x${barrels}: a ${gap}px hole sits across the aim point, wider than a ${narrowest}px enemy`);
    }
  }
}

// ---- from the first barrel, every gun puts a lane on the aim point ------
//
// The #113 report, in the player's words: "when you get 5 the sixth makes the
// auto cannon split into 2 rows of 3 ... it doesn't hit anything in the middle
// of the fire pattern." Raising MAX_VOLLEY alone lets an even gun spend its
// barrels without ever filling the centre, so removing the centre-first rule
// passed every other check in this file. This is the promise itself.
for (const weapon of ladder) {
  for (const barrels of barrelCounts.slice(1)) {
    const offsets = volleyOf(weapon.tier, barrels).map((s) => s.offsetX);
    check(offsets.includes(0),
      `${weapon.label} x${barrels} has no lane on the centreline: ${offsets.join(',')}`);
  }
}

// ---- lanes are parallel, always -----------------------------------------
for (const weapon of ladder) {
  for (const barrels of barrelCounts) {
    check(volleyOf(weapon.tier, barrels).every((s) => s.angle === 0),
      `${weapon.label} x${barrels} fans its shots; an angle becomes width over distance and there is nothing to aim`);
  }
}

// ---- families are mechanically different, not numerically ---------------
const families = new Set(ladder.map((w) => w.family));
check(families.size >= 4, `only ${families.size} weapon families; the ladder is one gun with different numbers`);
const withPierce = ladder.filter((w) => (w.pierce ?? 0) > 0);
const withSplash = ladder.filter((w) => (w.splash ?? 0) > 0);
const withClear = ladder.filter((w) => w.clearsShots);
check(withPierce.length > 0, 'no rung pierces');
check(withSplash.length > 0, 'no rung splashes');
check(withClear.length > 0, 'no rung clears hostile shots');
// And each of those has to be implemented, not just declared in data.
check(/bolt\.pierce -= 1;/.test(code), 'pierce is data only -- nothing spends a pierce charge');
check(/private splashFrom\(/.test(code) && /this\.splashFrom\(bolt, drone\)/.test(code),
  'splash is data only -- nothing applies a blast');
check(/private clearShotsWith\(/.test(code) && /this\.clearShotsWith\(bolt\)/.test(code),
  'clearsShots is data only -- nothing deletes a hostile shot');
// More than one projectile, or every family looks the same in flight.
check(new Set(ladder.map((w) => w.projectileKey)).size >= 3,
  'the whole ladder fires the same projectile art');

// ---- the primary gun does not reach into other systems ------------------
for (const weapon of ladder) {
  for (const forbidden of ['bombs', 'bombPower', 'shield', 'shieldMax', 'pulsePower']) {
    check(!(forbidden in weapon), `${weapon.label} carries ${forbidden}; the gun must not own bomb, shield or pulse state`);
  }
}

// ---- every weapon's assets exist and are consumed ------------------------
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
for (const weapon of ladder) {
  const projectile = PROJECTILES[weapon.projectileKey];
  check(!!projectile, `${weapon.label} fires '${weapon.projectileKey}', which is not in PROJECTILES`);
  if (!projectile) continue;
  const entry = manifest[projectile.sprite.category]?.[projectile.sprite.id];
  check(!!entry, `${weapon.label}'s projectile has no manifest entry (${projectile.sprite.category}/${projectile.sprite.id})`);
}
// No weapon icon may ship before something draws it.
const icons = Object.keys(manifest.weapons ?? {});
check(icons.length === 0 || /manifest\.weapons|'weapons'/.test(gameSrc),
  `${icons.length} weapon icons are in the manifest with nothing drawing them`);

if (failures.length) {
  console.error('weapon-ladder: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const rows = ladder.map((w) => `${w.tier} ${w.label.padEnd(15)} ${w.family.padEnd(8)} ${barrelCounts.map((b) => centred(w, b).toFixed(1).padStart(6)).join('')}`);
console.log(`weapon-ladder: OK — ${ladder.length} rungs, ${families.size} families, monotone at every barrel count.`);
console.log(`  tier label           family    ${barrelCounts.map((b) => ('x' + b).padStart(6)).join('')}`);
for (const row of rows) console.log(`  ${row}`);
