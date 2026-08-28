// XP, upgrades and hull identities.
//
// "What if instead of floating power ups you get experience points and you get
// to choose your upgrades ... and what if the ships that you start with one has
// a bigger Shield one has better weapons and one has a better bomb or pulse"
// plus "make guns upgrade with pickups too and shields but the weapons upgrades
// are differnt weapons".
//
// The content half is a real behavioural test against the bundled registry.
// The runtime half is a source check, because the choice screen only exists as
// canvas pixels.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const bundle = await build({
  entryPoints: ['src/game/content/registry.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { SHIPS, WEAPONS, PICKUPS, validateContent } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const contentErrors = validateContent?.() ?? [];
check(contentErrors.length === 0, `registry does not validate: ${contentErrors.join('; ')}`);

// ---- every hull leans a different way -------------------------------------
const hulls = Object.values(SHIPS);
check(hulls.length >= 3, `expected at least 3 hulls, found ${hulls.length}`);
for (const ship of hulls) {
  check(!!ship.loadout, `ships.${ship.key}: no loadout`);
  const l = ship.loadout ?? {};
  check(Number.isInteger(l.shield) && l.shield >= 0, `ships.${ship.key}: shield must be a non-negative integer`);
  check(Number.isInteger(l.weaponTier) && l.weaponTier >= 1, `ships.${ship.key}: weaponTier must be >= 1`);
  check(Number.isInteger(l.bombs) && l.bombs >= 0, `ships.${ship.key}: bombs must be a non-negative integer`);
  check(l.pulse >= 1, `ships.${ship.key}: pulse multiplier must be >= 1`);
  check(l.weaponTier <= Object.keys(WEAPONS).length, `ships.${ship.key}: weaponTier is past the end of the ladder`);
}

// The point of a loadout is that picking a ship changes something. Each of the
// three axes must have a distinct leader, or ship select is cosmetic.
const leaderOf = (pick) => {
  const best = Math.max(...hulls.map(pick));
  return hulls.filter((s) => pick(s) === best);
};
const shieldLeader = leaderOf((s) => s.loadout.shield);
const weaponLeader = leaderOf((s) => s.loadout.weaponTier);
const ordnanceLeader = leaderOf((s) => s.loadout.bombs + (s.loadout.pulse - 1) * 5);
check(shieldLeader.length === 1, `exactly one hull should lead on shields, got ${shieldLeader.map((s) => s.key).join(', ') || 'none'}`);
check(weaponLeader.length === 1, `exactly one hull should lead on weapons, got ${weaponLeader.map((s) => s.key).join(', ') || 'none'}`);
check(ordnanceLeader.length === 1, `exactly one hull should lead on bomb/pulse, got ${ordnanceLeader.map((s) => s.key).join(', ') || 'none'}`);
const leaders = new Set([shieldLeader[0]?.key, weaponLeader[0]?.key, ordnanceLeader[0]?.key]);
check(leaders.size === 3, `the three strengths must land on three different hulls, got ${[...leaders].join(', ')}`);

// ---- weapon upgrades are different WEAPONS, not bigger numbers ------------
const ladder = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
check(ladder.length >= 4, `the weapon ladder should have real depth, found ${ladder.length} rungs`);
check(new Set(ladder.map((w) => w.tier)).size === ladder.length, 'weapon tiers must be unique');
check(new Set(ladder.map((w) => w.label)).size === ladder.length, 'every weapon needs its own name');
for (let i = 1; i < ladder.length; i++) {
  const prev = ladder[i - 1];
  const next = ladder[i];
  // "Different weapon" means the shape of the volley changes -- shot count,
  // angles, damage or piercing -- not just a faster version of the same gun.
  const shapeChanged =
    prev.shots.length !== next.shots.length
    || prev.damage !== next.damage
    || (prev.pierce ?? 0) !== (next.pierce ?? 0)
    || JSON.stringify(prev.shots.map((s) => s.angle)) !== JSON.stringify(next.shots.map((s) => s.angle));
  check(shapeChanged, `${next.key} is not a different weapon from ${prev.key}, only a retuned one`);
}
check(ladder.some((w) => (w.pierce ?? 0) > 0), 'no weapon pierces — the ladder tops out without a new mechanic');

// ---- guns and shields also come from pickups ------------------------------
const effects = new Set(Object.values(PICKUPS).map((p) => p.effect));
check(effects.has('weapon_upgrade'), 'guns must still upgrade from pickups');
check(effects.has('shield'), 'shields must be obtainable from pickups, not only from levelling');

// ---- runtime wiring -------------------------------------------------------
const game = readFileSync('src/game/core/Game2A.ts', 'utf8');
const progress = readFileSync('src/game/content/CampaignProgress.ts', 'utf8');

check(/private awardXp\(/.test(game), 'kills must pay XP');
check(/while \(this\.xp >= this\.xpForNextLevel\(\)\)/.test(game), 'a single big award must be able to cross more than one level');
check(/private applyUpgrade\(kind: UpgradeKind\)/.test(game), 'there must be an upgrade to apply');
for (const kind of ['weapon', 'shield', 'bomb', 'pulse']) {
  check(new RegExp(`case '${kind}':`).test(game), `upgrade "${kind}" is not implemented`);
}
// A choice made under fire is a reflex test, not a choice.
check(/if \(this\.upgradeOffer\.length > 0\) return;/.test(game), 'the fight must freeze while an upgrade is being chosen');
// Never offer something that cannot do anything.
check(/private upgradeAvailable\(/.test(game), 'maxed-out upgrades must be filtered out of the offer');
check(/this\.pendingUpgrades = 0;\n      this\.score \+= 250;/.test(game), 'with everything maxed, a level must bank score rather than stall behind an empty overlay');

// Shields have to be more than extra hit points, or they are not worth a level.
check(/private updateShield\(/.test(game), 'shields must regenerate');
check(/if \(this\.shield > 0\) \{/.test(game), 'shields must absorb damage before the hull does');
check(/SHIELD_REGEN_DELAY/.test(game) && /SHIELD_REGEN_STEP/.test(game), 'shield regeneration needs both a delay and a step');

// Continuing from a save must not cost the player everything they earned.
check(/private upgradeSnapshot\(/.test(game), 'checkpoints must carry upgrade state');
check(/xpLevel\?: number;/.test(progress), 'checkpoint snapshot needs optional upgrade fields for backward compatibility');
check(/clamp\(safeCount\(snapshot\.shieldMax, 0\), 0, 6\)/.test(progress), 'upgrade fields from local storage must be bounded');

// Piercing has to actually pierce.
check(/bolt\.pierce -= 1;/.test(game), 'a piercing bolt must spend a charge instead of dying');
check(/pierce: weapon\.pierce \?\? 0/.test(game), 'bolts must carry their weapon pierce count');

if (failures.length) {
  console.error('xp-upgrades: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`xp-upgrades: OK — ${hulls.length} distinct hulls, ${ladder.length}-rung weapon ladder, 4 upgrade paths.`);
