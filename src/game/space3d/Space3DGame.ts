import { AssetLoader } from '../core/AssetLoader';
import { Loop } from '../core/Loop';
import { SpriteRenderer } from '../core/Sprite';
import { sfx } from '../audio/Sfx';
import { debugLog } from '../core/DebugLog';
import { Cockpit, type CockpitButtonId, type CockpitContact, type CockpitLock, type CockpitState } from './Cockpit';
import { TiltSource } from './Tilt';
import {
  DEFAULT_SETTINGS,
  TILT_SCALE_BY_SENSITIVITY,
  loadSettings,
  nextSensitivity,
  saveSettings,
  type TransitSettings,
} from './Settings';
import {
  FAR_PLANE,
  NEAR_PLANE,
  bearing,
  depthAlpha,
  forward,
  interceptTime,
  onScreen,
  project,
  rangeTo,
  screenSize,
  sortByDepth,
  toView,
  wrapAngle,
  type Camera,
} from './Projection';
import { LEDGER_TRANSIT, type EngagePattern, type SpaceLeg, type SpaceSquadron } from './SpaceLane';
import {
  armourMultiplier,
  blindSidePoint,
  classForSprite,
  engagementSlots,
  isBeingChased,
  shouldBreakOff,
  shouldReAttack,
  type AiState,
  type Combatant,
  type ShipClass,
  type SquadronView,
} from './Combat';

/**
 * The transit leg: open space, flown from the cockpit of the stolen warship.
 *
 * The on-foot interior asked a phone to do platforming with a thumb and it did
 * not work. This is the other half of the answer, and it is a whole level: at
 * the end of the previous mission you take the Regulatory Warship, and this is
 * you flying it to the next planet with its own navy trying to get it back.
 *
 * OPEN SPACE, NOT A LANE. There is no up and no down out here. The camera has
 * a real heading and elevation, you can turn all the way around, and contacts
 * live at world positions on every side of you rather than on rails coming
 * forward. A fighter you fly past ends up behind you and has to be turned onto
 * -- which is why the canopy's radar is a real instrument and not a decal.
 *
 * It is still 3D by projection, not by geometry: Projection.ts rotates world
 * space into view space and divides by depth, and the existing 2D sprites are
 * drawn at a size that falls off with distance. No new dependency, and the
 * only new art is the canopy itself.
 */

type Contact = {
  /**
   * Stable identity, so a lock survives the array being filtered.
   *
   * Locking an INDEX would silently re-point at whatever slid down into that
   * slot when a nearer contact died -- the missile you fired at a gunboat
   * would chase a drone, and nothing on screen would say why.
   */
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  size: number;
  sprite: string;
  pattern: EngagePattern;
  state: AiState;
  stateClock: number;
  /** What it is made of and how it behaves. */
  shipClass: ShipClass;
  /**
   * Unit heading, smoothed from its velocity.
   *
   * The quantity everything else keys off: the armour model, the attacker's
   * choice of approach, the mutual-support test, and -- when the angled
   * sprites land -- which frame is drawn. Smoothed rather than taken raw, so a
   * hard turn does not flip the armour profile for a single frame.
   */
  facing: { x: number; y: number; z: number };
  hpMax: number;
  /** Regenerating bank. Comes back on a break-off; hull never does. */
  shield: number;
  shieldMax: number;
  /** Seconds until this ship re-decides. Phase-offset at spawn. */
  decideClock: number;
  /** Counts out a joust's overshoot without disturbing the AI state. */
  pressClock: number;
  standoff: number;
  speed: number;
  fireClock: number;
  fireInterval: number;
  score: number;
  /** Which way round the player this one circles, and from what angle. */
  orbitPhase: number;
  orbitTilt: number;
};

type Bolt = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hostile: boolean;
  size: number;
  life: number;
};

type Missile = {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number;
  /** The lock it was fired with. It tracks THIS and nothing else. */
  targetId: number;
};
type Burst = { x: number; y: number; z: number; life: number; max: number };
/** Stars sit on a unit sphere: infinitely far, so they turn but never pass. */
type Star = { x: number; y: number; z: number; mag: number };
/** Dust is near and DOES pass, which is the only cue for how fast you are going. */
type Mote = { x: number; y: number; z: number };

type Mode = 'arrival' | 'flying' | 'boss' | 'won' | 'lost';

const FOCAL = 470;
/**
 * Cruise speed, world units per second.
 *
 * Halved from 240. At the old speed a squadron went from spawning to being on
 * top of you in 3.3-4.1 seconds, closing at 320-400 u/s, and the whole play
 * radius was crossed in 27 -- so contacts appeared out of nothing, flew past,
 * and were gone. Space does not work like that. Everything here is slower and
 * further apart so that a contact you can see coming stays a contact you can
 * see coming, for twenty seconds or more.
 */
const CRUISE = 130;
/** All the way down to a near stop: holding position is a tactic. */
const THROTTLE_MIN = 0.12;
const THROTTLE_MAX = 1.0;
/** Radians per second at full stick. */
const TURN_RATE = 1.35;
/** How quickly the turn rate reaches the stick. Lower is a heavier ship. */
const TURN_EASE = 3.4;
/** The warship is a capital hull, not a fighter: it does not pitch past this. */
const PITCH_LIMIT = 1.32;
/** Stick travel, in screen fractions, for a full-rate turn. */
const STICK_TRAVEL = 0.26;

const PLAYER_HP = 8;
/**
 * Guns are held now, not automatic, so the cadence is what the trigger buys
 * you rather than a constant. SHOT_INTERVAL keeps its name and value: the
 * boss time-to-kill validator is computed from it.
 */
const SHOT_INTERVAL = 0.17;
/** Heat per second of held fire, and how fast it bleeds off. */
const HEAT_PER_SECOND = 0.34;
const HEAT_COOL_PER_SECOND = 0.46;
/** Above this the guns slow down. They never cut out -- see fireGuns(). */
const HEAT_SOFT_LIMIT = 0.75;
const HEAT_MAX_SLOWDOWN = 2.1;
/** Seconds to refill the missile. */
const MISSILE_CHARGE_SECONDS = 7;
const MISSILE_SPEED = 1150;
/** How hard a missile can bend toward its mark, radians per second. */
const MISSILE_TURN_RATE = 2.4;
const MISSILE_DAMAGE = 6;
/** Half-angle of the cone a missile will look inside for something to chase. */
const MISSILE_SEEK_CONE = 0.42;
/** Seconds without damage before a shield bank starts coming back. */
const SHIELD_REGEN_DELAY = 4.5;
const SHIELD_REGEN_PER_SECOND = 0.22;
/** Two taps on empty glass inside this window is a barrel roll. */
const DOUBLE_TAP_SECONDS = 0.32;
/**
 * The warp drive: hold it and cross real distance, but the coil heats.
 *
 * Open space is big now -- squadrons scramble six thousand units out and the
 * leg is long -- so there has to be a way to cover ground deliberately. It is
 * a hold, not a toggle, and it overheats, so it is a decision about when
 * rather than a speed you simply travel at.
 */
const WARP_MULTIPLIER = 4.2;
const WARP_HEAT_PER_SECOND = 0.28;
const WARP_COOL_PER_SECOND = 0.20;
/** Once the coil maxes out it must fall back to this before it will re-engage. */
const WARP_RESET_HEAT = 0.35;
const BOLT_SPEED = 1750;
const BOLT_SIZE = 10;
const HOSTILE_BOLT_SPEED = 700;
const HOSTILE_BOLT_SIZE = 15;
/** How far ahead of the eye the guns fire from. */
const MUZZLE_AHEAD = 210;
/** Nothing that is merely a bolt may take over the screen. */
const MAX_BOLT_PIXELS = 30;
const HIT_GRACE = 1.2;
const ROLL_TIME = 0.7;
const ROLL_COOLDOWN = 1.1;

const STAR_COUNT = 260;
const MOTE_COUNT = 90;
/** The box dust is recycled inside, centred on the ship. */
const MOTE_SPAN = 900;
const BURST_LIFE = 0.45;
const RADAR_RANGE = 8000;
/**
 * Contacts further out than this stop being simulated.
 *
 * Nearly 2.5x the old radius. A fighter that flies past you has to still be
 * out there and still be findable, rather than evaporating the moment it is
 * behind you -- that vanishing is what made the fight feel like scenery
 * rushing by instead of an engagement.
 */
const DESPAWN_RANGE = 11000;

/** No target bracket shrinks below this, however far away its contact is. */
const BRACKET_MIN_PIXELS = 22;
/**
 * Target lock.
 *
 * You lock what you point at: the contact nearest the nose inside a cone,
 * held for a dwell. No extra gesture -- there is no spare thumb for one, and
 * "get the enemy ship in your sight" is already the gesture.
 *
 * The cone to ACQUIRE is tight and the cone to KEEP is wide. One value for
 * both would either be too tight to hold through a turn (the lock strobing on
 * and off, which is worse than none) or so loose that you cannot choose which
 * of two contacts you meant. Hysteresis, the same shape as the quality tiers.
 */
const LOCK_CONE = 0.16;
const LOCK_HOLD_CONE = 0.46;
const LOCK_DWELL = 0.5;
const LOCK_RANGE = 7000;
/** Sentinel identity for the capital ship, which is not in the contact array. */
const BOSS_ID = -1;
/**
 * How many enemies may be shooting at you at once.
 *
 * The cheapest change in the combat model and the one that does most for how
 * a fight feels. Without a budget every contact wants the same thing at the
 * same moment: a wall arriving together, none of them making a decision,
 * which is Galaga with a camera. With it some press and the rest reposition,
 * and the engagement has a shape you can read and exploit.
 */
const ENGAGEMENT_SLOTS = 3;
/**
 * Seconds between AI decisions, phase-offset per ship at spawn.
 *
 * Re-deciding every frame is both wasteful and WORSE: a ship that reconsiders
 * sixty times a second oscillates on the boundary between two choices instead
 * of committing to either. On a stagger, twenty contacts cost a handful of dot
 * products a frame, and each holds its decision long enough to look like it
 * meant it.
 */
const DECIDE_INTERVAL = 0.4;
/** How far out a broken-off ship runs before turning back in. */
const EXTEND_MULTIPLIER = 2.7;
/** Enemy shield regeneration while broken off, per second. Hull never returns. */
const ENEMY_SHIELD_REGEN = 0.34;
/** Range within which a wingman notices the player is on someone's tail. */
const SUPPORT_RANGE = 2600;
/**
 * Width of the cone ahead of the player that squadrons scramble into.
 *
 * Wide enough that arrivals are not all dead ahead and predictable; narrow
 * enough that they are all somewhere you can see.
 */
const SPAWN_CONE = 1.9;
/**
 * The arrival.
 *
 * "the ships view needs to be us coming out of warp or going into warp drive
 * and flying to a destination and then the battle starts but not just start
 * the battle."
 *
 * Three beats over ARRIVAL_SECONDS: the tunnel collapsing, the stars settling,
 * and the destination named -- then the first squadron scrambles. The music
 * cue fires at the top so the track has its intro rather than starting under
 * gunfire.
 */
const ARRIVAL_SECONDS = 6.4;
/** How much faster than cruise the ship is still travelling as it drops out. */
const ARRIVAL_SPEED_MULTIPLIER = 7.5;
/** Fraction of the arrival spent decelerating; the rest is the settled look. */
const ARRIVAL_DECEL_SHARE = 0.62;
/**
 * Where the settings chip sits, in pixels from the top.
 *
 * Clear of the shell's fullscreen chip, which is at a fixed position in both
 * orientations. A fraction of the viewport height collides with it on a short
 * landscape screen.
 */
const SETTINGS_BUTTON_TOP = 98;
/**
 * How long to watch for a requested calibration to complete.
 *
 * Clear of TiltSource's own 2600ms fallback, so an ordinary calibration always
 * resolves inside the window and only a genuinely dead sensor times out here.
 */
const TILT_WATCH_SECONDS = 4;
/** How fast a contact's facing catches up to its velocity. */
const FACING_EASE = 3.0;

const RED = '#ff4c66';
const GREEN = '#00ff6a';
const AMBER = '#ffb020';
/** The lock's colour, matching the cockpit's own shield/lock cyan. */
const CYAN = '#4fd8ff';

export class Space3DGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly assets = new AssetLoader();
  private readonly sprites: SpriteRenderer;
  private readonly cockpit: Cockpit;
  private readonly loop = new Loop((dt) => this.tick(dt));
  private readonly tilt = new TiltSource();
  private assetsReady = false;
  private visible = false;

  private leg: SpaceLeg = LEDGER_TRANSIT;
  private mode: Mode = 'flying';
  private clock = 0;
  private score = 0;
  private hp = PLAYER_HP;
  private graceClock = 0;

  private camera: Camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, cx: 0, cy: 0, focal: FOCAL };
  /** Stick position, -1..1 each axis. */
  private stickX = 0;
  private stickY = 0;
  private yawRate = 0;
  private pitchRate = 0;
  private throttle = 0.72;
  private rollClock = 0;
  private rollCooldown = 0;

  private contacts: Contact[] = [];
  private bolts: Bolt[] = [];
  private missiles: Missile[] = [];
  private bursts: Burst[] = [];
  private stars: Star[] = [];
  private motes: Mote[] = [];

  private squadronIndex = 0;
  private squadronClock = 0;
  private fireClock = 0;

  private bossHp = 0;
  private boss = { x: 0, y: 0, z: 0 };
  private bossAttack = 0;
  private bossClock = 0;
  private bossState: 'windUp' | 'recovery' = 'windUp';
  private escortsLaunched = false;

  private bannerText = '';
  private bannerClock = 0;
  private viewW = 0;
  private viewH = 0;

  /**
   * The STEERING pointer, and only ever that.
   *
   * Weapon touches are tracked separately in `weaponPointers`. Letting a
   * finger on the GUN button also register as the steering pointer would
   * disable tilt for as long as you were shooting -- you would stop being able
   * to fly the moment you started firing, which is the whole game.
   */
  private pointerId: number | null = null;
  private pointerStart = { x: 0, y: 0 };
  private pointerMoved = false;
  private pointerDownAt = 0;
  /** pointerId -> which button it is holding. */
  private readonly weaponPointers = new Map<number, CockpitButtonId>();
  private lastTapAt = -1;
  private readonly keys = new Set<string>();

  private gunHeat = 0;
  private gunClock = 0;
  private warpHeat = 0;
  /** Latched when the coil maxes: blocks re-engaging until it has cooled. */
  private warpLocked = false;
  private missileCharge = 1;
  private shieldFore = 1;
  private shieldAft = 1;
  private shieldQuiet = 0;
  /** Seconds into the warp arrival. Only meaningful while mode is 'arrival'. */
  private arrivalClock = 0;
  private settings = loadSettings();
  private settingsOpen = false;
  /** Seconds left on the "TILT RECALIBRATED" acknowledgement. */
  private settingsToast = 0;
  private settingsToastText = '';
  /**
   * Seconds left watching for a requested calibration to finish.
   *
   * Bounded, because completion is not guaranteed: TiltSource only latches
   * neutral from inside onSample, so a sensor that goes silent leaves the
   * status on 'calibrating' forever and an unbounded watch would leave a toast
   * on screen for the rest of the run.
   */
  private tiltWatch = 0;

  private nextContactId = 1;
  /** The held lock, or null. Survives filtering because it is an id. */
  private lockId: number | null = null;
  /** What the nose is currently dwelling on, and how far through the dwell. */
  private lockCandidateId: number | null = null;
  private lockProgress = 0;

  constructor(private readonly shell: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'CODED space flight');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'none',
      touchAction: 'none',
      background: '#01030a',
    });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('space flight needs a 2D context');
    this.ctx = ctx;
    this.sprites = new SpriteRenderer(ctx, this.assets);
    this.cockpit = new Cockpit(ctx, this.assets);
    this.shell.appendChild(this.canvas);
    this.bindInput();
    this.armTiltPermission();
    window.addEventListener('resize', () => this.resize());
    // Rotating the handset invalidates the neutral pose entirely.
    window.addEventListener('orientationchange', () => this.tilt.recalibrate('orientation change'));
  }

  /**
   * @param straightToBoss skip the squadrons and open on the interdictor.
   * Flying the whole leg to reach it is minutes per attempt when the thing
   * being checked is the boss.
   */
  async show(leg: SpaceLeg = LEDGER_TRANSIT, straightToBoss = false): Promise<void> {
    this.leg = leg;
    if (!this.assetsReady) {
      await this.assets.loadManifest();
      this.assetsReady = true;
    }
    this.visible = true;
    this.canvas.style.display = 'block';
    this.resize();
    this.restart();
    if (straightToBoss) {
      this.squadronIndex = this.leg.squadrons.length;
      this.startBoss();
    }
    this.loop.start();
    this.cueMusic('transit');
    debugLog.log('mode', 'transit entered', { leg: leg.key, squadrons: leg.squadrons.length });
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
    this.loop.stop();
  }

  /** The audio manifest owns the cue-to-track mapping; this only names a cue. */
  private cueMusic(cue: string): void {
    window.dispatchEvent(new CustomEvent('coded:music-cue', { detail: { cue } }));
  }

  private restart(): void {
    // The level opens dropping out of warp, not in a firefight.
    this.mode = 'arrival';
    this.arrivalClock = 0;
    this.clock = 0;
    this.score = 0;
    this.hp = PLAYER_HP;
    this.graceClock = 0;
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.z = 0;
    this.camera.yaw = 0;
    this.camera.pitch = 0;
    this.camera.roll = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.yawRate = 0;
    this.pitchRate = 0;
    this.throttle = 0.72;
    this.rollClock = 0;
    this.rollCooldown = 0;
    this.contacts = [];
    this.bolts = [];
    this.missiles = [];
    this.bursts = [];
    this.gunHeat = 0;
    this.gunClock = 0;
    this.warpHeat = 0;
    this.warpLocked = false;
    this.missileCharge = 1;
    this.shieldFore = 1;
    this.shieldAft = 1;
    this.shieldQuiet = 0;
    this.squadronIndex = 0;
    // The first squadron is scheduled from the END of the arrival, so the
    // opening cannot be interrupted by the fight it is supposed to precede.
    this.squadronClock = 2.0;
    this.fireClock = 0;
    this.bossHp = 0;
    this.escortsLaunched = false;
    this.seedSky();
    this.tilt.setScale(TILT_SCALE_BY_SENSITIVITY[this.settings.tiltSensitivity]);
    this.tilt.recalibrate('run start');
    // No music cue here: show() already cues on entry, and restart() also runs
    // on a retry tap where the track is already playing. Cueing in both places
    // would restart the transit track under the arrival every time.
    this.banner(`${this.leg.label} // ${this.leg.destination}`, 3.4);
  }

  /**
   * Two fields, doing two different jobs.
   *
   * Stars are direction only: they sit on a unit sphere and are re-projected
   * from the camera's own position every frame, so they rotate when you turn
   * and never slide past. That is what tells you which way you are facing when
   * there is no ground to look at.
   *
   * Dust is position: a box of motes around the ship, recycled when they fall
   * out of it. They stream past as you move, which is the only reason open
   * space reads as motion at all.
   */
  private seedSky(): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      // Even distribution over the sphere: a naive two-angle pick clumps at the poles.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      this.stars.push({ x: r * Math.cos(theta), y: u, z: r * Math.sin(theta), mag: Math.random() });
    }
    this.motes = [];
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      this.motes.push({
        x: (Math.random() - 0.5) * MOTE_SPAN,
        y: (Math.random() - 0.5) * MOTE_SPAN,
        z: (Math.random() - 0.5) * MOTE_SPAN,
      });
    }
  }

  // ---- input ------------------------------------------------------------
  //
  // Drag is a STICK, not a cursor. Displacement from where the finger went
  // down sets a turn RATE, and holding it turns you further -- which is what
  // lets a thumb come all the way around, something a position-mapped drag
  // can never do because it runs out of screen.

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.visible) return;
      event.preventDefault();
      // iOS will not hand over the sensor without a live gesture, so take the
      // grant from the first touch rather than making the player find a button.
      if (this.tilt.status === 'needs_permission') void this.tilt.requestPermission();
      // The settings overlay claims every pointer while it is open, BEFORE the
      // retry tap and before the weapon buttons -- otherwise a tap meant for a
      // row would also restart the run or fire a missile through the panel.
      if (this.settingsOpen) {
        this.tapSettings(event.clientX, event.clientY);
        return;
      }
      if (this.hitSettingsButton(event.clientX, event.clientY)) {
        this.settingsOpen = true;
        // Drop any stick the finger was holding, so the ship does not fly on
        // in whatever direction it was last steered while the menu is up.
        this.stickX = 0;
        this.stickY = 0;
        this.weaponPointers.clear();
        this.pointerId = null;
        return;
      }
      if (this.mode === 'won' || this.mode === 'lost') return void this.restart();

      // Buttons are tested FIRST, and a hit claims the pointer for the weapon
      // and nothing else. It never becomes the steering pointer, so tilt keeps
      // flying the ship while you shoot.
      const button = this.buttonAt(event.clientX, event.clientY);
      if (button) {
        this.weaponPointers.set(event.pointerId, button);
        this.tryCapture(event.pointerId);
        if (button === 'missile') this.fireMissile();
        return;
      }

      // Only one steering pointer. A second finger on empty glass is ignored
      // rather than fighting the first for the stick.
      if (this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.pointerStart = { x: event.clientX, y: event.clientY };
      this.pointerMoved = false;
      this.pointerDownAt = this.clock;
      this.tryCapture(event.pointerId);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.visible) return;
      // A finger sliding around on a weapon button must never steer.
      if (this.weaponPointers.has(event.pointerId)) return;
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const travel = Math.min(this.viewW, this.viewH) * STICK_TRAVEL;
      const dx = event.clientX - this.pointerStart.x;
      const dy = event.clientY - this.pointerStart.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.pointerMoved = true;
      this.stickX = clamp(dx / travel, -1, 1);
      this.stickY = clamp(dy / travel, -1, 1);
    });

    const release = (event: PointerEvent): void => {
      if (this.weaponPointers.delete(event.pointerId)) return;
      if (event.pointerId !== this.pointerId) return;
      // The roll moved to a DOUBLE tap. A single tap used to do it, which is
      // ambiguous now that there are buttons to press and a glass to miss.
      if (!this.pointerMoved && this.clock - this.pointerDownAt < 0.35) {
        if (this.clock - this.lastTapAt < DOUBLE_TAP_SECONDS) {
          this.startRoll();
          this.lastTapAt = -1;
        } else {
          this.lastTapAt = this.clock;
        }
      }
      this.pointerId = null;
      this.stickX = 0;
      this.stickY = 0;
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);

    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      this.keys.add(event.key.toLowerCase());
      if (event.key === ' ') {
        event.preventDefault();
        if (this.mode === 'won' || this.mode === 'lost') this.restart();
        else this.startRoll();
      }
      if (event.key.toLowerCase() === 'm') this.fireMissile();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
  }

  /**
   * Pointer capture is a nicety, not a prerequisite.
   *
   * It throws if the pointer is already gone by the time the handler runs --
   * a real race on a fast tap. Called inline it would abort the rest of the
   * handler, so the press would be registered by the browser and dropped by
   * us. State is set first and capture is attempted after, best-effort.
   */
  private hitSettingsButton(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const r = this.settingsButtonRect(this.viewW, this.viewH);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /**
   * A tap inside the settings overlay.
   *
   * Rows come from the same function that draws them, so what you can see and
   * what you can press cannot drift apart after a layout change -- the way the
   * weapon buttons are handled, and for the same reason.
   */
  private tapSettings(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const row of this.settingsRows(this.viewW, this.viewH)) {
      const r = row.rect;
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      if (row.id === 'sensitivity') {
        this.applySettings({ ...this.settings, tiltSensitivity: nextSensitivity(this.settings.tiltSensitivity) });
        this.toast(`TILT ${this.settings.tiltSensitivity.toUpperCase()}`);
      } else if (row.id === 'recalibrate') {
        this.tilt.recalibrate('player requested');
        // Report what the sensor is ACTUALLY doing, not what we hope it did.
        //
        // recalibrate() only STARTS a calibration: it sets the status to
        // 'calibrating' and returns. Neutral is latched later, in onSample,
        // once 4+ readings hold within 2.5 degrees for 550ms -- or at the
        // 2600ms timeout. Saying "RECALIBRATED" here claimed success at least
        // half a second before it could be true.
        //
        // And recalibrate() is a NO-OP in four states (unavailable, denied,
        // needs_permission, waiting), so on a desktop or a phone whose sensor
        // is silent a fixed "CALIBRATING" would be a different lie. The
        // readout already maps every status to a word, so it tells the truth
        // in all of them -- and reads CALIBRATING in the case that matters.
        this.toast(`TILT ${this.tiltReadout()}`);
        this.tiltWatch = TILT_WATCH_SECONDS;
        this.settingsOpen = false;
      } else {
        this.settingsOpen = false;
      }
      sfx.play('pickup');
      return;
    }
    // A tap on the backdrop closes, which is what every overlay does.
    this.settingsOpen = false;
  }

  /**
   * Waits for a requested calibration to actually finish, then says so.
   *
   * This is the half that makes the acknowledgement honest: TILT READY appears
   * only once TiltSource reports 'ready', which is the moment neutral is
   * genuinely latched. If the watch runs out first -- a sensor that never
   * delivers another sample -- it reports the real status instead of leaving
   * the player believing a calibration happened.
   */
  private watchCalibration(dt: number): void {
    if (this.tiltWatch <= 0) return;
    if (this.tilt.status === 'ready') {
      this.tiltWatch = 0;
      this.toast('TILT READY');
      return;
    }
    this.tiltWatch = Math.max(0, this.tiltWatch - dt);
    if (this.tiltWatch === 0) this.toast(`TILT ${this.tiltReadout()}`);
  }

  /** Applies a settings change everywhere it matters, and persists it. */
  private applySettings(settings: TransitSettings): void {
    this.settings = settings;
    this.tilt.setScale(TILT_SCALE_BY_SENSITIVITY[settings.tiltSensitivity]);
    saveSettings(settings);
    debugLog.log('input', 'transit settings', { ...settings, scale: this.tilt.fullScale });
  }

  private toast(text: string): void {
    this.settingsToastText = text;
    this.settingsToast = 1.8;
  }

  private tryCapture(pointerId: number): void {
    try {
      this.canvas.setPointerCapture(pointerId);
    } catch {
      // Without capture a finger that slides off the canvas stops steering,
      // which is survivable; losing the press entirely is not.
    }
  }

  /** Which button, if any, is under a client-space point. */
  private buttonAt(clientX: number, clientY: number): CockpitButtonId | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    // Same geometry the painter uses -- see Cockpit.buttons().
    for (const button of this.cockpit.buttons(this.cockpit.layout(this.viewW, this.viewH))) {
      if (Math.hypot(x - button.cx, y - button.cy) <= button.r * 1.15) return button.id;
    }
    return null;
  }

  /** True while a finger is holding the trigger, or the keyboard is. */
  private get gunsHeld(): boolean {
    for (const id of this.weaponPointers.values()) if (id === 'guns') return true;
    return this.keys.has(' ') === false && (this.keys.has('f') || this.keys.has('control'));
  }

  /** True while warp is demanded AND the coil will accept it. */
  private get warpHeld(): boolean {
    if (this.warpLocked) return false;
    for (const id of this.weaponPointers.values()) if (id === 'warp') return true;
    return this.keys.has('shift');
  }

  private get warpReady(): boolean {
    return !this.warpLocked;
  }

  /**
   * Takes the iOS sensor grant from the first gesture ANYWHERE on the page.
   *
   * The canvas handler alone was not enough. iOS will not hand over the
   * accelerometer without a live user gesture, and a player who opens the
   * level and simply starts tilting -- which is exactly what you would do when
   * told the game is flown by tilting -- never touches the canvas, so the
   * prompt never appears and tilt silently never starts. This mirrors how
   * MusicDirector takes the audio unlock.
   */
  private armTiltPermission(): void {
    const grab = (): void => {
      if (this.tilt.status !== 'needs_permission') return;
      void this.tilt.requestPermission();
    };
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
      document.addEventListener(type, grab, { capture: true, passive: true });
    }
  }

  private startRoll(): void {
    if (this.rollCooldown > 0 || this.rollClock > 0) return;
    this.rollClock = ROLL_TIME;
    this.rollCooldown = ROLL_TIME + ROLL_COOLDOWN;
    sfx.play('pulse');
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, this.shell.clientWidth || window.innerWidth);
    const h = Math.max(1, this.shell.clientHeight || window.innerHeight);
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The vanishing point belongs at the canopy's aperture centre, not the
    // middle of the screen: the console eats the lower third, so a view
    // centred on the viewport would put half the fight behind the panel.
    const frame = this.cockpit.layout(w, h);
    this.camera.cx = frame.cx;
    this.camera.cy = frame.cy;
    this.camera.focal = FOCAL * clamp(frame.aperture.w / 780, 0.68, 1.25);
  }

  // ---- frame ------------------------------------------------------------

  private tick(dt: number): void {
    if (!this.visible) return;
    this.clock += dt;
    if (this.bannerClock > 0) this.bannerClock = Math.max(0, this.bannerClock - dt);
    // Both of these live HERE rather than in update(), which tick() skips in
    // 'won' and 'lost'. A toast that stops counting down in those modes would
    // hang on screen, and the calibration watch would never resolve.
    if (this.settingsToast > 0) this.settingsToast = Math.max(0, this.settingsToast - dt);
    this.watchCalibration(dt);
    // 'arrival' belongs here.
    //
    // Leaving it out did not throw and did not look broken at a glance: the
    // arrival clock simply never advanced, so the warp tunnel drew at full
    // strength forever, the mode never became 'flying', and no squadron ever
    // scrambled. A level that quietly never starts.
    if (this.mode === 'arrival' || this.mode === 'flying' || this.mode === 'boss') this.update(dt);
    this.render();
  }

  private update(dt: number): void {
    if (this.settingsOpen) return;
    if (this.mode === 'arrival') {
      this.updateArrival(dt);
      return;
    }
    this.updateFlight(dt);
    this.updateSquadrons(dt);
    this.updateContacts(dt);
    if (this.mode === 'boss') this.updateBoss(dt);
    this.updateLock(dt);
    this.updateBolts(dt);
    this.updateMissiles(dt);
    this.fireGuns(dt);
    this.updateShields(dt);
    this.collide();
    for (const burst of this.bursts) burst.life -= dt;
    this.bursts = this.bursts.filter((burst) => burst.life > 0);
  }

  /**
   * Dropping out of warp toward the destination.
   *
   * The ship is still travelling -- fast, and slowing -- so the dust streams
   * past and the stars settle. That is the whole trick: the arrival uses the
   * SAME motion the flight model already has, at a decaying multiple of cruise,
   * rather than a scripted animation played over a frozen world. Nothing here
   * is faked, which is why control can be handed over mid-motion without a
   * visible seam.
   *
   * Presentation and simulation stay separate, per the plan's architectural
   * rule: this moves the camera and the stars, and it does not create, place,
   * damage or spare a single combatant. The first squadron scrambles from the
   * ordinary squadron timer once the arrival is over.
   */
  private updateArrival(dt: number): void {
    this.arrivalClock += dt;
    const t = Math.min(1, this.arrivalClock / ARRIVAL_SECONDS);

    // Decelerate over the first stretch, then hold cruise for the settled beat.
    const decel = Math.min(1, t / ARRIVAL_DECEL_SHARE);
    // Cubic ease-out: most of the speed is shed early, which is what "dropping
    // out" looks like. Linear reads as braking, not as arriving.
    const eased = 1 - (1 - decel) ** 3;
    const multiplier = ARRIVAL_SPEED_MULTIPLIER + (1 - ARRIVAL_SPEED_MULTIPLIER) * eased;
    const speed = CRUISE * multiplier;
    const dir = forward(this.camera);
    this.camera.x += dir.x * speed * dt;
    this.camera.y += dir.y * speed * dt;
    this.camera.z += dir.z * speed * dt;
    this.throttle = 0.72;
    this.recycleMotes();

    if (this.arrivalClock >= ARRIVAL_SECONDS) {
      this.mode = 'flying';
      // The first scramble is timed from HERE, so the opening is never cut
      // short by a squadron that was already counting down behind it.
      this.squadronClock = 2.4;
      this.banner(`${this.leg.destination} // CONTACTS INBOUND`, 2.6);
    }
  }

  private updateFlight(dt: number): void {
    if (this.graceClock > 0) this.graceClock = Math.max(0, this.graceClock - dt);
    if (this.rollClock > 0) this.rollClock = Math.max(0, this.rollClock - dt);
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - dt);

    // Tilt flies the ship when the sensor is live. Drag stays as the fallback
    // for desktop, for a denied permission, and for headless verification --
    // a denied prompt must not leave an unplayable level with no way out.
    this.tilt.update(dt);
    let stickX = this.stickX;
    let stickY = this.stickY;
    if (this.tilt.ready && this.pointerId === null) {
      const lean = this.tilt.read();
      stickX = lean.x;
      stickY = lean.y;
    }
    if (this.keys.has('arrowleft') || this.keys.has('a')) stickX = -1;
    if (this.keys.has('arrowright') || this.keys.has('d')) stickX = 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) stickY = -1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) stickY = 1;
    if (this.keys.has('shift')) this.throttle = Math.min(THROTTLE_MAX, this.throttle + dt * 0.6);
    if (this.keys.has('control')) this.throttle = Math.max(THROTTLE_MIN, this.throttle - dt * 0.6);

    // The ship has mass: the stick sets a target rate and the hull takes a
    // moment to get there. Instant rates make a capital ship feel like a mouse.
    const ease = Math.min(1, dt * TURN_EASE);
    this.yawRate += (stickX * TURN_RATE - this.yawRate) * ease;
    this.pitchRate += (-stickY * TURN_RATE - this.pitchRate) * ease;

    this.camera.yaw = wrapAngle(this.camera.yaw + this.yawRate * dt);
    // Elevation is clamped rather than wrapped: pitching past vertical would
    // invert the world with no horizon to tell you it had happened.
    this.camera.pitch = clamp(this.camera.pitch + this.pitchRate * dt, -PITCH_LIMIT, PITCH_LIMIT);

    // Bank into the turn, plus the barrel roll on top.
    const bank = clamp(this.yawRate / TURN_RATE, -1, 1) * 0.28;
    const spin = this.rollClock > 0 ? (1 - this.rollClock / ROLL_TIME) * Math.PI * 2 : 0;
    this.camera.roll = -bank + spin;

    // Warp: heat while engaged, cool while not. Maxing the coil latches it out
    // until it has cooled well down, so you cannot feather the limit -- you
    // have to actually let go, which is the cost that makes it a decision.
    const warping = this.warpHeld;
    this.warpHeat = clamp(
      this.warpHeat + (warping ? WARP_HEAT_PER_SECOND : -WARP_COOL_PER_SECOND) * dt,
      0,
      1,
    );
    if (this.warpHeat >= 1) this.warpLocked = true;
    if (this.warpLocked && this.warpHeat <= WARP_RESET_HEAT) this.warpLocked = false;

    const dir = forward(this.camera);
    const speed = CRUISE * this.throttle * (warping ? WARP_MULTIPLIER : 1);
    this.camera.x += dir.x * speed * dt;
    this.camera.y += dir.y * speed * dt;
    this.camera.z += dir.z * speed * dt;

    this.recycleMotes();
  }

  /**
   * Recycle dust through a box that travels with the ship.
   *
   * Extracted so the arrival can drive it too. The dust IS the sense of speed
   * -- stars are direction-only and never pass you -- so an opening that moves
   * the camera without recycling motes would look like a still image sliding.
   */
  private recycleMotes(): void {
    const half = MOTE_SPAN / 2;
    for (const mote of this.motes) {
      if (Math.abs(mote.x - this.camera.x) > half) mote.x += Math.sign(this.camera.x - mote.x) * MOTE_SPAN;
      if (Math.abs(mote.y - this.camera.y) > half) mote.y += Math.sign(this.camera.y - mote.y) * MOTE_SPAN;
      if (Math.abs(mote.z - this.camera.z) > half) mote.z += Math.sign(this.camera.z - mote.z) * MOTE_SPAN;
    }
  }

  private updateSquadrons(dt: number): void {
    if (this.mode !== 'flying') return;
    this.squadronClock -= dt;
    if (this.squadronClock > 0) return;
    if (this.squadronIndex >= this.leg.squadrons.length) {
      if (this.contacts.length === 0) this.startBoss();
      this.squadronClock = 0.5;
      return;
    }
    const squadron = this.leg.squadrons[this.squadronIndex];
    this.scramble(squadron);
    this.squadronIndex += 1;
    this.squadronClock = squadron.delay;
  }

  /**
   * Scrambles a squadron somewhere around the ship.
   *
   * Entry bearing is random and genuinely all the way around -- a squadron
   * that always appeared ahead would make the radar pointless and the turning
   * decorative. They arrive as a group from one bearing so they read as a
   * formation rather than as a sprinkle.
   */
  private scramble(squadron: SpaceSquadron): void {
    /**
     * Squadrons arrive AHEAD of you, not uniformly around you.
     *
     * "enemy ships are approaching, you can see I'm coming, they don't
     * disappear out of nowhere and fly by." A uniform bearing put half of
     * every squadron behind the player at birth, and since most classes are
     * slower than cruise they could never come round -- a live capture showed
     * 70% of approaching contacts permanently in the rear hemisphere. There
     * was nothing to fly toward, which is the "you can't ever find any
     * enemies" complaint exactly.
     *
     * Spawning in a cone off the nose means an engagement STARTS as something
     * you watch grow. They still end up behind you once you have flown through
     * them -- which is what the radar and the edge chevrons are for -- but
     * that is now a thing you did rather than the state of the world.
     */
    const nose = Math.atan2(this.camera.yaw === 0 ? 0 : Math.sin(this.camera.yaw), Math.cos(this.camera.yaw));
    const yaw = nose + (Math.random() - 0.5) * SPAWN_CONE;
    const pitch = this.camera.pitch + (Math.random() - 0.5) * 0.8;
    const cos = Math.cos(pitch);
    const base = {
      x: this.camera.x + Math.sin(yaw) * cos * squadron.entryRange,
      y: this.camera.y + Math.sin(pitch) * squadron.entryRange,
      z: this.camera.z + Math.cos(yaw) * cos * squadron.entryRange,
    };
    const squadronClass = classForSprite(squadron.enemyKey);
    for (let i = 0; i < squadron.count; i += 1) {
      const spread = 130;
      this.contacts.push({
        id: this.nextContactId,
        x: base.x + (Math.random() - 0.5) * spread * 2,
        y: base.y + (Math.random() - 0.5) * spread,
        z: base.z + (Math.random() - 0.5) * spread * 2,
        vx: 0,
        vy: 0,
        vz: 0,
        hp: squadron.hp,
        size: 78,
        sprite: squadron.enemyKey,
        pattern: squadron.pattern,
        state: 'approach',
        stateClock: 0,
        shipClass: squadronClass,
        // Seeded pointing at the player, so a shot that lands before the ship
        // has moved still resolves against a real facing rather than against
        // a zero vector -- which would normalise to (0,0,0) and make every
        // early hit a flank hit regardless of where it came from.
        facing: normalise({ x: this.camera.x - base.x, y: this.camera.y - base.y, z: this.camera.z - base.z }),
        hpMax: squadron.hp,
        shield: squadron.hp * squadronClass.shieldShare,
        shieldMax: squadron.hp * squadronClass.shieldShare,
        decideClock: Math.random() * DECIDE_INTERVAL,
        pressClock: 0,
        standoff: squadron.standoff,
        // Authored pacing, scaled by class. Without this nothing out-runs the
        // player and no enemy can choose its angle of attack.
        speed: squadron.speed * squadronClass.speedScale,
        fireClock: squadron.fireInterval > 0 ? squadron.fireInterval * (0.5 + Math.random()) : Number.POSITIVE_INFINITY,
        fireInterval: squadron.fireInterval,
        score: squadron.score,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitTilt: (Math.random() - 0.5) * 1.4,
      });
      this.nextContactId += 1;
    }
    this.banner(`SCRAMBLE // ${squadron.count} ${squadron.pattern.replace('_', ' ').toUpperCase()}`, 1.8);
    sfx.play('enemyShoot');
  }

  /**
   * A view of the fight, as the AI sees it.
   *
   * Built once per decision tick rather than per ship, because every ship
   * needs the same three numbers and recomputing the player's basis twenty
   * times a frame is pure waste.
   */
  private squadronView(): SquadronView {
    const dir = forward(this.camera);
    return {
      playerPosition: { x: this.camera.x, y: this.camera.y, z: this.camera.z },
      playerFacing: dir,
      slots: ENGAGEMENT_SLOTS,
    };
  }

  private asCombatant(contact: Contact): Combatant {
    return {
      id: contact.id,
      position: { x: contact.x, y: contact.y, z: contact.z },
      facing: contact.facing,
      state: contact.state,
      health: contact.hpMax > 0 ? contact.hp / contact.hpMax : 1,
      shipClass: contact.shipClass,
    };
  }

  /**
   * The AI's decisions, on a stagger.
   *
   * Four things happen here and only here, so the per-frame flight loop below
   * stays cheap: who holds an engagement slot, who has taken enough damage to
   * break off, who is coming back in, and who has noticed a wingman being
   * chased.
   *
   * Every ship carries its own countdown, phase-offset at spawn, so the cost
   * is spread across frames rather than spiking on the frames where everyone
   * happens to re-decide together.
   */
  private decide(dt: number): void {
    let anyDue = false;
    for (const contact of this.contacts) {
      contact.decideClock -= dt;
      if (contact.decideClock <= 0) anyDue = true;
    }
    if (!anyDue) return;

    const view = this.squadronView();
    const combatants = this.contacts.map((contact) => this.asCombatant(contact));
    const slots = engagementSlots(combatants, view);

    // The budget is applied to EVERY contact, not only the ones whose own
    // countdown fired.
    //
    // A live capture caught this: with per-ship staggering, a ship granted a
    // slot at t=0 held `engage` until its next decision at t=0.4, while a
    // different ship deciding at t=0.2 computed a fresh set and took one too.
    // Four ships were engaged against a budget of three -- the pure function
    // was correct and the wiring leaked around it. Demoting here makes the
    // budget authoritative at every tick; the stagger still governs the
    // expensive per-ship reasoning below.
    for (const contact of this.contacts) {
      if (contact.state === 'engage' && !slots.has(contact.id)) contact.state = 'approach';
    }

    for (const contact of this.contacts) {
      if (contact.decideClock > 0) continue;
      contact.decideClock += DECIDE_INTERVAL;
      const health = contact.hpMax > 0 ? contact.hp / contact.hpMax : 1;
      const range = Math.hypot(
        contact.x - this.camera.x, contact.y - this.camera.y, contact.z - this.camera.z,
      );

      const combatant = this.asCombatant(contact);

      // 1. Bank stripped and hull thin: leave. Shields come back out there;
      //    hull does not, so a ship that runs and returns is still the ship
      //    you wounded.
      if (shouldBreakOff(combatant, contact.shield)) {
        contact.state = 'extend';
        contact.stateClock = 0;
        continue;
      }

      // 2. Far enough out, and recovered enough, to turn back in.
      if (contact.state === 'extend') {
        if (shouldReAttack(combatant, contact.shield, contact.shieldMax, range, contact.standoff * EXTEND_MULTIPLIER)) {
          contact.state = 'approach';
          contact.stateClock = 0;
        } else {
          // 3. Mutual support. A ship that has broken off but sees the player
          //    sitting on a wingman's tail comes back for the player's own
          //    six -- which is the behaviour that makes a squadron read as a
          //    squadron rather than as a set of individuals.
          const rescuing = this.contacts.some((other) => (
            other.id !== contact.id && isBeingChased(this.asCombatant(other), view, SUPPORT_RANGE)
          ));
          if (rescuing && health > contact.shipClass.breakOffAt) {
            contact.state = 'engage';
            contact.stateClock = 0;
          }
        }
        continue;
      }

      // 4. Otherwise the slot budget decides: press, or hold off and wait.
      contact.state = slots.has(contact.id)
        ? (range < contact.standoff * 2.2 ? 'engage' : 'approach')
        : 'approach';
    }
  }

  /**
   * Enemy flight.
   *
   * They fly TO somewhere and hold there; they do not run at you on rails.
   * The AI STATE decides whether a ship is pressing, repositioning or running,
   * and its PATTERN decides what pressing looks like for that ship. The shared
   * steering below flies it to the resulting point at its own speed, which is
   * what makes them read as aircraft manoeuvring rather than as obstacles
   * arriving.
   */
  private updateContacts(dt: number): void {
    this.decide(dt);
    for (const contact of this.contacts) {
      contact.stateClock += dt;
      if (contact.pressClock > 0) contact.pressClock = Math.max(0, contact.pressClock - dt);
      // Shields only, and only while broken off. This is the line that makes a
      // wounded enemy worth having wounded.
      if (contact.state === 'extend' && contact.shieldMax > 0) {
        contact.shield = Math.min(contact.shieldMax, contact.shield + ENEMY_SHIELD_REGEN * dt);
      }
      const toPlayerX = this.camera.x - contact.x;
      const toPlayerY = this.camera.y - contact.y;
      const toPlayerZ = this.camera.z - contact.z;
      const range = Math.hypot(toPlayerX, toPlayerY, toPlayerZ) || 1;

      const goal = this.desiredPosition(contact, range, dt);
      const gx = goal.x - contact.x;
      const gy = goal.y - contact.y;
      const gz = goal.z - contact.z;
      const gLen = Math.hypot(gx, gy, gz) || 1;

      // Steer the velocity toward the goal rather than snapping to it, so
      // turns are arcs. This is the whole difference between "flies around"
      // and "teleports toward you".
      const wantX = (gx / gLen) * contact.speed;
      const wantY = (gy / gLen) * contact.speed;
      const wantZ = (gz / gLen) * contact.speed;
      const turn = Math.min(1, dt * 1.5);
      contact.vx += (wantX - contact.vx) * turn;
      contact.vy += (wantY - contact.vy) * turn;
      contact.vz += (wantZ - contact.vz) * turn;
      contact.x += contact.vx * dt;
      contact.y += contact.vy * dt;
      contact.z += contact.vz * dt;

      // Facing follows velocity, eased. Everything downstream -- the armour
      // model, the blind-side solve, the mutual-support test -- reads this.
      const speed = Math.hypot(contact.vx, contact.vy, contact.vz);
      if (speed > 1) {
        const want = { x: contact.vx / speed, y: contact.vy / speed, z: contact.vz / speed };
        const ease = Math.min(1, dt * FACING_EASE);
        contact.facing = normalise({
          x: contact.facing.x + (want.x - contact.facing.x) * ease,
          y: contact.facing.y + (want.y - contact.facing.y) * ease,
          z: contact.facing.z + (want.z - contact.facing.z) * ease,
        });
      }

      // Only a ship holding an engagement slot shoots. This is what the slot
      // budget BUYS: without it the budget would only change where ships fly,
      // and twenty contacts would still all be firing at you.
      if (contact.fireInterval > 0 && contact.state === 'engage' && range < contact.standoff * 2.4) {
        contact.fireClock -= dt;
        if (contact.fireClock <= 0) {
          contact.fireClock = contact.fireInterval;
          this.fireHostile(contact);
        }
      }
    }

    // Only cull what has genuinely left. A fighter behind you is still in the
    // fight -- that is the point of the radar.
    this.contacts = this.contacts.filter((contact) => {
      if (contact.hp <= 0) return false;
      const range = Math.hypot(contact.x - this.camera.x, contact.y - this.camera.y, contact.z - this.camera.z);
      return range < DESPAWN_RANGE;
    });
  }

  /**
   * Where a contact wants to be.
   *
   * Two layers, and keeping them separate is what makes the AI readable:
   *
   * - The STATE decides intent. Approaching, pressing, running, or breaking.
   * - The PATTERN decides what pressing looks like for that particular ship.
   *
   * Only the pressing case consults the pattern, which is why a squadron that
   * arrives together does not all fly the same line: most of them are in
   * `approach` or `extend`, and those go to points the pattern never sees.
   */
  private desiredPosition(contact: Contact, range: number, dt: number): { x: number; y: number; z: number } {
    const dir = forward(this.camera);

    if (contact.state === 'extend') {
      // Straight out, away from the player, until it has the room to turn
      // back in. It runs from where the player IS, not from where it was hit,
      // so turning to chase it does not shorten its escape.
      const away = normalise({
        x: contact.x - this.camera.x, y: contact.y - this.camera.y, z: contact.z - this.camera.z,
      });
      const out = contact.standoff * EXTEND_MULTIPLIER * 1.15;
      return {
        x: this.camera.x + away.x * out,
        y: this.camera.y + away.y * out,
        z: this.camera.z + away.z * out,
      };
    }

    if (contact.state === 'evade') {
      // Hard break across its own heading. Not away -- away from a faster
      // pursuer just means being shot in the back for longer.
      const across = cross(contact.facing, { x: 0, y: 1, z: 0 });
      const lateral = normalise(
        Math.hypot(across.x, across.y, across.z) < 0.1 ? { x: 1, y: 0, z: 0 } : across,
      );
      const swing = Math.sin(contact.orbitPhase) >= 0 ? 1 : -1;
      return {
        x: contact.x + contact.facing.x * 600 + lateral.x * 900 * swing,
        y: contact.y + contact.facing.y * 600 + lateral.y * 900 * swing,
        z: contact.z + contact.facing.z * 600 + lateral.z * 900 * swing,
      };
    }

    if (contact.state === 'approach') {
      // Closing, from wherever it actually is.
      //
      // This used to go for the blind side, and a live capture showed why that
      // was wrong: `approach` is the state MOST ships are in most of the time
      // (41526 contact-frames against 4885 engaged in a three-minute run), so
      // sending all of them behind the player put 100% of contacts in the rear
      // hemisphere. Nothing was ever in front of you, which is a worse level
      // than everything being in front of you -- you cannot fight what you can
      // never see, and the approach is the part the whole rescale exists to
      // show off.
      //
      // Closing on its own bearing keeps arrivals visible and varied. The
      // blind side is where an attack RUN goes (see the re-attack below), not
      // where a queue waits.
      const towards = normalise({
        x: contact.x - this.camera.x, y: contact.y - this.camera.y, z: contact.z - this.camera.z,
      });
      // Biased toward where the player can SEE it.
      //
      // Holding a ship's own bearing still put 81.5% of contact-frames in the
      // rear hemisphere in a live capture: the player cruises forward, so
      // anything holding a fixed distance slides behind and stays there. A
      // waiting queue you can never see is the "everything's moving too fast,
      // you can never find any enemies" complaint wearing a different hat.
      //
      // Blending toward the nose brings the queue around to where it reads as
      // a gathering threat. The blind side is still where an ATTACK RUN comes
      // from -- it is just not where ships loiter.
      const dir = forward(this.camera);
      // The weight has to exceed 1, and that is not a taste call.
      //
      // At 0.85 a contact sitting DIRECTLY behind blends to
      // normalise(-dir + 0.85*dir) = -dir: still directly behind. The blend
      // could only ever help contacts near the beam, and a live capture showed
      // the rear share going UP to 91%. Above 1 the sum always lands in the
      // front hemisphere, however far back the ship started, while a contact
      // on the beam keeps most of its lateral offset -- so the queue forms up
      // where it can be seen without collapsing onto the nose.
      const perch = normalise({
        x: towards.x + dir.x * 1.6,
        y: towards.y + dir.y * 1.6,
        z: towards.z + dir.z * 1.6,
      });
      const hold = contact.standoff * 1.6;
      return {
        x: this.camera.x + perch.x * hold,
        y: this.camera.y + perch.y * hold,
        z: this.camera.z + perch.z * hold,
      };
    }

    switch (contact.pattern) {
      case 'joust': {
        // Runs in, overshoots, then swings out and comes back around.
        //
        // The overshoot rides its own clock rather than the AI state, so a
        // ship that loses its engagement slot mid-pass still completes the
        // pass instead of stopping dead in front of the player.
        if (contact.pressClock <= 0 && range < contact.standoff * 0.55) contact.pressClock = 3.4;
        if (contact.pressClock > 0) {
          // Overshoot, then come back around ON THE BLIND SIDE. This is where
          // the rear-hemisphere rule belongs: an attack RUN, chosen after the
          // merge, rather than a holding pattern. It is also what makes the
          // second pass of a jouster different from the first, which is the
          // difference between an enemy that reads the fight and one that
          // repeats itself.
          const half = contact.pressClock / 3.4;
          if (half < 0.5) {
            return blindSidePoint(this.squadronView(), contact.standoff * 1.2, contact.orbitPhase);
          }
          return {
            x: contact.x + contact.vx * 3,
            y: contact.y + contact.vy * 3,
            z: contact.z + contact.vz * 3,
          };
        }
        return { x: this.camera.x, y: this.camera.y, z: this.camera.z };
      }
      case 'orbit': {
        // Circles at fighting range on its own tilted ring.
        contact.orbitPhase += dt * (contact.speed / Math.max(120, contact.standoff));
        const tilt = contact.orbitTilt;
        return {
          x: this.camera.x + Math.cos(contact.orbitPhase) * contact.standoff,
          y: this.camera.y + Math.sin(tilt) * contact.standoff * 0.5,
          z: this.camera.z + Math.sin(contact.orbitPhase) * contact.standoff,
        };
      }
      case 'tail': {
        // Sits behind you and stays there: the reason the radar exists.
        return {
          x: this.camera.x - dir.x * contact.standoff,
          y: this.camera.y - dir.y * contact.standoff,
          z: this.camera.z - dir.z * contact.standoff,
        };
      }
      case 'stand_off':
      default: {
        // Holds long range, edging sideways. Has to be chased down.
        const drift = Math.sin(this.clock * 0.4 + contact.orbitPhase);
        return {
          x: this.camera.x - dir.x * contact.standoff + drift * 260,
          y: this.camera.y - dir.y * contact.standoff + Math.sin(contact.orbitTilt) * 180,
          z: this.camera.z - dir.z * contact.standoff + drift * 260,
        };
      }
    }
  }

  private startBoss(): void {
    if (this.mode === 'boss') return;
    this.mode = 'boss';
    const boss = this.leg.boss;
    this.bossHp = boss.hp;
    const dir = forward(this.camera);
    this.boss = {
      x: this.camera.x + dir.x * 2400,
      y: this.camera.y + dir.y * 2400,
      z: this.camera.z + dir.z * 2400,
    };
    this.bossAttack = 0;
    this.bossClock = boss.attacks[0].windUp;
    this.bossState = 'windUp';
    this.escortsLaunched = false;
    this.banner(`${boss.label} // INTERCEPT`, 3.0);
    sfx.play('bigExplode');
    this.cueMusic('transit_boss');
    debugLog.log('mode', 'interdictor engaged', { boss: boss.label, hp: this.bossHp });
  }

  private updateBoss(dt: number): void {
    const boss = this.leg.boss;
    // It manoeuvres to hold its range instead of parking at a fixed depth:
    // fly at it and it backs off, turn away and it closes.
    const dx = this.camera.x - this.boss.x;
    const dy = this.camera.y - this.boss.y;
    const dz = this.camera.z - this.boss.z;
    const range = Math.hypot(dx, dy, dz) || 1;
    const push = (range - boss.standoff) / Math.max(1, boss.standoff);
    const step = clamp(push, -1, 1) * boss.speed * dt;
    this.boss.x += (dx / range) * step;
    this.boss.y += (dy / range) * step;
    this.boss.z += (dz / range) * step;
    // Slow lateral drift, so it is never a stationary target.
    this.boss.x += Math.sin(this.clock * 0.35) * 26 * dt;
    this.boss.y += Math.cos(this.clock * 0.27) * 18 * dt;

    if (!this.escortsLaunched && this.bossHp <= boss.hp * boss.escortAt) {
      this.escortsLaunched = true;
      this.launchEscorts();
    }

    if (range > boss.standoff * 2.6) return;
    this.bossClock -= dt;
    if (this.bossClock > 0) return;

    const attack = boss.attacks[this.bossAttack % boss.attacks.length];
    if (this.bossState === 'windUp') {
      this.fireBossPattern(attack.key, attack.shots);
      this.bossState = 'recovery';
      this.bossClock = attack.recovery;
      return;
    }
    this.bossState = 'windUp';
    this.bossAttack += 1;
    this.bossClock = boss.attacks[this.bossAttack % boss.attacks.length].windUp;
  }

  private launchEscorts(): void {
    const boss = this.leg.boss;
    this.banner('ESCORTS AWAY', 2.0);
    const escortClass = classForSprite(boss.escortKey);
    for (let i = 0; i < boss.escortCount; i += 1) {
      const angle = (i / boss.escortCount) * Math.PI * 2;
      this.contacts.push({
        id: this.nextContactId,
        x: this.boss.x + Math.cos(angle) * 200,
        y: this.boss.y + Math.sin(angle) * 140,
        z: this.boss.z + Math.sin(angle) * 200,
        vx: 0,
        vy: 0,
        vz: 0,
        hp: 2,
        size: 68,
        sprite: boss.escortKey,
        pattern: 'orbit',
        state: 'approach',
        stateClock: 0,
        shipClass: escortClass,
        facing: normalise({
          x: this.camera.x - this.boss.x, y: this.camera.y - this.boss.y, z: this.camera.z - this.boss.z,
        }),
        hpMax: 2,
        shield: 2 * escortClass.shieldShare,
        shieldMax: 2 * escortClass.shieldShare,
        // Deterministic phase across the flight rather than random: escorts
        // launch together, and staggering them evenly is what stops all four
        // deciding on the same frame for the rest of the fight.
        decideClock: (i / boss.escortCount) * DECIDE_INTERVAL,
        pressClock: 0,
        standoff: 480,
        speed: 215,
        fireClock: 1.6,
        fireInterval: 2.2,
        score: 70,
        orbitPhase: angle,
        orbitTilt: (Math.random() - 0.5) * 1.2,
      });
      this.nextContactId += 1;
    }
  }

  private fireBossPattern(key: string, shots: number): void {
    sfx.play('enemyShoot');
    const dx = this.camera.x - this.boss.x;
    const dy = this.camera.y - this.boss.y;
    const dz = this.camera.z - this.boss.z;
    const range = Math.hypot(dx, dy, dz) || 1;
    const aim = { x: dx / range, y: dy / range, z: dz / range };
    // A basis across the firing axis, so a fan opens across your view rather
    // than along some fixed world axis that may be edge-on to you.
    const right = normalise({ x: aim.z, y: 0, z: -aim.x });
    const up = cross(aim, right);

    for (let i = 0; i < shots; i += 1) {
      const t = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      if (key === 'wall' && Math.abs(t) < 0.09) continue;
      let spreadR = 0;
      let spreadU = 0;
      switch (key) {
        case 'spread': spreadR = t * 0.5; spreadU = 0.1; break;
        case 'lance': spreadR = t * 0.05; spreadU = 0; break;
        case 'swarm': spreadR = t * 0.32; spreadU = -t * 0.3; break;
        case 'wall': default: spreadR = t * 0.75; spreadU = 0; break;
      }
      const dir = normalise({
        x: aim.x + right.x * spreadR + up.x * spreadU,
        y: aim.y + right.y * spreadR + up.y * spreadU,
        z: aim.z + right.z * spreadR + up.z * spreadU,
      });
      this.bolts.push({
        x: this.boss.x,
        y: this.boss.y,
        z: this.boss.z,
        vx: dir.x * HOSTILE_BOLT_SPEED,
        vy: dir.y * HOSTILE_BOLT_SPEED,
        vz: dir.z * HOSTILE_BOLT_SPEED,
        hostile: true,
        size: HOSTILE_BOLT_SIZE,
        life: 8,
      });
    }
  }

  private fireHostile(contact: Contact): void {
    sfx.play('enemyShoot');
    const dx = this.camera.x - contact.x;
    const dy = this.camera.y - contact.y;
    const dz = this.camera.z - contact.z;
    const range = Math.hypot(dx, dy, dz) || 1;
    // Led onto where you will be, not where you are: flying straight is what
    // gets hit, turning is what does not.
    const flight = range / HOSTILE_BOLT_SPEED;
    const dir = forward(this.camera);
    const lead = CRUISE * this.throttle * flight * 0.8;
    const aim = normalise({
      x: dx + dir.x * lead,
      y: dy + dir.y * lead,
      z: dz + dir.z * lead,
    });
    this.bolts.push({
      x: contact.x,
      y: contact.y,
      z: contact.z,
      vx: aim.x * HOSTILE_BOLT_SPEED,
      vy: aim.y * HOSTILE_BOLT_SPEED,
      vz: aim.z * HOSTILE_BOLT_SPEED,
      hostile: true,
      size: HOSTILE_BOLT_SIZE,
      life: 8,
    });
  }

  /**
   * Held-trigger guns.
   *
   * Firing used to be automatic, and the validator used to assert that it must
   * be, on the reasoning that a fire button costs the thumb flying the ship.
   * That reasoning was correct right up until tilt started flying the ship;
   * now the thumb is free and a trigger is what makes shooting a decision.
   *
   * Heat slows the cadence but never stops it. A gun that cuts out entirely
   * would take the fight away from the player at the exact moment they most
   * need it, which reads as the game breaking rather than as a limit.
   */
  private fireGuns(dt: number): void {
    const firing = this.gunsHeld;
    this.gunHeat = clamp(
      this.gunHeat + (firing ? HEAT_PER_SECOND : -HEAT_COOL_PER_SECOND) * dt,
      0,
      1,
    );
    this.gunClock -= dt;
    if (!firing || this.gunClock > 0) return;

    const over = Math.max(0, this.gunHeat - HEAT_SOFT_LIMIT) / (1 - HEAT_SOFT_LIMIT);
    this.gunClock = SHOT_INTERVAL * (1 + over * (HEAT_MAX_SLOWDOWN - 1));

    const dir = forward(this.camera);
    const right = normalise({ x: dir.z, y: 0, z: -dir.x });
    for (const side of [-1, 1]) {
      this.bolts.push({
        x: this.camera.x + right.x * side * 30 + dir.x * MUZZLE_AHEAD,
        y: this.camera.y + right.y * side * 30 + dir.y * MUZZLE_AHEAD + 18,
        z: this.camera.z + right.z * side * 30 + dir.z * MUZZLE_AHEAD,
        vx: dir.x * BOLT_SPEED,
        vy: dir.y * BOLT_SPEED,
        vz: dir.z * BOLT_SPEED,
        hostile: false,
        size: BOLT_SIZE,
        life: 2.2,
      });
    }
    sfx.play('shoot');
  }

  /**
   * The special: a heavy seeker that has to be charged for AND locked.
   *
   * Requiring the lock is what makes the lock matter rather than being an
   * ornament on the glass. Two different refusals, said differently, because
   * "nothing happened when I pressed it" is the same experience for both and
   * the fix for each is the opposite of the other: wait, or aim.
   */
  private fireMissile(): void {
    if (this.mode !== 'flying' && this.mode !== 'boss') return;
    if (this.missileCharge < 1) {
      sfx.play('deny');
      this.banner('MISSILE CHARGING', 0.9);
      return;
    }
    if (this.lockId === null) {
      sfx.play('deny');
      this.banner('NO LOCK', 0.9);
      return;
    }
    this.missileCharge = 0;
    const dir = forward(this.camera);
    this.missiles.push({
      x: this.camera.x + dir.x * MUZZLE_AHEAD,
      y: this.camera.y + dir.y * MUZZLE_AHEAD + 14,
      z: this.camera.z + dir.z * MUZZLE_AHEAD,
      vx: dir.x * MISSILE_SPEED,
      vy: dir.y * MISSILE_SPEED,
      vz: dir.z * MISSILE_SPEED,
      life: 5.5,
      targetId: this.lockId,
    });
    sfx.play('bomb');
    this.banner('MISSILE AWAY', 1.1);
  }

  /** Missiles steer toward their mark at a bounded rate, so they can be out-turned. */
  private updateMissiles(dt: number): void {
    this.missileCharge = Math.min(1, this.missileCharge + dt / MISSILE_CHARGE_SECONDS);
    for (const missile of this.missiles) {
      const mark = this.seekTarget(missile);
      if (mark) {
        const toward = normalise({ x: mark.x - missile.x, y: mark.y - missile.y, z: mark.z - missile.z });
        const heading = normalise({ x: missile.vx, y: missile.vy, z: missile.vz });
        // Bounded turn: a seeker that snaps to its mark cannot be beaten by
        // flying, and beating it by flying is the entire point.
        const blend = Math.min(1, MISSILE_TURN_RATE * dt);
        const steered = normalise({
          x: heading.x + (toward.x - heading.x) * blend,
          y: heading.y + (toward.y - heading.y) * blend,
          z: heading.z + (toward.z - heading.z) * blend,
        });
        missile.vx = steered.x * MISSILE_SPEED;
        missile.vy = steered.y * MISSILE_SPEED;
        missile.vz = steered.z * MISSILE_SPEED;
      }
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;
      missile.z += missile.vz * dt;
      missile.life -= dt;
    }
    this.missiles = this.missiles.filter((missile) => missile.life > 0);
  }

  /**
   * The target lock.
   *
   * Two cones, not one. ACQUIRING needs the contact inside a tight cone off
   * the nose for a dwell, so you choose what you lock; KEEPING it allows a
   * much wider one, so a lock does not strobe on and off through a turn --
   * which is the failure mode that makes a lock indicator worse than none.
   *
   * Nothing here steers anything. The lock only decides what the instruments
   * describe and what the missile is allowed to be fired at.
   */
  private updateLock(dt: number): void {
    if (this.mode !== 'flying' && this.mode !== 'boss') {
      this.lockId = null;
      this.lockCandidateId = null;
      this.lockProgress = 0;
      return;
    }
    const dir = forward(this.camera);
    // Angle off the nose. Returns null when it is out of range or behind you.
    const offNose = (x: number, y: number, z: number): number | null => {
      const dx = x - this.camera.x;
      const dy = y - this.camera.y;
      const dz = z - this.camera.z;
      const range = Math.hypot(dx, dy, dz);
      if (range < 1 || range > LOCK_RANGE) return null;
      const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / range;
      // clamp before acos: floating drift past 1 is NaN, and a NaN angle
      // compares false against every threshold, so the lock would just stop.
      return Math.acos(clamp(cos, -1, 1));
    };

    // Hold an existing lock while it stays in the wide cone.
    if (this.lockId !== null) {
      const held = this.lockTarget();
      const angle = held ? offNose(held.x, held.y, held.z) : null;
      if (angle !== null && angle <= LOCK_HOLD_CONE) {
        this.lockProgress = 1;
        this.lockCandidateId = this.lockId;
        return;
      }
      this.lockId = null;
      this.lockProgress = 0;
    }

    // Acquire: whatever is CLOSEST TO THE NOSE, not whatever is nearest. You
    // lock what you point at; range decides nothing here.
    let bestId: number | null = null;
    let bestAngle = LOCK_CONE;
    for (const contact of this.contacts) {
      const angle = offNose(contact.x, contact.y, contact.z);
      if (angle !== null && angle < bestAngle) { bestAngle = angle; bestId = contact.id; }
    }
    if (this.mode === 'boss' && this.bossHp > 0) {
      const angle = offNose(this.boss.x, this.boss.y, this.boss.z);
      if (angle !== null && angle < bestAngle) { bestAngle = angle; bestId = BOSS_ID; }
    }

    if (bestId === null) {
      this.lockCandidateId = null;
      this.lockProgress = 0;
      return;
    }
    if (bestId !== this.lockCandidateId) {
      this.lockCandidateId = bestId;
      this.lockProgress = 0;
    }
    this.lockProgress = Math.min(1, this.lockProgress + dt / LOCK_DWELL);
    if (this.lockProgress >= 1) {
      this.lockId = bestId;
      sfx.play('pickup');
    }
  }

  /** Where the locked thing is right now, or null if it is gone. */
  private lockTarget(): { x: number; y: number; z: number; vx: number; vy: number; vz: number; label: string; health: number | null } | null {
    if (this.lockId === null) return null;
    if (this.lockId === BOSS_ID) {
      if (this.mode !== 'boss' || this.bossHp <= 0) return null;
      return {
        ...this.boss,
        vx: 0, vy: 0, vz: 0,
        label: this.leg.boss.label,
        health: Math.max(0, this.bossHp / this.leg.boss.hp),
      };
    }
    const contact = this.contacts.find((item) => item.id === this.lockId);
    if (!contact) return null;
    return {
      x: contact.x, y: contact.y, z: contact.z,
      vx: contact.vx, vy: contact.vy, vz: contact.vz,
      // The CLASS, not the sprite key. What the player needs from this line is
      // "which of the four is this and therefore where do I have to hit it",
      // and a filename cannot answer that.
      label: contact.shipClass.label,
      health: contact.hpMax > 0 ? Math.max(0, contact.hp / contact.hpMax) : null,
    };
  }

  /**
   * Where to put the nose so a bolt fired NOW meets the target.
   *
   * INSTRUMENTATION, NOT AUTO-AIM. Nothing is steered and nothing snaps: the
   * shot still leaves along forward(camera) exactly as before, and fireGuns
   * never reads this. The pipper only says where to put the nose yourself.
   * Without it a crossing target at 1750 units/s of bolt speed is guesswork,
   * and crossing shots are most of a dogfight.
   *
   * The solve itself is Projection.interceptTime, kept out here so the
   * arithmetic can be checked without a canvas -- the inverted-yaw bug in
   * toView shipped precisely because its maths was only reachable through a
   * draw call.
   */
  private leadPoint(target: { x: number; y: number; z: number; vx: number; vy: number; vz: number }):
  { x: number; y: number; z: number } | null {
    const dir = forward(this.camera);
    const speed = this.throttle * CRUISE * (this.warpHeld && this.warpReady ? WARP_MULTIPLIER : 1);
    // Relative to the MUZZLE, which is moving. The bolt inherits no ship
    // velocity, but the firing point runs forward while the round is in
    // flight, so what the solve needs is the target's velocity relative to us.
    const t = interceptTime(
      { x: target.x - this.camera.x, y: target.y - this.camera.y, z: target.z - this.camera.z },
      { x: target.vx - dir.x * speed, y: target.vy - dir.y * speed, z: target.vz - dir.z * speed },
      BOLT_SPEED,
    );
    // Past a few seconds the prediction is fiction -- nothing holds a constant
    // velocity that long in a dogfight -- and a pipper drawn from it would
    // send you somewhere the target was never going.
    if (t === null || t > 4) return null;
    return { x: target.x + target.vx * t, y: target.y + target.vy * t, z: target.z + target.vz * t };
  }

  /**
   * The mark a missile is steering at, or null when it has lost it.
   *
   * A missile tracks THE THING IT WAS LOCKED ONTO, not whatever happens to be
   * nearest -- otherwise a seeker fired at a gunboat quietly adopts the drone
   * that wanders in front of it, and the lock you spent time earning buys you
   * nothing.
   *
   * It still loses the mark by geometry: leave the seeker cone and it goes
   * ballistic. There is deliberately no rule saying a barrel roll breaks lock.
   * A defensive move that works because it played an animation teaches you
   * nothing about where to fly; this one is beaten by actually flying out of
   * the cone or out-turning the seeker, which is a thing you can get better at.
   */
  private seekTarget(missile: { x: number; y: number; z: number; vx: number; vy: number; vz: number; targetId: number }):
  { x: number; y: number; z: number } | null {
    const mark = missile.targetId === BOSS_ID
      ? (this.mode === 'boss' && this.bossHp > 0 ? this.boss : null)
      : this.contacts.find((contact) => contact.id === missile.targetId) ?? null;
    if (!mark) return null;
    const heading = normalise({ x: missile.vx, y: missile.vy, z: missile.vz });
    const dx = mark.x - missile.x;
    const dy = mark.y - missile.y;
    const dz = mark.z - missile.z;
    const range = Math.hypot(dx, dy, dz) || 1;
    const cone = (dx * heading.x + dy * heading.y + dz * heading.z) / range;
    if (cone < Math.cos(MISSILE_SEEK_CONE)) return null;
    return { x: mark.x, y: mark.y, z: mark.z };
  }

  private updateBolts(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.z += bolt.vz * dt;
      bolt.life -= dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.life > 0);
  }

  /**
   * Hit tests, in 3D.
   *
   * A bolt is tested against the segment it covered THIS frame, not against
   * where it happens to have landed: at 1750 units/s it moves further per
   * frame than a fighter is wide, so a plain distance check misses almost
   * every shot. The point-to-segment distance below is the fix, and it uses
   * the same world size the renderer draws so what looks like a hit is one.
   */
  private collide(): void {
    for (const bolt of this.bolts) {
      if (bolt.hostile || bolt.life <= 0) continue;
      const from = { x: bolt.x - bolt.vx * (1 / 60), y: bolt.y - bolt.vy * (1 / 60), z: bolt.z - bolt.vz * (1 / 60) };
      const to = { x: bolt.x, y: bolt.y, z: bolt.z };
      for (const contact of this.contacts) {
        if (contact.hp <= 0) continue;
        if (segmentDistance(from, to, contact) > contact.size * 0.5) continue;
        // Where the hit LANDS decides what it is worth. Shooting a heavy
        // fighter head-on is a bad trade; getting on its six kills it in a
        // third of the time. That is the strategy the whole combat model
        // exists to create, and it is one dot product.
        this.damage(contact, armourMultiplier({ x: bolt.vx, y: bolt.vy, z: bolt.vz }, contact.facing, contact.shipClass.armour));
        bolt.life = 0;
        this.burst(contact.x, contact.y, contact.z);
        if (contact.hp <= 0) {
          this.score += contact.score;
          sfx.play('explode');
        } else {
          sfx.play('hit');
        }
        break;
      }
      if (bolt.life <= 0) continue;
      if (this.mode === 'boss' && this.bossHp > 0 && segmentDistance(from, to, this.boss) <= this.leg.boss.size * 0.45) {
        // The interdictor is only soft on its recovery: shooting it through a
        // wind-up is meant to be worth less than waiting for the opening.
        const armoured = this.bossState === 'windUp';
        this.bossHp -= armoured ? 0.35 : 1.6;
        bolt.life = 0;
        this.burst(this.boss.x, this.boss.y, this.boss.z);
        sfx.play('hit');
        if (this.bossHp <= 0) this.win();
      }
    }
    // Missiles: same swept test, bigger radius, much bigger bite.
    for (const missile of this.missiles) {
      if (missile.life <= 0) continue;
      const from = { x: missile.x - missile.vx * (1 / 60), y: missile.y - missile.vy * (1 / 60), z: missile.z - missile.vz * (1 / 60) };
      const to = { x: missile.x, y: missile.y, z: missile.z };
      for (const contact of this.contacts) {
        if (contact.hp <= 0) continue;
        if (segmentDistance(from, to, contact) > contact.size * 0.7) continue;
        // A warhead does not care which panel it went through. Deliberate:
        // the missile is the answer to a target you could not get behind, so
        // making it obey the armour profile would take away the one tool that
        // beats a nose-armoured fighter you cannot out-turn.
        this.damage(contact, MISSILE_DAMAGE);
        missile.life = 0;
        this.burst(contact.x, contact.y, contact.z);
        sfx.play('bigExplode');
        if (contact.hp <= 0) this.score += contact.score;
        break;
      }
      if (missile.life <= 0) continue;
      if (this.mode === 'boss' && this.bossHp > 0 && segmentDistance(from, to, this.boss) <= this.leg.boss.size * 0.55) {
        // A missile ignores the guard: it is the answer to a boss that is
        // armoured while winding up, and the reason to save one.
        this.bossHp -= MISSILE_DAMAGE;
        missile.life = 0;
        this.burst(this.boss.x, this.boss.y, this.boss.z);
        sfx.play('bigExplode');
        if (this.bossHp <= 0) this.win();
      }
    }
    this.missiles = this.missiles.filter((missile) => missile.life > 0);
    this.bolts = this.bolts.filter((bolt) => bolt.life > 0);
    this.contacts = this.contacts.filter((contact) => contact.hp > 0);

    // A roll deflects rather than phases: shots that would have hit are spent.
    if (this.rollClock > 0) {
      for (const bolt of this.bolts) {
        if (!bolt.hostile) continue;
        const range = Math.hypot(bolt.x - this.camera.x, bolt.y - this.camera.y, bolt.z - this.camera.z);
        if (range < 160) bolt.life = 0;
      }
      this.bolts = this.bolts.filter((bolt) => bolt.life > 0);
      return;
    }
    if (this.graceClock > 0) return;

    for (const bolt of this.bolts) {
      if (!bolt.hostile || bolt.life <= 0) continue;
      const range = Math.hypot(bolt.x - this.camera.x, bolt.y - this.camera.y, bolt.z - this.camera.z);
      if (range > 46) continue;
      bolt.life = 0;
      // Trace back along the bolt's own travel to find which side it came from.
      this.takeHitFrom(bolt.x - bolt.vx, bolt.y - bolt.vy, bolt.z - bolt.vz);
      break;
    }

    for (const contact of this.contacts) {
      const range = Math.hypot(contact.x - this.camera.x, contact.y - this.camera.y, contact.z - this.camera.z);
      if (range > contact.size * 0.5 + 44) continue;
      contact.hp = 0;
      this.burst(contact.x, contact.y, contact.z);
      this.takeHitFrom(contact.x, contact.y, contact.z);
      break;
    }
    this.contacts = this.contacts.filter((contact) => contact.hp > 0);
  }

  /**
   * Damage into a contact: shield first, then hull.
   *
   * The split is what makes breaking off meaningful. Shields regenerate while
   * a ship is extended; hull never does. So a fighter you hurt and let escape
   * comes back with its bank refilled but its HULL still carrying every point
   * you put into it -- which is the difference between a smart enemy and an
   * irritating one. An enemy that ran away and returned untouched would make
   * every hit you landed retroactively pointless.
   *
   * Overflow carries: a hit bigger than the remaining shield spends the
   * remainder on hull rather than being absorbed whole, so a heavy shot on a
   * nearly-down bank is not silently wasted.
   */
  private damage(contact: Contact, amount: number): void {
    if (!(amount > 0)) return;
    let remaining = amount;
    if (contact.shield > 0) {
      const absorbed = Math.min(contact.shield, remaining);
      contact.shield -= absorbed;
      remaining -= absorbed;
    }
    contact.hp -= remaining;
  }

  /** Shields come back once nothing has hit you for a while. */
  private updateShields(dt: number): void {
    this.shieldQuiet += dt;
    if (this.shieldQuiet < SHIELD_REGEN_DELAY) return;
    const gain = SHIELD_REGEN_PER_SECOND * dt;
    this.shieldFore = Math.min(1, this.shieldFore + gain);
    this.shieldAft = Math.min(1, this.shieldAft + gain);
  }

  /**
   * Damage, resolved against the bank that was facing it.
   *
   * Whether a hit lands forward or aft is decided by where it came FROM
   * relative to the nose, not by where the shooter happens to be now. That is
   * what makes a fighter on your six genuinely dangerous: it drains a bank you
   * cannot turn toward without giving up the shot you are lining up.
   *
   * @param fromX where the damage originated, in world space
   */
  private takeHitFrom(fromX: number, fromY: number, fromZ: number): void {
    const dir = forward(this.camera);
    const toward = normalise({
      x: fromX - this.camera.x,
      y: fromY - this.camera.y,
      z: fromZ - this.camera.z,
    });
    const ahead = toward.x * dir.x + toward.y * dir.y + toward.z * dir.z;
    const aft = ahead < 0;
    this.shieldQuiet = 0;

    const bank = aft ? this.shieldAft : this.shieldFore;
    if (bank > 0) {
      const drained = Math.max(0, bank - 0.34);
      if (aft) this.shieldAft = drained; else this.shieldFore = drained;
      sfx.play('hit');
      this.banner(aft ? 'AFT SHIELD' : 'FWD SHIELD', 0.8);
      this.graceClock = HIT_GRACE * 0.45;
      return;
    }
    this.takeHit();
  }

  private takeHit(): void {
    this.hp -= 1;
    this.graceClock = HIT_GRACE;
    sfx.play('hurt');
    if (this.hp <= 0) this.lose();
  }

  private win(): void {
    this.mode = 'won';
    this.cueMusic('transit');
    this.score += 1500;
    this.banner(`${this.leg.destination} // APPROACH CLEAR`, 5);
    sfx.play('levelUp');
    debugLog.log('mode', 'transit cleared', { score: this.score });
    window.dispatchEvent(new CustomEvent('coded:space-complete', { detail: { leg: this.leg.key, score: this.score } }));
  }

  private lose(): void {
    this.mode = 'lost';
    this.banner('HULL BREACH', 5);
    sfx.play('bigExplode');
    debugLog.log('mode', 'transit lost', { score: this.score, squadron: this.squadronIndex });
    window.dispatchEvent(new CustomEvent('coded:space-defeat', { detail: { leg: this.leg.key, squadron: this.squadronIndex } }));
  }

  private burst(x: number, y: number, z: number): void {
    this.bursts.push({ x, y, z, life: BURST_LIFE, max: BURST_LIFE });
  }

  private banner(text: string, seconds: number): void {
    this.bannerText = text;
    this.bannerClock = seconds;
  }

  // ---- render -----------------------------------------------------------

  private render(): void {
    const { ctx } = this;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);
    this.drawDeepField(w, h);
    this.drawStars();
    this.drawMotes();

    // One depth-sorted pass over the world, so a near fighter draws over a far
    // one and the interdictor never swallows its own escorts.
    type Drawable = { depth: number; paint: () => void };
    const drawables: Drawable[] = [];
    for (const contact of this.contacts) {
      const p = project(this.camera, contact.x, contact.y, contact.z);
      if (p.visible) drawables.push({ depth: p.depth, paint: () => this.drawContact(contact, p) });
    }
    for (const bolt of this.bolts) {
      const p = project(this.camera, bolt.x, bolt.y, bolt.z);
      if (p.visible) drawables.push({ depth: p.depth, paint: () => this.drawBolt(bolt, p) });
    }
    for (const missile of this.missiles) {
      const p = project(this.camera, missile.x, missile.y, missile.z);
      if (p.visible) drawables.push({ depth: p.depth, paint: () => this.drawMissile(missile, p) });
    }
    for (const burst of this.bursts) {
      const p = project(this.camera, burst.x, burst.y, burst.z);
      if (p.visible) drawables.push({ depth: p.depth, paint: () => this.drawBurst(burst, p) });
    }
    if (this.mode === 'boss' && this.bossHp > 0) {
      const p = project(this.camera, this.boss.x, this.boss.y, this.boss.z);
      if (p.visible) drawables.push({ depth: p.depth, paint: () => this.drawBoss(p) });
    }
    for (const item of sortByDepth(drawables)) item.paint();

    if (this.mode === 'arrival') this.drawWarpTunnel(w, h);
    this.drawReticle();
    this.drawLockCursor();
    if (this.graceClock > 0) this.drawDamageFlash(w, h);

    // The canopy goes on LAST, over everything: it is a frame you look through,
    // not a layer in the scene.
    const frame = this.cockpit.layout(w, h);
    const drawn = this.cockpit.drawFrame(frame);
    if (drawn) {
      const state = this.cockpitState();
      this.cockpit.drawInstruments(frame, state);
      this.cockpit.drawButtons(frame, state, new Set(this.weaponPointers.values()));
    }
    this.drawOffscreenCues(w, h);
    this.drawBanner(w, h, drawn);
    this.drawSettingsButton(w, h);
    if (this.settingsOpen) this.drawSettings(w, h);
    if (this.settingsToast > 0) this.drawToast(w, h);
  }

  /**
   * Tilt state in one word, for the nav screen.
   *
   * DENIED, SILENT and CALIBRATING are three different faults that all present
   * as "tilt isn't working", and a tester cannot tell them apart without being
   * told which one it is.
   */
  private tiltReadout(): string {
    switch (this.tilt.status) {
      case 'ready': return 'READY';
      case 'calibrating': return 'CALIBRATING';
      case 'waiting': return 'SILENT';
      case 'needs_permission': return 'TAP TO ALLOW';
      case 'denied': return 'DENIED';
      default: return 'NO SENSOR';
    }
  }

  /** What the instruments are reading. */
  private cockpitState(): CockpitState {
    const contacts: CockpitContact[] = [];
    for (const contact of this.contacts) {
      const view = toView(this.camera, contact.x, contact.y, contact.z);
      const range = rangeTo(view);
      contacts.push({
        bearing: bearing(view),
        range,
        elevation: clamp(-view.y / Math.max(1, range), -1, 1),
        hostile: true,
        locked: contact.id === this.lockId,
      });
    }
    if (this.mode === 'boss' && this.bossHp > 0) {
      const view = toView(this.camera, this.boss.x, this.boss.y, this.boss.z);
      const range = rangeTo(view);
      contacts.push({
        bearing: bearing(view),
        range,
        elevation: clamp(-view.y / Math.max(1, range), -1, 1),
        hostile: true,
        capital: true,
        locked: this.lockId === BOSS_ID,
      });
    }
    return {
      hull: this.hp,
      hullMax: PLAYER_HP,
      shieldFore: this.shieldFore,
      shieldAft: this.shieldAft,
      gunHeat: this.gunHeat,
      gunsFiring: this.gunsHeld,
      missileCharge: this.missileCharge,
      warpHeat: this.warpHeat,
      warpEngaged: this.warpHeld,
      warpReady: this.warpReady,
      throttle: this.throttle,
      bossHealth: this.mode === 'boss' && this.bossHp > 0 ? Math.max(0, this.bossHp / this.leg.boss.hp) : null,
      bossLabel: this.leg.boss.label,
      status: this.mode === 'boss' ? 'INTERCEPT' : `NAV ${this.leg.destination}`,
      tiltStatus: this.tiltReadout(),
      contacts,
      lock: this.lockReadout(),
      lockProgress: this.lockId === null ? this.lockProgress : 1,
      radarRange: RADAR_RANGE,
      rollReady: this.rollCooldown <= 0,
      clock: this.clock,
    };
  }

  /**
   * The locked target, as the right screen wants it.
   *
   * Closure is the component of relative velocity ALONG the line to the
   * target, not the change in range between frames: a per-frame difference is
   * noise at 60fps and would flicker between CLOSING and OPENING while you
   * held a steady chase. Your own velocity counts, which is the point --
   * whether you are catching something depends on how fast you are going.
   */
  private lockReadout(): CockpitLock | null {
    const target = this.lockTarget();
    if (!target) return null;
    const dx = target.x - this.camera.x;
    const dy = target.y - this.camera.y;
    const dz = target.z - this.camera.z;
    const range = Math.hypot(dx, dy, dz) || 1;
    const dir = forward(this.camera);
    const speed = this.throttle * CRUISE * (this.warpHeld && this.warpReady ? WARP_MULTIPLIER : 1);
    // Relative velocity: theirs minus ours, projected onto the line of sight.
    const rvx = target.vx - dir.x * speed;
    const rvy = target.vy - dir.y * speed;
    const rvz = target.vz - dir.z * speed;
    const closure = -((rvx * dx + rvy * dy + rvz * dz) / range);
    return { label: target.label, range, closure, health: target.health };
  }

  /**
   * The warp tunnel, collapsing.
   *
   * Radial streaks from the vanishing point, shortening and fading as the ship
   * decelerates, plus a bloom that closes in. Drawn ON TOP of the real scene
   * rather than instead of it, so the stars and dust behind are the actual
   * ones the flight model is moving -- the tunnel is the effect leaving, not a
   * picture standing in for the world.
   *
   * Nothing here is pooled because nothing here is allocated: the streaks are
   * computed from an index each frame, so a six-second opening costs no
   * garbage on a phone.
   */
  private drawWarpTunnel(w: number, h: number): void {
    const t = Math.min(1, this.arrivalClock / ARRIVAL_SECONDS);
    // Fades out over the deceleration, so the last stretch is clear sky.
    const strength = Math.max(0, 1 - t / ARRIVAL_DECEL_SHARE);
    if (strength <= 0.001) return;
    const { ctx, camera } = this;
    const reach = Math.hypot(w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Tuned between two failures, both seen on screen: at 88 streaks with a
    // broken colour assignment it was invisible; at 150 with alpha 0.68 under
    // 'lighter' it blew out the whole canvas and made the banner unreadable.
    const streaks = 104;
    for (let i = 0; i < streaks; i += 1) {
      // Deterministic pseudo-random angle and radius per streak: no allocation,
      // and the tunnel does not shimmer randomly frame to frame.
      const seed = i * 2.399963;
      const angle = seed % (Math.PI * 2);
      const spread = 0.16 + ((i * 37) % 100) / 100 * 0.84;
      const inner = reach * 0.06 * spread;
      const outer = inner + reach * 0.72 * strength * (0.4 + spread * 0.6);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Build the colour, THEN assign once.
      //
      // Assigning a partial string and appending to it does not work and does
      // not complain: canvas silently ignores an invalid colour, so
      // `strokeStyle = 'rgba(90,150,255,'` leaves the previous value in place,
      // and `strokeStyle += ...` then reads that old value back and appends to
      // it -- producing another invalid string that is also ignored. The
      // streaks drew in whatever colour happened to be current.
      const alpha = (0.08 + 0.30 * strength).toFixed(3);
      ctx.strokeStyle = i % 5 === 0
        ? `rgba(150,220,255,${alpha})`
        : `rgba(90,150,255,${alpha})`;
      ctx.lineWidth = 1 + strength * 1.5;
      ctx.beginPath();
      ctx.moveTo(camera.cx + cos * inner, camera.cy + sin * inner);
      ctx.lineTo(camera.cx + cos * outer, camera.cy + sin * outer);
      ctx.stroke();
    }

    // The tunnel mouth closing.
    const glow = ctx.createRadialGradient?.(
      camera.cx, camera.cy, 0,
      camera.cx, camera.cy, reach * 0.34 * strength + 1,
    );
    if (glow) {
      glow.addColorStop(0, `rgba(190,235,255,${(0.16 * strength).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(150,200,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  /** The settings chip, top-left, clear of the shell's own controls. */
  private settingsButtonRect(w: number, h: number): { x: number; y: number; w: number; h: number } {
    const size = Math.max(30, Math.min(w, h) * 0.075);
    // A FIXED offset, not a fraction of height. At h*0.12 the chip landed on
    // top of the shell's own fullscreen button in landscape (420px tall puts
    // 0.12 at y=50, and the chip sits at 52-80) -- two controls in the same
    // place, one of them invisible. The shell's chip is at a fixed pixel
    // position, so this has to be too.
    return { x: 12, y: SETTINGS_BUTTON_TOP, w: size, h: size };
  }

  private drawSettingsButton(w: number, h: number): void {
    const { ctx } = this;
    const r = this.settingsButtonRect(w, h);
    ctx.save();
    ctx.globalAlpha = this.settingsOpen ? 1 : 0.62;
    ctx.fillStyle = 'rgba(8,4,8,0.72)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,80,90,0.75)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#ffd0d4';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const y = r.y + r.h * (0.32 + i * 0.18);
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.24, y);
      ctx.lineTo(r.x + r.w * 0.76, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The settings rows, in screen pixels. One definition for paint and touch. */
  private settingsRows(w: number, h: number): Array<{ id: 'sensitivity' | 'recalibrate' | 'close'; rect: { x: number; y: number; w: number; h: number } }> {
    const panelW = Math.min(w * 0.82, 340);
    const rowH = Math.max(44, h * 0.075);
    const x = (w - panelW) / 2;
    const top = h * 0.5 - rowH * 1.9;
    return (['sensitivity', 'recalibrate', 'close'] as const).map((id, index) => ({
      id,
      rect: { x, y: top + index * (rowH + 10), w: panelW, h: rowH },
    }));
  }

  private drawSettings(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(2,1,4,0.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd0d4';
    ctx.font = `700 ${Math.max(13, w * 0.04)}px "Courier New", monospace`;
    const rows = this.settingsRows(w, h);
    ctx.fillText('SETTINGS', w / 2, rows[0].rect.y - 30);

    for (const row of rows) {
      const { rect } = row;
      ctx.fillStyle = 'rgba(20,6,10,0.9)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = row.id === 'close' ? 'rgba(120,140,160,0.7)' : 'rgba(255,80,90,0.8)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#ffe6e8';
      ctx.font = `600 ${Math.max(11, rect.h * 0.3)}px "Courier New", monospace`;
      const label = row.id === 'sensitivity'
        ? `TILT SENSITIVITY   ${this.settings.tiltSensitivity.toUpperCase()}`
        : row.id === 'recalibrate' ? 'RECALIBRATE TILT' : 'CLOSE';
      ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }

    ctx.fillStyle = 'rgba(200,210,230,0.7)';
    ctx.font = `${Math.max(9, w * 0.026)}px "Courier New", monospace`;
    const rows2 = rows[rows.length - 1].rect;
    ctx.fillText('Hold the phone how you want to fly, then recalibrate.', w / 2, rows2.y + rows2.h + 26);
    ctx.restore();
  }

  private drawToast(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.settingsToast * 1.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(2,10,6,0.85)';
    const text = this.settingsToastText;
    ctx.font = `700 ${Math.max(12, w * 0.034)}px "Courier New", monospace`;
    const width = ctx.measureText(text).width + 28;
    // Above the panel, not on it. At 0.3 the toast landed across the SETTINGS
    // heading and both were unreadable -- and the toast fires precisely when
    // the panel is open, so that overlap was the common case rather than an
    // edge one.
    const y = h * 0.17;
    ctx.fillRect((w - width) / 2, y - 18, width, 36);
    ctx.fillStyle = '#00ff6a';
    ctx.fillText(text, w / 2, y);
    ctx.restore();
  }

  private drawDeepField(w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#01030a';
    ctx.fillRect(0, 0, w, h);
    // The backdrop is the sky at infinity: it slides with the camera's heading
    // so turning changes what is out there, rather than dragging a wallpaper.
    const shiftX = -wrapAngle(this.camera.yaw) / Math.PI * w * 0.5;
    const shiftY = this.camera.pitch / Math.PI * h * 0.7;
    // Faint. At half opacity this read as a wall hanging in front of the ship
    // instead of as the far field, and it drowned the stars that are the only
    // thing telling you which way you are pointing.
    ctx.save();
    ctx.globalAlpha = 0.17;
    const tileW = w * 1.6;
    const wrapped = ((shiftX % tileW) + tileW) % tileW;
    for (const tile of [-1, 0]) {
      this.sprites.draw('backgrounds', this.leg.backdrop, wrapped + tile * tileW, shiftY - 80, tileW, h + 160, this.clock);
    }
    ctx.restore();
  }

  /**
   * Stars are direction, not position: each is projected from a point one
   * FAR_PLANE away along its own unit vector, recomputed from wherever the
   * ship now is. They therefore turn with you and never stream past, which is
   * exactly how a real sky behaves and is the only orientation cue out here.
   */
  private drawStars(): void {
    const { ctx } = this;
    ctx.save();
    for (const star of this.stars) {
      const p = project(
        this.camera,
        this.camera.x + star.x * FAR_PLANE,
        this.camera.y + star.y * FAR_PLANE,
        this.camera.z + star.z * FAR_PLANE,
      );
      if (!p.visible || !onScreen(this.camera, p, 8)) continue;
      ctx.globalAlpha = 0.3 + star.mag * 0.7;
      ctx.fillStyle = star.mag > 0.86 ? '#dff0ff' : star.mag > 0.5 ? '#9fc0dd' : '#6d8aa6';
      const size = 0.7 + star.mag * 1.7;
      ctx.fillRect(p.sx, p.sy, size, size);
    }
    ctx.restore();
  }

  /** Dust: near, real positions, streaked by how fast it is going past. */
  private drawMotes(): void {
    const { ctx } = this;
    const dir = forward(this.camera);
    // Dust streaks stretch with actual speed, warp included -- it is the only
    // thing on screen that can show how fast you are really going.
    const back = CRUISE * this.throttle * (this.warpHeld ? WARP_MULTIPLIER : 1) * 0.055;
    ctx.save();
    ctx.lineCap = 'round';
    for (const mote of this.motes) {
      const head = project(this.camera, mote.x, mote.y, mote.z);
      if (!head.visible || !onScreen(this.camera, head, 30)) continue;
      const tail = project(this.camera, mote.x + dir.x * back, mote.y + dir.y * back, mote.z + dir.z * back);
      ctx.globalAlpha = Math.min(0.75, depthAlpha(head.depth) * 1.3);
      ctx.strokeStyle = '#8fb4d6';
      ctx.lineWidth = Math.max(0.6, head.scale * 1.1);
      ctx.beginPath();
      ctx.moveTo(head.sx, head.sy);
      ctx.lineTo(tail.visible ? tail.sx : head.sx, tail.visible ? tail.sy : head.sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawContact(contact: Contact, p: ReturnType<typeof project>): void {
    if (!onScreen(this.camera, p, 200)) return;
    const size = screenSize(this.camera, contact.size, p.depth);
    if (size < 1.5) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = depthAlpha(p.depth);
    ctx.translate(p.sx, p.sy);
    ctx.rotate(this.camera.roll);
    if (!this.sprites.draw('enemies', contact.sprite, -size / 2, -size / 2, size, size, this.clock)) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.strokeRect(-size / 2, -size / 2, size, size);
    }
    ctx.restore();

    this.drawTargetBracket(p.sx, p.sy, size, contact.id === this.lockId);
  }

  /**
   * Corner brackets on a contact, with a FLOOR on their size.
   *
   * Engagements start thousands of units out now, where a fighter projects to
   * about seven pixels -- findable only if you already knew where to look. The
   * bracket never shrinks below a readable size, so a distant contact is a
   * mark you can see and fly toward instead of a dark speck against a
   * starfield.
   *
   * This does not move anything or aim anything. The bracket is drawn at the
   * contact's true projected position; only its own size is floored.
   */
  private drawTargetBracket(sx: number, sy: number, hullSize: number, locked: boolean): void {
    const { ctx } = this;
    const b = Math.max(BRACKET_MIN_PIXELS, hullSize * 0.8);
    const arm = b * 0.3;
    const half = b / 2;
    ctx.save();
    ctx.globalAlpha = locked ? 0.95 : 0.62;
    ctx.strokeStyle = locked ? AMBER : RED;
    ctx.lineWidth = locked ? 2 : 1.4;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const cx = sx + dx * half;
      const cy = sy + dy * half;
      ctx.beginPath();
      ctx.moveTo(cx - dx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - dy * arm);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoss(p: ReturnType<typeof project>): void {
    const boss = this.leg.boss;
    const size = screenSize(this.camera, boss.size, p.depth);
    const { ctx } = this;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(this.camera.roll);
    if (!this.sprites.draw('bosses', boss.spriteKey, -size / 2, -size / 2, size, size, this.clock)) {
      ctx.fillStyle = 'rgba(255,76,102,0.25)';
      ctx.fillRect(-size / 2, -size / 2, size, size);
    }
    ctx.restore();
    this.drawTargetBracket(p.sx, p.sy, size, true);
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(this.camera.roll);
    // The guard, drawn only while it is up, so the opening is something you can
    // SEE rather than something you have to have memorised.
    if (this.bossState === 'windUp') {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#36a3ff';
      ctx.lineWidth = Math.max(2, size * 0.025);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBolt(bolt: Bolt, p: ReturnType<typeof project>): void {
    if (!onScreen(this.camera, p, 60)) return;
    const size = clamp(screenSize(this.camera, bolt.size, p.depth), 1.4, MAX_BOLT_PIXELS);
    const { ctx } = this;
    const key = bolt.hostile ? 'enemy_red_bullet' : 'bb_shot';
    ctx.save();
    if (!this.sprites.draw('projectiles', key, p.sx - size / 2, p.sy - size, size, size * 2, this.clock)) {
      ctx.fillStyle = bolt.hostile ? RED : GREEN;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMissile(missile: Missile, p: ReturnType<typeof project>): void {
    if (!onScreen(this.camera, p, 80)) return;
    const size = clamp(screenSize(this.camera, 26, p.depth), 2, 44);
    const { ctx } = this;
    ctx.save();
    if (!this.sprites.draw('projectiles', 'seeker_missile', p.sx - size / 2, p.sy - size, size, size * 2, this.clock)) {
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // A short exhaust so it reads as under power rather than falling.
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(this.clock * 40);
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy + size * 0.7, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBurst(burst: Burst, p: ReturnType<typeof project>): void {
    const t = burst.life / burst.max;
    const size = screenSize(this.camera, 110 * (1.4 - t), p.depth);
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = t;
    if (!this.sprites.draw('vfx', 'burst_ring', p.sx - size / 2, p.sy - size / 2, size, size, burst.max - burst.life)) {
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Fixed at the nose: in a cockpit you aim the ship, not a cursor. */
  private drawReticle(): void {
    const { ctx, camera } = this;
    ctx.save();
    ctx.strokeStyle = GREEN;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(camera.cx, camera.cy, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(camera.cx - 34, camera.cy);
    ctx.lineTo(camera.cx - 12, camera.cy);
    ctx.moveTo(camera.cx + 12, camera.cy);
    ctx.lineTo(camera.cx + 34, camera.cy);
    ctx.moveTo(camera.cx, camera.cy - 34);
    ctx.lineTo(camera.cx, camera.cy - 12);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The circular cursor on the locked target, plus the gun's lead pipper.
   *
   * Two separate marks that must not be confused for one another:
   *
   * - The RING sits on the target itself and says "this is what the missile
   *   goes to". While acquiring it is a wide arc that closes as the dwell
   *   fills, so you can see the lock being earned.
   * - The PIPPER sits where the target WILL BE when a bolt gets there, and
   *   says "put the nose here". It is drawn as a cross, never a ring, and it
   *   is what you actually fly onto.
   *
   * Nothing here aims anything. Both marks are drawn at positions computed
   * from the world; the guns still fire along forward(camera) and the shot
   * goes exactly where the nose points, whatever this draws.
   */
  private drawLockCursor(): void {
    const { ctx, camera } = this;
    const target = this.lockTarget();

    // Acquiring: an arc closing on the candidate, before there is a lock.
    if (!target && this.lockProgress > 0.02 && this.lockCandidateId !== null) {
      const candidate = this.lockCandidateId === BOSS_ID
        ? (this.mode === 'boss' && this.bossHp > 0 ? this.boss : null)
        : this.contacts.find((contact) => contact.id === this.lockCandidateId) ?? null;
      if (candidate) {
        const p = project(camera, candidate.x, candidate.y, candidate.z);
        if (p.visible) {
          const r = 34 - 12 * this.lockProgress;
          ctx.save();
          ctx.strokeStyle = 'rgba(79,216,255,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, -Math.PI / 2, -Math.PI / 2 + this.lockProgress * Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      return;
    }
    if (!target) return;

    const p = project(camera, target.x, target.y, target.z);
    if (p.visible) {
      const r = Math.max(20, screenSize(camera, 120, p.depth));
      ctx.save();
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Ticks at the cardinals, so it reads as an instrument rather than a
      // circle somebody drew round a ship.
      ctx.lineWidth = 1.6;
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        ctx.beginPath();
        ctx.moveTo(p.sx + Math.cos(angle) * r * 1.14, p.sy + Math.sin(angle) * r * 1.14);
        ctx.lineTo(p.sx + Math.cos(angle) * r * 1.42, p.sy + Math.sin(angle) * r * 1.42);
        ctx.stroke();
      }
      // Range on the bracket, so you do not have to look down to read it.
      const range = Math.hypot(target.x - camera.x, target.y - camera.y, target.z - camera.z);
      ctx.fillStyle = 'rgba(79,216,255,0.9)';
      ctx.font = '600 11px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(range / 1000).toFixed(1)}k`, p.sx + r * 1.5, p.sy);
      ctx.restore();
    }

    // The pipper. Drawn only when the intercept is in front of you: a solution
    // behind the camera projects to a mirrored ghost, and a cross floating on
    // the wrong side of the sky is worse than no cross at all.
    const lead = this.leadPoint(target);
    if (!lead) return;
    const lp = project(camera, lead.x, lead.y, lead.z);
    if (!lp.visible || !onScreen(camera, lp, 0)) return;
    ctx.save();
    ctx.strokeStyle = GREEN;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.8;
    const a = 9;
    ctx.beginPath();
    ctx.moveTo(lp.sx - a, lp.sy); ctx.lineTo(lp.sx - 3, lp.sy);
    ctx.moveTo(lp.sx + 3, lp.sy); ctx.lineTo(lp.sx + a, lp.sy);
    ctx.moveTo(lp.sx, lp.sy - a); ctx.lineTo(lp.sx, lp.sy - 3);
    ctx.moveTo(lp.sx, lp.sy + 3); ctx.lineTo(lp.sx, lp.sy + a);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lp.sx, lp.sy, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Chevrons at the edge of the glass for the nearest threats you cannot see.
   *
   * The radar says something is behind you; this says WHICH WAY TO TURN. In a
   * lane that would be noise; out here, without it, a tail sits on you and the
   * only feedback is the hull counting down.
   */
  private drawOffscreenCues(w: number, h: number): void {
    const { ctx, camera } = this;
    const threats = this.contacts
      .map((contact) => ({ contact, view: toView(camera, contact.x, contact.y, contact.z) }))
      .map((item) => ({ ...item, range: rangeTo(item.view) }))
      .filter((item) => item.range < 1800)
      .sort((a, b) => a.range - b.range)
      .slice(0, 4);

    ctx.save();
    for (const threat of threats) {
      const p = project(camera, threat.contact.x, threat.contact.y, threat.contact.z);
      if (p.visible && onScreen(camera, p, -30)) continue;
      // Behind the camera flips the screen direction, so point at where it
      // actually is rather than at a mirrored ghost.
      const flip = p.depth <= NEAR_PLANE ? -1 : 1;
      const angle = Math.atan2(threat.view.y * flip, threat.view.x * flip);
      const radius = Math.min(w, h) * 0.34;
      const x = camera.cx + Math.cos(angle) * radius;
      const y = camera.cy + Math.sin(angle) * radius;
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(this.clock * 7);
      ctx.fillStyle = RED;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawDamageFlash(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.min(0.4, this.graceClock * 0.34) * Math.abs(Math.sin(this.clock * 20));
    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawBanner(w: number, h: number, cockpitDrawn: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';

    // Without the canopy there are no instruments, so fall back to a strip.
    if (!cockpitDrawn) {
      ctx.fillStyle = 'rgba(1,3,10,0.62)';
      ctx.fillRect(0, 0, w, 26);
      ctx.font = '600 12px "Courier New", monospace';
      ctx.fillStyle = GREEN;
      ctx.textAlign = 'left';
      ctx.fillText(`HULL ${'|'.repeat(Math.max(0, this.hp))}`, 10, 17);
      ctx.textAlign = 'right';
      ctx.fillText(`${this.score}`, w - 10, 17);
      ctx.textAlign = 'center';
    }

    if (this.bannerClock > 0 && this.mode !== 'won' && this.mode !== 'lost') {
      ctx.globalAlpha = Math.min(1, this.bannerClock);
      ctx.font = '700 15px "Courier New", monospace';
      ctx.fillStyle = GREEN;
      ctx.fillText(this.bannerText, this.camera.cx, this.camera.cy - Math.min(w, h) * 0.2);
    }

    if (this.mode === 'won' || this.mode === 'lost') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(1,3,10,0.75)';
      ctx.fillRect(0, this.camera.cy - 54, w, 106);
      ctx.fillStyle = this.mode === 'won' ? GREEN : RED;
      ctx.font = '700 24px "Courier New", monospace';
      ctx.fillText(this.mode === 'won' ? 'APPROACH CLEAR' : 'HULL BREACH', this.camera.cx, this.camera.cy - 14);
      ctx.fillStyle = '#cfe';
      ctx.font = '600 13px "Courier New", monospace';
      ctx.fillText(`SCORE ${this.score} — TAP TO FLY AGAIN`, this.camera.cx, this.camera.cy + 20);
    }
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function normalise(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Distance from a point to the segment a bolt covered this frame.
 * Without this, fast bolts tunnel straight through everything.
 */
function segmentDistance(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  point: { x: number; y: number; z: number },
): number {
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const sz = to.z - from.z;
  const lenSq = sx * sx + sy * sy + sz * sz;
  if (lenSq === 0) return Math.hypot(point.x - from.x, point.y - from.y, point.z - from.z);
  let t = ((point.x - from.x) * sx + (point.y - from.y) * sy + (point.z - from.z) * sz) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(point.x - (from.x + sx * t), point.y - (from.y + sy * t), point.z - (from.z + sz * t));
}
