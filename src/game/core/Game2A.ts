import { AssetLoader } from './AssetLoader';
import { Input } from './Input';
import { Loop } from './Loop';
import { SpriteRenderer } from './Sprite';
import { debugLog } from './DebugLog';
import { sfx } from '../audio/Sfx';
import type { Rect } from './Types';
import { BOSSES, ENEMIES, ENVIRONMENT_PROPS, FX, HAZARDS, PICKUPS, PROJECTILES, SHIPS, SPECIALS, STAGES, WEAPONS, selectHazardKey } from '../content/registry';
import { bossPhaseIndex, nextBossKey, orderedBossKeys } from '../content/BossDirector';
import { loadCampaignProgress, missionCheckpointFor, recordCampaignRun, recordMissionCheckpoint, saveCampaignProgress } from '../content/CampaignProgress';
import type { CampaignProgress, MissionCheckpointSnapshot } from '../content/CampaignProgress';
import { EarthFlightEncounterDirector, earthFlightEncounterFor } from '../content/EarthFlightEncounters';
import { EARTH_ENEMIES, EARTH_HAZARDS } from '../content/EarthThreats';
import { awardGaryFogVictory, GARY_FOG_GUARDIAN_PLAN, guardianPlanFor, hasFogBreaker } from '../content/EarthBossFlow';
import type { GuardianEncounterPlan } from '../content/EarthBossFlow';
import { EARTH_LAUNCH_REVEAL, GARY_FOG_REVEAL, revealTotalDuration } from '../content/Level1Cinematics';
import { REGULATORY_WARSHIP, RegulatoryWarshipDirector } from '../content/RegulatoryWarship';
import type { WarshipSystemState } from '../content/RegulatoryWarship';
import { MissionDirector } from '../content/MissionDirector';
import { missionForPlanet } from '../content/missions';
import type { MissionCheckpointDef } from '../content/missions/types';
import { availableEnemyKeys, selectEnemyKey, spawnInterval } from '../content/WaveDirector';
import type { BossAttackKey, BossDef, BossPhaseDef, EnemyDef, EnemyDoctrine, HazardDef, PickupDef, ProjectileDef, SpriteRef, StageDef, WeaponDef, WeaponShotDef } from '../content/types';

type Mode = 'title' | 'select' | 'play' | 'results' | 'victory';
type Actor = { x: number; y: number; w: number; h: number; vx: number; vy: number; hp?: number; life?: number };
type EnemyStance = 'entering' | 'holding' | 'diving' | 'fleeing';
type EnemyActor = Actor & {
  enemyKey: string;
  age: number;
  anchorX: number;
  phase: number;
  direction: -1 | 1;
  fireClock: number;
  /** Combat stance. Enemies hold an arena station instead of falling through. */
  stance: EnemyStance;
  stationX: number;
  stationY: number;
  stanceClock: number;
  /** Seconds of combat left before this enemy breaks off and runs. */
  patience: number;
  dodgeCooldown: number;
  /** True at the ends of a hold pattern -- when rhythm shooters fire. */
  atRest: boolean;
  /** Launched by a boss to screen it. The boss is immune while any survive. */
  escort: boolean;
};
type HazardActor = Actor & { hazardKey: string; fireClock: number; side: -1 | 1 };
type HostileProjectile = Actor & {
  damage: number;
  color: string;
  projectileKey: string;
  /** Radians per second this round may steer toward the player. Salvo only. */
  homing?: number;
  /** Seconds of steering left before it commits to its heading. */
  track?: number;
  /** Drawn size, so a heavy round reads as heavy without new art. */
  size?: number;
};
type BossActor = Actor & {
  bossKey: string;
  state: 'intro' | 'fight';
  age: number;
  fireClock: number;
  contactClock: number;
  phaseIndex: number;
  targetX: number;
  /**
   * Where the boss is in its attack script.
   *
   * `telegraph` is the tell -- long enough to read and react to. `active` runs
   * sustained attacks. `recover` is the punish window: the boss cannot fire
   * and takes extra damage, so learning the script is what actually kills it.
   */
  attackIndex: number;
  attackState: 'telegraph' | 'active' | 'recover';
  attackClock: number;
  /** Where a fog wall leaves its gap, or where a charge is aimed. */
  attackAim: number;
  /**
   * The boss's actual maximum, scaled to the player's firepower when it spawns
   * so the fight lasts about the same TIME whatever gun turned up. `def.hp` is
   * the tuning number, not the live one.
   */
  maxHp: number;
};
type WarshipActor = Actor & {
  state: 'intro' | 'fight' | 'disabled';
  age: number;
  fireClock: number;
};
type ProjectileActor = Actor & { damage: number; projectileKey: string; pierce: number };
/** A player missile that steers. `target` is re-acquired if its quarry dies. */
type SeekerActor = Actor & { damage: number; angle: number; age: number };
/**
 * Weapon is deliberately absent: a new gun is what levelling GIVES you, not
 * something you trade a shield for. The cards are the choice you still make.
 */
type UpgradeKind = 'shield' | 'bomb' | 'pulse' | 'barrel';
type PickupActor = Actor & { pickupKey: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

// Arena combat tuning.
//
// Enemies used to fall straight through the play area, and anything that
// reached the bottom cost a life. On a short landscape screen a run was over in
// about twenty-five seconds without the player ever losing a fight. They now
// fly in, hold a station, manoeuvre, dodge, and eventually break off and run —
// escaping costs score, never health.
const ENEMY_STATION_TOP = 0.14;      // fraction of screen height
const ENEMY_STATION_BOTTOM = 0.52;
const ENEMY_PATIENCE_MIN = 9;        // seconds of combat before breaking off
const ENEMY_PATIENCE_VARY = 7;
const ENEMY_DIVE_CHANCE = 0.32;      // per opportunity, once settled

/**
 * What each enemy behaviour actually does.
 *
 * `behavior` used to select nothing but a sway width -- 74px, 52px or 30px --
 * so every ship in the game flew the identical hold-and-dive loop and only the
 * numbers differed. These give each one a routine with its own rhythm and its
 * own opening:
 *
 *   straight  pressure. Barely holds, dives often, comes straight down.
 *   sine      weaver. A wide slow arc across the lane; fires at the extremes.
 *   zigzag    darter. Sharp lateral dashes with a pause; fires when it stops.
 *   dive      hunter. Tracks your column, then commits, then climbs out.
 *
 * `burst` is how many shots leave the guns at once, and `sway` the width of
 * the hold pattern. `dive` is the per-opportunity chance of an attack run.
 */
const ENEMY_TACTICS: Record<EnemyDef['behavior'], {
  sway: number;
  swaySpeed: number;
  dive: number;
  burst: number;
  spread: number;
  /** Fires only at the ends of its movement, where the rhythm is readable. */
  firesAtRest: boolean;
}> = {
  straight: { sway: 22, swaySpeed: 1.4, dive: 0.52, burst: 1, spread: 0, firesAtRest: false },
  sine: { sway: 96, swaySpeed: 1.15, dive: 0.14, burst: 2, spread: 0.16, firesAtRest: true },
  zigzag: { sway: 74, swaySpeed: 2.6, dive: 0.22, burst: 1, spread: 0, firesAtRest: true },
  dive: { sway: 34, swaySpeed: 1.0, dive: 0.62, burst: 3, spread: 0.2, firesAtRest: false },
};
/**
 * What each doctrine actually fires.
 *
 * Before this table every armed enemy pushed one aimed `enemy_missile` at
 * `def.projectileSpeed`, so six ships with six silhouettes and six accent
 * colours all played identically: one bullet, straight at you, on a timer.
 * Cadence was the only difference, and cadence is not a weapon.
 *
 * `speed` and `interval` MULTIPLY the enemy's own numbers rather than
 * replacing them, so the per-ship tuning already in the registry still means
 * something and a doctrine cannot silently make a slow ship fast.
 *
 * `damage` stays 1 everywhere on purpose. This PR gives the roster different
 * weapons, not more teeth -- difficulty is the pressure curve's job, and a
 * doctrine that also raised damage would smuggle a balance change in behind a
 * readability change.
 */
const ENEMY_DOCTRINES: Record<EnemyDoctrine, {
  /** Rounds per volley. */
  shots: number;
  /** Radians between them. */
  spread: number;
  /** Multiplier on the enemy's own projectileSpeed. */
  speed: number;
  /** Multiplier on the enemy's own fireRate. Below 1 is faster. */
  interval: number;
  projectileKey: string;
  /** Drawn size, so a heavy round reads as heavy at 20px. */
  size: number;
  /** Steers toward the player. Only the salvo does. */
  homing?: number;
  label: string;
}> = {
  pressure: { shots: 1, spread: 0, speed: 1.15, interval: 0.55, projectileKey: 'enemy_red_bullet', size: 7, label: 'RAPID' },
  burst: { shots: 3, spread: 0.11, speed: 1.0, interval: 1.15, projectileKey: 'enemy_red_bullet', size: 8, label: 'BURST' },
  salvo: { shots: 1, spread: 0, speed: 0.62, interval: 1.5, projectileKey: 'enemy_missile', size: 13, homing: 1.5, label: 'SEEKER' },
  broadside: { shots: 5, spread: 0.26, speed: 0.9, interval: 1.35, projectileKey: 'enemy_red_bullet', size: 8, label: 'BROADSIDE' },
};
/** How long a tracking missile keeps steering before it goes ballistic. */
const SALVO_TRACK_SECONDS = 2.4;

const ENEMY_DODGE_RANGE = 92;        // px ahead of a bolt an enemy reacts to
const ENEMY_DODGE_COOLDOWN = 0.55;
const ENEMY_ESCAPE_PENALTY = 40;     // score lost when one gets away
const WAVE_CLEAR_BONUS = 150;        // for destroying every enemy on screen
// Enemies now linger for 9-16s instead of crossing in about one second, so the
// arcade spawner has to be capped or the screen fills. The cap grows slowly
// with the wave to keep pressure rising without becoming unreadable on a phone.
const ARENA_MAX_ENEMIES_BASE = 5;
const ARENA_MAX_ENEMIES_CAP = 10;
// Enemies were never able to shoot: EnemyDef had no firing fields and the only
// hostile fire in the game came from bosses and ground turrets. Armed enemies
// only fire while holding station or diving, never while entering or fleeing,
// so a formation cannot open up before the player can see it.
const ENEMY_FIRE_ARC = 0.62;      // how closely aimed at the player, 0..1
const ENEMY_FIRE_JITTER = 0.6;    // seconds of spread so volleys are not synced

const BURST_LIFE = 0.45;
const BURST_MAX_RADIUS = 72;
const BURST_MIN_RADIUS = 6;
const DEBRIS_MIN = 10;
const DEBRIS_VARY = 6;
// Barrel drops. At every 7 kills a hull maxed its barrels inside the first
// couple of minutes, which trivialised the early game now that the gun itself
// is on a much longer clock. Three barrels now take ~72 kills.
const UPGRADE_EVERY_KILLS = 24;
const BOMB_EVERY_KILLS = 12;
const REPAIR_EVERY_KILLS = 10;
const MAX_BOMBS = 3;
const BOMB_LIFE = 0.55;

// XP and upgrades.
//
// Kills pay XP, XP buys levels, and each level hands the player a choice of
// three upgrades. Weapon upgrades hand over a genuinely different gun rather
// than the same gun with a bigger number, which is why the ladder tops out at
// five distinct weapons.
// RPG pacing, not arcade pacing.
//
// Level 1's 96 authored groups pay out roughly 13,800 XP once every enemy,
// emplacement and wave-clear bonus is counted -- a number the validator
// computes from the encounter data rather than a guess. This curve spends all
// of it across twelve levels: the last arrives as the warship does. The first
// pass charged 55 XP for level 2 and handed out a new gun every couple of
// minutes, which is the arcade pacing this replaces.
const XP_LEVEL_BASE = 420;
const XP_LEVEL_STEP = 150;

/**
 * Levels at which the hull is handed a genuinely new gun.
 *
 * The weapon is no longer something you pick off a card: levelling gives it to
 * you, and the gaps are wide on purpose. QUAD BEAM lands two-thirds of the way
 * through the level and CLARITY LANCE only at the very end, so the ladder is a
 * long-term goal rather than a five-minute climb.
 */
const WEAPON_TIER_LEVELS = [3, 6, 9, 12];

// Boss duel.
//
// A boss fight stops being a lane shooter: the arena opens up, both fighters
// keep their nose on each other, and the player's guns fire along that heading
// instead of straight up. Flanking a boss should mean shooting sideways at it,
// not shooting past it.
/**
 * Top of the fighter's band in ordinary flight, as a fraction of screen height.
 *
 * Shallow enough to reach ENEMY_STATION_TOP, so every enemy that holds station
 * can be flown up to and flanked rather than only shot at from below.
 */
const FLIGHT_LANE_TOP = 0.12;
const DUEL_LANE_TOP = 0.06;
/** How fast a nose swings onto its target, in radians per second. */
const DUEL_TURN = 7.5;
const BOSS_TURN = 2.6;

/** Extra barrels a hull can bolt on, and the ceiling on a single volley. */
const MAX_BARRELS = 3;
/**
 * Barrels come in pairs, so this wants to be odd -- at 6 an odd-base gun like
 * BB SHOT or the Lance could only take two of its three barrels.
 */
const MAX_VOLLEY = 7;
/**
 * How long a freshly-opened upgrade overlay ignores taps.
 *
 * Sized against the double-tap window rather than picked by feel: Input.ts
 * pairs two taps up to DOUBLE_TAP_MS = 280ms apart, so the second tap of a
 * bomb gesture can land at most 280ms after the first. 0.36s covers that with
 * room for a slow thumb, and is still short enough that a player who WANTS to
 * pick a card is never left prodding a dead overlay.
 */
const UPGRADE_ARM_SECONDS = 0.36;

// Seeker missile. Unlocked deep in the ladder, then fires itself on a timer --
// the reward for getting far enough is a weapon you do not have to aim.
const SEEKER_UNLOCK_LEVEL = WEAPON_TIER_LEVELS[2];
const SEEKER_INTERVAL = 4.5;
const SEEKER_SPEED = 400;
/** How hard the missile can bend toward its target, in radians per second. */
const SEEKER_TURN = 3.4;
const SEEKER_DAMAGE = 3;
const SEEKER_LIFE = 4.2;
const XP_WAVE_CLEAR = 40;

/** XP a kill is worth, per point of the enemy's score value. */
const XP_PER_SCORE = 0.11;
const UPGRADE_CHOICES = 3;
const SHIELD_CAP = 6;
/**
 * Ceilings for the tracks that had none.
 *
 * Bomb yield and pulse reach grew without limit, so they were offered forever
 * and "MAX" was a state the player could never see or plan around. Every track
 * ends somewhere now, and a finished one says so on its card.
 */
const BOMB_POWER_CAP = 2.32;
const PULSE_POWER_CAP = 2.26;
/** Banked when a rank arrives with every track already full. */
const ALL_MAXED_SCORE = 250;

/**
 * Health scaling, because a flat number cannot work across this ladder.
 *
 * Measured across the weapon ladder, sustained player damage spans about 11x:
 *
 *   BB SHOT, no barrels        7.1 dps
 *   QUAD BEAM, no barrels     33.3 dps
 *   CLARITY LANCE, 3 barrels  80.8 dps
 *
 * Gary Fog's 120 effective health is 17 seconds of the first and 1.5 seconds
 * of the last. No single number is a fight for both, which is why bosses were
 * "dying in 3 seconds" for anyone who arrived geared and would be impossible
 * if simply raised. Health scales with what the player actually brings, so a
 * fight takes roughly the same TIME whatever is pointed at it.
 *
 * BASE is BB SHOT with no barrels -- the loadout every other number was tuned
 * against, so scale 1 leaves the early game exactly as it was.
 */
/**
 * Two scales, and the difference between them is the whole point.
 *
 * `loadoutScale()` is sampled ONCE, when a boss spawns, so a boss fight lasts
 * about the same time whatever gun turned up. It is a snapshot.
 *
 * `pressureScale()` is continuous, and it is what everything on screen reads.
 *
 * They used to be one function. `firepowerScale()` was a LIVE read of the
 * current gun -- volley length * damage / fireRate over a BB SHOT baseline --
 * and drone health, hazard health, enemy speed and the arena cap all called it
 * every frame. So catching an UPGRADE CRATE mid-wave turned every 1hp
 * regulator already on screen into a 3hp regulator, instantly, before a shot
 * was fired with the new gun. That is the exact thing the owner ruled out:
 * "player upgrade = small difficulty adjustment after time/waves, NOT
 * immediate weapon pickup. A player upgrade must feel like a reward."
 *
 * So the continuous half is now the run itself. `wave` is already that signal
 * -- the mission act index in the campaign, score/500 in the arcade -- and
 * `clock` is the run timer. Neither can be moved by a pickup.
 *
 * The boss snapshot stays, and that is deliberate rather than an oversight.
 * Measured against the shipped ladder, a decoupled boss health cannot hold a
 * fight length: the ladder spans 11.3x in dps (BB SHOT 7.1 to CLARITY LANCE
 * with three barrels 80.8), so any single curve either gives a maxed gun a
 * 3-second story boss or a starter gun a 100-second slog. A snapshot at spawn
 * is not the reported bug -- it cannot be moved by a pickup once the fight has
 * started -- and compressing that spread is PR4's job, not this one.
 */
const BASE_PLAYER_DPS = 1 / 0.14;
const FIREPOWER_CAP = 9;
/**
 * The continuous curve.
 *
 * Rises with waves and with time on the clock, capped so a long run does not
 * become a wall. Read every frame by everything except the boss snapshot.
 */
const PRESSURE_PER_WAVE = 0.16;
const PRESSURE_PER_MINUTE = 0.07;
const PRESSURE_CAP = 3;
/**
 * Trash does not scale all the way.
 *
 * A drone at full scale would take 27 hits, which is a sponge, not a threat.
 * They get part of the curve and make up the rest in numbers and speed --
 * a maxed gun should still delete a drone; there should just be more of them,
 * arriving faster.
 */
const ENEMY_SCALE_SHARE = 0.45;
const ENEMY_SPEED_PER_SCALE = 7;
/** Free upgrade picks granted for putting a boss down. */
const BOSS_UPGRADE_REWARD = 1;
/** How long the Fog Breaker takes to cut through, on its own. */
const FOG_AUTO_CUT_SECONDS = 2.4;
/** Seconds without a hit before shields start coming back. */
const SHIELD_REGEN_DELAY = 7;
/** Seconds per shield segment once regeneration starts. */
const SHIELD_REGEN_STEP = 4.5;
/** The nudge holds off until the launch settles, then reads for 9 seconds. */
const BOMB_HINT_DELAY = 2.5;
const BOMB_HINT_LIFE = 9;
const SHIELD_PICKUP_EVERY_KILLS = 9;
/** Half speed, so the pre-boss resupply is still on screen when you go for it. */
const BOSS_RESUPPLY_DRIFT = 0.5;

/**
 * Reading a ship against black.
 *
 * Every hull carried an always-on ring at 0.58x its size in the hull's accent
 * colour, and the escort shield was a disc filled at up to half opacity across
 * 0.86x the boss. At the sizes this game actually draws -- enemies land at
 * 19-23px on a phone -- a ring that big and that bright IS the sprite: what
 * you see is a circle, and the ship is whatever is inside it. Playtest, in as
 * many words: the ships look like floating circles.
 *
 * Three rules replace it.
 *
 * Nothing is ever filled over a hull. A shield is an outline, and it moves --
 * a still ring reads as a lid welded to the ship, a ripple reads as a field
 * that is holding. And the only always-on light is a rim: a soft wash that
 * peaks at the silhouette's edge and falls away to nothing both inward and
 * outward, so it lifts the ship off the background without painting over it
 * or drawing a disc around it.
 *
 * The colours are the sides. Green is yours; red is theirs. The player ring
 * used to take the hull accent, which meant it was only green on the default
 * hull and turned into whatever the ship you picked happened to be.
 */
const PLAYER_SHIELD_COLOR = '#00FF00';
const ENEMY_SHIELD_COLOR = '#ff3355';
/** Peak opacity of a rim light. Low enough that the sprite still wins. */
const RIM_GLOW_ALPHA = 0.2;
/** Rim radius as a fraction of the hull's larger side. */
const RIM_GLOW_SCALE = 0.86;
/** Where in that radius the light peaks -- roughly the silhouette's edge. */
const RIM_GLOW_EDGE = 0.6;
/** A shield outline is hairline on purpose: the hull has to stay the subject. */
const SHIELD_RING_WIDTH = 1.5;
/** Ring radius as a fraction of the hull's larger side. */
const SHIELD_RING_SCALE = 0.72;
/** How far the ring breathes, as a fraction of its radius. */
const SHIELD_RIPPLE = 0.07;
/** Radians per second the bright arc travels around the ring. */
const SHIELD_SWEEP_RATE = 2.2;
/** Length of that arc. */
const SHIELD_SWEEP_ARC = Math.PI * 0.55;
/** How far outside the ring the arc rides, as a multiple of the radius. */
const SHIELD_SWEEP_OFFSET = 1.12;

/**
 * The boss attack table.
 *
 * `telegraph` is how long the tell runs before anything is fired. It is the
 * budget the player has to read the move and get somewhere safe, so it is
 * generous on the attacks that punish hardest. `active` is how long a
 * sustained attack keeps firing (0 for one-shot volleys). `recover` is dead
 * time afterwards, during which the boss cannot fire and takes BOSS_EXPOSED
 * damage -- that window is the whole reason to learn the script.
 */
const BOSS_ATTACKS: Record<BossAttackKey, { telegraph: number; active: number; recover: number; label: string }> = {
  aimed_volley: { telegraph: 0.55, active: 0, recover: 0.32, label: 'AIMED' },
  escort_screen: { telegraph: 1.1, active: 0, recover: 0.5, label: 'LAUNCH' },
  fog_wall: { telegraph: 1.0, active: 0, recover: 0.45, label: 'FOG WALL' },
  radial: { telegraph: 0.8, active: 0, recover: 0.4, label: 'BURST' },
  charge: { telegraph: 0.9, active: 0.75, recover: 0.5, label: 'CHARGE' },
  sweep_beam: { telegraph: 0.85, active: 1.5, recover: 0.5, label: 'SWEEP' },
};

/**
 * Damage taken while winding up or attacking, and while open afterwards.
 *
 * These have to be read against the timings above, not chosen on their own.
 * The first pass used 0.45/1.85 with recoveries longer than the wind-ups, so
 * the boss spent more than half of every cycle exposed and the "armour" came
 * out to an average multiplier of about 1.0 -- it died faster than before the
 * script existed. Recovery is roughly a third of a cycle now, which puts the
 * average near 0.7: a real reduction, with a window worth aiming for.
 */
const BOSS_ARMOURED = 0.3;
const BOSS_EXPOSED = 1.6;
/** Shots in a fog wall, and how many adjacent ones are left out as the gap. */
const FOG_WALL_SHOTS = 13;
const FOG_WALL_GAP = 3;
/** Shots in a radial burst, and the arc left open in it. */
const RADIAL_SHOTS = 14;
const RADIAL_GAP = 3;
const BOSS_CHARGE_SPEED = 430;
/** Escorts launched by a screen attack, and how long before they break off. */
/**
 * The escort screen, as a clock rather than a wall.
 *
 * It used to be uncapped and untimed: every `escort_screen` beat pushed four
 * more escorts with no check for the ones already alive, and the shield held
 * until every one of them was dead. In Behemoth phase 2 that beat lands every
 * 3.92s while each escort lives 16s, so four launches overlap into twenty
 * frozen ships and the boss takes no damage at all. That is Ryan's 87-second
 * fight, and it is arithmetic, not tuning.
 *
 * Now: a launch REFILLS to the cap instead of adding to it, the screen has its
 * own life, every kill cuts that life, and a spent screen cannot come back for
 * a while. Worst case with the player killing nothing is SCREEN_SECONDS shielded
 * out of SCREEN_SECONDS + SCREEN_COOLDOWN, so the boss is exposed at least
 * 67% of the fight by construction rather than by hope.
 */
const ESCORT_COUNT = 3;
const ESCORT_PATIENCE = 16;
/** How long a fresh screen holds on its own. */
const SCREEN_SECONDS = 6;
/** Seconds cut from that life per escort destroyed. */
const SCREEN_KILL_CUT = 2;
/** How long after a screen ends before another may launch. */
const SCREEN_COOLDOWN = 12;
/**
 * When the clock runs out with escorts still flying, the shield OVERLOADS: the
 * survivors stop screening and the boss is forced open. Every screen therefore
 * ends in a punish window, so the clock is a promise rather than a timeout.
 */
const SCREEN_OVERLOAD_RECOVER = 2;
/**
 * Pressure kept on during a boss fight.
 *
 * The arena used to empty completely the moment a boss spawned, which left a
 * one-on-one duel where the only thing to do was hold position and fire. A
 * steady trickle of drones means the screen has to be managed as well as the
 * boss read.
 */
const BOSS_PRESSURE_INTERVAL = 3.4;
const BOSS_PRESSURE_CAP = 5;
/** Warship hangar launches: engine phase, then faster once the hangar is up. */
const WARSHIP_LAUNCH_INTERVAL = 4.2;
const WARSHIP_LAUNCH_FAST = 2.6;
const WARSHIP_DEFENDER_CAP = 4;

const DEFAULT_SHIP = SHIPS.player;
const DEFAULT_ENEMY = ENEMIES.regulator_drone;
const DEFAULT_HAZARD = HAZARDS.basic_turret;
const BURST_RING = FX.burst_ring;
const HIT_SPARK = FX.hit_spark;
const CLARITY_PULSE = SPECIALS.clarity_pulse;
const WEAPON_LADDER = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
const STAGE_LADDER = Object.values(STAGES).sort((a, b) => a.minWave - b.minWave);
const BOSS_LADDER = orderedBossKeys(BOSSES);

export class Game2A {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly assets = new AssetLoader();
  private readonly sprites: SpriteRenderer;
  private readonly loop = new Loop((dt) => this.frame(dt));
  private readonly missionDirector = new MissionDirector();
  private readonly earthEncounterDirector = new EarthFlightEncounterDirector();
  private readonly warshipDirector = new RegulatoryWarshipDirector();
  private clock = 0;
  private mode: Mode = 'title';
  private loggedMode: Mode | null = null;
  private escapedThisWave = 0;
  private killedThisWave = 0;
  private paused = false;
  private selectedShipKey = DEFAULT_SHIP.key;
  private player: Actor = this.newPlayer();
  private drones: EnemyActor[] = [];
  private hazards: HazardActor[] = [];
  private hostileShots: HostileProjectile[] = [];
  private boss: BossActor | null = null;
  private warship: WarshipActor | null = null;
  private completedBosses = new Set<string>();
  private bolts: ProjectileActor[] = [];
  private pickups: PickupActor[] = [];
  private rings: Actor[] = [];
  private debris: Particle[] = [];
  private score = 0;
  private wave = 1;
  private boltClock = 0;
  private droneClock = 0;
  private hazardClock = DEFAULT_HAZARD.spawnRate;
  private special = 100;
  private ringClock = 0;
  /** The rung of the weapon ladder this hull launches on. */
  private baseWeaponTier = 1;
  /** Barrels bolted on by pickups. Rides along whichever gun is equipped. */
  private barrels = 0;
  /** Where the fighter's nose points. Straight up outside a duel. */
  private playerFacing = -Math.PI / 2;
  private bossFacing = Math.PI / 2;
  private seekers: SeekerActor[] = [];
  private seekerClock = SEEKER_INTERVAL;
  private bossSpawnClock = BOSS_PRESSURE_INTERVAL;
  /** Seconds of screen left. Zero means the boss is open. */
  private screenClock = 0;
  /** Seconds before another screen may launch. */
  private screenCooldown = 0;
  private warshipLaunchClock = WARSHIP_LAUNCH_INTERVAL;
  /** Cleared once the player has actually double-tapped, so the nudge stops. */
  private bombHintShown = false;
  private bombHintClock = 0;
  private kills = 0;
  private bombs = 2;
  private xp = 0;
  private xpLevel = 1;
  private shield = 0;
  private shieldMax = 0;
  private shieldQuietClock = 0;
  private shieldRegenClock = 0;
  /** Levels earned but not yet spent. The overlay stays up until it hits 0. */
  private pendingUpgrades = 0;
  private upgradeOffer: UpgradeKind[] = [];
  /**
   * Seconds the freshly-opened upgrade overlay refuses taps.
   *
   * A card can open UNDER A FINGER THAT IS ALREADY MOVING. Dropping a bomb is
   * a double-tap: if the first tap's frame collects a pickup that banks a
   * pending level, the overlay pops between the two taps and the second tap --
   * aimed at empty play space, in the middle of the screen, exactly where the
   * cards are drawn -- spends the level on whatever card it landed on. Draw
   * BARREL and the gun changes. That is why "I picked up a bomb and my gun
   * spread out" was a true report about a bomb that never touches the gun.
   *
   * A choice you did not read is not a choice, so the overlay ignores taps
   * until it has been on screen long enough to have been seen.
   */
  private upgradeArmClock = 0;
  private bombPower = 1;
  private pulsePower = 1;
  private bombClock = 0;
  private bossClearClock = 0;
  private victoryPendingClock = 0;
  private pulseHitBoss = false;
  private playerHitClock = 0;
  private missionBannerClock = 0;
  private missionBannerText = '';
  private launchClock = 0;
  private launchTotal = 0;
  private fogGateActive = false;
  /** Counts up while a fog gate or shield cover is being cut automatically. */
  private fogCutClock = 0;
  private shieldCutClock = 0;
  /** Rim-light gradients, keyed by colour and radius. See drawRimGlow. */
  private readonly rimGlows = new Map<string, CanvasGradient>();
  private progress: CampaignProgress = this.loadProgress();
  private activePlanetKey: string | null = null;
  private activePlanetLabel: string | null = null;
  private showAssets = false;
  /**
   * Whether the asset diagnostics are reachable at all.
   *
   * The D button sat in the top-right of the play area, and a tap anywhere
   * near it toggled a developer panel over the game. In portrait that corner
   * is inside the battlefield, so players opened "ASSETS 56/56 loaded •
   * missing 0 • errors 0" by accident and had no idea what it was. It is a
   * debug tool now, on the ?log route with the rest of them.
   *
   * A genuine asset failure still reports itself without any of this.
   */
  private readonly diagnostics = hasDiagnosticsFlag();
  private reportAssets = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    this.ctx = ctx;
    this.sprites = new SpriteRenderer(ctx, this.assets);
    this.input = new Input(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  async start(): Promise<void> {
    await this.assets.loadManifest();
    const counts = this.assets.counts();
    this.reportAssets = counts.missing > 0 || counts.error > 0;
    this.loop.start();
  }

  deployFromMap(planetKey: string, planetLabel: string, checkpoint?: MissionCheckpointSnapshot): void {
    this.input.setActive(true);this.loop.start();
    this.progress = this.loadProgress();
    this.activePlanetKey = planetKey;
    this.activePlanetLabel = planetLabel;
    this.paused = false;

    const mission = missionForPlanet(planetKey);
    if (!mission) {
      this.missionDirector.clear();
      this.earthEncounterDirector.clear();
      this.mode = 'select';
      return;
    }

    const resumable = checkpoint
      && checkpoint.missionKey === mission.key
      && checkpoint.planetKey === planetKey
      && mission.acts.some((act) => act.key === checkpoint.resumeActKey);

    if (resumable) {
      this.missionDirector.startAtAct(mission, checkpoint.resumeActKey);
      if (SHIPS[checkpoint.shipKey]) this.selectedShipKey = checkpoint.shipKey;
      this.activePlanetLabel = `${mission.label} // ${checkpoint.checkpointLabel}`;
      this.reset(checkpoint);
      return;
    }

    this.missionDirector.start(mission);
    this.earthEncounterDirector.clear();
    this.activePlanetLabel = mission.label;
    this.mode = 'select';
  }

  deployTestMode(): void {
    this.input.setActive(true);this.loop.start();
    this.activePlanetKey = null;
    this.activePlanetLabel = null;
    this.missionDirector.clear();
    this.earthEncounterDirector.clear();
    this.launchClock = 0;
    this.fogGateActive = false;
    this.fogCutClock = 0;
    this.shieldCutClock = 0;
    this.warship = null;
    this.cueMusic('silence');
    this.paused = false;
    this.mode = 'title';
  }

  suspend(): void {
    this.paused = true;
    this.input.setActive(false);this.loop.stop();
    this.cueMusic('silence');
  }

  get boardingFighterKey():string{return this.selectedShipKey;}

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private get w(): number { return innerWidth; }
  private get h(): number { return innerHeight; }

  /**
   * The action pad: round arcade buttons stacked into the bottom-right corner,
   * with the two utility buttons up in the top-right.
   *
   * They used to be four rectangles spread across the whole bottom edge, PAUSE
   * on the left and the rest on the right, which ate the full width of the
   * play area. Cornering them keeps the left four-fifths of the screen clear
   * to fly in.
   */
  private get zone() {
    const edge = 14;
    const big = clamp(Math.min(this.w, this.h) * 0.125, 26, 38);
    const mid = big * 0.74;
    const tiny = clamp(big * 0.46, 13, 17);
    const row = this.h - edge - big;
    return {
      special: { cx: this.w - edge - big, cy: row, r: big },
      bomb: { cx: this.w - edge - big * 2 - mid - 10, cy: row + big - mid, r: mid },
      pause: { cx: this.w - edge - tiny, cy: edge + tiny, r: tiny },
      assets: { cx: this.w - edge - tiny * 3 - 10, cy: edge + tiny, r: tiny },
    };
  }

  private frame(dt: number): void {
    this.clock += dt;
    this.actions();
    // Ticked here, after actions() has read it and outside update(), which
    // returns early while the overlay is up -- an arm timer that only runs
    // when the overlay is closed would never expire.
    if (this.upgradeArmClock > 0) this.upgradeArmClock = Math.max(0, this.upgradeArmClock - dt);
    this.update(dt);
    this.render();
  }

  private actions(): void {
    // The keyboard shortcut stays unconditional: it cannot be hit by accident
    // with a thumb, and it is how the panel gets opened during development.
    if (this.input.consumeDiagnostics()) this.showAssets = !this.showAssets;
    if (this.input.consumePause() && this.mode === 'play') this.setPaused(!this.paused);
    if (this.launchClock <= 0 && this.input.consumeSpecial() && this.mode === 'play') this.useSpecial();
    if (this.launchClock <= 0 && this.input.consumeBomb() && this.mode === 'play') this.useBomb();

    // Always drained, so a double-tap made in a menu cannot fire a frame later
    // once play resumes.
    const doubleTap = this.input.consumeDoubleTap();
    if (
      doubleTap
      && this.mode === 'play'
      && !this.paused
      && this.launchClock <= 0
      && this.upgradeOffer.length === 0
      && !this.inControls(doubleTap.x, doubleTap.y)
    ) {
      this.bombHintShown = true;
      this.useBomb();
    }

    const tap = this.input.consumeTap();
    if (!tap) return;
    if (this.mode === 'title') return void (this.mode = 'select');
    if (this.mode === 'select') return this.selectShipAt(tap.x, tap.y);
    if (this.mode === 'results') {
      const save = this.resumeCheckpoint();
      const buttons = this.resultsButtons();
      if (save && inside(buttons.secondary, tap.x, tap.y)) return this.reset(undefined, { fresh: true });
      return this.reset();
    }
    if (this.mode === 'victory') return this.reset();
    if (this.upgradeOffer.length > 0) {
      // Still arming: this tap was in flight before the cards existed.
      if (this.upgradeArmClock > 0) return;
      const picked = this.upgradeCards().find((card) => inside(card.rect, tap.x, tap.y));
      if (picked) this.applyUpgrade(picked.kind);
      return;
    }
    if (this.diagnostics && inCircle(this.zone.assets, tap.x, tap.y)) return void (this.showAssets = !this.showAssets);
    if (inCircle(this.zone.pause, tap.x, tap.y)) return void this.setPaused(!this.paused);
    if (this.launchClock > 0) return;
    if (inCircle(this.zone.bomb, tap.x, tap.y)) return void this.useBomb();
    if (inCircle(this.zone.special, tap.x, tap.y)) this.useSpecial();
  }

  private update(dt: number): void {
    if (this.mode !== 'play' || this.paused) return;
    // A level-up freezes the fight. Picking an upgrade under fire is not a
    // choice, it is a reflex test.
    if (this.upgradeOffer.length > 0) return;

    if (this.launchClock > 0) {
      this.updateLaunchReveal(dt);
      if (this.missionBannerClock > 0) this.missionBannerClock = Math.max(0, this.missionBannerClock - dt);
      return;
    }

    this.movePlayer(dt);
    this.updateFacing(dt);
    this.updateBolts(dt);
    this.updateSeekers(dt);

    if (this.missionDirector.activeMission) {
      this.updateMission(dt);
    } else {
      this.startBossIfReady();
      if (this.boss) {
        this.updateBoss(dt);
        // Escorts were frozen for the whole fight: moveDrones is the only
        // place stance, fire, dodge and patience advance, and it was reached
        // only through updateDrones, which this branch skips. So the screen
        // never flew, never shot, and never broke off -- and ESCORT_PATIENCE,
        // the thing the code claimed made a deadlock impossible, was never
        // decremented at all. This is the missing call.
        this.moveDrones(dt);
      } else if (this.victoryPendingClock <= 0) {
        this.updateDrones(dt);
        this.updateHazards(dt);
      }
    }

    this.updateHostileShots(dt);
    this.updatePickups(dt);
    this.collisions();
    this.updateRings(dt);
    if (this.bombClock > 0) this.bombClock = Math.max(0, this.bombClock - dt);
    if (this.bossClearClock > 0) this.bossClearClock = Math.max(0, this.bossClearClock - dt);
    if (this.missionBannerClock > 0) this.missionBannerClock = Math.max(0, this.missionBannerClock - dt);
    // The double-tap nudge only runs while it is still true and still useful:
    // in flight, with a bomb in the rack, and only until the player uses one.
    if (!this.bombHintShown && this.bombs > 0 && this.launchClock <= 0) {
      this.bombHintClock += dt;
    }
    if (this.victoryPendingClock > 0) {
      this.victoryPendingClock = Math.max(0, this.victoryPendingClock - dt);
      if (this.victoryPendingClock === 0) this.finishRun(true);
    }
    if (this.playerHitClock > 0) this.playerHitClock = Math.max(0, this.playerHitClock - dt);
    this.updateDebris(dt);
    this.updateShield(dt);
    this.special = Math.min(100, this.special + dt * 7 * this.pulsePower);
    if ((this.player.hp ?? 0) <= 0 && this.mode === 'play') this.finishRun(false);
  }

  private updateLaunchReveal(dt: number): void {
    this.launchClock = Math.max(0, this.launchClock - dt);
    const elapsed = this.launchTotal - this.launchClock;
    const entranceStart = EARTH_LAUNCH_REVEAL.musicLead + EARTH_LAUNCH_REVEAL.entranceDelay;
    const entranceEnd = entranceStart + EARTH_LAUNCH_REVEAL.entranceDuration;
    const targetY = this.h - 112;
    const startY = this.h + 76;

    if (elapsed < entranceStart) {
      this.player.y = startY;
    } else if (elapsed < entranceEnd) {
      const t = clamp((elapsed - entranceStart) / EARTH_LAUNCH_REVEAL.entranceDuration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.player.y = startY + (targetY - startY) * eased;
    } else {
      this.player.y = targetY;
    }

    if (this.launchClock === 0) {
      this.player.y = targetY;
      this.earthEncounterDirector.start(this.missionDirector.currentAct?.key ?? '');
      this.missionBannerText = 'DEFEND EARTH // FIRST CONTACT INBOUND';
      this.missionBannerClock = 2.8;
    }
  }

  private updateMission(dt: number): void {
    const act = this.missionDirector.currentAct;
    if (!act) return;

    // Three guardian acts now, not one. This used to compare against
    // GARY_FOG_GUARDIAN_PLAN.actKey directly, which is fine with a single boss
    // and silently fatal with three: an act that no branch recognises spawns
    // nothing, and a boss act that spawns nothing never completes, so the level
    // stops dead on it with an empty sky.
    const guardian = guardianPlanFor(act.key);
    if (guardian) {
      if (!this.boss) this.startGuardian(guardian);
      this.updateBoss(dt);
      this.moveDrones(dt);
      return;
    }

    if (act.key === 'final_assault' && this.fogGateActive) {
      // The Fog Breaker fires itself.
      //
      // This used to wait for the player to press the special. Playtesters did
      // not connect the stalled route to that button and flew around in an
      // empty sky for minutes waiting for something to happen -- the fog gate
      // was a puzzle nobody knew they were being asked. It is a beat now: the
      // route opens on its own, with the banner still there to say what did it.
      this.hostileShots = [];
      this.fogCutClock += dt;
      if (this.fogCutClock >= FOG_AUTO_CUT_SECONDS) this.cutFogGate();
      return;
    }

    if (act.mode === 'flight' && earthFlightEncounterFor(act.key)) {
      this.updateAuthoredFlight(dt);
      return;
    }

    if (act.key === 'regulatory_warship') {
      if (!this.warship) this.startRegulatoryWarship();
      this.updateRegulatoryWarship(dt);
      return;
    }

    if (this.boss) this.updateBoss(dt);
  }

  private startGuardian(plan: GuardianEncounterPlan): void {
    this.screenClock = 0;
    this.screenCooldown = 0;
    const def = this.bossDef(plan.bossKey);
    this.drones = [];
    this.hazards = [];
    this.hostileShots = [];
    this.bolts = [];
    this.dropBossResupply();
    this.cueMusic(plan.musicCueKey);
    this.missionBannerText = plan.approachBanner;
    this.missionBannerClock = 2.8;
    this.boss = {
      x: this.w / 2,
      y: -def.draw.h,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: 0,
      hp: Math.round(def.hp * this.loadoutScale()),
      maxHp: Math.round(def.hp * this.loadoutScale()),
      bossKey: def.key,
      state: 'intro',
      age: -plan.musicLeadSeconds,
      fireClock: def.phases[0].fireRate,
      contactClock: 0,
      phaseIndex: 0,
      targetX: this.w / 2,
      attackIndex: 0,
      attackState: 'telegraph',
      attackClock: BOSS_ATTACKS.aimed_volley.telegraph,
      attackAim: this.w / 2,
    };
  }

  private startRegulatoryWarship(): void {
    this.drones = [];
    this.hazards = [];
    this.hostileShots = [];
    this.bolts = [];
    this.dropBossResupply();
    this.warshipDirector.reset();
    this.cueMusic('boss_regulatory_warship');
    this.missionBannerText = 'CAPITAL SHIP // REGULATORY WARSHIP';
    this.missionBannerClock = 2.8;
    this.warship = {
      x: this.w / 2,
      y: -REGULATORY_WARSHIP.draw.h,
      w: REGULATORY_WARSHIP.draw.w,
      h: REGULATORY_WARSHIP.draw.h,
      vx: 0,
      vy: 0,
      state: 'intro',
      age: 0,
      fireClock: 1,
    };
  }

  private updateRegulatoryWarship(dt: number): void {
    const warship = this.warship;
    if (!warship) return;
    warship.age += dt;

    if (warship.state === 'disabled') return;
    if (warship.state === 'intro') {
      const targetY = this.bossRestY();
      warship.y += (targetY - warship.y) * Math.min(1, dt * 1.35);
      if (warship.age >= 3.2) {
        warship.state = 'fight';
        warship.y = targetY;
        warship.age = 0;
        this.missionBannerText = this.warshipDirector.objective;
        this.missionBannerClock = 2.8;
      }
      return;
    }

    warship.x = this.w / 2 + Math.sin(warship.age * 0.45) * Math.min(42, this.w * 0.08);
    if (this.warshipDirector.shieldCovered) {
      this.shieldCutClock += dt;
      if (this.shieldCutClock >= FOG_AUTO_CUT_SECONDS && this.warshipDirector.exposeShieldRelay()) {
        this.missionBannerText = 'FOG BREAKER // SHIELD RELAY EXPOSED';
        this.missionBannerClock = 2.8;
        sfx.play('pulse');
      }
    } else {
      this.shieldCutClock = 0;
    }
    this.warshipDefenders(dt);
    warship.fireClock -= dt;
    if (warship.fireClock <= 0) {
      this.fireWarshipVolley();
      const phase = this.warshipDirector.phase;
      warship.fireClock = phase === 'batteries' ? 0.95 : phase === 'shield' ? 0.78 : phase === 'engines' ? 0.62 : 0.48;
    }
  }

  /**
   * Fighters scrambled off the capital ship in the back half of the fight.
   *
   * It is a warship with a hangar on it, and it used to sit there alone while
   * its own systems were dismantled one at a time. Once the batteries and the
   * shield relay are gone it starts putting fighters up -- more of them, and
   * faster, once the engines go and the hangar itself is the target.
   */
  private warshipDefenders(dt: number): void {
    const phase = this.warshipDirector.phase;
    if (phase !== 'engines' && phase !== 'hangar') return;

    this.warshipLaunchClock -= dt;
    if (this.warshipLaunchClock > 0) return;
    this.warshipLaunchClock = phase === 'hangar' ? WARSHIP_LAUNCH_FAST : WARSHIP_LAUNCH_INTERVAL;

    const cap = phase === 'hangar' ? WARSHIP_DEFENDER_CAP + 2 : WARSHIP_DEFENDER_CAP;
    if (this.drones.length >= cap) return;

    const warship = this.warship;
    if (!warship) return;
    const count = phase === 'hangar' ? 2 : 1;
    const key = availableEnemyKeys(ENEMIES, Math.max(4, this.wave)).slice(-1)[0] ?? 'regulator_drone';
    const def = this.enemyDef(key);
    for (let i = 0; i < count; i += 1) {
      const x = clamp(warship.x + (i === 0 ? -1 : 1) * (26 + Math.random() * 40), 26, this.w - 26);
      this.drones.push({
        x,
        y: warship.y + warship.h * 0.3,
        w: def.hitbox.w,
        h: def.hitbox.h,
        vx: 0,
        vy: def.baseSpeed,
        hp: this.enemyHp(def),
        enemyKey: key,
        age: 0,
        anchorX: x,
        phase: Math.random() * Math.PI * 2,
        direction: i === 0 ? -1 : 1,
        fireClock: (def.fireRate ?? 1) * (0.4 + Math.random() * 0.6),
        stance: 'entering',
        stationX: x,
        stationY: this.pickStationY(),
        stanceClock: 0,
        patience: ENEMY_PATIENCE_MIN + Math.random() * ENEMY_PATIENCE_VARY,
        dodgeCooldown: 0,
        atRest: false,
        // Not escorts: the warship has no shield to hang on them, and the
        // fight already has its own gate in the Fog Breaker relay.
        escort: false,
      });
    }
    if (this.missionBannerClock <= 0) {
      this.missionBannerText = 'HANGAR LAUNCH // FIGHTERS INBOUND';
      this.missionBannerClock = 1.8;
    }
  }

  private fireWarshipVolley(): void {
    const warship = this.warship;
    if (!warship || warship.state !== 'fight') return;
    const phase = this.warshipDirector.phase;
    const count = phase === 'batteries' ? 2 : phase === 'shield' ? 3 : phase === 'engines' ? 5 : 7;
    const speed = phase === 'batteries' ? 215 : phase === 'shield' ? 230 : phase === 'engines' ? 250 : 270;
    const spread = phase === 'batteries' ? 0.22 : phase === 'shield' ? 0.2 : phase === 'engines' ? 0.17 : 0.14;
    const aimed = Math.atan2(this.player.y - warship.y, this.player.x - warship.x);
    const middle = (count - 1) / 2;
    for (let index = 0; index < count; index += 1) {
      const angle = aimed + (index - middle) * spread;
      this.hostileShots.push({
        x: warship.x,
        y: warship.y + 36,
        w: 10,
        h: 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: 1,
        color: phase === 'hangar' ? '#ff3355' : '#ff8a3d',
        projectileKey: phase === 'engines' || phase === 'hangar' ? 'enemy_missile' : 'enemy_red_bullet',
      });
    }
  }

  private updateAuthoredFlight(dt: number): void {
    const activeThreats = this.drones.length + this.hazards.length;
    const state = this.earthEncounterDirector.update(dt, activeThreats);
    for (const spawn of state.spawns) {
      if (spawn.kind === 'enemy') this.spawnMissionDrone(spawn.enemyKey, spawn.x);
      else this.spawnMissionHazard(spawn.hazardKey, spawn.x, spawn.side);
    }
    this.moveDrones(dt);
    this.moveHazards(dt);

    if (state.completed && this.drones.length === 0 && this.hazards.length === 0) this.completeMissionFlightAct();
  }

  private spawnMissionDrone(enemyKey: string, xRatio: number): void {
    const def = this.enemyDef(enemyKey);
    const x = clamp(xRatio * this.w, 30, this.w - 30);
    const pressure = Math.max(0, this.missionDirector.currentActIndex - 1) * 5;
    this.drones.push({
      x,
      y: -35,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: def.baseSpeed + pressure,
      hp: this.enemyHp(def),
      enemyKey: def.key,
      age: 0,
      anchorX: x,
      phase: xRatio * Math.PI * 2,
      direction: xRatio < 0.5 ? 1 : -1,
      fireClock: (def.fireRate ?? 0) * (0.5 + Math.random()),
      stance: 'entering',
      stationX: x,
      stationY: this.pickStationY(),
      stanceClock: 0,
      patience: ENEMY_PATIENCE_MIN + Math.random() * ENEMY_PATIENCE_VARY,
      dodgeCooldown: 0,
      atRest: false,
      escort: false,
    });
  }

  private spawnMissionHazard(hazardKey: string, xRatio: number, requestedSide?: -1 | 1): void {
    const def = this.hazardDef(hazardKey);
    const side: -1 | 1 = requestedSide ?? (xRatio < 0.5 ? -1 : 1);
    const x = clamp(xRatio * this.w, 28, this.w - 28);
    this.hazards.push({
      x,
      y: -def.draw.h,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: this.currentStage().scrollSpeed,
      hp: this.hazardHp(def),
      hazardKey: def.key,
      fireClock: def.fires ? 0.95 : 0,
      side,
    });
  }

  /**
   * Banks the checkpoint that resumes into whichever act is current.
   *
   * Shared by the two paths that finish an act, rather than written twice:
   * a flight act records the act it is about to enter, and a guardian act
   * records the one it has just entered. Both mean "if you die now, come back
   * here", and duplicating that would be one snapshot field away from a resume
   * that silently loses a rank or a barrel.
   *
   * Returns the checkpoint banked, or null when the act has none -- the
   * opening cinematic and the closing beat deliberately do not.
   */
  private recordCheckpointForCurrentAct(): MissionCheckpointDef | null {
    const mission = this.missionDirector.activeMission;
    const act = this.missionDirector.currentAct;
    if (!mission || !act || !this.activePlanetKey) return null;
    const checkpoint = mission.checkpoints.find((item) => item.resumeActKey === act.key);
    if (!checkpoint) return null;
    this.progress = recordMissionCheckpoint(this.progress, {
      planetKey: this.activePlanetKey,
      missionKey: mission.key,
      checkpointKey: checkpoint.key,
      checkpointLabel: checkpoint.label,
      resumeActKey: checkpoint.resumeActKey,
      shipKey: this.selectedShipKey,
      weaponTier: this.weaponTier(),
      bombs: this.bombs,
      score: this.score,
      savedAt: Date.now(),
      ...this.upgradeSnapshot(),
    });
    this.saveProgress();
    return checkpoint;
  }

  private completeMissionFlightAct(): void {
    const mission = this.missionDirector.activeMission;
    const act = this.missionDirector.currentAct;
    if (!mission || !act) return;

    const nextAct = mission.acts[this.missionDirector.currentActIndex + 1];
    const checkpoint = nextAct
      ? mission.checkpoints.find((item) => item.resumeActKey === nextAct.key)
      : undefined;

    if (checkpoint && this.activePlanetKey) {
      this.progress = recordMissionCheckpoint(this.progress, {
        planetKey: this.activePlanetKey,
        missionKey: mission.key,
        checkpointKey: checkpoint.key,
        checkpointLabel: checkpoint.label,
        resumeActKey: checkpoint.resumeActKey,
        shipKey: this.selectedShipKey,
        weaponTier: this.weaponTier(),
        bombs: this.bombs,
        score: this.score,
        savedAt: Date.now(),
        ...this.upgradeSnapshot(),
      });
      this.saveProgress();
    }

    this.drones = [];
    this.hazards = [];
    this.hostileShots = [];
    const entered = this.missionDirector.advance();
    this.wave = Math.max(1, this.missionDirector.currentActIndex + 1);
    this.earthEncounterDirector.start(entered?.key ?? '');

    if (entered?.key === 'regulatory_warship') {
      this.missionBannerText = 'CAPITAL SHIP SIGNAL // REGULATORY WARSHIP';
    } else if (checkpoint && entered?.mode === 'boss') {
      this.missionBannerText = `CHECKPOINT SECURED // ${checkpoint.label} // GUARDIAN SIGNAL`;
    } else if (checkpoint) {
      this.missionBannerText = `CHECKPOINT SECURED // ${checkpoint.label}`;
    } else {
      this.missionBannerText = entered?.label ?? 'SECTOR CLEAR';
    }
    this.missionBannerClock = 2.8;
  }

  private movePlayer(dt: number): void {
    const pointer = this.input.pointer;
    const origin = this.input.pointerOrigin;
    const axis = this.input.axis();
    // Ask where the gesture STARTED, not where the finger is now. Testing the
    // live position turned every button into a wall the fighter could not be
    // dragged across -- you cannot lift a thumb over an obstacle mid-drag.
    // ...unless the finger has actually travelled, in which case it is a drag
    // and steers whatever it started on. The bottom-right pad is where a thumb
    // rests on a phone; without this, planting it there and pulling down moved
    // the fighter not at all.
    const usingPointer = Boolean(
      pointer && origin && (!this.inControls(origin.x, origin.y) || this.input.dragged),
    );
    if (usingPointer && pointer) {
      this.player.x += (pointer.x - this.player.x) * Math.min(1, dt * 14);
      this.player.y += (pointer.y - this.player.y) * Math.min(1, dt * 14);
    } else {
      const ship = this.playerDef();
      this.player.x += axis.x * ship.speed * dt;
      this.player.y += axis.y * ship.speed * dt;
    }
    const lane = this.playerLane();
    this.player.x = clamp(this.player.x, 28, this.w - 28);
    this.player.y = clamp(this.player.y, lane.top, lane.bottom);

    // Records what is actually steering the ship each second. If the fighter
    // drifts on its own, this shows whether the input is non-zero while the
    // player is not touching the screen, and by how much.
    debugLog.sample('move', 1000, 'input', 'player move', {
      source: usingPointer ? 'pointer' : 'axis',
      ax: Math.round(axis.x * 100) / 100,
      ay: Math.round(axis.y * 100) / 100,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
    });
  }

  /**
   * Vertical band the fighter may occupy.
   *
   * Portrait used to reserve the top 34%. On a 393x793 phone that is a hard,
   * invisible wall at y=270: drag a thumb to the top of the screen and the ship
   * stops dead underneath it with no feedback of any kind, which is what
   * "I can't move my ship up" turned out to mean. Landscape had long since been
   * cut to 12% for its own reasons, so the same game rotated obeyed a different
   * rule -- and 34% put more than half the enemy station band (14% to 52%) in a
   * place the player could never fly.
   *
   * Both orientations now use the same shallow margin, which reaches the top of
   * the formation. The bottom keeps clearance for nothing: the fighter must be
   * able to sit at the very bottom edge.
   */
  private playerLane(): { top: number; bottom: number } {
    // A duel opens the arena further still: you have to be able to get above a
    // boss to flank it.
    const top = this.h * (this.duelling() ? DUEL_LANE_TOP : FLIGHT_LANE_TOP);
    // The fighter must be able to sit at the very bottom edge. Reserving room
    // for the on-canvas controls left it stranded a ship-height up.
    const bottom = this.h - 22;
    return { top, bottom: Math.max(top + 40, bottom) };
  }

  /** True while a boss is actually fighting, which is when lock-step applies. */
  private duelling(): boolean {
    return this.boss?.state === 'fight';
  }

  /**
   * Swing both noses onto each other.
   *
   * The player's turn is fast enough to feel locked on without snapping; the
   * boss turns more slowly, so a fast fighter can get around behind it. Outside
   * a duel the fighter returns to pointing up, which is what every other part
   * of the game assumes.
   */
  private updateFacing(dt: number): void {
    const boss = this.boss;
    const target = boss && boss.state === 'fight'
      ? Math.atan2(boss.y - this.player.y, boss.x - this.player.x)
      : -Math.PI / 2;
    this.playerFacing = turnToward(this.playerFacing, target, DUEL_TURN * dt);
    if (boss) {
      const atPlayer = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      this.bossFacing = turnToward(this.bossFacing, atPlayer, BOSS_TURN * dt);
    }
  }

  /** Everything the seeker will chase, nearest first. */
  private seekerTargets(): Array<{ x: number; y: number }> {
    const targets: Array<{ x: number; y: number }> = [];
    for (const drone of this.drones) if ((drone.hp ?? 0) > 0) targets.push(drone);
    for (const hazard of this.hazards) if ((hazard.hp ?? 0) > 0) targets.push(hazard);
    if (this.boss?.state === 'fight') targets.push(this.boss);
    if (this.warship?.state === 'fight') {
      for (const system of this.warshipDirector.targetableSystems) targets.push(this.warshipSystemCenter(system));
    }
    return targets;
  }

  /**
   * Seeker missiles: launched on their own timer once the ladder is deep
   * enough, and steered rather than aimed. They turn at a fixed rate toward
   * the nearest target, so they curve into things instead of snapping onto
   * them -- a missile that cannot miss is not interesting to watch.
   */
  private updateSeekers(dt: number): void {
    if (this.xpLevel >= SEEKER_UNLOCK_LEVEL) {
      this.seekerClock -= dt;
      if (this.seekerClock <= 0 && this.seekerTargets().length > 0) {
        this.seekerClock = SEEKER_INTERVAL;
        this.seekers.push({
          x: this.player.x + Math.cos(this.playerFacing) * 18,
          y: this.player.y + Math.sin(this.playerFacing) * 18,
          w: 10,
          h: 22,
          vx: Math.cos(this.playerFacing) * SEEKER_SPEED,
          vy: Math.sin(this.playerFacing) * SEEKER_SPEED,
          damage: SEEKER_DAMAGE,
          angle: this.playerFacing,
          age: 0,
        });
        sfx.play('shoot');
      }
    }

    const targets = this.seekerTargets();
    for (const seeker of this.seekers) {
      seeker.age += dt;
      let best: { x: number; y: number } | null = null;
      let bestDistance = Infinity;
      for (const target of targets) {
        const distance = Math.hypot(target.x - seeker.x, target.y - seeker.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = target;
        }
      }
      if (best) {
        const desired = Math.atan2(best.y - seeker.y, best.x - seeker.x);
        // Shortest way round, so a target behind the missile is not chased
        // the long way about.
        let delta = desired - seeker.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        seeker.angle += clamp(delta, -SEEKER_TURN * dt, SEEKER_TURN * dt);
      }
      seeker.vx = Math.cos(seeker.angle) * SEEKER_SPEED;
      seeker.vy = Math.sin(seeker.angle) * SEEKER_SPEED;
      seeker.x += seeker.vx * dt;
      seeker.y += seeker.vy * dt;
    }
    this.seekers = this.seekers.filter((seeker) => (
      seeker.age < SEEKER_LIFE && seeker.y > -60 && seeker.y < this.h + 60 && seeker.x > -60 && seeker.x < this.w + 60
    ));
  }

  private updateBolts(dt: number): void {
    this.boltClock -= dt;
    if (this.boltClock <= 0) {
      const weapon = this.currentWeapon();
      const projectile = this.projectileDef(weapon.projectileKey);
      const ship = this.playerDef();
      this.boltClock = weapon.fireRate * (ship.fireRate / DEFAULT_SHIP.fireRate);
      // The volley is authored nose-up. Rotating it by the fighter's heading is
      // what lets you flank a boss and still be shooting AT it: the barrels and
      // their spread swing round together rather than the shots being re-aimed
      // one by one from a fixed muzzle.
      const heading = this.playerFacing + Math.PI / 2;
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      for (const shot of this.currentVolley()) {
        const muzzleX = shot.offsetX;
        const muzzleY = -24;
        this.bolts.push({
          x: this.player.x + muzzleX * cos - muzzleY * sin,
          y: this.player.y + muzzleX * sin + muzzleY * cos,
          w: projectile.hitbox.w,
          h: projectile.hitbox.h,
          vx: Math.sin(shot.angle + heading) * projectile.speed,
          vy: -Math.cos(shot.angle + heading) * projectile.speed,
          damage: weapon.damage,
          projectileKey: weapon.projectileKey,
          pierce: weapon.pierce ?? 0,
        });
      }
      sfx.play('shoot');
    }
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
    }
    // Bolts used to be culled only off the top, which is all a nose-up gun could
    // reach. A rotated volley can leave by any edge.
    this.bolts = this.bolts.filter((bolt) => (
      bolt.y > -40 && bolt.y < this.h + 40 && bolt.x > -40 && bolt.x < this.w + 40
    ));
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) pickup.y += pickup.vy * dt;
    this.pickups = this.pickups.filter((pickup) => pickup.y < this.h + 40);
  }

  private updateDrones(dt: number): void {
    this.droneClock -= dt;
    if (this.droneClock <= 0 && this.drones.length < this.arenaEnemyCap()) {
      const enemyKey = selectEnemyKey(ENEMIES, this.wave, Math.random());
      const def = this.enemyDef(enemyKey);
      const x = 30 + Math.random() * Math.max(1, this.w - 60);
      this.droneClock = Math.min(def.spawnRate, spawnInterval(this.wave));
      this.drones.push({
        x,
        y: -35,
        w: def.hitbox.w,
        h: def.hitbox.h,
        vx: 0,
        vy: this.enemySpeed(def),
        hp: this.enemyHp(def),
        enemyKey,
        age: 0,
        anchorX: x,
        phase: Math.random() * Math.PI * 2,
        direction: Math.random() < 0.5 ? -1 : 1,
        fireClock: (def.fireRate ?? 0) * (0.5 + Math.random()),
        stance: 'entering',
        stationX: x,
        stationY: this.pickStationY(),
        stanceClock: 0,
        patience: ENEMY_PATIENCE_MIN + Math.random() * ENEMY_PATIENCE_VARY,
        dodgeCooldown: 0,
        atRest: false,
        escort: false,
      });
    }
    this.moveDrones(dt);
    this.wave = 1 + Math.floor(this.score / 500);
  }

  private moveDrones(dt: number): void {
    for (const drone of this.drones) {
      const def = this.enemyDef(drone.enemyKey);
      drone.age += dt;
      drone.stanceClock -= dt;
      drone.dodgeCooldown = Math.max(0, drone.dodgeCooldown - dt);
      const speed = this.enemySpeed(def);

      if (drone.stance === 'entering') {
        drone.y += speed * dt;
        drone.x += (drone.stationX - drone.x) * Math.min(1, dt * 1.6);
        if (drone.y >= drone.stationY) {
          drone.y = drone.stationY;
          drone.stance = 'holding';
          drone.stanceClock = 0.8 + Math.random() * 1.6;
        }
      } else if (drone.stance === 'holding') {
        this.holdStation(drone, def, speed, dt);
        if (drone.stanceClock <= 0) {
          drone.stanceClock = 1.2 + Math.random() * 2.2;
          // A dive is a committed attack run that returns to station, not a
          // one-way trip through the play area.
          if (Math.random() < ENEMY_TACTICS[def.behavior].dive) {
            drone.stance = 'diving';
            drone.stanceClock = 1.5 + Math.random() * 0.9;
          }
        }
      } else if (drone.stance === 'diving') {
        const toPlayer = clamp(this.player.x - drone.x, -1, 1);
        drone.x += toPlayer * speed * 1.15 * dt;
        drone.y += speed * 0.95 * dt;
        const lane = this.playerLane();
        if (drone.stanceClock <= 0 || drone.y > lane.bottom - 12) {
          drone.stance = 'holding';
          drone.stanceClock = 1.4 + Math.random() * 1.8;
          drone.stationX = this.pickStationX();
        }
      } else {
        // Fleeing: break for the nearest horizontal edge and climb out.
        drone.x += drone.direction * speed * 1.5 * dt;
        drone.y -= speed * 0.65 * dt;
      }

      if (drone.stance === 'holding' || drone.stance === 'diving') {
        this.enemyFire(drone, def, dt);
      }

      if (drone.stance !== 'fleeing') {
        this.dodgeIncomingFire(drone, speed, dt);
        // Patience runs down only while actually fighting.
        drone.patience -= dt;
        if (drone.patience <= 0) {
          drone.stance = 'fleeing';
          drone.direction = drone.x < this.w / 2 ? -1 : 1;
        }
        drone.x = clamp(drone.x, 24, this.w - 24);
        drone.y = clamp(drone.y, 18, this.playerLane().bottom - 8);
      }
    }

    const before = this.drones.length;
    this.drones = this.drones.filter((drone) => {
      const gone = drone.y < -70 || drone.x < -70 || drone.x > this.w + 70;
      if (!gone) return true;
      // An enemy that gets away costs points, never health. Letting one slip
      // past should sting, not end the run.
      this.score = Math.max(0, this.score - ENEMY_ESCAPE_PENALTY);
      this.escapedThisWave += 1;
      debugLog.log('combat', 'enemy escaped', {
        enemy: drone.enemyKey, penalty: ENEMY_ESCAPE_PENALTY, score: this.score,
      });
      return false;
    });

    // Clearing a group by force is worth more than outlasting it.
    if (before > 0 && this.drones.length === 0 && this.killedThisWave > 0 && this.escapedThisWave === 0) {
      this.score += WAVE_CLEAR_BONUS;
      this.awardXp(XP_WAVE_CLEAR);
      this.missionBannerText = `FORMATION CLEARED  +${WAVE_CLEAR_BONUS}`;
      this.missionBannerClock = 1.8;
      debugLog.log('combat', 'formation cleared', { kills: this.killedThisWave, bonus: WAVE_CLEAR_BONUS });
    }
    if (this.drones.length === 0) {
      this.killedThisWave = 0;
      this.escapedThisWave = 0;
    }
  }

  /** An armed enemy shoots at the player while it is holding or diving. */
  private enemyFire(drone: EnemyActor, def: EnemyDef, dt: number): void {
    if (!def.fireRate || !def.projectileSpeed) return;
    drone.fireClock -= dt;
    if (drone.fireClock > 0) return;
    const tactics = ENEMY_TACTICS[def.behavior];
    // A rhythm shooter holds fire until it stops moving. Missing that beat
    // costs it the shot rather than delaying it, so the tempo stays readable.
    if (tactics.firesAtRest && drone.stance === 'holding' && !drone.atRest) {
      drone.fireClock = 0.12;
      return;
    }
    const doctrine = ENEMY_DOCTRINES[def.doctrine ?? 'pressure'];
    drone.fireClock = def.fireRate * doctrine.interval + Math.random() * ENEMY_FIRE_JITTER;

    const dx = this.player.x - drone.x;
    const dy = this.player.y - drone.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    // Only shoot when the player is roughly below: no blind shots upward.
    if (dy / length < ENEMY_FIRE_ARC) return;

    const aim = Math.atan2(dy, dx);
    const speed = def.projectileSpeed * doctrine.speed;
    // The doctrine's own fan, widened by the movement tactic's spread only
    // where the tactic already had one. A dive-bomber's shots stay looser than
    // a station-keeper's, which is the read the movement was already teaching.
    const spread = doctrine.spread + tactics.spread * 0.5;
    const middle = (doctrine.shots - 1) / 2;
    for (let i = 0; i < doctrine.shots; i += 1) {
      const angle = aim + (i - middle) * spread;
      this.hostileShots.push({
        x: drone.x,
        y: drone.y + drone.h * 0.4,
        w: doctrine.size,
        h: doctrine.size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: 1,
        color: def.accent,
        projectileKey: doctrine.projectileKey,
        size: doctrine.size,
        homing: doctrine.homing,
        track: doctrine.homing ? SALVO_TRACK_SECONDS : undefined,
      });
    }
    sfx.play('enemyShoot');
    debugLog.sample('efire', 3000, 'combat', 'enemy fired', { enemy: drone.enemyKey });
  }

  /** How many enemies may share the arena at once, by wave. */
  private arenaEnemyCap(): number {
    // Numbers are the other half of the pressure curve: a run that has been
    // going a while should have more screen to clear, whatever gun turned up.
    const forPressure = Math.floor(this.pressureScale() / 2);
    return Math.min(ARENA_MAX_ENEMIES_CAP + 3, ARENA_MAX_ENEMIES_BASE + Math.floor(this.wave / 2) + forPressure);
  }

  /** Station-keeping drift so a held position still reads as flying, not parking. */
  private holdStation(drone: EnemyActor, def: EnemyDef, speed: number, dt: number): void {
    const tactics = ENEMY_TACTICS[def.behavior];
    const beat = drone.age * tactics.swaySpeed + drone.phase;

    let targetX: number;
    if (def.behavior === 'zigzag') {
      // Dash, stop, dash. A triangle wave sharpened toward its ends, so the
      // ship snaps across and then sits still for the moment you can hit it.
      const wave = Math.asin(Math.sin(beat)) / (Math.PI / 2);
      targetX = drone.stationX + Math.sign(wave) * Math.pow(Math.abs(wave), 0.42) * tactics.sway;
    } else if (def.behavior === 'dive') {
      // A hunter lines up over the player instead of over its own station.
      targetX = clamp(this.player.x, 30, this.w - 30);
    } else {
      targetX = drone.stationX + Math.sin(beat) * tactics.sway;
    }

    const targetY = drone.stationY + Math.cos(drone.age * 1.1 + drone.phase) * 16;
    // The weaver needs to actually cross ground, so it is not speed-capped as
    // hard as the others.
    const lateral = def.behavior === 'sine' ? Math.min(speed * 1.35, 210) : Math.min(speed, 150);
    drone.x += clamp(targetX - drone.x, -1, 1) * lateral * dt;
    drone.y += clamp(targetY - drone.y, -1, 1) * 60 * dt;

    // Rhythm shooters fire at the ends of their travel, where they pause. That
    // pause is both the tell and the window.
    drone.atRest = Math.abs(targetX - drone.x) < 14;
  }

  /** Sidestep a bolt that is about to arrive. This is what reads as "smart". */
  private dodgeIncomingFire(drone: EnemyActor, speed: number, dt: number): void {
    if (drone.dodgeCooldown > 0) return;
    for (const bolt of this.bolts) {
      const closing = bolt.y - drone.y;
      if (closing < 0 || closing > ENEMY_DODGE_RANGE) continue;
      const offset = bolt.x - drone.x;
      if (Math.abs(offset) > drone.w * 0.9) continue;
      const away = offset >= 0 ? -1 : 1;
      drone.x += away * speed * 1.35 * dt;
      drone.stationX = clamp(drone.x + away * 40, 30, this.w - 30);
      drone.dodgeCooldown = ENEMY_DODGE_COOLDOWN;
      return;
    }
  }

  private pickStationX(): number {
    return 34 + Math.random() * Math.max(1, this.w - 68);
  }

  private pickStationY(): number {
    const top = this.h * ENEMY_STATION_TOP;
    return top + Math.random() * Math.max(1, this.h * ENEMY_STATION_BOTTOM - top);
  }

  private updateHazards(dt: number): void {
    if (this.wave < DEFAULT_HAZARD.minWave) return;

    this.hazardClock -= dt;
    if (this.hazardClock <= 0) {
      // Emplacements used to arrive one at a time and always pinned to x=54 or
      // x=w-54, so the ground threat was a thin line down each edge. They come
      // in batteries now, scattered across a band, and the batteries grow with
      // the wave.
      const battery = 1 + Math.min(2, Math.floor((this.wave - 1) / 4));
      for (let i = 0; i < battery; i++) {
        const def = HAZARDS[selectHazardKey(this.wave)] ?? DEFAULT_HAZARD;
        const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
        const edgeBand = Math.min(this.w * 0.3, 150);
        const x = def.placement === 'lane'
          ? 70 + Math.random() * Math.max(1, this.w - 140)
          : side < 0
            ? 40 + Math.random() * edgeBand
            : this.w - 40 - Math.random() * edgeBand;
        this.hazards.push({
          x,
          y: -def.draw.h - i * 46,
          w: def.hitbox.w,
          h: def.hitbox.h,
          vx: 0,
          vy: this.currentStage().scrollSpeed,
          hp: this.hazardHp(def),
          hazardKey: def.key,
          fireClock: 0.5 + Math.random() * 0.7,
          side,
        });
      }
      const def = HAZARDS[selectHazardKey(this.wave)] ?? DEFAULT_HAZARD;
      this.hazardClock = Math.max(2.4, def.spawnRate - (this.wave - def.minWave) * 0.22);
    }

    this.moveHazards(dt);
  }

  private moveHazards(dt: number): void {
    for (const hazard of this.hazards) {
      const hazardDef = this.hazardDef(hazard.hazardKey);
      hazard.y += hazard.vy * dt;
      if (!hazardDef.fires) continue;
      hazard.fireClock -= dt;
      // The firing window used a fixed 96px bottom margin, which on a short
      // landscape screen left almost no band in which a turret could shoot.
      if (hazard.y < 20 || hazard.y > this.h - 28 || hazard.fireClock > 0) continue;

      const dx = this.player.x - hazard.x;
      const dy = this.player.y - hazard.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      this.hostileShots.push({
        x: hazard.x,
        y: hazard.y,
        w: 9,
        h: 9,
        vx: (dx / length) * hazardDef.projectileSpeed,
        vy: (dy / length) * hazardDef.projectileSpeed,
        damage: 1,
        color: hazardDef.accent,
        projectileKey: 'enemy_missile',
      });
      hazard.fireClock = hazardDef.fireRate;
    }
    this.hazards = this.hazards.filter((hazard) => hazard.y < this.h + 60);
  }

  private updateHostileShots(dt: number): void {
    for (const shot of this.hostileShots) {
      // A salvo round steers for a couple of seconds, then commits. The timer
      // is what makes it dodgeable: a missile that tracked forever would be an
      // unavoidable hit rather than a threat you have to break away from, and
      // the whole point of the Whale Scout is that it is worth killing first.
      if (shot.homing && (shot.track ?? 0) > 0) {
        shot.track = (shot.track ?? 0) - dt;
        const speed = Math.hypot(shot.vx, shot.vy);
        const want = Math.atan2(this.player.y - shot.y, this.player.x - shot.x);
        // turnToward already crosses the -PI/+PI seam correctly; the boss duel
        // leans on it for the same reason.
        const angle = turnToward(Math.atan2(shot.vy, shot.vx), want, shot.homing * dt);
        shot.vx = Math.cos(angle) * speed;
        shot.vy = Math.sin(angle) * speed;
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }
    this.hostileShots = this.hostileShots.filter((shot) => (
      shot.x > -30 && shot.x < this.w + 30 && shot.y > -30 && shot.y < this.h + 30
    ));
  }

  private startBossIfReady(): void {
    if (this.boss || this.missionDirector.activeMission) return;
    const bossKey = nextBossKey(BOSSES, this.wave, this.completedBosses);
    if (!bossKey) return;
    this.screenClock = 0;
    this.screenCooldown = 0;
    const def = this.bossDef(bossKey);
    this.drones = [];
    this.hazards = [];
    this.hostileShots = [];
    this.dropBossResupply();
    // These used to arrive in silence. The boss track leads the entrance here
    // the same way it does for Gary Fog.
    this.cueMusic('boss_fight');
    this.boss = {
      x: this.w / 2,
      y: -def.draw.h,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: 0,
      hp: Math.round(def.hp * this.loadoutScale()),
      maxHp: Math.round(def.hp * this.loadoutScale()),
      bossKey,
      state: 'intro',
      age: 0,
      fireClock: def.phases[0].fireRate,
      contactClock: 0,
      phaseIndex: 0,
      targetX: this.w / 2,
      attackIndex: 0,
      attackState: 'telegraph',
      attackClock: BOSS_ATTACKS.aimed_volley.telegraph,
      attackAim: this.w / 2,
    };
  }

  /**
   * Where a boss settles, and how far it may drift.
   *
   * These were fixed pixel values (rest at y=118, +/-20 of sine) tuned for a
   * tall screen. On a 274px landscape phone that parks the boss halfway down,
   * crowding the fighter against the bottom and leaving the boss almost no
   * room to move. Proportional now: high in the frame, with a drift band that
   * scales with the screen.
   */
  private bossRestY(): number {
    return clamp(this.h * 0.24, 58, 132);
  }

  private bossDriftY(): number {
    return clamp(this.h * 0.075, 12, 30);
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    this.updateScreen(boss, dt);
    const def = this.bossDef(boss.bossKey);
    boss.age += dt;
    boss.contactClock = Math.max(0, boss.contactClock - dt);

    if (boss.state === 'intro') {
      // The creeping entrance belongs to every guardian, not only to Gary.
      //
      // This was the third place keyed to 'gary_fog' by hand. Leaving it would
      // have been the subtlest of the three failures: the new bosses would
      // still spawn and still fight, but they would snap into frame on the
      // 1.45s wave-boss path below instead of creeping in under their own
      // music -- landing as ordinary spawns, which is precisely the thing the
      // placement exists to avoid.
      const guardian = guardianPlanFor(this.missionDirector.currentAct?.key);
      if (guardian && guardian.bossKey === boss.bossKey) {
        if (boss.age < 0) return;
        const t = clamp(boss.age / guardian.creepSeconds, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        boss.y = -def.draw.h + (this.bossRestY() + def.draw.h) * eased;
        if (boss.age >= guardian.creepSeconds + guardian.postEntranceHoldSeconds) {
          boss.state = 'fight';
          boss.y = this.bossRestY();
          boss.age = 0;
          this.missionBannerText = `${def.label} // ENGAGE`;
          this.missionBannerClock = 2.2;
        }
        return;
      }

      boss.y += (this.bossRestY() - boss.y) * Math.min(1, dt * 3.4);
      if (boss.age >= 1.45) {
        boss.state = 'fight';
        boss.y = this.bossRestY();
        boss.age = 0;
      }
      return;
    }

    boss.phaseIndex = bossPhaseIndex(def, boss.hp ?? boss.maxHp, boss.maxHp);
    const phase = def.phases[boss.phaseIndex];
    if (Math.abs(boss.targetX - boss.x) < 12) boss.targetX = 52 + Math.random() * Math.max(1, this.w - 104);
    // A duel needs the boss to be somewhere other than a fixed altitude --
    // "make it to where the balls can move around the screen". It drifts across
    // a wide band on a slow second wave, so it comes down to meet you and then
    // pulls back up, and the fighter has to keep repositioning.
    const roam = clamp(this.h * 0.2, 30, 120);
    const centre = this.bossRestY() + roam;
    const script = phase.attacks ?? [];
    // A charge drives the boss itself. Letting the idle drift keep writing y
    // would cancel the dive, so during one the boss only steers itself, and
    // afterwards it eases back to the drift instead of snapping.
    const charging = script.length > 0
      && boss.attackState === 'active'
      && this.bossAttack(boss, script) === 'charge';
    if (!charging) {
      const drift = centre + Math.sin(boss.age * 1.7) * this.bossDriftY() + Math.sin(boss.age * 0.43) * roam;
      boss.y += (drift - boss.y) * Math.min(1, dt * 3.2);
      boss.x += Math.sign(boss.targetX - boss.x) * phase.moveSpeed * dt;
    }

    this.bossPressure(dt);

    if (script.length > 0) {
      this.runBossScript(boss, phase, script, dt);
      return;
    }

    boss.fireClock -= dt;
    if (boss.fireClock <= 0) {
      this.fireBossVolley(boss, phase);
      boss.fireClock = phase.fireRate;
    }
  }

  /**
   * Keeps drones arriving while a boss is up.
   *
   * The arena emptied completely the moment a boss spawned, which turned every
   * boss into a one-on-one where holding position and firing was the whole
   * plan. A trickle -- capped, so it stays a fight and not a wall -- means the
   * screen has to be managed while the boss is read. Escorts count toward the
   * cap, so a screened boss does not also bury the player.
   */
  private bossPressure(dt: number): void {
    this.bossSpawnClock -= dt;
    if (this.bossSpawnClock > 0) return;
    this.bossSpawnClock = BOSS_PRESSURE_INTERVAL;
    if (this.drones.length >= BOSS_PRESSURE_CAP) return;

    const enemyKey = selectEnemyKey(ENEMIES, this.wave, Math.random());
    const def = this.enemyDef(enemyKey);
    const x = 30 + Math.random() * Math.max(1, this.w - 60);
    this.drones.push({
      x,
      y: -35,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: this.enemySpeed(def),
      hp: this.enemyHp(def),
      enemyKey,
      age: 0,
      anchorX: x,
      phase: Math.random() * Math.PI * 2,
      direction: Math.random() < 0.5 ? -1 : 1,
      fireClock: (def.fireRate ?? 0) * (0.5 + Math.random()),
      stance: 'entering',
      stationX: x,
      stationY: this.pickStationY(),
      stanceClock: 0,
      patience: ENEMY_PATIENCE_MIN + Math.random() * ENEMY_PATIENCE_VARY,
      dodgeCooldown: 0,
      atRest: false,
      escort: false,
    });
  }

  /** The attack this boss is winding up, running, or recovering from. */
  private bossAttack(boss: BossActor, script: readonly BossAttackKey[]): BossAttackKey {
    return script[boss.attackIndex % script.length];
  }

  /**
   * Runs one phase's attack script.
   *
   * Fixed order, never shuffled: the point is that the sequence can be
   * learned. A move telegraphs, fires, then leaves the boss open, and the
   * script advances only after the recovery -- so a player who reads the tell
   * gets a guaranteed punish window every single cycle.
   */
  private runBossScript(boss: BossActor, phase: BossPhaseDef, script: readonly BossAttackKey[], dt: number): void {
    const key = this.bossAttack(boss, script);
    const timing = BOSS_ATTACKS[key];
    boss.attackClock -= dt;

    if (boss.attackState === 'telegraph') {
      // The aim is locked at the START of the tell, not when the shot goes
      // out. Otherwise the warning marker chases the player and there is
      // nothing to dodge -- the tell has to become a promise.
      if (boss.attackClock <= 0) {
        this.fireBossAttack(boss, phase, key);
        boss.attackState = timing.active > 0 ? 'active' : 'recover';
        boss.attackClock = timing.active > 0 ? timing.active : timing.recover;
      }
      return;
    }

    if (boss.attackState === 'active') {
      this.sustainBossAttack(boss, phase, key, dt);
      if (boss.attackClock <= 0) {
        boss.attackState = 'recover';
        boss.attackClock = timing.recover;
      }
      return;
    }

    if (boss.attackClock <= 0) {
      boss.attackIndex += 1;
      const next = BOSS_ATTACKS[this.bossAttack(boss, script)];
      boss.attackState = 'telegraph';
      boss.attackClock = next.telegraph;
      this.aimBossAttack(boss, this.bossAttack(boss, script));
    }
  }

  /** Locks in where the next attack will land, at the moment the tell starts. */
  private aimBossAttack(boss: BossActor, key: BossAttackKey): void {
    boss.attackAim = key === 'fog_wall'
      // The gap opens where the player is standing when the wall is called.
      // Staying put is safe; the punish is for panicking mid-tell.
      ? clamp(this.player.x, 40, this.w - 40)
      : this.player.x;
  }

  private fireBossAttack(boss: BossActor, phase: BossPhaseDef, key: BossAttackKey): void {
    const originY = boss.y + boss.h * 0.35;
    if (key === 'aimed_volley') {
      this.fireBossVolley(boss, phase);
      return;
    }

    if (key === 'fog_wall') {
      // A curtain across the whole width with one hole in it. Read the tell,
      // stand in the hole.
      const gapIndex = Math.round(((boss.attackAim - 40) / Math.max(1, this.w - 80)) * (FOG_WALL_SHOTS - 1));
      for (let i = 0; i < FOG_WALL_SHOTS; i += 1) {
        if (Math.abs(i - gapIndex) < FOG_WALL_GAP / 2 + 0.5) continue;
        const x = 40 + (i / (FOG_WALL_SHOTS - 1)) * (this.w - 80);
        this.pushBossShot(x, originY, Math.PI / 2, phase.projectileSpeed * 0.82, phase.accent);
      }
      sfx.play('enemyShoot');
      return;
    }

    if (key === 'radial') {
      const skip = Math.floor(Math.random() * RADIAL_SHOTS);
      for (let i = 0; i < RADIAL_SHOTS; i += 1) {
        if (Math.abs(i - skip) < RADIAL_GAP / 2 + 0.5) continue;
        const angle = (i / RADIAL_SHOTS) * Math.PI * 2;
        this.pushBossShot(boss.x, boss.y, angle, phase.projectileSpeed * 0.9, phase.accent);
      }
      sfx.play('enemyShoot');
      return;
    }

    if (key === 'escort_screen') {
      this.launchEscorts(boss);
      return;
    }

    if (key === 'charge') {
      sfx.play('enemyShoot');
      return;
    }

    // sweep_beam fires continuously in sustainBossAttack.
  }

  private sustainBossAttack(boss: BossActor, phase: BossPhaseDef, key: BossAttackKey, dt: number): void {
    if (key === 'charge') {
      // Dives at the column it marked, then the recovery pulls it back up.
      boss.x += clamp(boss.attackAim - boss.x, -1, 1) * BOSS_CHARGE_SPEED * dt;
      boss.y += BOSS_CHARGE_SPEED * 0.62 * dt;
      boss.y = Math.min(boss.y, this.playerLane().bottom - 46);
      return;
    }

    if (key === 'sweep_beam') {
      boss.fireClock -= dt;
      if (boss.fireClock > 0) return;
      boss.fireClock = 0.075;
      const swing = Math.sin(boss.age * 3.1) * 0.7;
      this.pushBossShot(boss.x, boss.y + boss.h * 0.35, Math.PI / 2 + swing, phase.projectileSpeed, phase.accent);
    }
  }

  /**
   * Launches the escort screen.
   *
   * They come out of the boss and fan down, so they are on screen and
   * shootable rather than dropping in from off the top. Their patience is
   * capped: if the player cannot clear them the escorts break off on their own
   * and the shield falls, so the fight can never deadlock behind an escort
   * that drifted somewhere awkward.
   */
  private launchEscorts(boss: BossActor): void {
    // A spent screen has to cool down first, so the beat cannot outrun the
    // player's ability to clear it.
    if (this.screenCooldown > 0 || this.screenClock > 0) return;
    // REFILL to the cap, never add to it. The old loop pushed a full set every
    // time the script came round, which is how four launches became twenty
    // live escorts.
    const alive = this.drones.filter((drone) => drone.escort && drone.stance !== 'fleeing').length;
    const wanted = Math.max(0, ESCORT_COUNT - alive);
    if (wanted === 0) return;
    this.screenClock = SCREEN_SECONDS;
    const key = this.escortKeyFor(boss);
    const def = this.enemyDef(key);
    for (let i = 0; i < wanted; i += 1) {
      const spread = (i - (wanted - 1) / 2) * 46;
      const x = clamp(boss.x + spread, 26, this.w - 26);
      this.drones.push({
        x,
        y: boss.y + boss.h * 0.3,
        w: def.hitbox.w,
        h: def.hitbox.h,
        vx: 0,
        vy: def.baseSpeed,
        hp: this.enemyHp(def),
        enemyKey: key,
        age: 0,
        anchorX: x,
        phase: Math.random() * Math.PI * 2,
        direction: i < wanted / 2 ? -1 : 1,
        fireClock: (def.fireRate ?? 1) * (0.4 + Math.random() * 0.6),
        stance: 'entering',
        stationX: x,
        stationY: this.pickStationY(),
        stanceClock: 0,
        patience: ESCORT_PATIENCE,
        dodgeCooldown: 0,
        atRest: false,
        escort: true,
      });
    }
    this.missionBannerText = 'ESCORTS LAUNCHED // SHIELD UP';
    this.missionBannerClock = 2.2;
    sfx.play('enemyShoot');
  }

  /** True while any launched escort is still fighting. */
  private bossShielded(): boolean {
    if (this.screenClock <= 0) return false;
    return this.drones.some((drone) => drone.escort && drone.stance !== 'fleeing');
  }

  /**
   * Who a boss sends up.
   *
   * Every screen used to be `availableEnemyKeys(...)[0]`, i.e. regulator
   * drones, whatever the boss and whatever the wave -- so all four bosses
   * screened themselves with the same 1hp weaver.
   */
  private escortKeyFor(boss: BossActor): string {
    const byBoss: Record<string, string> = {
      gary_fog: 'fog_raider',
      regulatory_behemoth: 'regulator_drone',
      clarity_destroyer: 'whale_scout',
      final_clarity: 'rug_fighter',
    };
    const key = byBoss[boss.bossKey];
    if (key && ENEMIES[key]) return key;
    return availableEnemyKeys(ENEMIES, this.wave)[0] ?? 'regulator_drone';
  }

  /**
   * Runs the screen clock, and ends it the way it has to end.
   *
   * Three exits, and all three open the boss. Every escort dead: the screen is
   * cleared early, which is the skilful one. The clock expires with escorts
   * still flying: OVERLOAD -- the survivors stop screening and the boss is
   * forced into a recover window, so the player who could not clear it still
   * gets the punish. Or the boss dies first.
   */
  private updateScreen(boss: BossActor, dt: number): void {
    if (this.screenCooldown > 0) this.screenCooldown = Math.max(0, this.screenCooldown - dt);
    // An escort that has broken off is not screening any more, so it stops
    // being an escort. Without this it keeps the flag while no longer counting
    // toward the cap, and a refill can put more than ESCORT_COUNT of them on
    // the field -- which is the stacking this whole change exists to stop.
    for (const drone of this.drones) if (drone.escort && drone.stance === 'fleeing') drone.escort = false;
    if (this.screenClock <= 0) return;
    const alive = this.drones.filter((drone) => drone.escort && drone.stance !== 'fleeing').length;
    if (alive === 0) {
      this.endScreen(boss, false);
      return;
    }
    this.screenClock -= dt;
    if (this.screenClock > 0) return;
    this.endScreen(boss, true);
  }

  /** Every exit starts the same exposure window, including a rapid full clear. */
  private endScreen(boss: BossActor, overloaded: boolean): void {
    this.screenClock = 0;
    this.screenCooldown = SCREEN_COOLDOWN;
    for (const drone of this.drones) if (drone.escort) drone.escort = false;
    boss.attackState = 'recover';
    boss.attackClock = SCREEN_OVERLOAD_RECOVER;
    this.missionBannerText = overloaded ? 'SHIELD OVERLOAD // BOSS EXPOSED' : 'SCREEN CLEARED // BOSS EXPOSED';
    this.missionBannerClock = 1.8;
    sfx.play('deny');
  }

  private pushBossShot(x: number, y: number, angle: number, speed: number, color: string): void {
    this.hostileShots.push({
      x,
      y,
      w: 10,
      h: 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: 1,
      color,
      projectileKey: 'enemy_red_bullet',
    });
  }

  private fireBossVolley(boss: BossActor, phase: BossPhaseDef): void {
    const aimed = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const centerAngle = phase.pattern === 'sweep' ? aimed + Math.sin(boss.age * 2.2) * 0.55 : aimed;
    const middle = (phase.projectileCount - 1) / 2;
    for (let index = 0; index < phase.projectileCount; index += 1) {
      const offset = (index - middle) * phase.spread;
      const burstOffset = phase.pattern === 'burst' ? Math.sin(boss.age * 5 + index) * 0.08 : 0;
      const angle = centerAngle + offset + burstOffset;
      this.hostileShots.push({
        x: boss.x,
        y: boss.y + boss.h * 0.35,
        w: 10,
        h: 10,
        vx: Math.cos(angle) * phase.projectileSpeed,
        vy: Math.sin(angle) * phase.projectileSpeed,
        damage: 1,
        color: phase.accent,
        projectileKey: 'enemy_red_bullet',
      });
    }
  }

  private collisions(): void {
    // A piercing bolt spends one charge per target instead of dying on contact,
    // so CLARITY LANCE punches a whole column rather than the first thing it
    // meets. `spend` returns true once the bolt is finally used up.
    const spend = (bolt: ProjectileActor): boolean => {
      if (bolt.pierce > 0) {
        bolt.pierce -= 1;
        return false;
      }
      bolt.life = 0;
      return true;
    };

    for (const bolt of this.bolts) {
      for (const drone of this.drones) {
        if ((drone.hp ?? 0) <= 0) continue;
        if (overlap(box(bolt, 0.65), box(drone, 0.68))) {
          const spent = spend(bolt);
          drone.hp = (drone.hp ?? 1) - bolt.damage;
          if ((drone.hp ?? 0) <= 0) this.registerKill(drone);
          if (spent) break;
        }
      }
      if (bolt.life === 0) continue;
      for (const hazard of this.hazards) {
        if ((hazard.hp ?? 0) <= 0) continue;
        if (overlap(box(bolt, 0.65), box(hazard, 0.78))) {
          const spent = spend(bolt);
          hazard.hp = (hazard.hp ?? 1) - bolt.damage;
          if ((hazard.hp ?? 0) <= 0) {
            this.score += this.hazardDef(hazard.hazardKey).score;
            this.special = Math.min(100, this.special + 12);
            this.awardXp(this.hazardDef(hazard.hazardKey).score * XP_PER_SCORE);
            this.ring(hazard.x, hazard.y);
            sfx.play('explode', 1.2);
          }
          if (spent) break;
        }
      }
      if (bolt.life === 0) continue;
      if (this.warship?.state === 'fight') {
        for (const system of this.warshipDirector.targetableSystems) {
          if (!overlap(box(bolt, 0.65), this.warshipSystemBox(system))) continue;
          bolt.life = 0;
          const before = this.warshipDirector.phase;
          const hit = this.warshipDirector.hit(system.key, bolt.damage);
          this.ring(this.warshipSystemCenter(system).x, this.warshipSystemCenter(system).y);
          if (hit.destroyedNow) this.special = Math.min(100, this.special + 24);
          if (this.warshipDirector.phase !== before) {
            this.hostileShots = [];
            this.missionBannerText = this.warshipDirector.objective;
            this.missionBannerClock = 2.8;
          }
          if (this.warshipDirector.phase === 'disabled') this.completeRegulatoryWarship();
          break;
        }
      }
      if (bolt.life === 0 || !this.boss || this.boss.state !== 'fight') continue;
      if (overlap(box(bolt, 0.65), box(this.boss, 0.84))) {
        bolt.life = 0;
        this.damageBoss(bolt.damage);
      }
    }
    // Seekers land on whatever they reach first, then die -- they do not pierce.
    for (const seeker of this.seekers) {
      let spent = false;
      for (const drone of this.drones) {
        if ((drone.hp ?? 0) <= 0 || !overlap(box(seeker, 0.8), box(drone, 0.8))) continue;
        drone.hp = (drone.hp ?? 1) - seeker.damage;
        if ((drone.hp ?? 0) <= 0) this.registerKill(drone);
        spent = true;
        break;
      }
      if (!spent) {
        for (const hazard of this.hazards) {
          if ((hazard.hp ?? 0) <= 0 || !overlap(box(seeker, 0.8), box(hazard, 0.85))) continue;
          hazard.hp = (hazard.hp ?? 1) - seeker.damage;
          if ((hazard.hp ?? 0) <= 0) {
            const def = this.hazardDef(hazard.hazardKey);
            this.score += def.score;
            this.awardXp(def.score * XP_PER_SCORE);
            this.special = Math.min(100, this.special + 12);
            sfx.play('explode', 1.2);
          }
          spent = true;
          break;
        }
      }
      if (!spent && this.boss?.state === 'fight' && overlap(box(seeker, 0.8), box(this.boss, 0.84))) {
        this.damageBoss(seeker.damage);
        spent = true;
      }
      if (!spent && this.warship?.state === 'fight') {
        for (const system of this.warshipDirector.targetableSystems) {
          if (!overlap(box(seeker, 0.8), this.warshipSystemBox(system))) continue;
          this.warshipDirector.hit(system.key, seeker.damage);
          spent = true;
          break;
        }
      }
      if (spent) {
        seeker.life = 0;
        this.ring(seeker.x, seeker.y);
      }
    }
    this.seekers = this.seekers.filter((seeker) => seeker.life !== 0);

    this.bolts = this.bolts.filter((bolt) => bolt.life !== 0);
    this.drones = this.drones.filter((drone) => (drone.hp ?? 0) > 0);
    this.hazards = this.hazards.filter((hazard) => (hazard.hp ?? 0) > 0);

    for (const drone of this.drones) {
      if (overlap(box(drone, 0.62), box(this.player, 0.55))) {
        drone.hp = 0;
        this.damagePlayer(1, drone.x, drone.y);
      }
    }
    this.drones = this.drones.filter((drone) => (drone.hp ?? 0) > 0);

    for (const hazard of this.hazards) {
      if (overlap(box(hazard, 0.76), box(this.player, 0.55))) {
        hazard.hp = 0;
        this.damagePlayer(1, hazard.x, hazard.y);
      }
    }
    this.hazards = this.hazards.filter((hazard) => (hazard.hp ?? 0) > 0);

    for (const shot of this.hostileShots) {
      if (overlap(box(shot, 0.8), box(this.player, 0.55))) {
        shot.life = 0;
        this.damagePlayer(shot.damage, shot.x, shot.y);
      }
    }
    this.hostileShots = this.hostileShots.filter((shot) => shot.life !== 0);

    if (this.boss && this.boss.state === 'fight' && this.boss.contactClock <= 0 && overlap(box(this.boss, 0.78), box(this.player, 0.55))) {
      this.damagePlayer(1, this.player.x, this.player.y);
      this.boss.contactClock = 0.9;
    }

    for (const pickup of this.pickups) {
      if (overlap(box(pickup, 0.78), box(this.player, 0.62))) {
        pickup.life = 0;
        this.applyPickup(pickup.pickupKey);
      }
    }
    this.pickups = this.pickups.filter((pickup) => pickup.life !== 0);
  }

  private warshipSystemCenter(system: WarshipSystemState): { x: number; y: number } {
    const warship = this.warship;
    if (!warship) return { x: 0, y: 0 };
    return {
      x: warship.x + system.x * REGULATORY_WARSHIP.draw.w,
      y: warship.y + system.y * REGULATORY_WARSHIP.draw.h,
    };
  }

  private warshipSystemBox(system: WarshipSystemState): Rect {
    const center = this.warshipSystemCenter(system);
    return { x: center.x - system.w / 2, y: center.y - system.h / 2, w: system.w, h: system.h };
  }

  private completeRegulatoryWarship(): void {
    const warship = this.warship;
    const mission = this.missionDirector.activeMission;
    if (!warship || warship.state === 'disabled' || !mission || !this.activePlanetKey) return;

    warship.state = 'disabled';
    this.score += REGULATORY_WARSHIP.score;
    this.hostileShots = [];
    this.bolts = [];
    this.special = 100;

    const boarding = mission.checkpoints.find((checkpoint) => checkpoint.resumeActKey === 'boarding');
    if (boarding) {
      this.progress = recordMissionCheckpoint(this.progress, {
        planetKey: this.activePlanetKey,
        missionKey: mission.key,
        checkpointKey: boarding.key,
        checkpointLabel: boarding.label,
        resumeActKey: boarding.resumeActKey,
        shipKey: this.selectedShipKey,
        weaponTier: this.weaponTier(),
        bombs: this.bombs,
        score: this.score,
        savedAt: Date.now(),
        ...this.upgradeSnapshot(),
      });
      this.saveProgress();
    }

    this.missionDirector.advance();
    this.wave = Math.max(1, this.missionDirector.currentActIndex + 1);
    this.cueMusic('warship_disabled');
    this.missionBannerText = 'WARSHIP DISABLED // HANGAR BREACH OPEN';
    this.missionBannerClock = 2.8;
  }

  private updateRings(dt: number): void {
    for (const item of this.rings) item.life = (item.life ?? 0) - dt;
    this.rings = this.rings.filter((item) => (item.life ?? 0) > 0);
    if (this.ringClock > 0) {
      this.ringClock -= dt;
      this.drones = this.drones.filter((drone) => {
        const hit = Math.hypot(drone.x - this.player.x, drone.y - this.player.y) < this.pulseRadius();
        if (hit) {
          this.score += 25;
          this.ring(drone.x, drone.y);
        }
        return !hit;
      });
      if (this.boss && this.boss.state === 'fight' && !this.pulseHitBoss) {
        const hit = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y) < this.pulseRadius() + this.boss.w * 0.35;
        if (hit) {
          this.pulseHitBoss = true;
          this.damageBoss(hasFogBreaker(this.progress) ? 6 : 4);
        }
      }
    }
  }

  private updateDebris(dt: number): void {
    const drag = 1 - Math.min(1, dt * 3.5);
    for (const p of this.debris) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
    }
    this.debris = this.debris.filter((p) => p.life > 0);
  }

  private render(): void {
    if (this.mode !== this.loggedMode) {
      debugLog.log('mode', `mode -> ${this.mode}`, { planet: this.activePlanetKey ?? null });
      this.loggedMode = this.mode;
    }
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.background();
    if (this.mode === 'title') this.title();
    if (this.mode === 'select') this.shipSelect();
    if (this.mode === 'play') this.play();
    if (this.mode === 'results') this.results();
    if (this.mode === 'victory') this.victory();
    if (this.reportAssets || (this.showAssets && this.diagnostics)) this.assetPanel();
  }

  private background(): void {
    const stage = this.currentStage();
    const sky = this.ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, stage.sky);
    sky.addColorStop(1, '#02060b');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, this.w, this.h);
    const illustrated = this.drawStageBackdrop(stage);
    this.ctx.strokeStyle = `${stage.accent}${illustrated ? '0c' : '18'}`;
    const gridOffset = (this.clock * stage.scrollSpeed) % 46;
    for (let y = gridOffset - 46; y < this.h; y += 46) line(this.ctx, 0, y, this.w, y);
    for (let x = 0; x < this.w; x += 46) line(this.ctx, x, 0, x, this.h);
    if (!illustrated) this.drawStageStructures(stage);
    this.drawStageProps(stage);
  }

  private drawStageProps(stage: StageDef): void {
    const props = Object.values(ENVIRONMENT_PROPS).filter((prop) => prop.stages.includes(stage.key));
    if (props.length === 0) return;
    const spacing = 168;
    const travel = this.clock * stage.scrollSpeed * 0.72;
    const base = Math.floor(travel / spacing);
    const offset = travel % spacing;

    this.ctx.save();
    this.ctx.globalAlpha = 0.62;
    for (let row = -1; row <= Math.ceil(this.h / spacing) + 1; row += 1) {
      const index = base + row;
      const prop = props[Math.abs(index) % props.length];
      const y = row * spacing + offset;
      const side = index % 2 === 0 ? -1 : 1;
      const inset = Math.min(26, prop.draw.w * 0.24);
      const x = side < 0 ? inset : this.w - inset;
      this.drawCentered(prop.sprite, x, y, prop.draw.w, prop.draw.h);
    }
    this.ctx.restore();
  }

  private drawStageBackdrop(stage: StageDef): boolean {
    const ref = this.boss || this.warship ? { category: 'backgrounds', id: 'boss_arena' } : stage.background;
    const image = this.assets.getImage(ref.category, ref.id);
    if (!image || image.width <= 0 || image.height <= 0) return false;

    const scale = Math.max(this.w / image.width, this.h / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (this.w - drawWidth) / 2;
    const offset = (this.clock * stage.scrollSpeed * 0.32) % drawHeight;

    this.ctx.save();
    this.ctx.globalAlpha = 0.7;
    this.ctx.drawImage(image, x, offset - drawHeight, drawWidth, drawHeight);
    this.ctx.drawImage(image, x, offset, drawWidth, drawHeight);
    this.ctx.globalAlpha = 1;
    const shade = this.ctx.createLinearGradient(0, 0, 0, this.h);
    shade.addColorStop(0, 'rgba(2,6,11,0.18)');
    shade.addColorStop(0.55, 'rgba(2,6,11,0.34)');
    shade.addColorStop(1, 'rgba(2,6,11,0.5)');
    this.ctx.fillStyle = shade;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.restore();
    return true;
  }

  private drawStageStructures(stage: StageDef): void {
    const spacing = 104;
    const offset = (this.clock * stage.scrollSpeed) % spacing;
    let index = 0;
    for (let y = offset - spacing; y < this.h + spacing; y += spacing) {
      const width = 34 + ((index * 17) % 38);
      const height = 72 + ((index * 23) % 30);
      this.ctx.fillStyle = stage.structure;
      this.ctx.strokeStyle = `${stage.accent}66`;
      this.ctx.fillRect(0, y, width, height);
      this.ctx.strokeRect(0, y, width, height);
      this.ctx.fillRect(this.w - width, y + 18, width, height);
      this.ctx.strokeRect(this.w - width, y + 18, width, height);

      this.ctx.fillStyle = `${stage.accent}88`;
      for (let wy = y + 12; wy < y + height - 8; wy += 18) {
        this.ctx.fillRect(Math.max(8, width - 18), wy, 6, 4);
        this.ctx.fillRect(this.w - width + 10, wy + 18, 6, 4);
      }
      index += 1;
    }
  }

  private title(): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '700 28px ui-sans-serif, system-ui';
    this.ctx.fillText('CODED: XRP', this.w / 2, this.h * 0.34);
    this.ctx.fillStyle = '#36a3ff';
    this.ctx.font = '600 16px ui-sans-serif, system-ui';
    this.ctx.fillText('THE HUNT FOR CLARITY', this.w / 2, this.h * 0.39);
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.strokeRect(this.w / 2 - 78, this.h * 0.54 - 24, 156, 48);
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 18px ui-sans-serif, system-ui';
    this.ctx.fillText('START', this.w / 2, this.h * 0.54 + 7);
    this.ctx.font = '12px ui-sans-serif, system-ui';
    this.ctx.fillStyle = 'rgba(216,255,232,0.7)';
    this.ctx.fillText('Drag to fly • Space pulse • B bomb • P pause', this.w / 2, this.h * 0.64);
  }

  private results(): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ff3355';
    this.ctx.font = '700 26px ui-sans-serif, system-ui';
    this.ctx.fillText('GAME OVER', this.w / 2, this.h * 0.3);
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '600 14px ui-sans-serif, system-ui';
    this.ctx.fillText(`SCORE ${this.score}`, this.w / 2, this.h * 0.42);
    this.ctx.fillText(`BEST ${this.progress.highScore} • HIGHEST WAVE ${this.progress.highestWave}`, this.w / 2, this.h * 0.5);

    const save = this.resumeCheckpoint();
    const buttons = this.resultsButtons();
    if (save) {
      this.button(buttons.primary, `CONTINUE // ${save.checkpointLabel}`, '#00ff88');
      this.button(buttons.secondary, 'RESTART MISSION', 'rgba(216,255,232,0.5)');
    } else {
      this.button(buttons.primary, 'RESTART', '#00ff88');
    }
  }

  /** The save a GAME OVER can continue from, if one applies to this mission. */
  private resumeCheckpoint(): MissionCheckpointSnapshot | undefined {
    const mission = this.missionDirector.activeMission;
    if (!mission || !this.activePlanetKey) return undefined;
    const stored = missionCheckpointFor(this.progress, this.activePlanetKey);
    if (!stored) return undefined;
    const usable = stored.missionKey === mission.key
      && stored.planetKey === this.activePlanetKey
      && mission.acts.some((act) => act.key === stored.resumeActKey);
    return usable ? stored : undefined;
  }

  private resultsButtons(): { primary: Rect; secondary: Rect } {
    const w = Math.min(this.w - 64, 260);
    const h = 34;
    const x = (this.w - w) / 2;
    const top = this.h * 0.58;
    return {
      primary: { x, y: top, w, h },
      secondary: { x, y: top + h + 8, w, h },
    };
  }

  private victory(): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '900 28px ui-sans-serif, system-ui';
    this.ctx.fillText('CLARITY RESTORED', this.w / 2, this.h * 0.32);
    this.ctx.fillStyle = '#36a3ff';
    this.ctx.font = '700 17px ui-sans-serif, system-ui';
    this.ctx.fillText('THE LEDGER IS CLEAR', this.w / 2, this.h * 0.38);
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '600 15px ui-sans-serif, system-ui';
    this.ctx.fillText(`FINAL SCORE ${this.score}`, this.w / 2, this.h * 0.47);
    this.ctx.fillText(`CAMPAIGN VICTORIES ${this.progress.victories}`, this.w / 2, this.h * 0.52);
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.strokeRect(this.w / 2 - 92, this.h * 0.62 - 24, 184, 48);
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '800 15px ui-sans-serif, system-ui';
    this.ctx.fillText('RUN IT AGAIN', this.w / 2, this.h * 0.62 + 6);
  }

  private shipSelect(): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '700 22px ui-sans-serif, system-ui';
    this.ctx.fillText('SELECT YOUR SHIP', this.w / 2, 54);
    if (this.activePlanetLabel) {
      this.ctx.fillStyle = '#36a3ff';
      this.ctx.font = '700 11px ui-sans-serif, system-ui';
      this.ctx.fillText(`DESTINATION // ${this.activePlanetLabel}`, this.w / 2, 73);
    }

    for (const card of this.shipCards()) {
      const def = SHIPS[card.key];
      const { x, y, w, h } = card.rect;
      this.ctx.fillStyle = 'rgba(2,6,11,0.82)';
      this.ctx.strokeStyle = def.accent;
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeRect(x, y, w, h);
      const compact = h < 52;
      const art = Math.min(h - 12, 38);
      this.drawCentered(def.sprite, x + 36, y + h / 2, art * 0.8, art);
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = def.accent;
      this.ctx.font = `700 ${compact ? 11 : 13}px ui-sans-serif, system-ui`;
      this.ctx.fillText(def.label, x + 70, y + h * 0.42);
      this.ctx.fillStyle = 'rgba(216,255,232,0.78)';
      this.ctx.font = `600 ${compact ? 9 : 11}px ui-sans-serif, system-ui`;
      this.ctx.fillText(`HP ${def.hp}   SPEED ${def.speed}   FIRE ${def.fireRate.toFixed(2)}`, x + 70, y + h * 0.78);
    }

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = 'rgba(216,255,232,0.66)';
    this.ctx.font = '12px ui-sans-serif, system-ui';
    this.ctx.fillText('TAP A SHIP TO DEPLOY', this.w / 2, this.h - 34);
  }

  private play(): void {
    this.drawPlayer();
    for (const drone of this.drones) this.drawDrone(drone);
    for (const hazard of this.hazards) this.drawHazard(hazard);
    if (this.boss) this.drawBoss(this.boss);
    // Over the boss, not under it: the bubble is the explanation for why shots
    // are bouncing, so it has to be the thing you see.
    if (this.boss?.state === 'fight' && this.bossShielded()) this.drawBossShield(this.boss);
    if (this.warship) this.drawRegulatoryWarship();
    for (const bolt of this.bolts) this.drawBolt(bolt);
    for (const seeker of this.seekers) this.drawSeeker(seeker);
    for (const shot of this.hostileShots) this.drawHostileShot(shot);
    for (const pickup of this.pickups) this.drawPickup(pickup);
    for (const item of this.rings) this.drawRing(item);
    this.drawDebris();
    if (this.ringClock > 0) this.drawPulse();
    if (this.bombClock > 0) this.drawBombWave();
    this.hud();
    if (this.launchClock > 0) this.drawLaunchReveal();
    if (this.bossClearClock > 0) this.bossClearBanner();
    if (this.missionBannerClock > 0) this.drawMissionBanner();
    if (!this.bombHintShown && this.bombHintClock > 0) this.drawBombHint();
    if (this.upgradeOffer.length > 0) this.drawUpgradeChoice();
    if (this.paused) this.pause();
  }

  /**
   * Teaches the double-tap, once.
   *
   * It waits a beat after the fighter is flying so it is not competing with
   * the launch cinematic, pulses so it reads as a prompt rather than a label,
   * and retires itself the first time a bomb goes off however it was fired.
   */
  private drawBombHint(): void {
    if (this.bombHintClock < BOMB_HINT_DELAY) return;
    const remaining = BOMB_HINT_DELAY + BOMB_HINT_LIFE - this.bombHintClock;
    if (remaining <= 0) return;
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.globalAlpha = Math.min(1, remaining) * (0.74 + 0.26 * Math.sin(this.clock * 5));
    this.ctx.fillStyle = '#ffd24a';
    this.ctx.font = '900 12px ui-sans-serif, system-ui';
    this.ctx.fillText('DOUBLE-TAP ANYWHERE TO DROP A BOMB', this.w / 2, this.h - 34);
    this.ctx.restore();
  }

  private drawLaunchReveal(): void {
    const elapsed = this.launchTotal - this.launchClock;
    const entranceStart = EARTH_LAUNCH_REVEAL.musicLead + EARTH_LAUNCH_REVEAL.entranceDelay;
    const entranceEnd = entranceStart + EARTH_LAUNCH_REVEAL.entranceDuration;
    const label = elapsed < entranceStart
      ? 'EARTH UNDER ATTACK'
      : elapsed < entranceEnd
        ? 'XRP MAN // DEPLOYING'
        : 'DEFEND EARTH';
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '900 20px ui-sans-serif, system-ui';
    this.ctx.fillText(label, this.w / 2, this.h * 0.25);
    this.ctx.restore();
  }

  private drawCentered(ref: SpriteRef, cx: number, cy: number, dw: number, dh: number): boolean {
    return this.sprites.draw(ref.category, ref.id, cx - dw / 2, cy - dh / 2, dw, dh, this.clock);
  }

  /** Sprites are authored nose-up, so a heading of -PI/2 means no rotation. */
  private drawFacing(ref: SpriteRef, cx: number, cy: number, dw: number, dh: number, facing: number): boolean {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(facing + Math.PI / 2);
    const drawn = this.sprites.draw(ref.category, ref.id, -dw / 2, -dh / 2, dw, dh, this.clock);
    this.ctx.restore();
    return drawn;
  }

  /**
   * A rim light: one soft wash that peaks at the silhouette's edge.
   *
   * Transparent in the middle and transparent again outside, so it never lies
   * over the sprite and never closes into a disc. It goes down BEFORE the hull
   * for the same reason.
   *
   * The gradient is built at the origin and cached per colour and radius --
   * there are only a handful of distinct pairs, and a fresh gradient per ship
   * per frame is a few thousand allocations a second for a halo.
   */
  private drawRimGlow(x: number, y: number, size: number, color: string): void {
    const radius = size * RIM_GLOW_SCALE;
    if (radius <= 0) return;
    const key = `${color}:${radius.toFixed(1)}`;
    let glow = this.rimGlows.get(key);
    if (!glow) {
      glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, 'transparent');
      glow.addColorStop(RIM_GLOW_EDGE, color);
      glow.addColorStop(1, 'transparent');
      this.rimGlows.set(key, glow);
    }
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.globalAlpha = RIM_GLOW_ALPHA;
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /**
   * A shield, drawn as an outline that is doing something.
   *
   * A hairline ring that breathes, plus one brighter arc travelling around it.
   * No fill at any opacity: the hull underneath is the thing the player is
   * aiming at and steering, and covering it is what made the old bubble read
   * as a bug rather than as a shield.
   *
   * `strength` (0..1) only moves the opacity. A shield down to its last
   * segment should look thin, not smaller -- the radius is where the hull is.
   */
  private drawShieldField(x: number, y: number, radius: number, color: string, strength: number): void {
    if (radius <= 0) return;
    const held = clamp(strength, 0, 1);
    // Offset by position so two ships side by side do not pulse in lockstep.
    const live = radius * (1 + SHIELD_RIPPLE * Math.sin(this.clock * 5 + x * 0.05 + y * 0.03));
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = SHIELD_RING_WIDTH;
    c.globalAlpha = 0.3 + 0.35 * held;
    c.beginPath();
    c.arc(x, y, live, 0, Math.PI * 2);
    c.stroke();
    // The travelling arc sits just outside the ring rather than on top of it,
    // so what you see is two lines and one of them is moving. Painted at the
    // same radius it only brightened a quarter of a solid ring, which still
    // read as a lid.
    const sweep = this.clock * SHIELD_SWEEP_RATE;
    c.globalAlpha = 0.55 + 0.4 * held;
    c.beginPath();
    c.arc(x, y, live * SHIELD_SWEEP_OFFSET, sweep, sweep + SHIELD_SWEEP_ARC);
    c.stroke();
    c.restore();
  }

  private drawPlayer(): void {
    const def = this.playerDef();
    const size = Math.max(def.draw.w, def.draw.h);
    this.drawRimGlow(this.player.x, this.player.y, size, def.accent);
    const drawn = this.drawFacing(def.sprite, this.player.x, this.player.y, def.draw.w, def.draw.h, this.playerFacing);
    if (!drawn) {
      this.ctx.save();
      this.ctx.translate(this.player.x, this.player.y);
      this.ctx.rotate(this.playerFacing + Math.PI / 2);
      this.ctx.strokeStyle = def.accent;
      this.ctx.fillStyle = 'rgba(0,255,128,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, -24);
      this.ctx.lineTo(18, 18);
      this.ctx.lineTo(0, 10);
      this.ctx.lineTo(-18, 18);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }
    // The ring that used to live here was unconditional and took the hull's
    // accent, so it was on when there was no shield to show and green only if
    // you happened to be flying the default ship. It is the shield now, in the
    // one colour, and only when there is one.
    if (this.shield > 0) {
      this.drawShieldField(
        this.player.x,
        this.player.y,
        size * SHIELD_RING_SCALE,
        PLAYER_SHIELD_COLOR,
        this.shield / Math.max(1, this.shieldMax),
      );
    }
  }

  private drawDrone(drone: EnemyActor): void {
    const def = this.enemyDef(drone.enemyKey);
    this.drawRimGlow(drone.x, drone.y, Math.max(def.draw.w, def.draw.h), def.accent);
    const drawn = this.drawCentered(def.sprite, drone.x, drone.y, def.draw.w, def.draw.h);
    if (!drawn) {
      this.ctx.save();
      this.ctx.translate(drone.x, drone.y);
      this.ctx.strokeStyle = def.accent;
      this.ctx.fillStyle = 'rgba(255,51,85,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, 18);
      this.ctx.lineTo(18, -10);
      this.ctx.lineTo(0, -18);
      this.ctx.lineTo(-18, -10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }

    // An escort is the only enemy carrying a shield, and it is carrying the
    // BOSS's -- so it gets the outline while the screen is up. That is worth
    // showing: it names the four ships you have to clear, instead of leaving
    // the player to work out which drones the bubble is counting.
    if (drone.escort && this.bossShielded()) {
      this.drawShieldField(
        drone.x,
        drone.y,
        Math.max(def.draw.w, def.draw.h) * SHIELD_RING_SCALE,
        ENEMY_SHIELD_COLOR,
        1,
      );
    }
  }

  private drawBolt(bolt: ProjectileActor): void {
    const projectile = this.projectileDef(bolt.projectileKey);
    // Bolts fly in any direction now that a duel rotates the volley, and the
    // Lance round is a long beam with an obvious nose, so draw along the
    // heading rather than always pointing up.
    const facing = Math.atan2(bolt.vy, bolt.vx);
    if (this.drawFacing(projectile.sprite, bolt.x, bolt.y, projectile.draw.w, projectile.draw.h, facing)) return;
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = 3;
    line(this.ctx, bolt.x - bolt.vx * 0.012, bolt.y - bolt.vy * 0.012, bolt.x + bolt.vx * 0.012, bolt.y + bolt.vy * 0.012);
  }

  private drawHazard(hazard: HazardActor): void {
    const def = this.hazardDef(hazard.hazardKey);
    const drawn = this.drawCentered(def.sprite, hazard.x, hazard.y, def.draw.w, def.draw.h);

    if (!drawn) {
      const aim = Math.atan2(this.player.y - hazard.y, this.player.x - hazard.x);
      this.ctx.save();
      this.ctx.translate(hazard.x, hazard.y);
      this.ctx.fillStyle = 'rgba(25,10,5,0.88)';
      this.ctx.strokeStyle = def.accent;
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(-18, -18, 36, 36);
      this.ctx.strokeRect(-18, -18, 36, 36);
      if (def.fires) {
        this.ctx.rotate(aim);
        this.ctx.fillStyle = def.accent;
        this.ctx.fillRect(0, -3, 24, 6);
      }
      this.ctx.restore();
    }

    bar(this.ctx, hazard.x - 20, hazard.y - def.draw.h / 2 - 8, 40, 4, (hazard.hp ?? 0) / def.hp, def.accent);
  }

  private drawHostileShot(shot: HostileProjectile): void {
    const projectile = this.projectileDef(shot.projectileKey);
    const image = this.assets.getImage(projectile.sprite.category, projectile.sprite.id);
    if (image) {
      this.ctx.save();
      this.ctx.translate(shot.x, shot.y);
      this.ctx.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2);
      this.ctx.drawImage(image, -projectile.draw.w / 2, -projectile.draw.h / 2, projectile.draw.w, projectile.draw.h);
      this.ctx.restore();
      return;
    }
    this.ctx.save();
    this.ctx.strokeStyle = shot.color;
    this.ctx.shadowColor = shot.color;
    this.ctx.shadowBlur = 8;
    this.ctx.lineWidth = 4;
    line(this.ctx, shot.x - shot.vx * 0.025, shot.y - shot.vy * 0.025, shot.x, shot.y);
    this.ctx.restore();
  }

  /**
   * Draws the tell, so the script can actually be read.
   *
   * A telegraph the player cannot see is just a delay. Each move paints the
   * shape of what is coming, in the space where it will land, filling up over
   * the wind-up so the timing is legible too. The recovery paints the opposite
   * signal -- the boss glows open, because that is when hitting it counts.
   */
  private drawBossTell(boss: BossActor, phase: BossPhaseDef, script: readonly BossAttackKey[]): void {
    const key = this.bossAttack(boss, script);
    const timing = BOSS_ATTACKS[key];
    const c = this.ctx;

    if (boss.attackState === 'recover') {
      const t = clamp(boss.attackClock / Math.max(0.01, timing.recover), 0, 1);
      c.save();
      c.globalAlpha = 0.3 + 0.35 * t;
      c.strokeStyle = '#00ff88';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(boss.x, boss.y, Math.max(boss.w, boss.h) * 0.72, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.85;
      c.fillStyle = '#00ff88';
      c.textAlign = 'center';
      c.font = '900 10px ui-sans-serif, system-ui';
      c.fillText('OPEN', boss.x, boss.y - Math.max(boss.w, boss.h) * 0.72 - 6);
      c.restore();
      return;
    }

    if (boss.attackState !== 'telegraph') return;
    // 0 at the start of the wind-up, 1 the instant it fires.
    const charge = 1 - clamp(boss.attackClock / Math.max(0.01, timing.telegraph), 0, 1);

    c.save();
    c.strokeStyle = phase.accent;
    c.fillStyle = phase.accent;
    c.lineWidth = 2;
    c.globalAlpha = 0.35 + 0.45 * charge;

    if (key === 'fog_wall') {
      // Paint the curtain, and leave the gap unpainted. Stand in the gap.
      const gapIndex = Math.round(((boss.attackAim - 40) / Math.max(1, this.w - 80)) * (FOG_WALL_SHOTS - 1));
      for (let i = 0; i < FOG_WALL_SHOTS; i += 1) {
        if (Math.abs(i - gapIndex) < FOG_WALL_GAP / 2 + 0.5) continue;
        const x = 40 + (i / (FOG_WALL_SHOTS - 1)) * (this.w - 80);
        c.fillRect(x - 3, boss.y + boss.h * 0.35, 6, 10 + 26 * charge);
      }
    } else if (key === 'charge') {
      // The column it is about to dive down.
      c.globalAlpha = 0.16 + 0.24 * charge;
      c.fillRect(boss.attackAim - 26, boss.y, 52, this.h - boss.y);
      c.globalAlpha = 0.6 + 0.4 * charge;
      c.beginPath();
      c.moveTo(boss.attackAim - 13, boss.y + 34);
      c.lineTo(boss.attackAim + 13, boss.y + 34);
      c.lineTo(boss.attackAim, boss.y + 52);
      c.closePath();
      c.fill();
    } else if (key === 'radial') {
      c.beginPath();
      c.arc(boss.x, boss.y, 26 + 54 * charge, 0, Math.PI * 2);
      c.stroke();
    } else if (key === 'sweep_beam') {
      const swing = Math.sin(boss.age * 3.1) * 0.7 + Math.PI / 2;
      c.globalAlpha = 0.28 + 0.4 * charge;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(boss.x, boss.y);
      c.lineTo(boss.x + Math.cos(swing) * this.h, boss.y + Math.sin(swing) * this.h);
      c.stroke();
    } else {
      // An aimed volley: a short lead line down the firing angle.
      const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(boss.x, boss.y);
      c.lineTo(boss.x + Math.cos(angle) * (40 + 70 * charge), boss.y + Math.sin(angle) * (40 + 70 * charge));
      c.stroke();
    }

    c.globalAlpha = 0.9;
    c.fillStyle = phase.accent;
    c.textAlign = 'center';
    c.font = '900 9px ui-sans-serif, system-ui';
    c.fillText(timing.label, boss.x, boss.y - Math.max(boss.w, boss.h) * 0.6);
    c.restore();
  }

  /**
   * The escort shield.
   *
   * A boss that simply stops taking damage looks broken, so the shield has to
   * be visible and the count has to say what to shoot instead. What it must
   * NOT do is hide the boss: it was a #36a3ff disc filled at 0.34-0.50 across
   * 0.86x the largest boss on the field, which is most of the screen during
   * the phase where reading the attack tell matters most. It is the same
   * outline every shield uses now, in the enemy colour -- and blue is the
   * player's own HUD shield bar, which was a second reason it read wrong.
   */
  private drawBossShield(boss: BossActor): void {
    const remaining = this.drones.filter((drone) => drone.escort && drone.stance !== 'fleeing').length;
    // Sized off the DRAWN silhouette, not the hitbox. `boss.w/h` is the
    // collision box, which after scaling is about a quarter smaller than the
    // art: Gary Fog collides at 59x54 and draws at 76x81. The old 0.86x
    // hitbox radius does clear all four bosses as they are drawn today, but
    // only by coincidence -- it tracks a number the player cannot see. This
    // one tracks the one they can, so it keeps clearing the ship if either
    // is retuned.
    const def = this.bossDef(boss.bossKey);
    const radius = Math.max(def.draw.w, def.draw.h) * SHIELD_RING_SCALE;
    this.drawShieldField(boss.x, boss.y, radius, ENEMY_SHIELD_COLOR, 1);
    const c = this.ctx;
    c.save();
    c.fillStyle = '#d8ffe8';
    c.textAlign = 'center';
    c.font = '900 10px ui-sans-serif, system-ui';
    // Above the field, but never up in the HUD strip and never down in the
    // bottom row of buttons -- both of which it landed in on the first try.
    c.fillText(
      `SHIELDED • CLEAR ${remaining} ESCORT${remaining === 1 ? '' : 'S'}`,
      clamp(boss.x, 74, this.w - 74),
      clamp(boss.y - radius - 8, 52, this.h - 58),
    );
    c.restore();
  }

  private drawBoss(boss: BossActor): void {
    const def = this.bossDef(boss.bossKey);
    const phase = def.phases[boss.phaseIndex];
    const script = phase.attacks ?? [];
    if (boss.state === 'fight' && script.length > 0 && !this.bossShielded()) {
      this.drawBossTell(boss, phase, script);
    }
    // The boss keeps its nose on the player too, so the duel reads as two
    // fighters circling rather than one thing shooting downwards.
    const facing = boss.state === 'fight' ? this.bossFacing : Math.PI / 2;
    const drawn = this.drawFacing(def.sprite, boss.x, boss.y, def.draw.w, def.draw.h, facing);
    if (!drawn) {
      this.ctx.save();
      this.ctx.translate(boss.x, boss.y);
      this.ctx.rotate(facing - Math.PI / 2 + Math.sin(Math.max(0, boss.age) * 1.4) * 0.06);
      this.ctx.fillStyle = 'rgba(5,8,18,0.92)';
      this.ctx.strokeStyle = phase.accent;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 62);
      this.ctx.lineTo(64, 18);
      this.ctx.lineTo(48, -52);
      this.ctx.lineTo(0, -68);
      this.ctx.lineTo(-48, -52);
      this.ctx.lineTo(-64, 18);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = `${phase.accent}55`;
      this.ctx.fillRect(-34, -24, 68, 45);
      this.ctx.strokeRect(-34, -24, 68, 45);
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.strokeStyle = phase.accent;
    this.ctx.globalAlpha = 0.5 + Math.sin(this.clock * 5) * 0.2;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(boss.x, boss.y, Math.max(def.draw.w, def.draw.h) * 0.48, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    if (boss.state === 'intro') {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = phase.accent;
      this.ctx.font = '800 20px ui-sans-serif, system-ui';
      this.ctx.fillText(boss.age < 0 ? `GUARDIAN SIGNAL • ${def.label}` : `WARNING • ${def.label}`, this.w / 2, this.h * 0.52);
    }
  }

  private drawRegulatoryWarship(): void {
    const warship = this.warship;
    if (!warship) return;
    const disabled = warship.state === 'disabled';
    this.ctx.save();
    if (disabled) this.ctx.globalAlpha = 0.78;
    this.drawCentered(REGULATORY_WARSHIP.sprite, warship.x, warship.y, REGULATORY_WARSHIP.draw.w, REGULATORY_WARSHIP.draw.h);
    this.ctx.restore();

    if (warship.state === 'intro') {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ff8a3d';
      this.ctx.font = '900 18px ui-sans-serif, system-ui';
      this.ctx.fillText('CAPITAL SHIP INBOUND', this.w / 2, this.h * 0.51);
      return;
    }

    for (const system of this.warshipDirector.allSystems) {
      const center = this.warshipSystemCenter(system);
      if (system.destroyed) {
        this.ctx.strokeStyle = 'rgba(255,51,85,0.7)';
        this.ctx.lineWidth = 3;
        line(this.ctx, center.x - 8, center.y - 8, center.x + 8, center.y + 8);
        line(this.ctx, center.x + 8, center.y - 8, center.x - 8, center.y + 8);
        continue;
      }
      if (!system.exposed) continue;
      const pulse = 0.55 + Math.sin(this.clock * 7) * 0.25;
      this.ctx.save();
      this.ctx.globalAlpha = pulse;
      this.ctx.strokeStyle = '#ffd24a';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(center.x - system.w / 2, center.y - system.h / 2, system.w, system.h);
      this.ctx.restore();
      bar(this.ctx, center.x - 18, center.y + system.h / 2 + 4, 36, 4, system.remainingHp / system.hp, '#ffd24a');
    }

    if (this.warshipDirector.phase === 'shield' && this.warshipDirector.targetableSystems.length === 0) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(54,163,255,0.7)';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.ellipse(warship.x, warship.y, 112, 96, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * The homing rocket. Uses projectiles/seeker_missile when that art exists and
   * falls back to a procedural dart with a burning tail until it does -- the
   * same pattern as every other sprite here, so dropping the image into the
   * manifest is the whole integration.
   */
  private drawSeeker(seeker: SeekerActor): void {
    const def = this.projectileDef('seeker_missile');
    if (this.drawFacing(def.sprite, seeker.x, seeker.y, def.draw.w, def.draw.h, seeker.angle)) return;

    this.ctx.save();
    this.ctx.translate(seeker.x, seeker.y);
    this.ctx.rotate(seeker.angle + Math.PI / 2);
    const flicker = 0.6 + 0.4 * Math.sin(this.clock * 30 + seeker.age * 12);
    this.ctx.globalAlpha = flicker;
    this.ctx.fillStyle = '#ffd24a';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 14);
    this.ctx.lineTo(-4, 4);
    this.ctx.lineTo(4, 4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -12);
    this.ctx.lineTo(5, 6);
    this.ctx.lineTo(-5, 6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = '#36a3ff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draws a pickup, and -- more importantly -- draws WHICH pickup it is.
   *
   * The four pickup sprites are all a green glyph inside the same blue ring.
   * Side by side at full size they are clearly different; in flight at 22px on
   * a phone they are the same object, so whatever you got felt like the wrong
   * thing was wired up. The art is unchanged; each drop now carries its own
   * coloured aura and a stamped tag, which is what actually gets read at speed.
   */
  private drawPickup(pickup: PickupActor): void {
    const def = this.pickupDef(pickup.pickupKey);
    if (!def) return;
    const pulse = 0.72 + 0.28 * Math.sin(this.clock * 6 + pickup.x * 0.05);
    const radius = Math.max(def.draw.w, def.draw.h) * 0.62;

    this.ctx.save();
    this.ctx.translate(pickup.x, pickup.y);
    this.ctx.globalAlpha = 0.9 * pulse;
    this.ctx.strokeStyle = def.tint;
    this.ctx.lineWidth = 2.4;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.globalAlpha = 0.16 * pulse;
    this.ctx.fillStyle = def.tint;
    this.ctx.fill();
    this.ctx.restore();

    const drawn = this.drawCentered(def.sprite, pickup.x, pickup.y, def.draw.w, def.draw.h);

    this.ctx.save();
    this.ctx.translate(pickup.x, pickup.y);
    if (!drawn) {
      // Sprite missing: the aura alone is not a shape, so keep a glyph.
      this.ctx.rotate(this.clock * 2.4);
      this.ctx.strokeStyle = def.tint;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -radius * 0.6);
      this.ctx.lineTo(radius * 0.6, 0);
      this.ctx.lineTo(0, radius * 0.6);
      this.ctx.lineTo(-radius * 0.6, 0);
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.rotate(-this.clock * 2.4);
    }
    this.ctx.font = '700 7px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    this.ctx.strokeText(def.tag, 0, radius + 8);
    this.ctx.fillStyle = def.tint;
    this.ctx.fillText(def.tag, 0, radius + 8);
    this.ctx.restore();
  }

  private drawRing(item: Actor): void {
    const alpha = Math.max(0, (item.life ?? 0) / BURST_LIFE);
    const radius = (1 - alpha) * BURST_MAX_RADIUS + BURST_MIN_RADIUS;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, alpha);
    // Each burst plays its OWN animation: the sheet is stepped by this ring's
    // age, not the global clock, or every burst on screen would show the same
    // frame regardless of when it started.
    const age = BURST_LIFE - (item.life ?? 0);
    const drawn = this.sprites.draw(HIT_SPARK.sprite.category, HIT_SPARK.sprite.id, item.x - radius, item.y - radius, radius * 2, radius * 2, age)
      || this.drawCentered(BURST_RING.sprite, item.x, item.y, radius * 2, radius * 2);
    this.ctx.restore();
    if (drawn) return;
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawDebris(): void {
    this.ctx.save();
    this.ctx.lineCap = 'round';
    for (const p of this.debris) {
      const a = Math.max(0, p.life / p.max);
      this.ctx.globalAlpha = a;
      this.ctx.strokeStyle = `hsl(${p.hue}, 100%, ${55 + a * 25}%)`;
      this.ctx.lineWidth = p.size * (0.4 + a * 0.6);
      line(this.ctx, p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  /** Pulse reach: the Fog Breaker widens it, and so does every PULSE upgrade. */
  private pulseRadius(): number {
    const base = hasFogBreaker(this.progress) ? CLARITY_PULSE.radius * 1.25 : CLARITY_PULSE.radius;
    return base * this.pulsePower;
  }

  private drawPulse(): void {
    const alpha = Math.max(0, this.ringClock / (hasFogBreaker(this.progress) ? 0.55 : 0.35));
    const color = hasFogBreaker(this.progress) ? '54,163,255' : '0,255,136';
    const radius = this.pulseRadius();
    this.ctx.strokeStyle = `rgba(${color},${alpha})`;
    this.ctx.lineWidth = hasFogBreaker(this.progress) ? 6 : 4;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, (1 - alpha) * radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  /**
   * The level-up screen. Text and shape only: there is no upgrade artwork in
   * the repo yet (pickups/ holds three images and ui/, weapons/ and icons/ are
   * empty), so each card draws its own glyph rather than referencing art that
   * would show up as a missing asset.
   */
  private drawUpgradeChoice(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(2,6,11,0.82)';
    this.ctx.fillRect(0, 0, this.w, this.h);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '900 15px ui-sans-serif, system-ui';
    // "RANK", to match the HUD and to stay out of the way of "Level 1".
    this.ctx.font = '900 19px ui-sans-serif, system-ui';
    this.ctx.fillText(`RANK ${this.xpLevel}`, this.w / 2, this.h * 0.16);
    this.ctx.fillStyle = 'rgba(216,255,232,0.66)';
    this.ctx.font = '700 9px ui-sans-serif, system-ui';
    const queued = this.pendingUpgrades > 1 ? ` • ${this.pendingUpgrades} TO SPEND` : '';
    this.ctx.fillText(`CHOOSE AN UPGRADE${queued}`, this.w / 2, this.h * 0.16 + 15);

    for (const card of this.upgradeCards()) {
      const info = this.upgradeInfo(card.kind);
      const open = this.upgradeAvailable(card.kind);
      const { x, y, w, h } = card.rect;
      // A finished track still shows -- the layout must not change shape as
      // the run fills up -- but it reads as spent and cannot be taken.
      this.ctx.globalAlpha = open ? 1 : 0.42;
      this.ctx.fillStyle = 'rgba(2,6,11,0.94)';
      this.ctx.strokeStyle = open ? info.accent : 'rgba(126,146,158,0.75)';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeRect(x, y, w, h);

      this.drawUpgradeGlyph(card.kind, x + w / 2, y + h * 0.3, Math.min(w, h) * 0.17, open ? info.accent : '#7e929e');

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = open ? info.accent : '#9fb0ba';
      this.ctx.font = '900 11px ui-sans-serif, system-ui';
      this.ctx.fillText(fitText(this.ctx, info.title, w - 12), x + w / 2, y + h * 0.62);
      this.ctx.fillStyle = 'rgba(216,255,232,0.72)';
      this.ctx.font = '600 8px ui-sans-serif, system-ui';
      const spentDetail = this.allUpgradesMaxed() ? `TAP TO BANK +${ALL_MAXED_SCORE}` : 'FULLY UPGRADED';
      this.ctx.fillText(fitText(this.ctx, open ? info.detail : spentDetail, w - 12), x + w / 2, y + h * 0.62 + 13);
      this.ctx.fillStyle = 'rgba(216,255,232,0.4)';
      this.ctx.fillText(fitText(this.ctx, info.current, w - 12), x + w / 2, y + h * 0.62 + 25);
      this.ctx.globalAlpha = 1;

      if (!open) {
        this.ctx.fillStyle = '#ffd24a';
        this.ctx.font = '900 10px ui-sans-serif, system-ui';
        this.ctx.fillText('MAX', x + w / 2, y + 15);
      }
    }
    this.ctx.restore();
  }

  /** What each upgrade is called, does, and what the player already has. */
  private upgradeInfo(kind: UpgradeKind): { title: string; detail: string; current: string; accent: string } {
    switch (kind) {
      case 'barrel':
        return {
          title: 'BARREL PAIR',
          detail: '+2 SHOTS • BOTH SIDES',
          current: `NOW: ${this.currentVolley().length} SHOT ${this.currentWeapon().label}`,
          accent: '#00ff88',
        };
      case 'shield':
        return {
          title: 'SHIELD PLATING',
          detail: '+1 SEGMENT • REFILLS',
          current: `NOW: ${this.shieldMax} SEGMENTS`,
          accent: '#36a3ff',
        };
      case 'bomb':
        return {
          title: 'BOMB YIELD',
          detail: '+22% BLAST • +1 BOMB',
          current: `NOW: ${this.bombs}/${this.maxBombs()} RACK`,
          accent: '#ffd24a',
        };
      case 'pulse':
        return {
          title: 'PULSE FIELD',
          detail: '+18% REACH • FASTER CHARGE',
          current: `NOW: ${Math.round(this.pulseRadius())}px`,
          accent: '#b56cff',
        };
    }
  }

  private drawUpgradeGlyph(kind: UpgradeKind, cx: number, cy: number, r: number, accent: string): void {
    this.ctx.save();
    this.ctx.strokeStyle = accent;
    this.ctx.fillStyle = accent;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    if (kind === 'shield') {
      // Hexagon, matching the shield-cell pickup.
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
    } else if (kind === 'bomb') {
      this.ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    } else {
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    }
    this.ctx.globalAlpha = 0.22;
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawBombWave(): void {
    const progress = 1 - this.bombClock / BOMB_LIFE;
    const radius = progress * Math.hypot(this.w, this.h) * 0.62;
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(255,210,74,${Math.max(0, 1 - progress)})`;
    this.ctx.lineWidth = 8 - progress * 5;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Compact HUD.
   *
   * The readout used to run down the left edge to y=128 at 10-13px. On a
   * 274px-tall landscape phone that is nearly half the screen given over to
   * text the player reads once. Everything now lives in a ~40px strip along
   * the top at roughly half the old size and well under full opacity, so the
   * playfield gets the room back.
   */
  private hud(): void {
    const ship = this.playerDef();
    const mission = this.missionDirector.activeMission;
    const missionAct = this.missionDirector.currentAct;
    // Keep the left stack out of the top-right utility buttons.
    const leftWidth = Math.min(this.w * 0.5, this.zone.assets.cx - this.zone.assets.r - 24);

    this.ctx.save();
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = 'rgba(216,255,232,0.9)';
    this.ctx.font = '800 11px ui-sans-serif, system-ui';
    this.ctx.fillText(`SCORE ${this.score}`, 14, 15);

    // Health, then shield, then XP -- three 3px bars stacked under the score.
    // Shield only takes a row when the hull actually has one.
    bar(this.ctx, 14, 21, 72, 3, (this.player.hp ?? 0) / ship.hp, ship.accent);
    let barY = 26;
    if (this.shieldMax > 0) {
      bar(this.ctx, 14, barY, 72, 3, this.shield / this.shieldMax, '#36a3ff');
      barY += 5;
    }
    bar(this.ctx, 14, barY, 72, 2, this.xp / this.xpForNextLevel(), '#00ff88');
    this.ctx.font = '800 8px ui-sans-serif, system-ui';
    this.ctx.fillStyle = 'rgba(0,255,136,0.8)';
    // "RANK", not "LV". Playtesters read `LV 4` on a level called Level 1 and
    // reported reaching "level four" -- two different meanings of the same
    // word, one of them wrong.
    this.ctx.fillText(`RANK ${this.xpLevel}`, 92, barY + 2.5);

    // Seekers are not a consumable -- once the tier is earned they reload
    // forever. The bar shows the reload, and the infinity mark says that is
    // all there is to it, so nobody plays around them thinking they are rare.
    if (this.xpLevel >= SEEKER_UNLOCK_LEVEL && leftWidth > 190) {
      const charge = 1 - clamp(this.seekerClock / SEEKER_INTERVAL, 0, 1);
      bar(this.ctx, 122, barY, 30, 2, charge, '#ff6b3d');
      this.ctx.fillStyle = 'rgba(255,107,61,0.85)';
      this.ctx.fillText('SEEKER \u221e', 156, barY + 2.5);
    }

    const weapon = this.currentWeapon();
    const gun = `${weapon.label}${this.barrels > 0 ? ` +${this.barrels}` : ''}`;
    const detail = mission && missionAct
      ? `${missionAct.label} • ${gun} • ${ship.label}`
      : `WAVE ${this.wave} • ${gun} • ${ship.label}`;
    this.ctx.font = '600 8px ui-sans-serif, system-ui';
    this.ctx.fillStyle = 'rgba(216,255,232,0.5)';
    this.ctx.fillText(fitText(this.ctx, detail, leftWidth), 14, barY + 13);

    // The one line that tells the player what to do right now.
    let objective = mission && missionAct ? missionAct.objective : '';
    if (this.warship) objective = this.warshipDirector.objective;
    else if (this.earthEncounterDirector.active) {
      const groupLabel = this.earthEncounterDirector.currentGroupLabel ?? 'INBOUND';
      objective = `FORMATION ${this.earthEncounterDirector.currentGroupNumber}/${this.earthEncounterDirector.totalGroups} • ${groupLabel}`;
    } else if (missionAct?.mode === 'boss') objective = 'GUARDIAN SIGNAL DETECTED';
    else if (missionAct?.key === 'final_assault' && this.fogGateActive) objective = 'FOG BREAKER CUTTING THE ROUTE';
    if (objective) {
      this.ctx.fillStyle = this.fogGateActive ? 'rgba(54,163,255,0.85)' : 'rgba(216,255,232,0.44)';
      this.ctx.fillText(fitText(this.ctx, objective, leftWidth), 14, barY + 23);
    }

    const stage = this.currentStage();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = stage.accent;
    this.ctx.globalAlpha = 0.72;
    this.ctx.font = '800 9px ui-sans-serif, system-ui';
    this.ctx.fillText(stage.label, this.w / 2, 15);
    this.ctx.globalAlpha = 1;

    if (this.boss && this.boss.state === 'fight') {
      const def = this.bossDef(this.boss.bossKey);
      const phase = def.phases[this.boss.phaseIndex];
      const bossBarWidth = Math.min(280, this.w - 80);
      const bossBarX = (this.w - bossBarWidth) / 2;
      this.ctx.fillStyle = phase.accent;
      this.ctx.font = '800 9px ui-sans-serif, system-ui';
      this.ctx.fillText(`${def.label} • PHASE ${this.boss.phaseIndex + 1}`, this.w / 2, 29);
      // Against the boss's own scaled maximum, not the tuning number.
      bar(this.ctx, bossBarX, 33, bossBarWidth, 5, (this.boss.hp ?? 0) / this.boss.maxHp, phase.accent);
    }
    if (this.warship?.state === 'fight') {
      this.ctx.fillStyle = '#ff8a3d';
      this.ctx.font = '800 9px ui-sans-serif, system-ui';
      this.ctx.fillText(`REGULATORY WARSHIP • ${this.warshipDirector.phase.toUpperCase()}`, this.w / 2, 29);
    }
    this.ctx.restore();

    this.padButton(this.zone.pause, this.paused ? '▶' : '❚❚', '#00ff88');
    if (this.diagnostics) this.padButton(this.zone.assets, 'D', 'rgba(255,210,74,0.75)');
    this.padButton(this.zone.bomb, 'BOMB', this.bombs > 0 ? '#ffd24a' : 'rgba(255,210,74,0.35)', {
      badge: String(this.bombs),
      // The button stays, but it says out loud that you never have to reach
      // for it: the same bomb is two taps under the thumb already steering.
      caption: '2× TAP',
    });
    this.drawSpecialButton();
  }

  private bossClearBanner(): void {
    const alpha = Math.min(1, this.bossClearClock, 2.4 - this.bossClearClock);
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, alpha);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = '900 24px ui-sans-serif, system-ui';
    this.ctx.fillText('CLARITY GATE RESTORED', this.w / 2, this.h * 0.43);
    this.ctx.restore();
  }

  private drawMissionBanner(): void {
    const alpha = Math.min(1, this.missionBannerClock, 2.8 - this.missionBannerClock);
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, alpha);

    // First these sat centred at 36% of the screen height, then top-right --
    // both land in the band the fighter and the diving enemies share. The
    // bottom strip is the one lane nothing else uses: enemies hold station in
    // the top half, and down here the fighter is already under the player's
    // thumb. With the pad cornered to the right, the whole left run is free.
    // Starts clear of the bottom-left utility row (LOG / sound), ends clear of
    // the action pad. STAR MAP moved to the top-right, so this row is shorter.
    const gapLeft = 110;
    const gapRight = this.zone.bomb.cx - this.zone.bomb.r - 12;
    const height = 18;
    const width = Math.min(280, Math.max(120, gapRight - gapLeft));
    const x = Math.max(10, gapLeft + (gapRight - gapLeft - width) / 2);
    // Sits one row up from the very bottom edge: the FULLSCREEN nudge parks
    // there until the player takes the game fullscreen, and two overlapping
    // bottom-centre elements is exactly the "in the way" this move was fixing.
    const y = this.h - height - 34;

    this.ctx.fillStyle = 'rgba(2,6,11,0.86)';
    this.ctx.strokeStyle = 'rgba(0,255,136,0.75)';
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '800 9px ui-sans-serif, system-ui';
    this.ctx.fillText(fitText(this.ctx, this.missionBannerText, width - 12), x + width / 2, y + height / 2 + 3);
    this.ctx.restore();
  }

  /**
   * The Fog Breaker is the one control Level 1 never teaches. Two moments stall
   * outright until the player taps it -- the fog gate before the final assault,
   * and the warship's shield phase -- and a player who does not know that just
   * sees the mission stop. Those moments make the button blink and caption
   * itself, so the control teaches its own use the first time it matters.
   */
  /**
   * The pulse button's state.
   *
   * `blocked` used to mean "the mission is waiting on this press" and drove a
   * 2.5Hz blink. Nothing waits on the press any more -- the fog cuts itself --
   * so there is nothing to nag about and the button is just charged or not.
   */
  private specialCue(): { blocked: boolean; ready: boolean } {
    return { blocked: false, ready: this.special >= 100 };
  }

  /** Wide rectangular button for the menu screens (ship select, GAME OVER). */
  private button(rect: Rect, label: string, color: string): void {
    this.ctx.fillStyle = 'rgba(2,6,11,0.72)';
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 12px ui-sans-serif, system-ui';
    this.ctx.fillText(fitText(this.ctx, label, rect.w - 14), rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
  }

  private drawSpecialButton(): void {
    const circle = this.zone.special;
    // Always PULSE. It read FOG BREAK once the upgrade landed, which is what
    // sent people hunting for something to break fog with.
    const label = 'PULSE';
    const { blocked, ready } = this.specialCue();
    // The charge meter used to be a bar across the top-right. Wearing it as a
    // ring on the button puts the number where the decision is.
    const charge = this.special / 100;

    if (!blocked) {
      this.padButton(circle, label, ready ? '#36a3ff' : 'rgba(54,163,255,0.5)', { ring: charge });
      return;
    }

    // 2.5 Hz reads as "press me" without strobing.
    const beat = 0.5 + 0.5 * Math.sin(this.clock * Math.PI * 5);
    const accent = ready ? '#8fd6ff' : '#ffd24a';
    this.padButton(circle, label, accent, { ring: charge, glow: 0.16 + 0.34 * beat });

    this.ctx.save();
    this.ctx.globalAlpha = 0.5 + 0.5 * beat;
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = accent;
    this.ctx.font = '900 10px ui-sans-serif, system-ui';
    this.ctx.fillText(
      ready ? 'TAP TO BREAK THE FOG' : `CHARGING ${Math.floor(this.special)}%`,
      this.w - 14,
      circle.cy - circle.r - 10,
    );
    this.ctx.restore();
    this.ctx.textAlign = 'left';
  }

  /**
   * A round arcade button. The old ones were plain stroked rectangles; these
   * read as something you press -- a filled disc, a bright rim, an optional
   * count badge for BOMB and an optional charge ring for the special.
   */
  private padButton(
    circle: { cx: number; cy: number; r: number },
    label: string,
    color: string,
    options: { badge?: string; caption?: string; glow?: number; ring?: number } = {},
  ): void {
    const { cx, cy, r } = circle;
    this.ctx.save();

    if (options.glow) {
      this.ctx.globalAlpha = options.glow;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(2,6,11,0.6)';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = color;
    this.ctx.stroke();

    // Inner rim: depth without needing artwork.
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba(216,255,232,0.16)';
    this.ctx.stroke();

    if (options.ring !== undefined && options.ring > 0) {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, options.ring));
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
    }

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = `800 ${Math.max(8, Math.round(r * 0.34))}px ui-sans-serif, system-ui`;
    this.ctx.fillText(fitText(this.ctx, label, r * 1.85), cx, cy + r * 0.12);

    if (options.badge !== undefined) {
      const bx = cx + r * 0.72;
      const by = cy - r * 0.72;
      this.ctx.beginPath();
      this.ctx.arc(bx, by, r * 0.34, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(2,6,11,0.92)';
      this.ctx.fill();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
      this.ctx.fillStyle = color;
      this.ctx.font = `800 ${Math.max(8, Math.round(r * 0.36))}px ui-sans-serif, system-ui`;
      this.ctx.fillText(options.badge, bx, by + r * 0.13);
    }

    if (options.caption !== undefined) {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.7;
      this.ctx.font = `800 ${Math.max(7, Math.round(r * 0.24))}px ui-sans-serif, system-ui`;
      this.ctx.fillText(fitText(this.ctx, options.caption, r * 2.4), cx, cy + r * 0.52);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.restore();
  }

  private assetPanel(): void {
    const counts = this.assets.counts();
    const missing = this.assets.missing().slice(0, 6);
    const open = this.showAssets;
    const h = open ? 124 + missing.length * 14 : 32;
    const x = 12;
    const y = 84;
    const w = Math.min(this.w - 24, 430);
    this.ctx.fillStyle = 'rgba(2,6,11,0.86)';
    this.ctx.strokeStyle = counts.missing || counts.error ? '#ffd24a' : '#00ff88';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 12px ui-sans-serif, system-ui';
    this.ctx.fillText(`ASSETS ${counts.loaded}/${counts.total} loaded • missing ${counts.missing} • errors ${counts.error}`, x + 10, y + 21);
    if (!open) return;
    this.ctx.fillStyle = 'rgba(216,255,232,0.78)';
    this.ctx.fillText('Manifest supports image and spritesheet entries.', x + 10, y + 43);
    this.ctx.fillText('D key or top-right D button toggles diagnostics.', x + 10, y + 61);
    this.ctx.fillStyle = '#ffd24a';
    missing.forEach((item, i) => this.ctx.fillText(`${item.status.toUpperCase()} ${item.category}:${item.id}`, x + 10, y + 84 + i * 14));
  }

  private pause(): void {
    this.ctx.fillStyle = 'rgba(2,6,11,0.72)';
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#36a3ff';
    this.ctx.font = '700 28px ui-sans-serif, system-ui';
    this.ctx.fillText('PAUSED', this.w / 2, this.h / 2);
  }

  private useSpecial(): void {
    // A dead press still answers, so the button never feels broken.
    if (this.special < 100) return void sfx.play('deny');
    this.special = 0;
    sfx.play('pulse');
    this.ringClock = hasFogBreaker(this.progress) ? 0.55 : 0.35;
    this.pulseHitBoss = false;

    // The Fog Breaker is a permanent upgrade to this pulse -- wider, longer,
    // and it sweeps the screen clear of fire. It no longer unlocks anything,
    // because a button that gates progress is a button people get stuck behind.
    if (hasFogBreaker(this.progress)) this.hostileShots = [];
  }

  /** Opens the route to the capital ship. */
  private cutFogGate(): void {
    if (!this.fogGateActive) return;
    this.fogGateActive = false;
    this.fogCutClock = 0;
    this.hostileShots = [];
    this.ringClock = 0.55;
    this.earthEncounterDirector.start('final_assault');
    this.missionBannerText = 'FOG BREAKER // ROUTE EXPOSED';
    this.missionBannerClock = 2.8;
    sfx.play('pulse');
  }

  private useBomb(): void {
    if (this.bombs <= 0 || this.mode !== 'play') return void sfx.play('deny');
    this.bombHintShown = true;
    this.bombs -= 1;
    this.bombClock = BOMB_LIFE;
    sfx.play('bomb');
    for (const drone of this.drones) {
      this.score += 35;
      this.ring(drone.x, drone.y);
    }
    this.drones = [];
    for (const hazard of this.hazards) {
      this.score += 75;
      this.ring(hazard.x, hazard.y);
    }
    this.hazards = [];
    this.hostileShots = [];
    if (this.boss?.state === 'fight') {
      this.ring(this.boss.x, this.boss.y);
      this.damageBoss(Math.round(6 * this.bombPower));
    }
    if (this.warship?.state === 'fight') {
      for (const system of this.warshipDirector.targetableSystems) {
        this.warshipDirector.hit(system.key, 2);
        const center = this.warshipSystemCenter(system);
        this.ring(center.x, center.y);
      }
      if (this.warshipDirector.phase === 'disabled') this.completeRegulatoryWarship();
    }
  }

  /**
   * How much of a hit lands right now.
   *
   * A scripted boss is armoured while it winds up and attacks, and wide open
   * while it recovers. That is what makes reading the tell worth anything: you
   * cannot simply out-trade it, you have to survive the move and punish the
   * window. Bosses with no script take full damage as before.
   */
  private bossDamageScale(boss: BossActor): number {
    // The escort screen blocks outright rather than reducing. Auto-aim means
    // the player is always on target, so a percentage would just be a slower
    // version of the same fight; zero forces the screen to be cleared first.
    if (this.bossShielded()) return 0;
    const script = this.bossDef(boss.bossKey).phases[boss.phaseIndex]?.attacks ?? [];
    if (script.length === 0) return 1;
    return boss.attackState === 'recover' ? BOSS_EXPOSED : BOSS_ARMOURED;
  }

  private damageBoss(damage: number): void {
    const boss = this.boss;
    if (!boss || boss.state !== 'fight') return;
    const scale = this.bossDamageScale(boss);
    if (scale === 0) {
      // Say so, or a blocked hit reads as the game dropping shots.
      this.ring(boss.x, boss.y + boss.h * 0.2);
      return void sfx.play('deny');
    }
    boss.hp = Math.max(0, (boss.hp ?? boss.maxHp) - damage * scale);
    if ((boss.hp ?? 0) > 0) return void sfx.play('hit');
    sfx.play('bigExplode');

    const def = this.bossDef(boss.bossKey);
    const guardian = guardianPlanFor(this.missionDirector.currentAct?.key);
    const missionGuardian = guardian && guardian.bossKey === boss.bossKey ? guardian : null;
    this.completedBosses.add(boss.bossKey);
    this.score += def.score;
    this.special = 100;
    // A boss is worth a free pick. Killing one used to hand over score and a
    // hull point and nothing you could choose, which made the biggest fight in
    // the level the least interesting thing to finish.
    this.pendingUpgrades += BOSS_UPGRADE_REWARD;
    this.player.hp = Math.min(this.playerDef().hp, (this.player.hp ?? this.playerDef().hp) + 1);
    this.ring(boss.x, boss.y);
    this.hostileShots = [];
    this.boss = null;

    // A GUARDIAN ACT MUST ADVANCE THE MISSION, or the level stops on it.
    //
    // Only Gary did. Every other boss fell through to `bossClearClock` below,
    // which is right for the wave ladder -- there is no act to finish out there
    // -- and fatal for a boss that IS an act: the Behemoth would die, the sky
    // would empty, and the mission would sit on a completed act forever with
    // nothing left to kill.
    if (missionGuardian) {
      const isGary = missionGuardian.rewardTechKey !== null;
      let banner = missionGuardian.defeatBanner;
      if (isGary) {
        // Guarded against checkpoint-reload farming inside recordGuardianDefeated.
        const alreadyOwned = hasFogBreaker(this.progress);
        this.progress = awardGaryFogVictory(this.progress);
        this.saveProgress();
        this.fogGateActive = true;
        banner = alreadyOwned
          ? 'GARY FOG DEFEATED // FOG BREAKER READY'
          : 'BOSS TECH ACQUIRED // FOG BREAKER PULSE';
      }

      const entered = this.missionDirector.advance();
      this.wave = Math.max(1, this.missionDirector.currentActIndex + 1);
      this.earthEncounterDirector.clear();
      this.cueMusic('level1');
      this.missionBannerText = banner;
      this.missionBannerClock = 2.8;
      // Bank the act we just moved into, so dying to what follows a guardian
      // does not replay the guardian. Flight acts get this from
      // completeMissionFlightAct; a boss act never reaches that path.
      this.recordCheckpointForCurrentAct();
      // final_assault runs on the fog gate rather than on authored spawns.
      if (entered?.key !== 'final_assault') this.earthEncounterDirector.start(entered?.key ?? '');
      return;
    }

    this.bossClearClock = 2.4;
    if (!this.missionDirector.activeMission && this.completedBosses.size === BOSS_LADDER.length) this.victoryPendingClock = 2.4;
  }

  /**
   * Shields soak damage before the hull does, and they come back on their own
   * after a quiet spell — which is what makes them worth spending a level on
   * rather than just being extra hit points.
   */
  private damagePlayer(damage: number, impactX: number, impactY: number): void {
    if (this.playerHitClock > 0) return;
    this.playerHitClock = 0.55;
    sfx.play('hurt');
    this.shieldQuietClock = 0;
    this.shieldRegenClock = 0;
    this.ring(impactX, impactY);

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, damage);
      this.shield -= absorbed;
      damage -= absorbed;
      if (damage <= 0) return;
    }
    this.player.hp = (this.player.hp ?? this.playerDef().hp) - damage;
  }

  private updateShield(dt: number): void {
    if (this.shieldMax <= 0 || this.shield >= this.shieldMax) return;
    this.shieldQuietClock += dt;
    if (this.shieldQuietClock < SHIELD_REGEN_DELAY) return;
    this.shieldRegenClock += dt;
    if (this.shieldRegenClock < SHIELD_REGEN_STEP) return;
    this.shieldRegenClock = 0;
    this.shield = Math.min(this.shieldMax, this.shield + 1);
  }

  private finishRun(victory: boolean): void {
    this.progress = recordCampaignRun(this.progress, this.score, this.wave, victory);
    this.saveProgress();
    this.mode = victory ? 'victory' : 'results';
    this.paused = false;
  }

  private loadProgress(): CampaignProgress {
    return loadCampaignProgress();
  }

  private saveProgress(): void {
    saveCampaignProgress(this.progress);
  }

  /**
   * The theme song plays over the pause menu, so pausing is a music cue as much
   * as a game-state change. 'resume' sends the director back to whatever the
   * mission was playing rather than guessing a track.
   */
  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.cueMusic(paused ? 'paused' : 'resume');
  }

  private cueMusic(cue: string): void {
    window.dispatchEvent(new CustomEvent('coded:music-cue', { detail: { cue } }));
  }

  private ring(x: number, y: number): void {
    this.rings.push({ x, y, w: 1, h: 1, vx: 0, vy: 0, life: BURST_LIFE });
    this.spawnDebris(x, y);
  }

  private registerKill(drone: EnemyActor): void {
    // Clearing the screen is the skilful way out of it, so every escort taken
    // down buys real time off the shield rather than only counting down a
    // label. Three kills at SCREEN_KILL_CUT each ends a SCREEN_SECONDS screen
    // outright, which is the promise the "CLEAR N ESCORTS" prompt makes.
    if (drone.escort && this.screenClock > 0) {
      this.screenClock = Math.max(0, this.screenClock - SCREEN_KILL_CUT);
      if (this.screenClock === 0 && this.boss) this.endScreen(this.boss, false);
    }
    const def = this.enemyDef(drone.enemyKey);
    this.score += def.score;
    this.killedThisWave += 1;
    this.special = Math.min(100, this.special + 8 * this.pulsePower);
    this.kills += 1;
    this.awardXp(def.score * XP_PER_SCORE);
    this.ring(drone.x, drone.y);
    sfx.play('explode');

    if (this.kills % SHIELD_PICKUP_EVERY_KILLS === 0) this.dropPickup(PICKUPS.shield_cell, drone.x, drone.y);

    // The crate hands out a choice now, so it is worth dropping for as long as
    // ANY track can still grow -- not only while barrels are unmaxed.
    if (this.kills % UPGRADE_EVERY_KILLS === 0 && !this.allUpgradesMaxed()) {
      this.dropPickup(PICKUPS.weapon_upgrade, drone.x, drone.y);
    }

    if (this.kills % BOMB_EVERY_KILLS === 0 && this.bombs < this.maxBombs()) {
      this.dropPickup(PICKUPS.bomb, drone.x, drone.y);
    }

    if (this.kills % REPAIR_EVERY_KILLS === 0 && (this.player.hp ?? 0) < this.playerDef().hp) {
      this.dropPickup(PICKUPS.repair, drone.x, drone.y);
    }
  }

  private dropPickup(def: PickupDef, x: number, y: number, driftScale = 1): void {
    this.pickups.push({
      x,
      y,
      w: def.hitbox.w,
      h: def.hitbox.h,
      vx: 0,
      vy: def.driftSpeed * driftScale,
      pickupKey: def.key,
    });
  }

  /**
   * The resupply that falls in just before a boss opens fire.
   *
   * Reaching a boss on fumes used to be a dead end: every other drop is tied
   * to a kill count, and the run of drones ends the moment the boss spawns, so
   * whatever you limped in with was what you fought with. This guarantees a
   * shield cell and a hull patch in the seconds before the fight starts, plus
   * one random third pick, and drifts them at half speed so they are actually
   * catchable during the entrance. Lanes stay left of the button cluster --
   * a pickup you cannot reach without covering a button is not a pickup.
   */
  private dropBossResupply(): void {
    const bonus = Math.random() < 0.5 ? PICKUPS.bomb : PICKUPS.weapon_upgrade;
    const drops: PickupDef[] = [PICKUPS.shield_cell, PICKUPS.repair, bonus];
    for (let i = 0; i < drops.length; i++) {
      const lane = 0.18 + i * 0.24;
      this.dropPickup(drops[i], this.w * lane, -22 - i * 30, BOSS_RESUPPLY_DRIFT);
    }
    this.missionBannerText = 'RESUPPLY DROP // GRAB IT';
    this.missionBannerClock = 2.4;
  }

  /** Upgrade state a checkpoint carries, so continuing keeps what was earned. */
  private upgradeSnapshot(): Pick<MissionCheckpointSnapshot, 'xpLevel' | 'barrels' | 'shieldMax' | 'bombPower' | 'pulsePower'> {
    return {
      xpLevel: this.xpLevel,
      barrels: this.barrels,
      shieldMax: this.shieldMax,
      bombPower: this.bombPower,
      pulsePower: this.pulsePower,
    };
  }

  /** XP needed to reach the next level. The curve stretches as levels stack. */
  private xpForNextLevel(): number {
    return XP_LEVEL_BASE + (this.xpLevel - 1) * XP_LEVEL_STEP;
  }

  private awardXp(amount: number): void {
    if (!(amount > 0) || this.mode !== 'play') return;
    this.xp += amount;
    // A big score chunk can cross two thresholds at once; every crossing owes
    // the player a choice, so this loops rather than levelling once.
    let levelled = false;
    const gunBefore = this.currentWeapon().key;
    while (this.xp >= this.xpForNextLevel()) {
      this.xp -= this.xpForNextLevel();
      this.xpLevel += 1;
      this.pendingUpgrades += 1;
      levelled = true;
    }
    if (levelled) {
      // Every level tops the shields back up, so a hull that took a beating
      // gets something out of the level even before the card is picked.
      this.shield = this.shieldMax;
      this.shieldQuietClock = 0;
      this.shieldRegenClock = 0;
      const gunNow = this.currentWeapon();
      if (gunNow.key !== gunBefore) {
        // Crossing a weapon level hands over a whole new gun. It is announced
        // rather than offered -- there is no version of this the player declines.
        this.missionBannerText = `NEW WEAPON // ${gunNow.label}`;
        this.missionBannerClock = 3.2;
        sfx.play('levelUp');
        debugLog.log('combat', 'weapon granted', { level: this.xpLevel, weapon: gunNow.key, label: gunNow.label });
      }
    }
    debugLog.sample('xp', 1500, 'combat', 'xp', {
      xp: Math.round(this.xp),
      level: this.xpLevel,
      nextAt: Math.round(this.xpForNextLevel()),
    });
    if (levelled) {
      debugLog.log('combat', 'level up', {
        level: this.xpLevel,
        weapon: this.currentWeapon().label,
        barrels: this.barrels,
        pending: this.pendingUpgrades,
        nextAt: Math.round(this.xpForNextLevel()),
      });
    }
    if (this.pendingUpgrades > 0 && this.upgradeOffer.length === 0) this.openUpgradeChoice();
  }

  /** Upgrades with nothing left to give are not offered. */
  private upgradeAvailable(kind: UpgradeKind): boolean {
    if (kind === 'shield') return this.shieldMax < SHIELD_CAP;
    if (kind === 'bomb') return this.bombPower < BOMB_POWER_CAP;
    if (kind === 'pulse') return this.pulsePower < PULSE_POWER_CAP;
    if (kind === 'barrel') return this.barrels < MAX_BARRELS;
    return true;
  }

  /**
   * Opens the level-up choice.
   *
   * There is ALWAYS a choice on screen. This used to draw only from tracks
   * that still had something to give, so as tracks filled the card count
   * quietly shrank -- and once everything was full the level was converted to
   * score in silence and the player never saw a level-up at all. Now every
   * track shows, a finished one reads MAX and cannot be picked, and levelling
   * is always a moment you are shown rather than one that happens off screen.
   */
  private openUpgradeChoice(): void {
    const all: UpgradeKind[] = ['barrel', 'shield', 'bomb', 'pulse'];
    const open = all.filter((kind) => this.upgradeAvailable(kind));

    if (open.length === 0) {
      // Genuinely everything maxed. Still shown, still a card, still a beat.
      this.upgradeOffer = all.slice(0, UPGRADE_CHOICES);
      this.upgradeArmClock = UPGRADE_ARM_SECONDS;
      sfx.play('levelUp');
      return;
    }

    // Shuffle the open tracks, take up to the card count, then pad with maxed
    // ones so the layout does not change shape as the run goes on.
    const shuffled = [...open].sort(() => Math.random() - 0.5);
    const offer = shuffled.slice(0, UPGRADE_CHOICES);
    for (const kind of all) {
      if (offer.length >= UPGRADE_CHOICES) break;
      if (!offer.includes(kind)) offer.push(kind);
    }

    this.upgradeOffer = offer;
    this.upgradeArmClock = UPGRADE_ARM_SECONDS;
    sfx.play('levelUp');
    debugLog.log('combat', 'upgrade offer', { level: this.xpLevel, offer, pending: this.pendingUpgrades });
  }

  /** True when no track has anything left to give. */
  private allUpgradesMaxed(): boolean {
    return !(['barrel', 'shield', 'bomb', 'pulse'] as UpgradeKind[]).some((kind) => this.upgradeAvailable(kind));
  }

  private applyUpgrade(kind: UpgradeKind): void {
    if (!this.upgradeAvailable(kind)) {
      // A maxed card is on screen for completeness, not to be spent on -- but
      // if EVERY card is maxed then none of them is clickable, and refusing
      // them all would trap the player behind an overlay with no way out. In
      // that case any tap banks the level and closes.
      if (!this.allUpgradesMaxed()) return void sfx.play('deny');
      // Pay for EVERY rank being closed out, not just the one on screen.
      //
      // awardXp loops -- a single boss kill can cross two thresholds at once --
      // so pendingUpgrades is regularly greater than 1, and this used to add a
      // flat ALL_MAXED_SCORE and then set pendingUpgrades to 0. Two ranks
      // banked together paid 250 instead of 500 and the second one vanished
      // with no message. It is worst exactly where it is most likely: late in a
      // run, with every track full, killing something big.
      const banked = Math.max(1, this.pendingUpgrades);
      const reward = ALL_MAXED_SCORE * banked;
      this.score += reward;
      this.missionBannerText = banked > 1
        ? `ALL SYSTEMS MAX // ${banked} RANKS +${reward}`
        : `ALL SYSTEMS MAX // +${reward}`;
      this.missionBannerClock = 2.4;
      this.pendingUpgrades = 0;
      this.upgradeOffer = [];
      sfx.play('levelUp');
      return;
    }
    switch (kind) {
      case 'barrel':
        this.barrels = Math.min(MAX_BARRELS, this.barrels + 1);
        this.missionBannerText = `GUN // ${this.currentVolley().length} SHOT ${this.currentWeapon().label}`;
        break;
      case 'shield':
        this.shieldMax = Math.min(SHIELD_CAP, this.shieldMax + 1);
        this.shield = this.shieldMax;
        this.missionBannerText = `SHIELD // ${this.shieldMax} SEGMENTS`;
        break;
      case 'bomb':
        this.bombPower = Math.min(BOMB_POWER_CAP, this.bombPower + 0.22);
        this.bombs = Math.min(this.maxBombs(), this.bombs + 1);
        this.missionBannerText = `BOMB // BLAST +${Math.round((this.bombPower - 1) * 100)}%`;
        break;
      case 'pulse':
        this.pulsePower = Math.min(PULSE_POWER_CAP, this.pulsePower + 0.18);
        this.missionBannerText = `PULSE // FIELD +${Math.round((this.pulsePower - 1) * 100)}%`;
        break;
    }
    this.missionBannerClock = 2.4;
    debugLog.log('combat', 'upgrade taken', {
      kind,
      weaponTier: this.weaponTier(),
      shieldMax: this.shieldMax,
      bombs: `${this.bombs}/${this.maxBombs()}`,
      pulsePower: Math.round(this.pulsePower * 100) / 100,
    });
    this.pendingUpgrades = Math.max(0, this.pendingUpgrades - 1);
    this.upgradeOffer = [];
    if (this.pendingUpgrades > 0) this.openUpgradeChoice();
  }

  /** The bomb upgrade widens the rack as well as the blast. */
  private maxBombs(): number {
    return MAX_BOMBS + Math.floor((this.bombPower - 1) / 0.44);
  }

  private upgradeCards(): Array<{ kind: UpgradeKind; rect: Rect }> {
    const offer = this.upgradeOffer;
    const gap = 10;
    const w = Math.min((this.w - 32 - gap * (offer.length - 1)) / Math.max(1, offer.length), 168);
    const h = Math.min(this.h * 0.42, 118);
    const total = offer.length * w + (offer.length - 1) * gap;
    const startX = (this.w - total) / 2;
    const y = this.h * 0.5 - h * 0.42;
    return offer.map((kind, index) => ({ kind, rect: { x: startX + index * (w + gap), y, w, h } }));
  }

  /**
   * Collecting a pickup.
   *
   * Two rules hold here, and both exist because players reported "the power-up
   * did the wrong thing":
   *
   * 1. NOTHING in the field changes the gun on its own. The upgrade crate used
   *    to bolt on a barrel where it landed, so a player who had deliberately
   *    declined barrels at a level-up -- keeping a tight, aimed volley -- had
   *    the spread forced back on them mid-fight by a crate they grabbed for
   *    something else. The crate now banks an upgrade CHOICE. Every barrel the
   *    player carries is one they picked.
   * 2. Every pickup names itself on the banner. When four drops look alike, a
   *    silent effect is indistinguishable from a broken one.
   */
  private applyPickup(key: string): void {
    const def = this.pickupDef(key);
    if (!def) return;
    sfx.play('pickup');
    let banner = def.label;
    switch (def.effect) {
      case 'weapon_upgrade':
        this.pendingUpgrades += 1;
        banner = 'UPGRADE CRATE // CHOOSE';
        break;
      case 'bomb': {
        // Say so when the rack was already full. A pickup that silently does
        // nothing is the moment a player starts attributing whatever else
        // happened that second -- a level-up, a new gun -- to the pickup.
        const full = this.bombs >= this.maxBombs();
        this.bombs = Math.min(this.maxBombs(), this.bombs + 1);
        banner = full
          ? `RACK FULL // ${this.bombs}/${this.maxBombs()} BOMBS`
          : `CLARITY BOMB // ${this.bombs}/${this.maxBombs()}`;
        break;
      }
      case 'repair':
        this.player.hp = Math.min(this.playerDef().hp, (this.player.hp ?? 0) + 1);
        banner = `HULL REPAIR // ${this.player.hp}/${this.playerDef().hp}`;
        break;
      case 'shield':
        // A cell found in the field refills the bank, and raises the ceiling
        // when the bank is already full -- so shields can grow from play and
        // not only from levelling. A hull with no shield gets its first segment.
        if (this.shield >= this.shieldMax) this.shieldMax = Math.min(SHIELD_CAP, this.shieldMax + 1);
        this.shield = this.shieldMax;
        banner = `SHIELD CELL // ${this.shield}/${this.shieldMax}`;
        break;
    }
    this.missionBannerText = banner;
    this.missionBannerClock = 2.2;
    debugLog.log('combat', 'pickup', { key, effect: def.effect, barrels: this.barrels });
    if (this.pendingUpgrades > 0 && this.upgradeOffer.length === 0) this.openUpgradeChoice();
  }

  private spawnDebris(x: number, y: number): void {
    const count = DEBRIS_MIN + Math.floor(Math.random() * DEBRIS_VARY);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 170;
      const life = 0.35 + Math.random() * 0.3;
      this.debris.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life,
        max: life,
        size: 1.5 + Math.random() * 2.5,
        hue: 130 + Math.random() * 60,
      });
    }
  }

  /**
   * @param explicitCheckpoint resume from this snapshot instead of the stored one
   * @param options `fresh` restarts the mission from its first act, ignoring any save
   */
  private reset(explicitCheckpoint?: MissionCheckpointSnapshot, options?: { fresh?: boolean }): void {
    this.mode = 'play';
    this.paused = false;
    this.reportAssets = false;
    this.drones = [];
    this.hazards = [];
    this.hostileShots = [];
    this.boss = null;
    this.warship = null;
    this.warshipDirector.reset();
    this.completedBosses = new Set<string>();
    this.bolts = [];
    this.seekers = [];
    this.seekerClock = SEEKER_INTERVAL;
    this.bossSpawnClock = BOSS_PRESSURE_INTERVAL;
    this.screenClock = 0;
    this.screenCooldown = 0;
    this.warshipLaunchClock = WARSHIP_LAUNCH_INTERVAL;
    // Restart the nudge each run: a player who has never dropped a bomb still
    // has not been taught, and the timer would otherwise be spent already.
    this.bombHintClock = 0;
    this.playerFacing = -Math.PI / 2;
    this.bossFacing = Math.PI / 2;
    this.pickups = [];
    this.rings = [];
    this.debris = [];
    this.special = 100;
    this.boltClock = 0;
    this.droneClock = 0;
    this.hazardClock = DEFAULT_HAZARD.spawnRate;
    this.ringClock = 0;
    this.bombClock = 0;
    this.bossClearClock = 0;
    this.victoryPendingClock = 0;
    this.pulseHitBoss = false;
    this.playerHitClock = 0;
    this.missionBannerClock = 0;
    this.missionBannerText = '';
    this.launchClock = 0;
    this.launchTotal = 0;
    this.fogGateActive = false;
    this.fogCutClock = 0;
    this.shieldCutClock = 0;
    this.applyLoadout();

    const mission = this.missionDirector.activeMission;
    if (mission && this.activePlanetKey) {
      this.progress = this.loadProgress();
      const stored = options?.fresh ? undefined : explicitCheckpoint ?? missionCheckpointFor(this.progress, this.activePlanetKey);
      const checkpoint = stored
        && stored.missionKey === mission.key
        && stored.planetKey === this.activePlanetKey
        && mission.acts.some((act) => act.key === stored.resumeActKey)
        ? stored
        : undefined;

      if (checkpoint) {
        this.missionDirector.startAtAct(mission, checkpoint.resumeActKey);
        if (SHIPS[checkpoint.shipKey]) this.selectedShipKey = checkpoint.shipKey;
        this.barrels = clamp(checkpoint.barrels ?? 0, 0, MAX_BARRELS);
        this.bombs = Math.min(this.maxBombs(), Math.max(0, checkpoint.bombs));
        this.score = Math.max(0, checkpoint.score);
        this.kills = 0;
        // A resumed run keeps the level it had reached: losing every upgrade at
        // a checkpoint would make continuing worse than restarting.
        this.xpLevel = Math.max(1, checkpoint.xpLevel ?? 1);
        this.shieldMax = clamp(checkpoint.shieldMax ?? this.shieldMax, 0, SHIELD_CAP);
        this.shield = this.shieldMax;
        this.bombPower = Math.max(1, checkpoint.bombPower ?? 1);
        this.pulsePower = Math.max(1, checkpoint.pulsePower ?? this.pulsePower);
      } else {
        this.missionDirector.restart();
        this.applyLoadout();
        this.score = 0;
        this.kills = 0;
        if (this.missionDirector.currentAct?.key === 'deployment') this.missionDirector.advance();
      }

      this.wave = Math.max(1, this.missionDirector.currentActIndex + 1);
      this.player = this.newPlayer();
      this.cueMusic('level1');

      if (checkpoint) {
        this.earthEncounterDirector.start(this.missionDirector.currentAct?.key ?? '');
        if (this.missionDirector.currentAct?.key === 'boarding') {
          this.warshipDirector.reset();
          for (const system of REGULATORY_WARSHIP.systems) {
            if (system.key === 'shield_relay') this.warshipDirector.exposeShieldRelay();
            let guard = 0;
            while (!this.warshipDirector.allSystems.find((item) => item.key === system.key)?.destroyed && guard < 30) {
              this.warshipDirector.hit(system.key, 99);
              if (this.warshipDirector.phase === 'shield') this.warshipDirector.exposeShieldRelay();
              guard += 1;
            }
          }
          this.warship = {
            x: this.w / 2,
            y: this.bossRestY(),
            w: REGULATORY_WARSHIP.draw.w,
            h: REGULATORY_WARSHIP.draw.h,
            vx: 0,
            vy: 0,
            state: 'disabled',
            age: 0,
            fireClock: 0,
          };
        }
        this.missionBannerText = this.missionDirector.currentAct?.label ?? mission.label;
        this.missionBannerClock = 2.2;
      } else {
        this.earthEncounterDirector.clear();
        this.launchTotal = revealTotalDuration(EARTH_LAUNCH_REVEAL);
        this.launchClock = this.launchTotal;
        this.player.y = this.h + 76;
      }
      return;
    }

    this.player = this.newPlayer();
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.earthEncounterDirector.clear();
  }

  /**
   * Puts the hull's own strengths on the board. Each of the three ships leans
   * one way -- the Warden launches with shields, the Striker skips the first
   * rung of the weapon ladder, the Interceptor carries a heavier bomb rack and
   * a wider pulse -- so ship select is a real decision.
   */
  private applyLoadout(): void {
    const loadout = this.playerDef().loadout;
    this.xp = 0;
    this.xpLevel = 1;
    this.pendingUpgrades = 0;
    this.upgradeOffer = [];
    this.baseWeaponTier = clamp(loadout.weaponTier, 1, WEAPON_LADDER.length);
    this.barrels = 0;
    this.shieldMax = clamp(loadout.shield, 0, SHIELD_CAP);
    this.shield = this.shieldMax;
    this.shieldQuietClock = 0;
    this.shieldRegenClock = 0;
    this.bombPower = 1;
    this.pulsePower = loadout.pulse;
    this.bombs = Math.min(this.maxBombs(), 2 + loadout.bombs);
  }

  private newPlayer(): Actor {
    const ship = this.playerDef();
    return { x: this.w / 2, y: this.h - 112, w: ship.hitbox.w, h: ship.hitbox.h, vx: 0, vy: 0, hp: ship.hp };
  }

  private inControls(x: number, y: number): boolean {
    const zone = this.zone;
    // The assets circle only counts while its button is actually on screen.
    // Reserving the spot for an invisible button would swallow taps for no
    // visible reason.
    return inCircle(zone.pause, x, y) || inCircle(zone.bomb, x, y) || inCircle(zone.special, x, y)
      || (this.diagnostics && inCircle(zone.assets, x, y));
  }

  private enemyDef(key: string): EnemyDef {
    return EARTH_ENEMIES[key] ?? ENEMIES[key] ?? DEFAULT_ENEMY;
  }

  private hazardDef(key: string): HazardDef {
    return EARTH_HAZARDS[key] ?? HAZARDS[key] ?? DEFAULT_HAZARD;
  }

  private bossDef(key: string): BossDef {
    return BOSSES[key] ?? BOSSES.gary_fog;
  }

  private playerDef() {
    return SHIPS[this.selectedShipKey] ?? DEFAULT_SHIP;
  }

  private shipCards(): Array<{ key: string; rect: Rect }> {
    const keys = Object.keys(SHIPS);
    const w = Math.min(this.w - 32, 430);
    // The card stack has to fit between the heading and the tap prompt. A fixed
    // 68px card overflowed a short landscape screen, pushing the last ship
    // entirely off the bottom where it could not be seen or chosen.
    const top = 84;
    const bottom = this.h - 52;
    const available = Math.max(60, bottom - top);
    const gap = available > 200 ? 12 : 7;
    const h = clamp((available - gap * (keys.length - 1)) / keys.length, 34, 68);
    const total = keys.length * h + (keys.length - 1) * gap;
    const startY = Math.max(top, top + (available - total) / 2);
    return keys.map((key, index) => ({ key, rect: { x: (this.w - w) / 2, y: startY + index * (h + gap), w, h } }));
  }

  private selectShipAt(x: number, y: number): void {
    const selected = this.shipCards().find((card) => inside(card.rect, x, y));
    if (!selected) return;
    this.selectedShipKey = selected.key;
    this.reset();
  }

  /**
   * Which gun the hull is holding.
   *
   * Derived from the level rather than stored, which is the point: a stored
   * tier can drift out of range and silently fall back to the first gun, and a
   * player who reaches CLARITY LANCE and then sees BB SHOT again has no way to
   * tell a bug from a rule. There is nothing to desync here.
   */
  private weaponTier(): number {
    let tier = this.baseWeaponTier;
    for (const at of WEAPON_TIER_LEVELS) if (this.xpLevel >= at) tier += 1;
    return clamp(tier, 1, WEAPON_LADDER.length);
  }

  private currentWeapon(): WeaponDef {
    return WEAPON_LADDER[this.weaponTier() - 1] ?? WEAPON_LADDER[0];
  }

  /**
   * The volley actually fired: the gun's own shots plus any bolted-on barrels.
   *
   * Pickups add barrels to whatever gun is equipped rather than advancing the
   * ladder, so drops still matter between levels without short-cutting the
   * ladder itself. Extra barrels alternate outward from the widest existing
   * one, angled slightly so a wide volley still converges.
   */
  /**
   * The gun as it currently fires: the weapon's own shots plus bolted-on
   * barrels.
   *
   * Barrels add in PAIRS. They used to be appended one at a time alternating
   * sides, so a four-beam gun with one barrel fired
   * `-13, -5, 5, 13, -22` -- four symmetric beams and a single extra hanging
   * off the left. It looked broken because it was: the muzzle flashes were no
   * longer symmetric about the nose.
   *
   * The old loop also wasted barrels. It stopped at MAX_VOLLEY mid-pair, so a
   * quad gun capped at two barrels and the third bought nothing at all.
   */
  /**
   * A drone's health for the loadout facing it.
   *
   * Trash only gets ENEMY_SCALE_SHARE of the curve. At full scale a 2hp drone
   * would take 18 hits, which is a sponge rather than a threat; a maxed gun
   * should still delete one. The rest of the pressure comes from more of them,
   * arriving faster.
   */
  private enemyHp(def: EnemyDef): number {
    const scaled = def.hp * (1 - ENEMY_SCALE_SHARE + ENEMY_SCALE_SHARE * this.pressureScale());
    return Math.max(1, Math.round(scaled));
  }

  /** Mines and turrets are shot at too, so they ride the same curve. */
  private hazardHp(def: HazardDef): number {
    const scaled = def.hp * (1 - ENEMY_SCALE_SHARE + ENEMY_SCALE_SHARE * this.pressureScale());
    return Math.max(1, Math.round(scaled));
  }

  /** A drone's speed, which climbs with the wave and with the gun facing it. */
  private enemySpeed(def: EnemyDef): number {
    return def.baseSpeed + this.wave * 7 + (this.pressureScale() - 1) * ENEMY_SPEED_PER_SCALE;
  }

  /**
   * How hard the game is pushing right now, on a 1..PRESSURE_CAP curve.
   *
   * Reads the RUN and nothing else. It must never consult the weapon, the
   * volley, the barrel count or any pickup -- that coupling is the bug this
   * replaced, and validate-difficulty fails if any of those names appear in
   * this method.
   */
  private pressureScale(): number {
    const fromWaves = (this.wave - 1) * PRESSURE_PER_WAVE;
    const fromTime = (this.clock / 60) * PRESSURE_PER_MINUTE;
    return clamp(1 + fromWaves + fromTime, 1, PRESSURE_CAP);
  }

  /** Sustained damage per second this loadout puts out. */
  private playerDps(): number {
    const weapon = this.currentWeapon();
    return (this.currentVolley().length * weapon.damage) / weapon.fireRate;
  }

  /**
   * The boss snapshot. Sampled at spawn and never again.
   *
   * Only `startBossIfReady` and the Gary Fog entrance may call this. Anything
   * that reads it per-frame is back to handing the player's upgrade straight
   * back as hit points.
   */
  private loadoutScale(): number {
    return clamp(this.playerDps() / BASE_PLAYER_DPS, 1, FIREPOWER_CAP);
  }

  private currentVolley(): WeaponShotDef[] {
    const weapon = this.currentWeapon();
    if (this.barrels <= 0) return weapon.shots;
    const shots = [...weapon.shots];
    const widest = Math.max(...weapon.shots.map((shot) => Math.abs(shot.offsetX)), 0);

    // On an even gun the FIRST barrel goes down the middle; the rest go on in
    // pairs.
    //
    // "When you get 5 the sixth makes the auto cannon split into 2 rows of 3.
    // It loses power and doesn't hit anything in the middle of the fire
    // pattern." Both halves were true and they were one fault. Pairs-only kept
    // the gun symmetric but could never fill the centre, so a four-beam gun
    // plus a barrel fired -26,-17,-6,6,17,26: three each side, and the widest
    // gap in the whole pattern sitting exactly where you are aiming.
    //
    // It also meant an even gun could never reach MAX_VOLLEY. Seven is odd and
    // pairs move in twos, so QUAD stopped at six and the seventh slot was
    // unreachable -- measured, its second and third barrel pickups bought
    // nothing at all. The centre beam is what makes that last slot spendable,
    // which is why one rule fixes the hole and the dead pickups together.
    let pairs = this.barrels;
    if (!weapon.shots.some((shot) => shot.offsetX === 0) && shots.length < MAX_VOLLEY) {
      shots.push({ offsetX: 0, angle: 0 });
      pairs -= 1;
    }
    for (let pair = 1; pair <= pairs; pair += 1) {
      // A pair goes on together or not at all, so the gun stays symmetric.
      if (shots.length + 2 > MAX_VOLLEY) break;
      // Parallel, not fanned. Barrels used to angle outward 0.045rad per pair,
      // and an angle becomes width over distance: on a 780px portrait screen a
      // three-barrel gun swept 75% of the whole width by the time its shots
      // reached the top, so there was nothing to aim at and nothing to do but
      // slide side to side. The same gun covered 40% on the short landscape
      // screen, which is why this only showed up in portrait.
      //
      // A barrel adds a BEAM, and now so does every rung of the ladder: the
      // last fanning gun (TRI-SPREAD, +/-0.18rad) is gone. Nothing the player
      // can equip sprays any more -- the volley that leaves the muzzle is the
      // volley that reaches the target.
      const offset = widest + 9 * pair;
      shots.push({ offsetX: -offset, angle: 0 });
      shots.push({ offsetX: offset, angle: 0 });
    }
    return shots;
  }

  private projectileDef(key: string): ProjectileDef {
    return PROJECTILES[key] ?? PROJECTILES.bb_shot;
  }

  /**
   * No fallback. This used to return PICKUPS.weapon_upgrade for any key it did
   * not recognise, which meant a typo or a stale save turned some other drop
   * into a free barrel -- the gun changing on a pickup that was never a gun
   * pickup. An unknown key is now nothing at all, loudly, in the debug log.
   */
  private pickupDef(key: string): PickupDef | null {
    const def = PICKUPS[key];
    if (!def) debugLog.log('combat', 'unknown pickup key', { key });
    return def ?? null;
  }

  private currentStage(): StageDef {
    const missionStageKey = this.earthEncounterDirector.stageKey;
    if (this.missionDirector.activeMission && missionStageKey && STAGES[missionStageKey]) return STAGES[missionStageKey];
    // A guardian act has no authored encounter, so it reaches here with no
    // stageKey. Falling on through lands it on the WAVE ladder, which put the
    // Behemoth and the Destroyer in `data_canyon` -- a location Level 1 never
    // visits -- for the length of each fight.
    //
    // This replaces a hand-written `gary_fog` branch rather than adding two
    // more beside it. Every guardian carries the stage of the act it follows,
    // Gary's included, so his behaviour is unchanged and the next act inserted
    // without a stage is a gate failure instead of a silent wrong background.
    if (this.missionDirector.activeMission) {
      const guardianStage = guardianPlanFor(this.missionDirector.currentAct?.key)?.stageKey;
      if (guardianStage && STAGES[guardianStage]) return STAGES[guardianStage];
    }
    if (this.missionDirector.activeMission && ['regulatory_warship', 'boarding'].includes(this.missionDirector.currentAct?.key ?? '')) return STAGES.regulatory_outpost;
    for (let index = STAGE_LADDER.length - 1; index >= 0; index -= 1) {
      if (STAGE_LADDER[index].minWave <= this.wave) return STAGE_LADDER[index];
    }
    return STAGE_LADDER[0];
  }
}

/** Trim a label with an ellipsis so it never spills out of its box. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function box(actor: Actor, scale: number): Rect {
  return { x: actor.x - (actor.w * scale) / 2, y: actor.y - (actor.h * scale) / 2, w: actor.w * scale, h: actor.h * scale };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Circular hit test with a few px of thumb forgiveness past the drawn edge. */
/**
 * Rotate `from` toward `to` by at most `step`, taking the shortest way round.
 * Exported so the duel's turning can be tested directly: the wrap-around is
 * exactly the part that is easy to get wrong and invisible in a screenshot.
 */
export function turnToward(from: number, to: number, step: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + clamp(delta, -step, step);
}

/** True on the ?log / ?debug routes, where the developer panels belong. */
function hasDiagnosticsFlag(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    return params.has('log') || params.has('debug');
  } catch {
    return false;
  }
}

function inCircle(circle: { cx: number; cy: number; r: number }, x: number, y: number): boolean {
  return Math.hypot(x - circle.cx, y - circle.cy) <= circle.r + 6;
}

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string): void {
  ctx.strokeStyle = 'rgba(216,255,232,0.55)';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.min(1, pct)) * (w - 2), h - 2);
}
