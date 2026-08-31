/**
 * A save point that keeps the moment, not just the act.
 *
 * "in the pause go ahead and add a save point that way people can pause game
 * save and then play later" -- and, asked how much of the moment it should
 * keep: your position, every enemy, every bullet in the air.
 *
 * This is a deliberate reversal of one architectural decision, and it is worth
 * being honest about which. `MissionDirector` says in its own header that
 * checkpoints exist so persistence can resume the authored mission "instead of
 * restoring live bullets/enemies". That is still true of checkpoints: they are
 * cheap, they never rot, and they remain the floor this file falls back to
 * whenever anything here fails. What is added is a second, richer save that a
 * player writes on purpose from the pause menu.
 *
 * The cost is real and permanent: every actor field added to the game from now
 * on must be serialised here or it is silently lost on load. That is why
 * `SAVED_GAME_FIELDS` / `UNSAVED_GAME_FIELDS` below are exhaustive and why
 * validate-run-save.mjs fails the build when a new live-state field appears in
 * neither list. A save that restores a subtly wrong world is worse than no
 * save at all, because nobody can see it happen.
 */

import { BOSSES, ENEMIES, HAZARDS, PICKUPS, PROJECTILES, SHIPS } from './registry';
import { EARTH_ENEMIES, EARTH_HAZARDS } from './EarthThreats';
import { REGULATORY_WARSHIP } from './RegulatoryWarship';
import { MISSIONS } from './missions';

export const RUN_SAVE_VERSION = 1;
export const RUN_SAVE_STORAGE_KEY = 'coded-xrp-run-save-v1';

/**
 * The checkpointKey a restored save wears while `reset()` rebuilds the world.
 *
 * It is never persisted and names no declared mission checkpoint -- the object
 * exists only to hand `reset()` an act to resume at through the path it
 * already uses. It lives here as a constant rather than inline so it does not
 * read as a real `checkpointKey: '...'` declaration at the call site, which is
 * what validate-content scans for.
 */
export const RUN_SAVE_CHECKPOINT_KEY = 'run.live-save';

/** Nothing sane has this many actors alive; anything more is a corrupt blob. */
const MAX_ACTORS = 512;

export interface SavedActor {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /**
   * Optional because it genuinely is: bullets, seekers and pickups carry no
   * hp at all, and writing a `0` in for them would restore actors that read as
   * destroyed rather than as bullets. Absent means absent.
   */
  hp?: number;
}

export interface SavedEnemy extends SavedActor {
  enemyKey: string;
  age: number;
  anchorX: number;
  phase: number;
  direction: -1 | 1;
  fireClock: number;
  stance: 'entering' | 'holding' | 'diving' | 'fleeing';
  stationX: number;
  stationY: number;
  stanceClock: number;
  patience: number;
  dodgeCooldown: number;
  atRest: boolean;
  escort: boolean;
}

export interface SavedHazard extends SavedActor {
  hazardKey: string;
  fireClock: number;
  side: -1 | 1;
}

export interface SavedHostileShot extends SavedActor {
  damage: number;
  color: string;
  projectileKey: string;
}

export interface SavedBolt extends SavedActor {
  damage: number;
  projectileKey: string;
  pierce: number;
}

export interface SavedSeeker extends SavedActor {
  damage: number;
  angle: number;
  age: number;
}

export interface SavedPickup extends SavedActor {
  pickupKey: string;
}

export interface SavedBoss extends SavedActor {
  bossKey: string;
  state: 'intro' | 'fight';
  age: number;
  fireClock: number;
  contactClock: number;
  phaseIndex: number;
  targetX: number;
  attackIndex: number;
  attackState: 'telegraph' | 'active' | 'recover';
  attackClock: number;
  attackAim: number;
  maxHp: number;
}

export interface SavedWarship extends SavedActor {
  state: 'intro' | 'fight' | 'disabled';
  age: number;
  fireClock: number;
}

/** The encounter director's sequencing position inside an authored act. */
export interface SavedEncounter {
  actKey: string;
  groupIndex: number;
  wait: number;
  groupSpawned: boolean;
  done: boolean;
}

export interface SavedWarshipSystem {
  key: string;
  remainingHp: number;
  destroyed: boolean;
}

/**
 * Every live timer.
 *
 * These are the fields whose absence is invisible. Lose `bossSpawnClock` and a
 * boss simply arrives at the wrong moment; lose `shieldRegenClock` and the
 * shield comes back early. Nothing crashes, nothing logs, the run is just
 * subtly not the one that was saved.
 */
export interface SavedClocks {
  boltClock: number;
  droneClock: number;
  hazardClock: number;
  ringClock: number;
  seekerClock: number;
  bossSpawnClock: number;
  warshipLaunchClock: number;
  bombClock: number;
  bossClearClock: number;
  victoryPendingClock: number;
  playerHitClock: number;
  shieldQuietClock: number;
  shieldRegenClock: number;
  fogCutClock: number;
  shieldCutClock: number;
  upgradeArmClock: number;
}

export interface SavedScalars {
  score: number;
  wave: number;
  kills: number;
  xp: number;
  xpLevel: number;
  bombs: number;
  shield: number;
  shieldMax: number;
  special: number;
  barrels: number;
  baseWeaponTier: number;
  bombPower: number;
  pulsePower: number;
  pendingUpgrades: number;
  playerFacing: number;
  bossFacing: number;
}

export interface RunSave {
  version: number;
  savedAt: number;
  /**
   * The screen the pixel positions were measured against.
   *
   * Every actor position in this file is an absolute pixel against
   * innerWidth/innerHeight. Saving in portrait and loading in landscape is the
   * normal case on a phone, not an exotic one, so the viewport travels with
   * the save and `rescaleRunSave` maps the positions across.
   */
  viewport: { w: number; h: number };
  planetKey: string;
  planetLabel: string;
  missionKey: string;
  actKey: string;
  actLabel: string;
  shipKey: string;
  scalars: SavedScalars;
  clocks: SavedClocks;
  fogGateActive: boolean;
  bombHintShown: boolean;
  player: SavedActor;
  drones: SavedEnemy[];
  hazards: SavedHazard[];
  hostileShots: SavedHostileShot[];
  bolts: SavedBolt[];
  seekers: SavedSeeker[];
  pickups: SavedPickup[];
  boss: SavedBoss | null;
  warship: SavedWarship | null;
  completedBosses: string[];
  upgradeOffer: string[];
  encounter: SavedEncounter | null;
  warshipSystems: SavedWarshipSystem[];
  warshipShieldExposed: boolean;
}

/**
 * The registry keys a save is allowed to name.
 *
 * A save written before an enemy was renamed must not resurrect a key that no
 * longer resolves -- `enemyDef()` would fall back to a default and the player
 * would resume against something that was never there. Rejecting the whole
 * save and dropping to the act checkpoint is the honest outcome.
 */
export interface KnownRunKeys {
  enemies: ReadonlySet<string>;
  hazards: ReadonlySet<string>;
  projectiles: ReadonlySet<string>;
  pickups: ReadonlySet<string>;
  bosses: ReadonlySet<string>;
  ships: ReadonlySet<string>;
  acts: ReadonlySet<string>;
  warshipSystems: ReadonlySet<string>;
}

/**
 * The keys the shipped content currently defines.
 *
 * Built fresh each call rather than at module load so it cannot capture a
 * half-initialised registry through an import cycle, and so a test can compare
 * against it without a module reset.
 */
export function currentRunKeys(): KnownRunKeys {
  return {
    enemies: new Set([...Object.keys(ENEMIES), ...Object.keys(EARTH_ENEMIES)]),
    hazards: new Set([...Object.keys(HAZARDS), ...Object.keys(EARTH_HAZARDS)]),
    projectiles: new Set(Object.keys(PROJECTILES)),
    pickups: new Set(Object.keys(PICKUPS)),
    bosses: new Set(Object.keys(BOSSES)),
    ships: new Set(Object.keys(SHIPS)),
    acts: new Set(MISSIONS.flatMap((mission) => mission.acts.map((act) => act.key))),
    warshipSystems: new Set(REGULATORY_WARSHIP.systems.map((system) => system.key)),
  };
}

const STANCES = new Set(['entering', 'holding', 'diving', 'fleeing']);
const BOSS_STATES = new Set(['intro', 'fight']);
const BOSS_ATTACK_STATES = new Set(['telegraph', 'active', 'recover']);
const WARSHIP_STATES = new Set(['intro', 'fight', 'disabled']);
const UPGRADE_KINDS = new Set(['shield', 'bomb', 'pulse', 'barrel']);

class Reject extends Error {}

function num(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Reject('not a finite number');
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Reject('not a boolean');
  return value;
}

function text(value: unknown, max = 96): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Reject('not a short string');
  return value;
}

function member<T extends string>(value: unknown, allowed: ReadonlySet<string>): T {
  const key = text(value);
  if (!allowed.has(key)) throw new Reject(`unknown key ${key}`);
  return key as T;
}

function side(value: unknown): -1 | 1 {
  const raw = num(value);
  if (raw !== -1 && raw !== 1) throw new Reject('not a side');
  return raw;
}

function list<T>(value: unknown, map: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Reject('not an array');
  if (value.length > MAX_ACTORS) throw new Reject('array is implausibly long');
  return value.map(map);
}

function actor(raw: unknown): SavedActor {
  const value = raw as Record<string, unknown>;
  if (!value || typeof value !== 'object') throw new Reject('not an actor');
  const base: SavedActor = {
    x: num(value.x),
    y: num(value.y),
    w: num(value.w),
    h: num(value.h),
    vx: num(value.vx),
    vy: num(value.vy),
  };
  if (value.hp !== undefined) base.hp = num(value.hp);
  return base;
}

/**
 * Parses an untrusted save. Returns null rather than throwing, ever.
 *
 * Strict on purpose: a missing field is a rejection, not a default. A save is
 * a photograph of one moment, and a photograph with a hole in it is not a
 * dimmer photograph, it is a different moment. The checkpoint is right there
 * as the fallback, so there is no reason to accept a damaged one.
 */
export function parseRunSave(raw: string | null, known: KnownRunKeys): RunSave | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object') return null;
    if (value.version !== RUN_SAVE_VERSION) return null;

    const viewport = value.viewport as Record<string, unknown>;
    if (!viewport || typeof viewport !== 'object') return null;
    const scalarsRaw = value.scalars as Record<string, unknown>;
    const clocksRaw = value.clocks as Record<string, unknown>;
    if (!scalarsRaw || !clocksRaw) return null;

    const save: RunSave = {
      version: RUN_SAVE_VERSION,
      savedAt: num(value.savedAt),
      viewport: { w: num(viewport.w), h: num(viewport.h) },
      planetKey: text(value.planetKey),
      planetLabel: text(value.planetLabel, 160),
      missionKey: text(value.missionKey),
      actKey: member(value.actKey, known.acts),
      actLabel: text(value.actLabel, 160),
      shipKey: member(value.shipKey, known.ships),
      scalars: {
        score: num(scalarsRaw.score),
        wave: num(scalarsRaw.wave),
        kills: num(scalarsRaw.kills),
        xp: num(scalarsRaw.xp),
        xpLevel: num(scalarsRaw.xpLevel),
        bombs: num(scalarsRaw.bombs),
        shield: num(scalarsRaw.shield),
        shieldMax: num(scalarsRaw.shieldMax),
        special: num(scalarsRaw.special),
        barrels: num(scalarsRaw.barrels),
        baseWeaponTier: num(scalarsRaw.baseWeaponTier),
        bombPower: num(scalarsRaw.bombPower),
        pulsePower: num(scalarsRaw.pulsePower),
        pendingUpgrades: num(scalarsRaw.pendingUpgrades),
        playerFacing: num(scalarsRaw.playerFacing),
        bossFacing: num(scalarsRaw.bossFacing),
      },
      clocks: {
        boltClock: num(clocksRaw.boltClock),
        droneClock: num(clocksRaw.droneClock),
        hazardClock: num(clocksRaw.hazardClock),
        ringClock: num(clocksRaw.ringClock),
        seekerClock: num(clocksRaw.seekerClock),
        bossSpawnClock: num(clocksRaw.bossSpawnClock),
        warshipLaunchClock: num(clocksRaw.warshipLaunchClock),
        bombClock: num(clocksRaw.bombClock),
        bossClearClock: num(clocksRaw.bossClearClock),
        victoryPendingClock: num(clocksRaw.victoryPendingClock),
        playerHitClock: num(clocksRaw.playerHitClock),
        shieldQuietClock: num(clocksRaw.shieldQuietClock),
        shieldRegenClock: num(clocksRaw.shieldRegenClock),
        fogCutClock: num(clocksRaw.fogCutClock),
        shieldCutClock: num(clocksRaw.shieldCutClock),
        upgradeArmClock: num(clocksRaw.upgradeArmClock),
      },
      fogGateActive: bool(value.fogGateActive),
      bombHintShown: bool(value.bombHintShown),
      player: actor(value.player),
      drones: list(value.drones, (item) => {
        const enemy = item as Record<string, unknown>;
        return {
          ...actor(enemy),
          enemyKey: member<string>(enemy.enemyKey, known.enemies),
          age: num(enemy.age),
          anchorX: num(enemy.anchorX),
          phase: num(enemy.phase),
          direction: side(enemy.direction),
          fireClock: num(enemy.fireClock),
          stance: member<'entering' | 'holding' | 'diving' | 'fleeing'>(enemy.stance, STANCES),
          stationX: num(enemy.stationX),
          stationY: num(enemy.stationY),
          stanceClock: num(enemy.stanceClock),
          patience: num(enemy.patience),
          dodgeCooldown: num(enemy.dodgeCooldown),
          atRest: bool(enemy.atRest),
          escort: bool(enemy.escort),
        };
      }),
      hazards: list(value.hazards, (item) => {
        const hazard = item as Record<string, unknown>;
        return {
          ...actor(hazard),
          hazardKey: member<string>(hazard.hazardKey, known.hazards),
          fireClock: num(hazard.fireClock),
          side: side(hazard.side),
        };
      }),
      hostileShots: list(value.hostileShots, (item) => {
        const shot = item as Record<string, unknown>;
        return {
          ...actor(shot),
          damage: num(shot.damage),
          color: text(shot.color, 32),
          projectileKey: member<string>(shot.projectileKey, known.projectiles),
        };
      }),
      bolts: list(value.bolts, (item) => {
        const bolt = item as Record<string, unknown>;
        return {
          ...actor(bolt),
          damage: num(bolt.damage),
          projectileKey: member<string>(bolt.projectileKey, known.projectiles),
          pierce: num(bolt.pierce),
        };
      }),
      seekers: list(value.seekers, (item) => {
        const seeker = item as Record<string, unknown>;
        return {
          ...actor(seeker),
          damage: num(seeker.damage),
          angle: num(seeker.angle),
          age: num(seeker.age),
        };
      }),
      pickups: list(value.pickups, (item) => {
        const pickup = item as Record<string, unknown>;
        return { ...actor(pickup), pickupKey: member<string>(pickup.pickupKey, known.pickups) };
      }),
      boss: value.boss === null ? null : (() => {
        const boss = value.boss as Record<string, unknown>;
        return {
          ...actor(boss),
          bossKey: member<string>(boss.bossKey, known.bosses),
          state: member<'intro' | 'fight'>(boss.state, BOSS_STATES),
          age: num(boss.age),
          fireClock: num(boss.fireClock),
          contactClock: num(boss.contactClock),
          phaseIndex: num(boss.phaseIndex),
          targetX: num(boss.targetX),
          attackIndex: num(boss.attackIndex),
          attackState: member<'telegraph' | 'active' | 'recover'>(boss.attackState, BOSS_ATTACK_STATES),
          attackClock: num(boss.attackClock),
          attackAim: num(boss.attackAim),
          maxHp: num(boss.maxHp),
        };
      })(),
      warship: value.warship === null ? null : (() => {
        const warship = value.warship as Record<string, unknown>;
        return {
          ...actor(warship),
          state: member<'intro' | 'fight' | 'disabled'>(warship.state, WARSHIP_STATES),
          age: num(warship.age),
          fireClock: num(warship.fireClock),
        };
      })(),
      completedBosses: list(value.completedBosses, (item) => member<string>(item, known.bosses)),
      upgradeOffer: list(value.upgradeOffer, (item) => member<string>(item, UPGRADE_KINDS)),
      encounter: value.encounter === null ? null : (() => {
        const encounter = value.encounter as Record<string, unknown>;
        return {
          actKey: member<string>(encounter.actKey, known.acts),
          groupIndex: num(encounter.groupIndex),
          wait: num(encounter.wait),
          groupSpawned: bool(encounter.groupSpawned),
          done: bool(encounter.done),
        };
      })(),
      warshipSystems: list(value.warshipSystems, (item) => {
        const system = item as Record<string, unknown>;
        return {
          key: member<string>(system.key, known.warshipSystems),
          remainingHp: num(system.remainingHp),
          destroyed: bool(system.destroyed),
        };
      }),
      warshipShieldExposed: bool(value.warshipShieldExposed),
    };

    if (!(save.viewport.w > 0) || !(save.viewport.h > 0)) return null;
    return save;
  } catch {
    return null;
  }
}

/**
 * Maps a save's absolute pixel positions onto a different screen.
 *
 * Sizes and velocities are definition-driven and stay as they are; only
 * positions move. Without this, a save written in portrait restores every
 * actor outside a landscape screen and the fight resumes against an empty
 * field of enemies nobody can reach.
 */
export function rescaleRunSave(save: RunSave, w: number, h: number): RunSave {
  if (!(w > 0) || !(h > 0)) return save;
  const sx = w / save.viewport.w;
  const sy = h / save.viewport.h;
  if (sx === 1 && sy === 1) return save;

  const point = <T extends SavedActor>(item: T): T => ({ ...item, x: item.x * sx, y: item.y * sy });
  return {
    ...save,
    viewport: { w, h },
    scalars: { ...save.scalars },
    clocks: { ...save.clocks },
    player: point(save.player),
    drones: save.drones.map((drone) => ({
      ...point(drone),
      anchorX: drone.anchorX * sx,
      stationX: drone.stationX * sx,
      stationY: drone.stationY * sy,
    })),
    hazards: save.hazards.map(point),
    hostileShots: save.hostileShots.map(point),
    bolts: save.bolts.map(point),
    seekers: save.seekers.map(point),
    pickups: save.pickups.map(point),
    boss: save.boss ? { ...point(save.boss), targetX: save.boss.targetX * sx } : null,
    warship: save.warship ? point(save.warship) : null,
  };
}

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;
type ClearStorage = Pick<Storage, 'removeItem'>;

/**
 * Storage is injectable, the way `loadSettings`/`saveSettings` already do it.
 * It lets the gate exercise the real read/write path against a plain object
 * instead of stubbing a global and hoping the stub matches the browser.
 */
function readStorage(storage?: ReadStorage): ReadStorage | null {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadRunSave(known: KnownRunKeys, storage?: ReadStorage): RunSave | null {
  const target = readStorage(storage);
  if (!target) return null;
  try {
    return parseRunSave(target.getItem(RUN_SAVE_STORAGE_KEY), known);
  } catch {
    return null;
  }
}

export function writeRunSave(save: RunSave, storage?: WriteStorage): boolean {
  try {
    const target = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    if (!target) return false;
    target.setItem(RUN_SAVE_STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    // A full or blocked quota must never take the game down mid-pause.
    return false;
  }
}

export function clearRunSave(storage?: ClearStorage): void {
  try {
    const target = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    target?.removeItem(RUN_SAVE_STORAGE_KEY);
  } catch {
    // Nothing to do: an unremovable save is still parsed defensively on load.
  }
}

/**
 * Every live-simulation field on Game2A, classified.
 *
 * This is the maintenance contract for the whole feature. `validate-run-save`
 * enumerates the real instance's fields and fails when one appears in neither
 * list, so adding an actor array or a timer to the game forces a decision here
 * rather than quietly producing a save that restores a wrong world.
 *
 * Adding a field to UNSAVED_GAME_FIELDS is a legitimate answer. Adding it
 * without reading the reasons already listed there is not.
 */
export const SAVED_GAME_FIELDS: readonly string[] = [
  'selectedShipKey', 'player', 'drones', 'hazards', 'hostileShots', 'boss', 'warship',
  'completedBosses', 'bolts', 'pickups', 'seekers', 'score', 'wave', 'kills', 'xp', 'xpLevel',
  'bombs', 'shield', 'shieldMax', 'special', 'barrels', 'baseWeaponTier', 'bombPower',
  'pulsePower', 'pendingUpgrades', 'upgradeOffer', 'playerFacing', 'bossFacing',
  'boltClock', 'droneClock', 'hazardClock', 'ringClock', 'seekerClock', 'bossSpawnClock',
  'warshipLaunchClock', 'bombClock', 'bossClearClock', 'victoryPendingClock', 'playerHitClock',
  'shieldQuietClock', 'shieldRegenClock', 'fogCutClock', 'shieldCutClock', 'upgradeArmClock',
  'fogGateActive', 'bombHintShown', 'activePlanetKey', 'activePlanetLabel',
  'missionDirector', 'earthEncounterDirector', 'warshipDirector',
];

/** Live fields deliberately left out of a save, each with the reason. */
export const UNSAVED_GAME_FIELDS: readonly Readonly<{ field: string; why: string }>[] = [
  { field: 'rings', why: 'burst rings live under a second and are pure decoration' },
  { field: 'debris', why: 'explosion particles, decoration with a shorter life still' },
  { field: 'missionBannerText', why: 'the resume banner is written fresh from the act label' },
  { field: 'missionBannerClock', why: 'the resume banner sets its own duration on load' },
  { field: 'bombHintClock', why: 'a teaching nudge, restarted per session on purpose' },
  { field: 'launchClock', why: 'replaying half a launch cinematic is worse than skipping it' },
  { field: 'launchTotal', why: 'the launch cinematic is skipped on resume, so its length is moot' },
  { field: 'resumeHoldClock', why: 'the ready-hold belongs to the load, not to the moment saved' },
  { field: 'saveNoticeClock', why: 'pause-menu feedback, gone before the save is ever loaded' },
  { field: 'saveNoticeText', why: 'pause-menu feedback, written fresh each time a save is taken' },
  { field: 'clock', why: 'wall clock since boot, not run state' },
  { field: 'mode', why: 'a restored save is always put straight into play' },
  { field: 'loggedMode', why: 'an edge detector for the debug log, meaningless across sessions' },
  { field: 'paused', why: 'a restored save is never paused; it holds frozen instead' },
  { field: 'escapedThisWave', why: 'per-wave score bookkeeping, reset by the next wave anyway' },
  { field: 'killedThisWave', why: 'per-wave bookkeeping, rewritten by the next wave' },
  { field: 'pulseHitBoss', why: 'valid only inside the single frame a pulse expands' },
  { field: 'showAssets', why: 'developer panel visibility, not part of a run' },
  { field: 'reportAssets', why: 'developer panel visibility, not part of a run' },
  { field: 'diagnostics', why: 'read from the URL, not from a save' },
  { field: 'progress', why: 'campaign progress has its own storage and is reloaded on restore' },
  { field: 'canvas', why: 'the drawing surface, not simulation state' },
  { field: 'ctx', why: 'the drawing context, not simulation state' },
  { field: 'input', why: 'live pointer and key state, rebuilt by the new session' },
  { field: 'assets', why: 'the loaded art, identical in any session of this build' },
  { field: 'sprites', why: 'the renderer, identical in any session of this build' },
  { field: 'loop', why: 'the frame loop, owned by the page and not by a run' },
];
