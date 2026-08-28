// The Regulatory Warship interior.
//
// The interior shipped with two of its six rooms. This covers the four that
// were missing — Access Corridor, Maintenance Shaft, Field Control Chamber,
// Defense Systems Deck — and the properties that keep a platformer playable:
// every ledge reachable, every exit reachable, difficulty climbing, and no
// room able to soft-lock a run.
//
// Core Access is the checkpoint that hands off to the Ledger Defense Core boss,
// not a seventh combat room.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/onfoot/InteriorRooms.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { REGULATORY_INTERIOR_ROOMS: rooms, ONFOOT_PHYSICS: phys, validateInteriorRooms } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const own = validateInteriorRooms();
check(own.length === 0, `interior rooms do not validate: ${own.join('; ')}`);

const expected = ['docking_bay', 'security_checkpoint', 'access_corridor', 'maintenance_shaft', 'field_control', 'defense_deck'];
check(
  rooms.map((r) => r.key).join(',') === expected.join(','),
  `room order is ${rooms.map((r) => r.key).join(',')}, expected ${expected.join(',')}`,
);

// ---- physics the rooms are authored against --------------------------------
const jumpRise = phys.jumpSpeed ** 2 / (2 * phys.gravity);
// Horizontal reach at the apex, halved: how far across a gap a jump carries.
const jumpRun = phys.moveSpeed * (phys.jumpSpeed / phys.gravity) * 2;
check(jumpRise > 100, `a ${Math.round(jumpRise)}px jump cannot clear authored ledges`);

for (const room of rooms) {
  const where = `interior.${room.key}`;

  // The floor must actually span the room, or the player falls out of the world.
  const floor = room.platforms.find((p) => p.y === room.floorY);
  check(!!floor, `${where}: no platform at floorY`);
  if (floor) check(floor.x <= 0 && floor.x + floor.w >= room.worldWidth, `${where}: floor does not span the room`);

  // Nothing may sit outside the world.
  for (const p of room.platforms) {
    check(p.x >= 0 && p.x + p.w <= room.worldWidth, `${where}: platform at x=${p.x} leaves the room`);
    check(p.y > 0 && p.y < room.worldHeight, `${where}: platform at y=${p.y} leaves the room`);
  }

  // Reachability, properly: flood-fill from the floor rather than assuming the
  // player must hop ledge to ledge in height order. The floor spans every room,
  // so anything within one jump of it is reachable, and anything higher needs a
  // stepping stone that is itself reachable.
  const canReach = (from, to) => {
    if (from.y - to.y > jumpRise) return false;                       // too high to jump
    const gap = Math.max(0, to.x - (from.x + from.w), from.x - (to.x + to.w));
    return gap <= jumpRun;                                            // and within horizontal reach
  };
  const reached = new Set(floor ? [floor] : []);
  for (let changed = true; changed; ) {
    changed = false;
    for (const candidate of room.platforms) {
      if (reached.has(candidate)) continue;
      if ([...reached].some((from) => canReach(from, candidate))) {
        reached.add(candidate);
        changed = true;
      }
    }
  }
  for (const platform of room.platforms) {
    check(reached.has(platform), `${where}: the ledge at (${platform.x},${platform.y}) cannot be reached from the floor`);
  }

  // The player must start on solid ground, not in a wall or in mid-air forever.
  const startFloor = room.platforms.some((p) => room.startX >= p.x - 40 && room.startX <= p.x + p.w + 40 && p.y > room.startY);
  check(startFloor, `${where}: spawn point has nothing beneath it`);

  // Enemies must be standing on something too, or they hang in space.
  for (const enemy of room.enemies) {
    const perch = room.platforms.some((p) => enemy.x >= p.x - 60 && enemy.x <= p.x + p.w + 60 && p.y > enemy.y && p.y - enemy.y < 130);
    check(perch, `${where}: enemy at (${enemy.x},${enemy.y}) has no perch`);
    check(enemy.health > 0 && enemy.fireSeconds > 0, `${where}: enemy at x=${enemy.x} has invalid stats`);
  }

  // An exit pinned to a height needs a REACHABLE ledge there, or the room
  // soft-locks: cleared of enemies with no way through the door.
  if (room.exitY !== undefined) {
    check(!!room.verticalCamera, `${where}: an exit at height needs the camera to follow the climb`);
    const landing = room.platforms.find((p) => Math.abs(p.y - room.exitY) < 130 && p.x + p.w > room.exitX - 40);
    check(!!landing, `${where}: exit at y=${room.exitY} has no ledge to reach it`);
    if (landing) check(reached.has(landing), `${where}: the exit ledge exists but cannot be climbed to`);
  }
}

// ---- the shaft is a climb, not a corridor ----------------------------------
const shaft = rooms.find((r) => r.key === 'maintenance_shaft');
check(!!shaft, 'the maintenance shaft is missing');
if (shaft) {
  const highest = Math.min(...shaft.platforms.map((p) => p.y));
  const climb = shaft.floorY - highest;
  check(climb > 600, `the shaft only climbs ${Math.round(climb)}px — that is a corridor, not a shaft`);
  check(shaft.exitY !== undefined, 'the shaft exit must be gated by height, or its floor leads straight to the door');
  check(shaft.verticalCamera === true, 'the shaft needs the following camera');
}

// Only the shaft should override the camera; a pinned floor reads better for
// every side-scrolling room.
check(
  rooms.filter((r) => r.verticalCamera).length === 1,
  'exactly one room should use the following camera',
);

// ---- difficulty climbs across the interior ---------------------------------
const pressure = rooms.map((r) => r.enemies.reduce((sum, e) => sum + e.health / e.fireSeconds, 0));
check(pressure[pressure.length - 1] > pressure[0] * 2, 'the last room must be meaningfully harder than the first');
check(
  rooms[rooms.length - 1].enemies.length >= 4,
  `the deck before the core carries ${rooms[rooms.length - 1].enemies.length} enemies — too light for a finale`,
);

// ---- rooms without art still draw something ---------------------------------
const runtime = readFileSync('src/game/onfoot/OnFootGame.ts', 'utf8');
check(/private drawProceduralInterior\(/.test(runtime), 'rooms without art need a procedural interior, not a flat fill');
check(!/c\.fillStyle = '#0a1a29';\n      c\.fillRect\(0, 0, this\.room\.worldWidth/.test(runtime), 'the flat-fill fallback is back');
check(/if \(!room\.backgroundSrc\) continue;/.test(runtime), 'rooms without art must not request a file nobody made');
for (const room of rooms) {
  check(/^#[0-9a-f]{6}$/i.test(room.accent), `interior.${room.key}: needs an accent for its procedural lighting`);
}

// The interior was silent; it shares the flight game's synthesised voices now.
check(/from '\.\.\/audio\/Sfx'/.test(runtime), 'the interior must make noise');
for (const voice of ["'shoot'", "'enemyShoot'", "'hurt'", "'explode'"]) {
  check(new RegExp(`sfx\\.play\\(${voice}`).test(runtime), `interior has no ${voice} sound`);
}

if (failures.length) {
  console.error('interior-rooms: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const enemies = rooms.reduce((n, r) => n + r.enemies.length, 0);
console.log(`interior-rooms: OK — ${rooms.length} rooms, ${enemies} authored enemies, every ledge and exit reachable.`);
