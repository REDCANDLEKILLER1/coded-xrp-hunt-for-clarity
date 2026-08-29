// Every pickup does its own job, and looks like the job it does.
//
// Two defects hid behind each other here.
//
// The first was mechanical: pickupDef() ended in `?? PICKUPS.weapon_upgrade`,
// so any key the registry did not know silently became a weapon upgrade --
// a free barrel handed out by a drop that was never a gun drop.
//
// The second was that the fix for the first would not have been visible. All
// four pickup sprites are a green glyph inside the same blue ring; at 22px in
// flight they are one object, so a player cannot tell which they collected and
// EVERY effect reads as the wrong one. Distinct tints and tags are what make
// the wiring checkable by eye, so they are pinned here as data.
//
// And the rule that started it: nothing in the field bolts a barrel onto the
// gun. Barrels come from the level-up choice, where they can be declined --
// a player who chose a tight volley keeps it.

import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const registry = readFileSync('src/game/content/registry.ts', 'utf8');
const types = readFileSync('src/game/content/types.ts', 'utf8');

/** Body of a method, from its signature to the matching closing brace. */
const methodBody = (source, signature) => {
  const start = source.indexOf(signature);
  if (start < 0) return null;
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
};

// ---- the silent fallback is gone ----------------------------------------
const lookup = methodBody(game, 'private pickupDef(');
check(lookup !== null, 'pickupDef is missing');
check(
  lookup !== null && !/\?\?\s*PICKUPS\./.test(lookup),
  'pickupDef falls back to a real pickup: an unknown key must be nothing, not a free upgrade',
);
check(
  lookup !== null && /PickupDef \| null/.test(lookup),
  'pickupDef must be able to return null so callers handle an unknown key',
);
for (const caller of ['private applyPickup(', 'private drawPickup(']) {
  const body = methodBody(game, caller);
  check(body !== null, `${caller} is missing`);
  check(
    body !== null && /if \(!def\) return/.test(body),
    `${caller} does not bail out on an unknown pickup key`,
  );
}

// ---- no field drop touches the gun --------------------------------------
const apply = methodBody(game, 'private applyPickup(') ?? '';
check(
  !/this\.barrels\s*=/.test(apply),
  'applyPickup assigns this.barrels: a pickup must never widen the volley on its own',
);
check(
  /case 'weapon_upgrade':[\s\S]*?this\.pendingUpgrades \+= 1/.test(apply),
  'the upgrade crate must bank a level-up CHOICE, not apply an upgrade itself',
);

// ---- each effect is handled, exactly once, and says so ------------------
const effects = ['weapon_upgrade', 'bomb', 'repair', 'shield'];
for (const effect of effects) {
  const branches = apply.match(new RegExp(`case '${effect}':`, 'g')) ?? [];
  check(branches.length === 1, `applyPickup handles '${effect}' ${branches.length} times, expected once`);
}
check(
  /this\.missionBannerText = banner/.test(apply) && /this\.missionBannerClock/.test(apply),
  'applyPickup must name every pickup on the banner: a silent effect reads as a broken one',
);

// ---- effect wiring, per key ---------------------------------------------
const expected = {
  shield_cell: 'shield',
  weapon_upgrade: 'weapon_upgrade',
  bomb: 'bomb',
  repair: 'repair',
};
const tints = new Map();
const tags = new Map();
for (const [key, effect] of Object.entries(expected)) {
  const block = registry.match(new RegExp(`\\n  ${key}: \\{[\\s\\S]*?\\n  \\},`));
  check(block !== null, `PICKUPS.${key} is missing from the registry`);
  if (!block) continue;
  const body = block[0];
  check(
    new RegExp(`effect: '${effect}'`).test(body),
    `PICKUPS.${key} is not wired to the '${effect}' effect`,
  );
  const tint = body.match(/tint: '(#[0-9a-fA-F]{6})'/);
  const tag = body.match(/tag: '([A-Z]{2,4})'/);
  check(tint !== null, `PICKUPS.${key} has no tint: it would be unreadable against the other drops`);
  check(tag !== null, `PICKUPS.${key} has no tag`);
  if (tint) tints.set(key, tint[1].toLowerCase());
  if (tag) tags.set(key, tag[1]);
}
check(new Set(tints.values()).size === tints.size, `pickup tints collide: ${[...tints].map(([k, v]) => `${k}=${v}`).join(', ')}`);
check(new Set(tags.values()).size === tags.size, `pickup tags collide: ${[...tags].map(([k, v]) => `${k}=${v}`).join(', ')}`);

check(/tint: string;/.test(types) && /tag: string;/.test(types), 'PickupDef must declare tint and tag');

// ---- the aura is actually drawn, for every pickup, sprite or not --------
const draw = methodBody(game, 'private drawPickup(') ?? '';
check(
  /strokeStyle = def\.tint/.test(draw) && /fillStyle = def\.tint/.test(draw),
  'drawPickup does not paint the effect tint',
);
check(
  /strokeText\(def\.tag/.test(draw) && /fillText\(def\.tag/.test(draw),
  'drawPickup does not stamp the effect tag',
);
// The aura must precede the sprite draw and must not be skipped by it: the
// old code returned the moment the sprite rendered, which is exactly the
// path every real pickup takes.
const auraAt = draw.search(/strokeStyle = def\.tint/);
const spriteAt = draw.search(/drawCentered\(def\.sprite/);
check(auraAt >= 0 && spriteAt >= 0 && auraAt < spriteAt, 'the tint aura must be drawn before the sprite');
check(
  !/if \(this\.drawCentered\(def\.sprite[\s\S]*?\) return;/.test(draw),
  'drawPickup returns early when the sprite renders, which skips the aura on every real pickup',
);

if (failures.length > 0) {
  console.error('pickup wiring FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('pickup wiring OK: 4 pickups, distinct tint + tag, no field drop touches the gun');
