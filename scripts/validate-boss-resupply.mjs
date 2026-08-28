// Pre-boss resupply, and the seeker rocket's on-screen size.
//
// Every other pickup in the game is tied to a kill count, and the drone run
// ends the instant a boss spawns -- so a player who limped in on an empty
// shield bank had no way left to top up. Each of the three boss entrances now
// drops a guaranteed shield cell and hull patch (plus one random third pick)
// before the fight opens.
//
// Source checks: the drops happen inside spawn methods whose only observable
// output is canvas pixels, so there is nothing to bundle and call.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const registry = readFileSync('src/game/content/registry.ts', 'utf8');

// ---- the resupply exists and every boss entrance uses it ------------------
check(/private dropBossResupply\(\): void \{/.test(game), 'dropBossResupply() is missing');

const body = game.split('private dropBossResupply(): void {')[1]?.split('\n  }\n')[0] ?? '';
check(/PICKUPS\.shield_cell/.test(body), 'the resupply must guarantee a shield cell -- that is the energy the player came for');
check(/PICKUPS\.repair/.test(body), 'the resupply must guarantee a hull repair');
check(
  /Math\.random\(\)/.test(body) && /PICKUPS\.bomb/.test(body) && /PICKUPS\.weapon_upgrade/.test(body),
  'the third pick should be a random roll between the bomb and the weapon upgrade',
);
check(/BOSS_RESUPPLY_DRIFT/.test(body), 'the resupply must drift slower than a normal drop or it falls past the player');

const drift = Number(/const BOSS_RESUPPLY_DRIFT = ([\d.]+);/.exec(game)?.[1]);
check(drift > 0 && drift < 1, `BOSS_RESUPPLY_DRIFT should slow the drop (0 < x < 1), got ${drift}`);

// Lanes must stay clear of the button cluster on the right edge: a pickup you
// can only reach by putting a thumb over a button is not a pickup.
const lanes = [...body.matchAll(/0\.18 \+ i \* 0\.24/g)];
check(lanes.length === 1, 'resupply lanes should be laid out left of the right-hand button cluster');

for (const entry of ['startBossIfReady', 'startGaryFogGuardian', 'startRegulatoryWarship']) {
  const method = game.split(`private ${entry}(`)[1]?.split('\n  }\n')[0] ?? '';
  check(/this\.dropBossResupply\(\);/.test(method), `${entry}() must drop the resupply before the fight starts`);
}

// It has to land before the boss can shoot, not after.
const gary = game.split('private startGaryFogGuardian(')[1]?.split('\n  }\n')[0] ?? '';
check(
  gary.indexOf('this.dropBossResupply();') < gary.indexOf('state: \'intro\''),
  'the resupply must be dropped before the boss actor is created',
);

// ---- the seeker rocket is a rocket, not a second ship ---------------------
const seeker = /seeker_missile: \{[\s\S]*?\n  \},/.exec(registry)?.[0] ?? '';
const draw = /draw: \{ w: (\d+), h: (\d+) \}/.exec(seeker);
check(Boolean(draw), 'seeker_missile has no draw size');
if (draw) {
  const [w, h] = [Number(draw[1]), Number(draw[2])];
  // Compare against the shortest hull in the roster, not just the starter --
  // the rocket has to look like ordnance from every ship that fires it.
  const ships = registry.split('export const SHIPS')[1]?.split('export const')[0] ?? '';
  const hulls = [...ships.matchAll(/draw: \{ w: (\d+), h: (\d+) \}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  check(hulls.length >= 3, `expected at least 3 player hulls to compare against, found ${hulls.length}`);
  // Compared by footprint, not height: a rocket is meant to be long and thin,
  // so height alone would flag a silhouette that reads fine.
  const smallest = Math.min(...hulls.map(([hw, hh]) => hw * hh));
  check(
    w * h <= smallest * 0.4,
    `the rocket footprint (${w}x${h} = ${w * h}) must stay under 40% of the smallest hull (${smallest})`,
  );
  check(w <= Math.min(...hulls.map(([hw]) => hw)) * 0.45, `the rocket is too wide at ${w}px`);
  check(w >= 6 && h >= 18, `the rocket got too small to see at ${w}x${h}`);
}

if (failures.length > 0) {
  console.error('boss-resupply validation FAILED:');
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`boss-resupply: OK — guaranteed shield + hull before all 3 bosses, rocket drawn at ${draw?.[1]}x${draw?.[2]}.`);
