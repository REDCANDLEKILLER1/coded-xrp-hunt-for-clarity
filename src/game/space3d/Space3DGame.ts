import { AssetLoader } from '../core/AssetLoader';
import { Loop } from '../core/Loop';
import { SpriteRenderer } from '../core/Sprite';
import { sfx } from '../audio/Sfx';
import { debugLog } from '../core/DebugLog';
import { Cockpit, type CockpitButtonId, type CockpitContact, type CockpitState } from './Cockpit';
import { TiltSource } from './Tilt';
import {
  FAR_PLANE,
  NEAR_PLANE,
  bearing,
  depthAlpha,
  forward,
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

type EnemyState = 'inbound' | 'engaged' | 'breaking';

type Contact = {
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
  state: EnemyState;
  stateClock: number;
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

type Missile = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number };
type Burst = { x: number; y: number; z: number; life: number; max: number };
/** Stars sit on a unit sphere: infinitely far, so they turn but never pass. */
type Star = { x: number; y: number; z: number; mag: number };
/** Dust is near and DOES pass, which is the only cue for how fast you are going. */
type Mote = { x: number; y: number; z: number };

type Mode = 'flying' | 'boss' | 'won' | 'lost';

const FOCAL = 470;
/** Cruise speed, world units per second. */
const CRUISE = 240;
const THROTTLE_MIN = 0.35;
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
const RADAR_RANGE = 2600;
/** Contacts further out than this stop being simulated in detail. */
const DESPAWN_RANGE = 4600;

const RED = '#ff4c66';
const GREEN = '#00ff6a';
const AMBER = '#ffb020';

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
  private missileCharge = 1;
  private shieldFore = 1;
  private shieldAft = 1;
  private shieldQuiet = 0;

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
    this.mode = 'flying';
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
    this.missileCharge = 1;
    this.shieldFore = 1;
    this.shieldAft = 1;
    this.shieldQuiet = 0;
    this.squadronIndex = 0;
    this.squadronClock = 2.0;
    this.fireClock = 0;
    this.bossHp = 0;
    this.escortsLaunched = false;
    this.seedSky();
    this.tilt.recalibrate('run start');
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
    if (this.mode === 'flying' || this.mode === 'boss') this.update(dt);
    this.render();
  }

  private update(dt: number): void {
    this.updateFlight(dt);
    this.updateSquadrons(dt);
    this.updateContacts(dt);
    if (this.mode === 'boss') this.updateBoss(dt);
    this.updateBolts(dt);
    this.updateMissiles(dt);
    this.fireGuns(dt);
    this.updateShields(dt);
    this.collide();
    for (const burst of this.bursts) burst.life -= dt;
    this.bursts = this.bursts.filter((burst) => burst.life > 0);
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

    const dir = forward(this.camera);
    const speed = CRUISE * this.throttle;
    this.camera.x += dir.x * speed * dt;
    this.camera.y += dir.y * speed * dt;
    this.camera.z += dir.z * speed * dt;

    // Recycle dust through a box that travels with the ship.
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
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 1.1;
    const cos = Math.cos(pitch);
    const base = {
      x: this.camera.x + Math.sin(yaw) * cos * squadron.entryRange,
      y: this.camera.y + Math.sin(pitch) * squadron.entryRange,
      z: this.camera.z + Math.cos(yaw) * cos * squadron.entryRange,
    };
    for (let i = 0; i < squadron.count; i += 1) {
      const spread = 130;
      this.contacts.push({
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
        state: 'inbound',
        stateClock: 0,
        standoff: squadron.standoff,
        speed: squadron.speed,
        fireClock: squadron.fireInterval > 0 ? squadron.fireInterval * (0.5 + Math.random()) : Number.POSITIVE_INFINITY,
        fireInterval: squadron.fireInterval,
        score: squadron.score,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitTilt: (Math.random() - 0.5) * 1.4,
      });
    }
    this.banner(`SCRAMBLE // ${squadron.count} ${squadron.pattern.replace('_', ' ').toUpperCase()}`, 1.8);
    sfx.play('enemyShoot');
  }

  /**
   * Enemy flight.
   *
   * They fly TO somewhere and hold there; they do not run at you on rails.
   * Each pattern picks a different point to want to be at relative to the
   * player, and the shared steering below flies them to it at their own speed.
   * That is what makes them read as aircraft manoeuvring rather than as
   * obstacles arriving.
   */
  private updateContacts(dt: number): void {
    for (const contact of this.contacts) {
      contact.stateClock += dt;
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

      if (contact.state === 'inbound' && range < contact.standoff * 1.5) contact.state = 'engaged';

      if (contact.fireInterval > 0 && contact.state === 'engaged' && range < contact.standoff * 2.4) {
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

  /** Where a contact wants to be, which is what its pattern actually means. */
  private desiredPosition(contact: Contact, range: number, dt: number): { x: number; y: number; z: number } {
    const dir = forward(this.camera);
    switch (contact.pattern) {
      case 'joust': {
        // Runs in, overshoots, then swings out and comes back around.
        if (contact.state === 'engaged' && range < contact.standoff * 0.55) contact.state = 'breaking';
        if (contact.state === 'breaking') {
          if (contact.stateClock > 3.4) {
            contact.state = 'inbound';
            contact.stateClock = 0;
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
    for (let i = 0; i < boss.escortCount; i += 1) {
      const angle = (i / boss.escortCount) * Math.PI * 2;
      this.contacts.push({
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
        state: 'inbound',
        stateClock: 0,
        standoff: 480,
        speed: 215,
        fireClock: 1.6,
        fireInterval: 2.2,
        score: 70,
        orbitPhase: angle,
        orbitTilt: (Math.random() - 0.5) * 1.2,
      });
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
   * The special: a heavy seeker that has to be charged for.
   *
   * It picks the nearest contact inside a cone off the nose. PR 3 replaces
   * that with the formal target lock -- the seeker steering below is written
   * against "a mark" rather than "the nearest thing" so that swap is a
   * one-line change rather than a rewrite.
   */
  private fireMissile(): void {
    if (this.mode !== 'flying' && this.mode !== 'boss') return;
    if (this.missileCharge < 1) {
      sfx.play('deny');
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

  /** Nearest contact inside the seeker cone, or null when it has lost the plot. */
  private seekTarget(missile: { x: number; y: number; z: number; vx: number; vy: number; vz: number }):
  { x: number; y: number; z: number } | null {
    const heading = normalise({ x: missile.vx, y: missile.vy, z: missile.vz });
    let best: { x: number; y: number; z: number } | null = null;
    let bestRange = Infinity;
    const consider = (x: number, y: number, z: number): void => {
      const dx = x - missile.x;
      const dy = y - missile.y;
      const dz = z - missile.z;
      const range = Math.hypot(dx, dy, dz) || 1;
      const cone = (dx * heading.x + dy * heading.y + dz * heading.z) / range;
      if (cone < Math.cos(MISSILE_SEEK_CONE)) return;
      if (range < bestRange) { bestRange = range; best = { x, y, z }; }
    };
    for (const contact of this.contacts) consider(contact.x, contact.y, contact.z);
    if (this.mode === 'boss' && this.bossHp > 0) consider(this.boss.x, this.boss.y, this.boss.z);
    return best;
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
        contact.hp -= 1;
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
        contact.hp -= MISSILE_DAMAGE;
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

    this.drawReticle();
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
      throttle: this.throttle,
      bossHealth: this.mode === 'boss' && this.bossHp > 0 ? Math.max(0, this.bossHp / this.leg.boss.hp) : null,
      bossLabel: this.leg.boss.label,
      status: this.mode === 'boss' ? 'INTERCEPT' : `NAV ${this.leg.destination}`,
      contacts,
      radarRange: RADAR_RANGE,
      rollReady: this.rollCooldown <= 0,
      clock: this.clock,
    };
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
    const back = CRUISE * this.throttle * 0.055;
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

    // A box on anything close enough to shoot, so a contact against the
    // backdrop is findable without hunting for a dark shape.
    if (p.depth < 1500 && size > 6) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1;
      const b = size * 0.75;
      ctx.strokeRect(p.sx - b / 2, p.sy - b / 2, b, b);
      ctx.restore();
    }
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
