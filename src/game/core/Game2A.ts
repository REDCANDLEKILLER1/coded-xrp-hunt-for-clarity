import { AssetLoader } from './AssetLoader';
import { Input } from './Input';
import { Loop } from './Loop';
import { SpriteRenderer } from './Sprite';
import type { Rect } from './Types';
import { ENEMIES, FX, PICKUPS, PROJECTILES, SHIPS, SPECIALS, STAGES, WEAPONS } from '../content/registry';
import { availableEnemyKeys, selectEnemyKey, spawnInterval } from '../content/WaveDirector';
import type { EnemyDef, PickupDef, ProjectileDef, SpriteRef, StageDef, WeaponDef } from '../content/types';

type Mode = 'title' | 'select' | 'play' | 'results';
type Actor = { x: number; y: number; w: number; h: number; vx: number; vy: number; hp?: number; life?: number };
type EnemyActor = Actor & { enemyKey: string; age: number; anchorX: number; phase: number; direction: -1 | 1 };
type ProjectileActor = Actor & { damage: number; projectileKey: string };
type PickupActor = Actor & { pickupKey: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

// Hit-burst tuning: a bigger, longer ring that reveals the spark debris baked
// into the art, plus a spray of short-lived shards flying outward on impact.
const BURST_LIFE = 0.45;
const BURST_MAX_RADIUS = 72;
const BURST_MIN_RADIUS = 6;
const DEBRIS_MIN = 10;
const DEBRIS_VARY = 6;
const UPGRADE_EVERY_KILLS = 7;
const BOMB_EVERY_KILLS = 12;
const MAX_BOMBS = 3;
const BOMB_LIFE = 0.55;

// Phase A: live content is sourced from the data registry rather than loose constants.
const DEFAULT_SHIP = SHIPS.player;
const DEFAULT_ENEMY = ENEMIES.regulator_drone;
const BURST_RING = FX.burst_ring;
const CLARITY_PULSE = SPECIALS.clarity_pulse;
const WEAPON_LADDER = Object.values(WEAPONS).sort((a, b) => a.tier - b.tier);
const STAGE_LADDER = Object.values(STAGES).sort((a, b) => a.minWave - b.minWave);

export class Game2A {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly assets = new AssetLoader();
  private readonly sprites: SpriteRenderer;
  private readonly loop = new Loop((dt) => this.frame(dt));
  private clock = 0;
  private mode: Mode = 'title';
  private paused = false;
  private selectedShipKey = DEFAULT_SHIP.key;
  private player: Actor = this.newPlayer();
  private drones: EnemyActor[] = [];
  private bolts: ProjectileActor[] = [];
  private pickups: PickupActor[] = [];
  private rings: Actor[] = [];
  private debris: Particle[] = [];
  private score = 0;
  private wave = 1;
  private boltClock = 0;
  private droneClock = 0;
  private special = 100;
  private ringClock = 0;
  private weaponTier = 1;
  private kills = 0;
  private bombs = 2;
  private bombClock = 0;
  private showAssets = false;
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

  private get zone() {
    return {
      pause: { x: 16, y: this.h - 76, w: 72, h: 52 },
      bomb: { x: this.w - 208, y: this.h - 82, w: 84, h: 58 },
      special: { x: this.w - 112, y: this.h - 86, w: 96, h: 62 },
      assets: { x: this.w - 58, y: 14, w: 42, h: 34 },
    };
  }

  private frame(dt: number): void {
    this.clock += dt;
    this.actions();
    this.update(dt);
    this.render();
  }

  private actions(): void {
    if (this.input.consumeDiagnostics()) this.showAssets = !this.showAssets;
    if (this.input.consumePause() && this.mode === 'play') this.paused = !this.paused;
    if (this.input.consumeSpecial() && this.mode === 'play') this.useSpecial();
    if (this.input.consumeBomb() && this.mode === 'play') this.useBomb();

    const tap = this.input.consumeTap();
    if (!tap) return;
    if (this.mode === 'title') return void (this.mode = 'select');
    if (this.mode === 'select') return this.selectShipAt(tap.x, tap.y);
    if (this.mode === 'results') return this.reset();
    if (inside(this.zone.assets, tap.x, tap.y)) return void (this.showAssets = !this.showAssets);
    if (inside(this.zone.pause, tap.x, tap.y)) return void (this.paused = !this.paused);
    if (inside(this.zone.bomb, tap.x, tap.y)) return void this.useBomb();
    if (inside(this.zone.special, tap.x, tap.y)) this.useSpecial();
  }

  private update(dt: number): void {
    if (this.mode !== 'play' || this.paused) return;
    this.movePlayer(dt);
    this.updateBolts(dt);
    this.updateDrones(dt);
    this.updatePickups(dt);
    this.collisions();
    this.updateRings(dt);
    if (this.bombClock > 0) this.bombClock = Math.max(0, this.bombClock - dt);
    this.updateDebris(dt);
    this.special = Math.min(100, this.special + dt * 7);
    if ((this.player.hp ?? 0) <= 0) this.mode = 'results';
  }

  private movePlayer(dt: number): void {
    const pointer = this.input.pointer;
    const axis = this.input.axis();
    if (pointer && !this.inControls(pointer.x, pointer.y)) {
      this.player.x += (pointer.x - this.player.x) * Math.min(1, dt * 14);
      this.player.y += (pointer.y - this.player.y) * Math.min(1, dt * 14);
    } else {
      const ship = this.playerDef();
      this.player.x += axis.x * ship.speed * dt;
      this.player.y += axis.y * ship.speed * dt;
    }
    this.player.x = clamp(this.player.x, 28, this.w - 28);
    this.player.y = clamp(this.player.y, this.h * 0.34, this.h - 96);
  }

  private updateBolts(dt: number): void {
    this.boltClock -= dt;
    if (this.boltClock <= 0) {
      const weapon = this.currentWeapon();
      const projectile = this.projectileDef(weapon.projectileKey);
      const ship = this.playerDef();
      this.boltClock = weapon.fireRate * (ship.fireRate / DEFAULT_SHIP.fireRate);
      for (const shot of weapon.shots) {
        this.bolts.push({
          x: this.player.x + shot.offsetX,
          y: this.player.y - 24,
          w: projectile.hitbox.w,
          h: projectile.hitbox.h,
          vx: Math.sin(shot.angle) * projectile.speed,
          vy: -Math.cos(shot.angle) * projectile.speed,
          damage: weapon.damage,
          projectileKey: weapon.projectileKey,
        });
      }
    }
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.y > -40);
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) pickup.y += pickup.vy * dt;
    this.pickups = this.pickups.filter((pickup) => pickup.y < this.h + 40);
  }

  private updateDrones(dt: number): void {
    this.droneClock -= dt;
    if (this.droneClock <= 0) {
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
        vy: def.baseSpeed + this.wave * 7,
        hp: def.hp,
        enemyKey,
        age: 0,
        anchorX: x,
        phase: Math.random() * Math.PI * 2,
        direction: Math.random() < 0.5 ? -1 : 1,
      });
    }
    for (const drone of this.drones) {
      const def = this.enemyDef(drone.enemyKey);
      drone.age += dt;
      drone.y += drone.vy * dt;

      if (def.behavior === 'straight') {
        drone.x += Math.sin(drone.age * 1.8 + drone.phase) * 12 * dt;
      } else if (def.behavior === 'sine') {
        drone.x = drone.anchorX + Math.sin(drone.age * 3.2 + drone.phase) * 46;
      } else if (def.behavior === 'zigzag') {
        drone.x += drone.direction * (110 + this.wave * 4) * dt;
        if (drone.x < 26 || drone.x > this.w - 26) drone.direction = drone.x < 26 ? 1 : -1;
      } else {
        const pursuit = clamp(this.player.x - drone.x, -1, 1);
        drone.x += pursuit * Math.min(155, 58 + drone.age * 34) * dt;
      }

      drone.x = clamp(drone.x, 24, this.w - 24);
    }
    this.drones = this.drones.filter((drone) => {
      if (drone.y > this.h + 40) {
        this.player.hp = (this.player.hp ?? this.playerDef().hp) - 1;
        return false;
      }
      return true;
    });
    this.wave = 1 + Math.floor(this.score / 500);
  }

  private collisions(): void {
    for (const bolt of this.bolts) {
      for (const drone of this.drones) {
        if ((drone.hp ?? 0) <= 0) continue;
        if (overlap(box(bolt, 0.65), box(drone, 0.68))) {
          bolt.life = 0;
          drone.hp = (drone.hp ?? 1) - bolt.damage;
          if ((drone.hp ?? 0) <= 0) {
            this.registerKill(drone);
          }
          break;
        }
      }
    }
    this.bolts = this.bolts.filter((bolt) => bolt.life !== 0);
    this.drones = this.drones.filter((drone) => (drone.hp ?? 0) > 0);

    for (const drone of this.drones) {
      if (overlap(box(drone, 0.62), box(this.player, 0.55))) {
        drone.hp = 0;
        this.player.hp = (this.player.hp ?? this.playerDef().hp) - 1;
        this.ring(drone.x, drone.y);
      }
    }
    this.drones = this.drones.filter((drone) => (drone.hp ?? 0) > 0);

    for (const pickup of this.pickups) {
      if (overlap(box(pickup, 0.78), box(this.player, 0.62))) {
        pickup.life = 0;
        this.applyPickup(pickup.pickupKey);
      }
    }
    this.pickups = this.pickups.filter((pickup) => pickup.life !== 0);
  }

  private updateRings(dt: number): void {
    for (const item of this.rings) item.life = (item.life ?? 0) - dt;
    this.rings = this.rings.filter((item) => (item.life ?? 0) > 0);
    if (this.ringClock > 0) {
      this.ringClock -= dt;
      this.drones = this.drones.filter((drone) => {
        const hit = Math.hypot(drone.x - this.player.x, drone.y - this.player.y) < CLARITY_PULSE.radius;
        if (hit) {
          this.score += 25;
          this.ring(drone.x, drone.y);
        }
        return !hit;
      });
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
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.background();
    if (this.mode === 'title') this.title();
    if (this.mode === 'select') this.shipSelect();
    if (this.mode === 'play') this.play();
    if (this.mode === 'results') this.results();
    if (this.reportAssets || this.showAssets) this.assetPanel();
  }

  private background(): void {
    const stage = this.currentStage();
    const sky = this.ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, stage.sky);
    sky.addColorStop(1, '#02060b');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.strokeStyle = `${stage.accent}18`;
    const gridOffset = (this.clock * stage.scrollSpeed) % 46;
    for (let y = gridOffset - 46; y < this.h; y += 46) line(this.ctx, 0, y, this.w, y);
    for (let x = 0; x < this.w; x += 46) line(this.ctx, x, 0, x, this.h);
    this.drawStageStructures(stage);
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
    this.ctx.fillText('SYSTEM FAILURE', this.w / 2, this.h * 0.38);
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '600 16px ui-sans-serif, system-ui';
    this.ctx.fillText(`SCORE ${this.score}`, this.w / 2, this.h * 0.46);
    this.ctx.fillText('TAP TO RESTART', this.w / 2, this.h * 0.56);
  }

  private shipSelect(): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '700 22px ui-sans-serif, system-ui';
    this.ctx.fillText('SELECT YOUR SHIP', this.w / 2, 54);

    for (const card of this.shipCards()) {
      const def = SHIPS[card.key];
      const { x, y, w, h } = card.rect;
      this.ctx.fillStyle = 'rgba(2,6,11,0.82)';
      this.ctx.strokeStyle = def.accent;
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeRect(x, y, w, h);
      this.drawCentered(def.sprite, x + 42, y + h / 2, Math.min(34, def.draw.w), Math.min(42, def.draw.h));
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = def.accent;
      this.ctx.font = '700 13px ui-sans-serif, system-ui';
      this.ctx.fillText(def.label, x + 76, y + 26);
      this.ctx.fillStyle = 'rgba(216,255,232,0.78)';
      this.ctx.font = '600 11px ui-sans-serif, system-ui';
      this.ctx.fillText(`HP ${def.hp}   SPEED ${def.speed}   FIRE ${def.fireRate.toFixed(2)}`, x + 76, y + 49);
    }

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = 'rgba(216,255,232,0.66)';
    this.ctx.font = '12px ui-sans-serif, system-ui';
    this.ctx.fillText('TAP A SHIP TO DEPLOY', this.w / 2, this.h - 34);
  }

  private play(): void {
    this.drawPlayer();
    for (const drone of this.drones) this.drawDrone(drone);
    for (const bolt of this.bolts) this.drawBolt(bolt);
    for (const pickup of this.pickups) this.drawPickup(pickup);
    for (const item of this.rings) this.drawRing(item);
    this.drawDebris();
    if (this.ringClock > 0) this.drawPulse();
    if (this.bombClock > 0) this.drawBombWave();
    this.hud();
    if (this.paused) this.pause();
  }

  /** Draws a manifest sprite centered on (cx, cy); returns false so callers keep procedural fallback. */
  private drawCentered(ref: SpriteRef, cx: number, cy: number, dw: number, dh: number): boolean {
    return this.sprites.draw(ref.category, ref.id, cx - dw / 2, cy - dh / 2, dw, dh, this.clock);
  }

  private drawPlayer(): void {
    const def = this.playerDef();
    const drawn = this.drawCentered(def.sprite, this.player.x, this.player.y, def.draw.w, def.draw.h);
    if (!drawn) {
      this.ctx.save();
      this.ctx.translate(this.player.x, this.player.y);
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
    this.ctx.strokeStyle = def.accent;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, Math.max(def.draw.w, def.draw.h) * 0.58, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawDrone(drone: EnemyActor): void {
    const def = this.enemyDef(drone.enemyKey);
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

    // Temporary color-coded threat marker while Phase C variants reuse the
    // regulator sprite. Each can receive dedicated art in a later asset PR.
    this.ctx.save();
    this.ctx.strokeStyle = def.accent;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(drone.x, drone.y, Math.max(def.draw.w, def.draw.h) * 0.58, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawBolt(bolt: ProjectileActor): void {
    const projectile = this.projectileDef(bolt.projectileKey);
    if (this.drawCentered(projectile.sprite, bolt.x, bolt.y, projectile.draw.w, projectile.draw.h)) return;
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = 3;
    line(this.ctx, bolt.x - bolt.vx * 0.012, bolt.y - bolt.vy * 0.012, bolt.x + bolt.vx * 0.012, bolt.y + bolt.vy * 0.012);
  }

  private drawPickup(pickup: PickupActor): void {
    const def = this.pickupDef(pickup.pickupKey);
    if (this.drawCentered(def.sprite, pickup.x, pickup.y, def.draw.w, def.draw.h)) return;
    this.ctx.save();
    this.ctx.translate(pickup.x, pickup.y);
    this.ctx.rotate(this.clock * 2.4);
    this.ctx.fillStyle = def.effect === 'bomb' ? 'rgba(255,210,74,0.2)' : 'rgba(0,255,0,0.18)';
    this.ctx.strokeStyle = def.effect === 'bomb' ? '#ffd24a' : '#00ff00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    if (def.effect === 'bomb') {
      this.ctx.arc(0, 0, 13, 0, Math.PI * 2);
    } else {
      this.ctx.moveTo(0, -14);
      this.ctx.lineTo(14, 0);
      this.ctx.lineTo(0, 14);
      this.ctx.lineTo(-14, 0);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    if (def.effect === 'bomb') {
      this.ctx.beginPath();
      this.ctx.moveTo(-6, 0);
      this.ctx.lineTo(6, 0);
      this.ctx.moveTo(0, -6);
      this.ctx.lineTo(0, 6);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawRing(item: Actor): void {
    const alpha = Math.max(0, (item.life ?? 0) / BURST_LIFE);
    const radius = (1 - alpha) * BURST_MAX_RADIUS + BURST_MIN_RADIUS;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, alpha);
    const drawn = this.drawCentered(BURST_RING.sprite, item.x, item.y, radius * 2, radius * 2);
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
      // streak tail oriented along velocity gives a flung-shard read
      this.ctx.strokeStyle = `hsl(${p.hue}, 100%, ${55 + a * 25}%)`;
      this.ctx.lineWidth = p.size * (0.4 + a * 0.6);
      line(this.ctx, p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  private drawPulse(): void {
    const alpha = Math.max(0, this.ringClock / 0.35);
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, (1 - alpha) * CLARITY_PULSE.radius, 0, Math.PI * 2);
    this.ctx.stroke();
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

  private hud(): void {
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 13px ui-sans-serif, system-ui';
    this.ctx.fillText(`SCORE ${this.score}`, 16, 24);
    this.ctx.fillText(`WAVE ${this.wave}`, 16, 44);
    const threatKeys = availableEnemyKeys(ENEMIES, this.wave);
    const newestThreat = ENEMIES[threatKeys[threatKeys.length - 1]].label;
    this.ctx.font = '600 10px ui-sans-serif, system-ui';
    this.ctx.fillStyle = 'rgba(216,255,232,0.65)';
    this.ctx.fillText(`THREATS ${threatKeys.length} • LATEST ${newestThreat}`, 16, 80);
    const weapon = this.currentWeapon();
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillText(`WEAPON T${weapon.tier} • ${weapon.label}`, 16, 96);
    const ship = this.playerDef();
    this.ctx.fillStyle = ship.accent;
    this.ctx.fillText(ship.label, 16, 112);
    const stage = this.currentStage();
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = stage.accent;
    this.ctx.fillText(stage.label, this.w / 2, 24);
    this.ctx.textAlign = 'left';
    bar(this.ctx, 16, 58, 128, 8, (this.player.hp ?? 0) / ship.hp, ship.accent);
    bar(this.ctx, this.w - 144, 20, 128, 8, this.special / 100, '#36a3ff');
    this.button(this.zone.pause, 'PAUSE', '#00ff88');
    this.button(this.zone.bomb, `BOMB ${this.bombs}`, this.bombs > 0 ? '#ffd24a' : 'rgba(255,210,74,0.4)');
    this.button(this.zone.special, 'PULSE', this.special >= 100 ? '#36a3ff' : 'rgba(54,163,255,0.45)');
    this.button(this.zone.assets, 'D', '#ffd24a');
  }

  private button(rect: Rect, label: string, color: string): void {
    this.ctx.fillStyle = 'rgba(2,6,11,0.72)';
    this.ctx.strokeStyle = color;
    this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 12px ui-sans-serif, system-ui';
    this.ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
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
    if (this.special < 100) return;
    this.special = 0;
    this.ringClock = 0.35;
  }

  private useBomb(): void {
    if (this.bombs <= 0 || this.mode !== 'play') return;
    this.bombs -= 1;
    this.bombClock = BOMB_LIFE;
    for (const drone of this.drones) {
      this.score += 35;
      this.ring(drone.x, drone.y);
    }
    this.drones = [];
  }

  private ring(x: number, y: number): void {
    this.rings.push({ x, y, w: 1, h: 1, vx: 0, vy: 0, life: BURST_LIFE });
    this.spawnDebris(x, y);
  }

  private registerKill(drone: EnemyActor): void {
    this.score += this.enemyDef(drone.enemyKey).score;
    this.special = Math.min(100, this.special + 8);
    this.kills += 1;
    this.ring(drone.x, drone.y);

    if (this.kills % UPGRADE_EVERY_KILLS === 0 && this.weaponTier < WEAPON_LADDER.length) {
      const def = PICKUPS.weapon_upgrade;
      this.pickups.push({
        x: drone.x,
        y: drone.y,
        w: def.hitbox.w,
        h: def.hitbox.h,
        vx: 0,
        vy: def.driftSpeed,
        pickupKey: def.key,
      });
    }

    if (this.kills % BOMB_EVERY_KILLS === 0 && this.bombs < MAX_BOMBS) {
      const def = PICKUPS.bomb;
      this.pickups.push({
        x: drone.x,
        y: drone.y,
        w: def.hitbox.w,
        h: def.hitbox.h,
        vx: 0,
        vy: def.driftSpeed,
        pickupKey: def.key,
      });
    }
  }

  private applyPickup(key: string): void {
    const def = this.pickupDef(key);
    if (def.effect === 'weapon_upgrade') this.weaponTier = Math.min(WEAPON_LADDER.length, this.weaponTier + 1);
    if (def.effect === 'bomb') this.bombs = Math.min(MAX_BOMBS, this.bombs + 1);
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

  private reset(): void {
    this.mode = 'play';
    this.paused = false;
    this.reportAssets = false;
    this.player = this.newPlayer();
    this.drones = [];
    this.bolts = [];
    this.pickups = [];
    this.rings = [];
    this.debris = [];
    this.score = 0;
    this.wave = 1;
    this.special = 100;
    this.boltClock = 0;
    this.droneClock = 0;
    this.ringClock = 0;
    this.weaponTier = 1;
    this.kills = 0;
    this.bombs = 2;
    this.bombClock = 0;
  }

  private newPlayer(): Actor {
    const ship = this.playerDef();
    return { x: this.w / 2, y: this.h - 112, w: ship.hitbox.w, h: ship.hitbox.h, vx: 0, vy: 0, hp: ship.hp };
  }

  private inControls(x: number, y: number): boolean {
    return inside(this.zone.pause, x, y) || inside(this.zone.bomb, x, y) || inside(this.zone.special, x, y) || inside(this.zone.assets, x, y);
  }

  private enemyDef(key: string): EnemyDef {
    return ENEMIES[key] ?? DEFAULT_ENEMY;
  }

  private playerDef() {
    return SHIPS[this.selectedShipKey] ?? DEFAULT_SHIP;
  }

  private shipCards(): Array<{ key: string; rect: Rect }> {
    const keys = Object.keys(SHIPS);
    const w = Math.min(this.w - 32, 430);
    const h = 68;
    const gap = 12;
    const total = keys.length * h + (keys.length - 1) * gap;
    const startY = Math.max(76, (this.h - total) / 2);
    return keys.map((key, index) => ({ key, rect: { x: (this.w - w) / 2, y: startY + index * (h + gap), w, h } }));
  }

  private selectShipAt(x: number, y: number): void {
    const selected = this.shipCards().find((card) => inside(card.rect, x, y));
    if (!selected) return;
    this.selectedShipKey = selected.key;
    this.reset();
  }

  private currentWeapon(): WeaponDef {
    return WEAPON_LADDER[this.weaponTier - 1] ?? WEAPON_LADDER[0];
  }

  private projectileDef(key: string): ProjectileDef {
    return PROJECTILES[key] ?? PROJECTILES.bb_shot;
  }

  private pickupDef(key: string): PickupDef {
    return PICKUPS[key] ?? PICKUPS.weapon_upgrade;
  }

  private currentStage(): StageDef {
    for (let index = STAGE_LADDER.length - 1; index >= 0; index -= 1) {
      if (STAGE_LADDER[index].minWave <= this.wave) return STAGE_LADDER[index];
    }
    return STAGE_LADDER[0];
  }
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
