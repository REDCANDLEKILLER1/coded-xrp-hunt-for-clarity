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
for (const kind of ['shield', 'bomb', 'pulse']) {
  check(new RegExp(`case '${kind}':`).test(game), `upgrade "${kind}" is not implemented`);
}
// A new gun is what levelling GIVES you, not a card you trade a shield for.
check(!/'weapon' \| 'shield'/.test(game), 'weapon must not be an upgrade card — levelling grants it');
check(/NEW WEAPON \/\//.test(game), 'crossing a weapon level must announce the new gun');
// Every level tops the shields back up.
check(/this\.shield = this\.shieldMax;\n      this\.shieldQuietClock = 0;/.test(game), 'levelling must refill shields to max');

// ---- the gun is derived, and can never regress ----------------------------
// Reported: "when you upgrade the fifth time it gives you the first gun again".
// A stored tier can drift out of range and fall back to WEAPON_LADDER[0]; a
// derived one cannot. This walks the whole progression for every hull.
check(/private weaponTier\(\): number \{/.test(game), 'the weapon tier must be derived from the level, not stored');
check(!/this\.weaponTier = /.test(game), 'nothing may assign the weapon tier directly');

const num = (name) => {
  const match = game.match(new RegExp(`^const ${name} = ([\\d.]+);`, 'm'));
  check(!!match, `could not read ${name} from Game2A`);
  return match ? Number(match[1]) : NaN;
};
const tierLevels = JSON.parse((game.match(/^const WEAPON_TIER_LEVELS = (\[[^\]]*\]);/m) ?? [])[1] ?? '[]');
check(tierLevels.length > 0, 'WEAPON_TIER_LEVELS is missing');
check(tierLevels.every((v, i) => i === 0 || v > tierLevels[i - 1]), 'weapon levels must strictly increase');

const tierFor = (level, base) => {
  let tier = base;
  for (const at of tierLevels) if (level >= at) tier += 1;
  return Math.min(ladder.length, Math.max(1, tier));
};
for (const ship of hulls) {
  let previous = 0;
  for (let level = 1; level <= 40; level++) {
    const tier = tierFor(level, ship.loadout.weaponTier);
    check(tier >= previous, `ships.${ship.key}: gun went backwards at level ${level} (${previous} -> ${tier})`);
    check(tier >= 1 && tier <= ladder.length, `ships.${ship.key}: level ${level} yields tier ${tier}, off the ladder`);
    previous = tier;
  }
  check(previous === ladder.length, `ships.${ship.key}: never reaches the top of the ladder`);
}

// ---- pickups add barrels, they do not climb the ladder --------------------
check(/this\.barrels = Math\.min\(MAX_BARRELS, this\.barrels \+ 1\)/.test(game), 'weapon pickups must add a barrel');
check(/private currentVolley\(\)/.test(game), 'barrels must actually widen the volley');
check(/shots\.length < MAX_VOLLEY/.test(game), 'the volley needs a ceiling');

// ---- the seeker missile ----------------------------------------------------
// "a heat seeker missile that comes out automatically every four or five
// seconds if you upgrade so far ... so it seeks out a Target".
check(/const SEEKER_UNLOCK_LEVEL = WEAPON_TIER_LEVELS\[2\];/.test(game), 'the seeker must unlock deep in the ladder, not at a hand-typed level');
const interval = Number((game.match(/^const SEEKER_INTERVAL = ([\d.]+);/m) ?? [])[1]);
check(interval >= 4 && interval <= 5, `the seeker fires every ${interval}s — asked for four or five`);
check(/private updateSeekers\(/.test(game), 'the seeker needs an update');
check(/this\.updateSeekers\(dt\);/.test(game), 'the seeker update is never called');
// It must steer, not snap: a turn rate is what makes it a missile.
check(/const SEEKER_TURN = /.test(game), 'the seeker must have a turn rate');
check(/clamp\(delta, -SEEKER_TURN \* dt, SEEKER_TURN \* dt\)/.test(game), 'the seeker must turn at a limited rate, not snap onto its target');
check(/while \(delta > Math\.PI\) delta -= Math\.PI \* 2;/.test(game), 'the seeker must take the shortest way round, or it chases backwards targets the long way');
// It has to be able to run out, or misses accumulate forever.
check(/seeker\.age < SEEKER_LIFE/.test(game), 'seekers must expire');
check(/this\.seekers = \[\];/.test(game), 'seekers must not survive a reset');
// And it has to actually hit things.
for (const [what, pattern] of [
  ['drones', /if \(\(drone\.hp \?\? 0\) <= 0 \|\| !overlap\(box\(seeker/],
  ['hazards', /if \(\(hazard\.hp \?\? 0\) <= 0 \|\| !overlap\(box\(seeker/],
  ['the boss', /this\.boss\?\.state === 'fight' && overlap\(box\(seeker/],
  ['the warship', /!overlap\(box\(seeker, 0\.8\), this\.warshipSystemBox\(system\)\)/],
]) {
  check(pattern.test(game), `seekers do not hit ${what}`);
}

// ---- RPG pacing, measured against the XP the level actually pays ----------
const base = num('XP_LEVEL_BASE');
const step = num('XP_LEVEL_STEP');
const perScore = num('XP_PER_SCORE');
const waveClear = num('XP_WAVE_CLEAR');
const cumulative = (level) => (level - 1) * base + step * ((level - 1) * (level - 2)) / 2;

// What Level 1 pays out, from the authored encounters and the real score values.
const encBundle = await build({
  entryPoints: ['src/game/content/EarthFlightEncounters.ts', 'src/game/content/EarthThreats.ts'],
  bundle: true, format: 'esm', write: false, logLevel: 'silent', outdir: 'out',
});
const pick = async (name) => import(`data:text/javascript;base64,${Buffer.from(
  encBundle.outputFiles.find((f) => f.path.endsWith(`${name}.js`)).text).toString('base64')}`);
const { EARTH_FLIGHT_ENCOUNTERS } = await pick('EarthFlightEncounters');
const earth = await pick('EarthThreats');
const { ENEMIES, HAZARDS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const scoreOf = (spawn) => spawn.kind === 'enemy'
  ? (earth.EARTH_ENEMIES?.[spawn.enemyKey] ?? ENEMIES[spawn.enemyKey])?.score ?? 0
  : (earth.EARTH_HAZARDS?.[spawn.hazardKey] ?? HAZARDS[spawn.hazardKey])?.score ?? 0;

let levelXp = 0;
for (const encounter of Object.values(EARTH_FLIGHT_ENCOUNTERS)) {
  for (const group of encounter.groups) {
    levelXp += waveClear;
    for (const spawn of group.spawns) levelXp += scoreOf(spawn) * perScore;
  }
}
check(levelXp > 0, 'could not price the level in XP — the scraper is broken');

const quadLevel = tierLevels[2];
const lanceLevel = tierLevels[3];
const quadAt = cumulative(quadLevel) / levelXp;
const lanceAt = cumulative(lanceLevel) / levelXp;

// "it's supposed to take longer ... less like a video arcade game and more like
// a long-term RPG". The fourth gun must be past the halfway mark and the fifth
// must be a genuine end-of-level goal.
check(quadAt > 0.45, `QUAD BEAM arrives ${(quadAt * 100).toFixed(0)}% into the level — still arcade pacing`);
check(lanceAt > 0.8, `CLARITY LANCE arrives ${(lanceAt * 100).toFixed(0)}% into the level — not a long-term goal`);
check(lanceAt <= 1.2, `CLARITY LANCE needs ${(lanceAt * 100).toFixed(0)}% of the level's XP — unreachable`);
check(cumulative(2) >= 120, `level 2 costs ${cumulative(2)} XP — too cheap for RPG pacing`);
console.log(`  level pays ~${Math.round(levelXp)} XP • QUAD at ${(quadAt * 100).toFixed(0)}% • LANCE at ${(lanceAt * 100).toFixed(0)}%`);
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
console.log(`xp-upgrades: OK — ${hulls.length} distinct hulls, ${ladder.length} guns granted by level, barrels from drops, 3 upgrade cards.`);
