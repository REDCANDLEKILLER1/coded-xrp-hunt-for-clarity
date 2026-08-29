import { AssetLoader } from '../core/AssetLoader';
import { Loop } from '../core/Loop';
import { SpriteRenderer } from '../core/Sprite';
import { sfx } from '../audio/Sfx';
import { debugLog } from '../core/DebugLog';
import {
  FAR_PLANE,
  NEAR_PLANE,
  depthAlpha,
  onScreen,
  project,
  screenSize,
  sortByDepth,
  type Camera,
} from './Projection';
import { ORBITAL_LANE, type FlightPattern, type SpaceLane, type SpaceWave } from './SpaceLane';

/**
 * The space flight segment: the same sprites, flown into the screen.
 *
 * The interior on-foot section asked a phone to do platforming with a thumb,
 * and it did not work. This is the other half of the answer: after boarding,
 * the game becomes a flyer through open space, where the only control needed
 * is "where is your finger" -- which is the one thing a touch screen is
 * genuinely good at.
 *
 * It is 3D by projection, not by geometry. Every contact carries a depth, the
 * perspective divide in Projection.ts turns that into position and scale, and
 * the existing 2D enemy art grows as it closes. No new dependency, no new
 * asset, no model format: the bundle stays what it was and the art pipeline
 * stays the one that has been producing images all along.
 *
 * Mounted on its own route so it can be flown in isolation. It announces
 * `coded:space-complete` and `coded:space-defeat` rather than reaching into
 * the campaign itself -- wiring it into the mission flow is a separate,
 * deliberate change.
 */

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
  pattern: FlightPattern;
  fireClock: number;
  fireInterval: number;
  score: number;
  /** Phase offset so a formation weaves as a formation, not in lockstep. */
  phase: number;
  born: number;
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

type Burst = { x: number; y: number; z: number; life: number; max: number };

type Star = { x: number; y: number; z: number };

type Mode = 'flying' | 'boss' | 'won' | 'lost';

/** Pixels from eye to screen plane. Tuned so a hull at the hold depth reads large but leaves room to dodge. */
const FOCAL = 430;
/** How far the eye can be pushed off the lane axis. Bounds the whole play field. */
const CAM_RANGE_X = 260;
const CAM_RANGE_Y = 165;
/** Seconds for the eye to cover the full range. Lower is twitchier. */
const CAM_EASE = 7.5;
/**
 * Where the player's own hull sits.
 *
 * The first pass put it at z=150 at size 74, which projects to a QUARTER of a
 * landscape screen -- the hull covered the reticle, the lane and most of the
 * traffic, so there was nothing to fly through. It sits further out and lower
 * now: small enough to see past, dropped below the aim point so the crosshair
 * is never behind it, which is where every game of this shape puts it.
 */
const SHIP_Z = 330;
/** The ship trails the eye, so the frame leads the hull and banking reads. */
const SHIP_LAG = 6.2;
const SHIP_SIZE = 55;
/**
 * How far down the frame the hull sits, as a fraction of half-height.
 *
 * A fixed world offset put it comfortably low in portrait and half off the
 * bottom edge of a short landscape window, because the same world units cover
 * a different share of a frame that is 380px tall than one that is 800. The
 * drop is derived from the viewport in resize() so the hull lands in the same
 * place on both.
 */
const SHIP_DROP_FRACTION = 0.52;
const SHIP_HITBOX = 26;
/** Roll, in radians, at full lateral input. */
const MAX_ROLL = 0.34;
const MAX_BANK = 0.55;

const PLAYER_HP = 6;
const SHOT_INTERVAL = 0.16;
const BOLT_SPEED = 1500;
const BOLT_SIZE = 9;
const HOSTILE_BOLT_SPEED = 620;
const HOSTILE_BOLT_SIZE = 13;
/** Seconds of invulnerability after a hit, so one bad frame is not three. */
const HIT_GRACE = 1.1;
/** A roll deflects everything for this long. The one defensive move. */
const ROLL_TIME = 0.62;
const ROLL_COOLDOWN = 0.95;

const STAR_COUNT = 190;
const BURST_LIFE = 0.42;
/** Enemies are worth hitting from here in; past it they are a rumour. */
const ENGAGE_Z = 1200;

const GREEN = '#00ff6a';
const BLUE = '#36a3ff';
const RED = '#ff4c66';
const AMBER = '#ffb020';

export class Space3DGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly assets = new AssetLoader();
  private readonly sprites: SpriteRenderer;
  private readonly loop = new Loop((dt) => this.tick(dt));
  private assetsReady = false;
  private visible = false;

  private lane: SpaceLane = ORBITAL_LANE;
  private mode: Mode = 'flying';
  private clock = 0;
  private score = 0;
  private hp = PLAYER_HP;
  private graceClock = 0;

  /** Where the finger is pointing, in world units, before easing. */
  private aimX = 0;
  private aimY = 0;
  private camera: Camera = { x: 0, y: 0, cx: 0, cy: 0, focal: FOCAL, roll: 0 };
  private shipX = 0;
  private shipY = 0;
  private shipDrop = 100;
  private bank = 0;
  private rollClock = 0;
  private rollCooldown = 0;

  private contacts: Contact[] = [];
  private bolts: Bolt[] = [];
  private bursts: Burst[] = [];
  private stars: Star[] = [];

  private waveIndex = 0;
  private waveClock = 0;
  private fireClock = 0;

  private bossHp = 0;
  private bossX = 0;
  private bossZ = 0;
  private bossAttack = 0;
  private bossClock = 0;
  private bossState: 'windUp' | 'recovery' = 'windUp';
  private escortsLaunched = false;

  private bannerText = '';
  private bannerClock = 0;

  private pointerId: number | null = null;
  private pointerStart = { x: 0, y: 0 };
  private aimStart = { x: 0, y: 0 };
  private pointerMoved = false;
  private pointerDownAt = 0;

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
    this.shell.appendChild(this.canvas);
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * @param straightToBoss skip the waves and open on the boss. Reaching it
   * normally is four minutes of flying, which is four minutes per attempt when
   * the thing being checked is the boss.
   */
  async show(lane: SpaceLane = ORBITAL_LANE, straightToBoss = false): Promise<void> {
    this.lane = lane;
    if (!this.assetsReady) {
      await this.assets.loadManifest();
      this.assetsReady = true;
    }
    this.visible = true;
    this.canvas.style.display = 'block';
    this.resize();
    this.restart();
    if (straightToBoss) {
      this.waveIndex = this.lane.waves.length;
      this.startBoss();
    }
    this.loop.start();
    debugLog.log('mode', 'lane entered', { lane: lane.key, waves: lane.waves.length });
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
    this.loop.stop();
  }

  private restart(): void {
    this.mode = 'flying';
    this.clock = 0;
    this.score = 0;
    this.hp = PLAYER_HP;
    this.graceClock = 0;
    this.aimX = 0;
    this.aimY = 0;
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.roll = 0;
    this.shipX = 0;
    this.shipY = 0;
    this.bank = 0;
    this.rollClock = 0;
    this.rollCooldown = 0;
    this.contacts = [];
    this.bolts = [];
    this.bursts = [];
    this.waveIndex = 0;
    this.waveClock = 0.9;
    this.fireClock = 0;
    this.bossHp = 0;
    this.escortsLaunched = false;
    this.seedStars();
    this.banner(`${this.lane.label} // DRAG TO FLY`, 3.0);
  }

  /** Stars are the only thing here that is procedural, and they carry the speed. */
  private seedStars(): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2400,
        y: (Math.random() - 0.5) * 1600,
        z: NEAR_PLANE + Math.random() * (FAR_PLANE - NEAR_PLANE),
      });
    }
  }

  // ---- input ------------------------------------------------------------
  //
  // One gesture does everything that matters: drag to fly. The aim moves
  // RELATIVE to where the finger went down rather than jumping to it, so the
  // ship does not teleport under the thumb on the first touch -- the same
  // gesture-intent rule the top-down game settled on.

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.visible) return;
      event.preventDefault();
      if (this.mode === 'won' || this.mode === 'lost') return void this.restart();
      this.pointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.pointerStart = { x: event.clientX, y: event.clientY };
      this.aimStart = { x: this.aimX, y: this.aimY };
      this.pointerMoved = false;
      this.pointerDownAt = this.clock;
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.visible || event.pointerId !== this.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - this.pointerStart.x;
      const dy = event.clientY - this.pointerStart.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.pointerMoved = true;
      // Screen pixels to world units at the ship's depth: a finger that moves
      // an inch moves the ship the same distance on screen whatever the DPR.
      const perPixel = SHIP_Z / this.camera.focal;
      this.aimX = clamp(this.aimStart.x + dx * perPixel, -CAM_RANGE_X, CAM_RANGE_X);
      this.aimY = clamp(this.aimStart.y + dy * perPixel, -CAM_RANGE_Y, CAM_RANGE_Y);
    });

    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.pointerId) return;
      // A tap that never became a drag is a barrel roll. It costs nothing to
      // discover and it is the only thing to press.
      if (!this.pointerMoved && this.clock - this.pointerDownAt < 0.35) this.startRoll();
      this.pointerId = null;
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);

    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      const step = 46;
      if (event.key === 'ArrowLeft' || event.key === 'a') this.aimX = clamp(this.aimX - step, -CAM_RANGE_X, CAM_RANGE_X);
      if (event.key === 'ArrowRight' || event.key === 'd') this.aimX = clamp(this.aimX + step, -CAM_RANGE_X, CAM_RANGE_X);
      if (event.key === 'ArrowUp' || event.key === 'w') this.aimY = clamp(this.aimY - step, -CAM_RANGE_Y, CAM_RANGE_Y);
      if (event.key === 'ArrowDown' || event.key === 's') this.aimY = clamp(this.aimY + step, -CAM_RANGE_Y, CAM_RANGE_Y);
      if (event.key === ' ') {
        event.preventDefault();
        if (this.mode === 'won' || this.mode === 'lost') this.restart();
        else this.startRoll();
      }
    });
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
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.cx = w / 2;
    this.camera.cy = h / 2;
    // A narrow portrait frame needs a wider lens or the lane fills the screen
    // before there is anywhere to dodge to.
    this.camera.focal = FOCAL * clamp(w / 780, 0.62, 1.15);
    // Same screen position on any frame shape: solve the projection backwards.
    this.shipDrop = (this.camera.cy * SHIP_DROP_FRACTION) / (this.camera.focal / SHIP_Z);
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
    this.updateStars(dt);
    this.updateWaves(dt);
    this.updateContacts(dt);
    if (this.mode === 'boss') this.updateBoss(dt);
    this.updateBolts(dt);
    this.autoFire(dt);
    this.collide();
    for (const burst of this.bursts) burst.life -= dt;
    this.bursts = this.bursts.filter((burst) => burst.life > 0);
  }

  private updateFlight(dt: number): void {
    if (this.graceClock > 0) this.graceClock = Math.max(0, this.graceClock - dt);
    if (this.rollClock > 0) this.rollClock = Math.max(0, this.rollClock - dt);
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - dt);

    // The eye chases the aim; the hull chases the eye more slowly still. Two
    // lags is what turns a cursor into an aircraft.
    const ease = Math.min(1, dt * CAM_EASE);
    const previousX = this.camera.x;
    this.camera.x += (this.aimX - this.camera.x) * ease;
    this.camera.y += (this.aimY - this.camera.y) * ease;
    const shipEase = Math.min(1, dt * SHIP_LAG);
    this.shipX += (this.camera.x - this.shipX) * shipEase;
    this.shipY += (this.camera.y - this.shipY) * shipEase;

    const lateral = dt > 0 ? (this.camera.x - previousX) / dt : 0;
    const target = clamp(lateral / 420, -1, 1);
    this.bank += (target - this.bank) * Math.min(1, dt * 6);
    this.camera.roll = -this.bank * MAX_ROLL;
  }

  private updateStars(dt: number): void {
    // Stars close at a fixed rate whatever the traffic is doing: the lane is
    // always moving, so the segment never feels parked between waves.
    const speed = 520 + (this.mode === 'boss' ? 90 : 0);
    for (const star of this.stars) {
      star.z -= speed * dt;
      if (star.z > NEAR_PLANE) continue;
      star.z = FAR_PLANE;
      star.x = (Math.random() - 0.5) * 2400 + this.camera.x;
      star.y = (Math.random() - 0.5) * 1600 + this.camera.y;
    }
  }

  private updateWaves(dt: number): void {
    if (this.mode !== 'flying') return;
    this.waveClock -= dt;
    if (this.waveClock > 0) return;
    if (this.waveIndex >= this.lane.waves.length) {
      if (this.contacts.length === 0) this.startBoss();
      this.waveClock = 0.4;
      return;
    }
    const wave = this.lane.waves[this.waveIndex];
    this.spawnWave(wave);
    this.waveIndex += 1;
    this.waveClock = wave.gap;
  }

  private spawnWave(wave: SpaceWave): void {
    for (let i = 0; i < wave.count; i += 1) {
      const t = wave.count === 1 ? 0 : i / (wave.count - 1) - 0.5;
      let x = t * wave.spread * 2;
      let y = 0;
      let z = FAR_PLANE;
      switch (wave.shape) {
        case 'vee':
          y = -Math.abs(t) * wave.spread * 0.7 + wave.spread * 0.25;
          break;
        case 'column':
          x = 0;
          y = t * wave.spread;
          z = FAR_PLANE + i * 90;
          break;
        case 'ring': {
          const angle = (i / wave.count) * Math.PI * 2;
          x = Math.cos(angle) * wave.spread;
          y = Math.sin(angle) * wave.spread * 0.62;
          break;
        }
        case 'pair':
          x = (i % 2 === 0 ? -1 : 1) * wave.spread * 0.75;
          y = Math.floor(i / 2) * 90 - 45;
          break;
        case 'line':
        default:
          y = t * wave.spread * 0.22;
          break;
      }
      this.contacts.push({
        x: x + this.camera.x * 0.35,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: -wave.speed,
        hp: wave.hp,
        size: 72,
        sprite: wave.enemyKey,
        pattern: wave.pattern,
        fireClock: wave.fireInterval > 0 ? wave.fireInterval * (0.6 + Math.random() * 0.7) : Number.POSITIVE_INFINITY,
        fireInterval: wave.fireInterval,
        score: wave.score,
        phase: Math.random() * Math.PI * 2,
        born: this.clock,
      });
    }
    this.banner(`CONTACT // ${wave.count} ${wave.pattern.toUpperCase()}`, 1.3);
  }

  private updateContacts(dt: number): void {
    for (const contact of this.contacts) {
      const age = this.clock - contact.born;
      switch (contact.pattern) {
        case 'weave':
          // Lateral slide that grows as it closes, so a held aim drifts off it.
          contact.x += Math.cos(age * 2.1 + contact.phase) * 190 * dt;
          contact.y += Math.sin(age * 1.5 + contact.phase) * 90 * dt;
          break;
        case 'chase': {
          // Tracks the eye. Slow enough to out-turn, fast enough to punish a
          // player who parks in one lane and holds the trigger.
          const dx = this.camera.x - contact.x;
          const dy = this.camera.y - contact.y;
          contact.x += clamp(dx, -150, 150) * dt * 1.25;
          contact.y += clamp(dy, -110, 110) * dt * 1.25;
          break;
        }
        case 'flank': {
          // Out wide, then back down the side: it leaves the frame on purpose
          // and returns from an edge the player is not watching.
          const swing = Math.sin(age * 1.05 + contact.phase);
          contact.x += swing * 320 * dt;
          contact.y += Math.cos(age * 0.8 + contact.phase) * 130 * dt;
          break;
        }
        case 'straight':
        default:
          break;
      }
      contact.z += contact.vz * dt;

      if (contact.fireInterval > 0 && contact.z < ENGAGE_Z) {
        contact.fireClock -= dt;
        if (contact.fireClock <= 0) {
          contact.fireClock = contact.fireInterval;
          this.fireHostile(contact.x, contact.y, contact.z);
        }
      }
    }

    // A contact that reaches the near plane has flown past, not through: the
    // player is not hit for failing to shoot something down.
    this.contacts = this.contacts.filter((contact) => contact.z > NEAR_PLANE && contact.hp > 0);
  }

  private startBoss(): void {
    if (this.mode === 'boss') return;
    this.mode = 'boss';
    this.bossHp = this.lane.boss.hp;
    this.bossX = 0;
    this.bossZ = FAR_PLANE;
    this.bossAttack = 0;
    this.bossClock = this.lane.boss.attacks[0].windUp;
    this.bossState = 'windUp';
    this.escortsLaunched = false;
    this.banner(`${this.lane.boss.label} // INBOUND`, 2.6);
    sfx.play('bigExplode');
    window.dispatchEvent(new CustomEvent('coded:music-cue', { detail: { cue: 'boss' } }));
    debugLog.log('mode', 'boss engaged', { boss: this.lane.boss.label, hp: this.bossHp });
  }

  private updateBoss(dt: number): void {
    const boss = this.lane.boss;
    // Closes to its hold depth and stays there, strafing.
    this.bossZ += (boss.holdZ - this.bossZ) * Math.min(1, dt * 0.9);
    this.bossX = Math.sin(this.clock * 0.55) * 190;

    if (!this.escortsLaunched && this.bossHp <= boss.hp * boss.escortAt) {
      this.escortsLaunched = true;
      this.launchEscorts();
    }

    if (this.bossZ > boss.holdZ + 120) return;
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
    const boss = this.lane.boss;
    this.banner('ESCORTS LAUNCHED', 1.8);
    for (let i = 0; i < boss.escortCount; i += 1) {
      const angle = (i / boss.escortCount) * Math.PI * 2;
      this.contacts.push({
        x: this.bossX + Math.cos(angle) * 150,
        y: Math.sin(angle) * 100,
        z: this.bossZ - 40,
        vx: 0,
        vy: 0,
        vz: -330,
        hp: 2,
        size: 64,
        sprite: boss.escortKey,
        pattern: 'chase',
        fireClock: 1.4,
        fireInterval: 2.0,
        score: 70,
        phase: angle,
        born: this.clock,
      });
    }
  }

  private fireBossPattern(key: string, shots: number): void {
    sfx.play('enemyShoot');
    for (let i = 0; i < shots; i += 1) {
      const t = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      let x = this.bossX;
      let y = 0;
      let vx = 0;
      let vy = 0;
      switch (key) {
        case 'spread':
          // A fan. Aimed at the lane, not at you: there is a gap, and finding
          // it is the point.
          vx = t * 420;
          vy = 90;
          break;
        case 'lance':
          // Tracks where you are NOW, so it must be moved away from, not sat under.
          x = this.bossX + t * 60;
          vx = (this.shipX - this.bossX) * 0.55;
          vy = this.shipWorldY() * 0.55;
          break;
        case 'swarm':
          x = this.bossX + t * 220;
          y = t * 120;
          vx = t * 180;
          vy = -t * 120;
          break;
        case 'wall':
        default:
          // A horizontal curtain with one hole, punched at a random lane.
          x = this.bossX + t * 560;
          y = 0;
          vx = 0;
          vy = 0;
          break;
      }
      if (key === 'wall' && Math.abs(t) < 0.09) continue;
      this.bolts.push({
        x,
        y,
        z: this.bossZ - 30,
        vx,
        vy,
        vz: -HOSTILE_BOLT_SPEED,
        hostile: true,
        size: HOSTILE_BOLT_SIZE,
        life: 6,
      });
    }
  }

  private fireHostile(x: number, y: number, z: number): void {
    // Led toward the HULL, not the aim point. Leading the camera aimed every
    // shot at the crosshair, which floats above the ship -- a permanent miss
    // that made the whole lane harmless.
    sfx.play('enemyShoot');
    const flight = Math.max(0.35, (z - SHIP_Z) / HOSTILE_BOLT_SPEED);
    this.bolts.push({
      x,
      y,
      z,
      vx: (this.shipX - x) / flight * 0.72,
      vy: (this.shipWorldY() - y) / flight * 0.72,
      vz: -HOSTILE_BOLT_SPEED,
      hostile: true,
      size: HOSTILE_BOLT_SIZE,
      life: 6,
    });
  }

  private autoFire(dt: number): void {
    // Auto-fire, like the top-down game. A fire button would cost the thumb
    // that is flying the ship, which is the whole reason this segment exists.
    this.fireClock -= dt;
    if (this.fireClock > 0) return;
    this.fireClock = SHOT_INTERVAL;
    for (const side of [-1, 1]) {
      const muzzleX = this.shipX + side * 20;
      const muzzleY = this.shipWorldY();
      this.bolts.push({
        x: muzzleX,
        y: muzzleY,
        z: SHIP_Z,
        // Converge on the aim point: the two cannons cross where the reticle is.
        vx: (this.camera.x - muzzleX) * 3.2,
        vy: (this.camera.y - muzzleY) * 3.2,
        vz: BOLT_SPEED,
        hostile: false,
        size: BOLT_SIZE,
        life: 2.4,
      });
    }
    sfx.play('shoot');
  }

  private updateBolts(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.z += bolt.vz * dt;
      bolt.life -= dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.life > 0 && bolt.z < FAR_PLANE && bolt.z > NEAR_PLANE * 0.4);
  }

  /**
   * Hit tests, in depth.
   *
   * A bolt and a target collide when the bolt CROSSES the target's depth in
   * this frame, not when they happen to be close: at 1500 units/s a bolt moves
   * further per frame than a fighter is wide, so a plain distance test misses
   * almost every shot. The lateral test then uses the same world size the
   * renderer draws, so what looks like a hit is one.
   */
  private collide(): void {
    for (const bolt of this.bolts) {
      if (bolt.hostile) continue;
      const from = bolt.z - bolt.vz * (1 / 60);
      for (const contact of this.contacts) {
        if (contact.hp <= 0) continue;
        if (!crossed(from, bolt.z, contact.z)) continue;
        const radius = contact.size * 0.42;
        if (Math.abs(bolt.x - contact.x) > radius || Math.abs(bolt.y - contact.y) > radius) continue;
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
      if (this.mode === 'boss' && this.bossHp > 0 && crossed(from, bolt.z, this.bossZ)) {
        const radius = this.lane.boss.size * 0.4;
        if (Math.abs(bolt.x - this.bossX) <= radius && Math.abs(bolt.y) <= radius * 0.7) {
          // The boss is only soft on the recovery: shooting it through a
          // wind-up is meant to be worth less than waiting for the opening.
          const armoured = this.bossState === 'windUp';
          this.bossHp -= armoured ? 0.35 : 1.6;
          bolt.life = 0;
          this.burst(this.bossX, 0, this.bossZ);
          sfx.play('hit');
          if (this.bossHp <= 0) this.win();
        }
      }
    }

    if (this.graceClock > 0 || this.rollClock > 0) {
      // A roll deflects rather than phases: shots that would have hit are
      // spent, so a well-timed roll clears the screen in front of you.
      if (this.rollClock > 0) {
        for (const bolt of this.bolts) {
          if (bolt.hostile && bolt.z < SHIP_Z + 130 && bolt.z > NEAR_PLANE) bolt.life = 0;
        }
      }
      return;
    }

    const hullY = this.shipWorldY();
    for (const bolt of this.bolts) {
      if (!bolt.hostile || bolt.life <= 0) continue;
      if (bolt.z > SHIP_Z + 50 || bolt.z < SHIP_Z - 110) continue;
      if (Math.abs(bolt.x - this.shipX) > SHIP_HITBOX || Math.abs(bolt.y - hullY) > SHIP_HITBOX) continue;
      bolt.life = 0;
      this.takeHit();
      break;
    }

    for (const contact of this.contacts) {
      if (contact.z > SHIP_Z + 40 || contact.z < NEAR_PLANE) continue;
      const radius = contact.size * 0.4 + SHIP_HITBOX * 0.6;
      if (Math.abs(contact.x - this.shipX) > radius || Math.abs(contact.y - hullY) > radius) continue;
      contact.hp = 0;
      this.burst(contact.x, contact.y, contact.z);
      this.takeHit();
      break;
    }
  }

  private takeHit(): void {
    this.hp -= 1;
    this.graceClock = HIT_GRACE;
    sfx.play('hurt');
    this.banner(`HULL ${Math.max(0, this.hp)}/${PLAYER_HP}`, 1.2);
    if (this.hp <= 0) this.lose();
  }

  private win(): void {
    this.mode = 'won';
    this.score += 1200;
    this.banner('LANE CLEAR', 4);
    sfx.play('levelUp');
    debugLog.log('mode', 'lane cleared', { score: this.score });
    window.dispatchEvent(new CustomEvent('coded:space-complete', { detail: { lane: this.lane.key, score: this.score } }));
  }

  private lose(): void {
    this.mode = 'lost';
    this.banner('HULL BREACH', 4);
    sfx.play('bigExplode');
    debugLog.log('mode', 'lane lost', { score: this.score, wave: this.waveIndex });
    window.dispatchEvent(new CustomEvent('coded:space-defeat', { detail: { lane: this.lane.key, wave: this.waveIndex } }));
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
    const { ctx, camera } = this;
    const w = camera.cx * 2;
    const h = camera.cy * 2;
    ctx.clearRect(0, 0, w, h);
    this.drawBackdrop(w, h);
    this.drawStars();
    this.drawLaneGrid();

    // One depth-sorted pass over everything in the world, so a bolt in front of
    // a fighter draws in front of it and the boss never swallows its escorts.
    type Drawable = { z: number; paint: () => void };
    const drawables: Drawable[] = [];
    for (const contact of this.contacts) drawables.push({ z: contact.z, paint: () => this.drawContact(contact) });
    for (const bolt of this.bolts) drawables.push({ z: bolt.z, paint: () => this.drawBolt(bolt) });
    for (const burst of this.bursts) drawables.push({ z: burst.z, paint: () => this.drawBurst(burst) });
    if (this.mode === 'boss' && this.bossHp > 0) drawables.push({ z: this.bossZ, paint: () => this.drawBoss() });
    for (const item of sortByDepth(drawables)) item.paint();

    this.drawShip();
    this.drawReticle();
    this.drawHud(w, h);
  }

  private drawBackdrop(w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#01030a';
    ctx.fillRect(0, 0, w, h);
    // The backdrop is the far plane: it parallaxes a fraction of the camera so
    // it reads as distance rather than as wallpaper stuck to the screen.
    const shiftX = -this.camera.x * 0.06;
    const shiftY = -this.camera.y * 0.06;
    const over = 40;
    ctx.save();
    ctx.globalAlpha = 0.55;
    this.sprites.draw('backgrounds', this.lane.backdrop, shiftX - over, shiftY - over, w + over * 2, h + over * 2, this.clock);
    ctx.restore();
  }

  private drawStars(): void {
    const { ctx } = this;
    ctx.save();
    for (const star of this.stars) {
      const p = project(this.camera, star.x, star.y, star.z);
      if (!p.visible || !onScreen(this.camera, p, 20)) continue;
      const near = 1 - star.z / FAR_PLANE;
      // Near stars streak: the length IS the speed, and it costs one line.
      const tail = project(this.camera, star.x, star.y, Math.min(FAR_PLANE, star.z + 90));
      ctx.globalAlpha = 0.2 + near * 0.75;
      ctx.strokeStyle = near > 0.72 ? '#cfefff' : '#7fa6c8';
      ctx.lineWidth = 0.6 + near * 1.6;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(tail.visible ? tail.sx : p.sx, tail.visible ? tail.sy : p.sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * A receding grid on the lane floor.
   *
   * Stars alone give speed but not orientation -- with nothing but points, a
   * roll is invisible and there is no sense of a floor to fly over. Six ribs
   * and four rails cost almost nothing and anchor the whole field.
   */
  private drawLaneGrid(): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,106,0.13)';
    ctx.lineWidth = 1;
    const floor = 300;
    for (let i = 0; i < 7; i += 1) {
      const z = ((this.clock * 520 + i * 220) % 1540) + NEAR_PLANE + 10;
      const left = project(this.camera, -1400, floor, z);
      const right = project(this.camera, 1400, floor, z);
      if (!left.visible || !right.visible) continue;
      ctx.globalAlpha = depthAlpha(z) * 0.7;
      ctx.beginPath();
      ctx.moveTo(left.sx, left.sy);
      ctx.lineTo(right.sx, right.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.16;
    for (const x of [-900, -300, 300, 900]) {
      const near = project(this.camera, x, floor, NEAR_PLANE + 20);
      const far = project(this.camera, x, floor, FAR_PLANE);
      if (!near.visible || !far.visible) continue;
      ctx.beginPath();
      ctx.moveTo(near.sx, near.sy);
      ctx.lineTo(far.sx, far.sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawContact(contact: Contact): void {
    const p = project(this.camera, contact.x, contact.y, contact.z);
    if (!p.visible || !onScreen(this.camera, p, 140)) return;
    const size = screenSize(this.camera, contact.size, contact.z);
    if (size < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = depthAlpha(contact.z);
    ctx.translate(p.sx, p.sy);
    ctx.rotate(this.camera.roll);
    const drawn = this.sprites.draw('enemies', contact.sprite, -size / 2, -size / 2, size, size, this.clock);
    if (!drawn) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoss(): void {
    const boss = this.lane.boss;
    const p = project(this.camera, this.bossX, 0, this.bossZ);
    if (!p.visible) return;
    const size = screenSize(this.camera, boss.size, this.bossZ);
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
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBolt(bolt: Bolt): void {
    const p = project(this.camera, bolt.x, bolt.y, bolt.z);
    if (!p.visible || !onScreen(this.camera, p, 60)) return;
    const size = Math.max(1.4, screenSize(this.camera, bolt.size, bolt.z));
    const { ctx } = this;
    const key = bolt.hostile ? 'enemy_red_bullet' : 'bb_shot';
    ctx.save();
    ctx.globalAlpha = bolt.hostile ? 1 : 0.95;
    if (!this.sprites.draw('projectiles', key, p.sx - size / 2, p.sy - size, size, size * 2, this.clock)) {
      ctx.fillStyle = bolt.hostile ? RED : GREEN;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBurst(burst: Burst): void {
    const p = project(this.camera, burst.x, burst.y, burst.z);
    if (!p.visible) return;
    const t = burst.life / burst.max;
    const size = screenSize(this.camera, 90 * (1.4 - t), burst.z);
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

  /** The hull's world Y: it hangs below the aim point rather than sitting on it. */
  private shipWorldY(): number {
    return this.shipY + this.shipDrop;
  }

  private drawShip(): void {
    const p = project(this.camera, this.shipX, this.shipWorldY(), SHIP_Z);
    if (!p.visible) return;
    const size = screenSize(this.camera, SHIP_SIZE, SHIP_Z);
    const { ctx } = this;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    // The roll is the barrel roll; the bank is the lean into a turn. Both are
    // the same sprite, spun -- which is exactly how the originals did it.
    const spin = this.rollClock > 0 ? (1 - this.rollClock / ROLL_TIME) * Math.PI * 2 : 0;
    ctx.rotate(this.bank * MAX_BANK + spin);
    if (this.graceClock > 0) ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(this.clock * 22));
    if (!this.sprites.draw('ships', 'player', -size / 2, -size / 2, size, size, this.clock)) {
      ctx.fillStyle = GREEN;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Engine wash, so the hull is attached to the thrust and not floating.
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.clock * 30);
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy + size * 0.46, size * 0.13, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Two reticles at two depths.
   *
   * A single crosshair on a flat screen says nothing about where the guns
   * cross. Drawing the same point at a near and a far depth gives two rings
   * that converge as you centre up -- which is the aim cue AND another read on
   * how deep the lane is.
   */
  private drawReticle(): void {
    const { ctx } = this;
    for (const [z, radius, alpha] of [[420, 26, 0.85], [900, 15, 0.4]] as const) {
      const p = project(this.camera, this.camera.x, this.camera.y, z);
      if (!p.visible) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.sx - radius * 1.5, p.sy);
      ctx.lineTo(p.sx - radius * 0.55, p.sy);
      ctx.moveTo(p.sx + radius * 0.55, p.sy);
      ctx.lineTo(p.sx + radius * 1.5, p.sy);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawHud(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 12px "Courier New", monospace';
    ctx.textBaseline = 'middle';

    // A strip, not a panel: portrait has no width to give away.
    ctx.fillStyle = 'rgba(1,3,10,0.62)';
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = GREEN;
    ctx.textAlign = 'left';
    ctx.fillText(`HULL ${'|'.repeat(Math.max(0, this.hp))}${'.'.repeat(Math.max(0, PLAYER_HP - this.hp))}`, 10, 13);
    ctx.textAlign = 'center';
    ctx.fillText(this.lane.label, w / 2, 13);
    ctx.textAlign = 'right';
    ctx.fillText(`${this.score}`, w - 10, 13);

    if (this.mode === 'boss' && this.bossHp > 0) {
      const barWidth = Math.min(w - 40, 320);
      const frac = Math.max(0, this.bossHp / this.lane.boss.hp);
      ctx.fillStyle = 'rgba(255,76,102,0.25)';
      ctx.fillRect((w - barWidth) / 2, 32, barWidth, 6);
      ctx.fillStyle = RED;
      ctx.fillRect((w - barWidth) / 2, 32, barWidth * frac, 6);
      ctx.fillStyle = this.bossState === 'windUp' ? BLUE : AMBER;
      ctx.textAlign = 'center';
      ctx.font = '600 10px "Courier New", monospace';
      ctx.fillText(this.bossState === 'windUp' ? 'GUARD UP' : 'EXPOSED', w / 2, 47);
      ctx.font = '600 12px "Courier New", monospace';
    }

    // Roll readiness. Bottom-RIGHT: the shell already parks the mute button
    // bottom-left, and two labels in one corner is one unreadable label.
    ctx.textAlign = 'right';
    ctx.font = '600 10px "Courier New", monospace';
    ctx.fillStyle = this.rollCooldown > 0 ? 'rgba(120,140,160,0.7)' : BLUE;
    ctx.fillText(this.rollClock > 0 ? 'ROLLING' : this.rollCooldown > 0 ? 'ROLL ...' : 'TAP = ROLL', w - 10, h - 14);
    ctx.font = '600 12px "Courier New", monospace';

    if (this.bannerClock > 0 && this.mode !== 'won' && this.mode !== 'lost') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.bannerClock);
      ctx.font = '700 16px "Courier New", monospace';
      ctx.fillStyle = GREEN;
      ctx.fillText(this.bannerText, w / 2, h * 0.24);
    }

    if (this.mode === 'won' || this.mode === 'lost') {
      ctx.globalAlpha = 1;
      // A scrim, so the result is not competing with a reticle and a starfield.
      ctx.fillStyle = 'rgba(1,3,10,0.72)';
      ctx.fillRect(0, h / 2 - 52, w, 104);
      ctx.textAlign = 'center';
      ctx.fillStyle = this.mode === 'won' ? GREEN : RED;
      ctx.font = '700 26px "Courier New", monospace';
      ctx.fillText(this.mode === 'won' ? 'LANE CLEAR' : 'HULL BREACH', w / 2, h / 2 - 12);
      ctx.fillStyle = '#cfe';
      ctx.font = '600 13px "Courier New", monospace';
      ctx.fillText(`SCORE ${this.score} — TAP TO FLY AGAIN`, w / 2, h / 2 + 18);
    }
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** True when `target` lies in the span the bolt covered this frame, either way. */
function crossed(from: number, to: number, target: number): boolean {
  return (from - target) * (to - target) <= 0;
}
