import { AssetLoader } from './AssetLoader';
import { Input } from './Input';
import { Loop } from './Loop';
import type { Rect } from './Types';

type Mode = 'title' | 'play' | 'results';
type Actor = { x: number; y: number; w: number; h: number; vx: number; vy: number; hp?: number; life?: number };

const SPEED = 340;
const BOLT_RATE = 0.14;
const DRONE_RATE = 0.72;

export class Game2A {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly assets = new AssetLoader();
  private readonly loop = new Loop((dt) => this.frame(dt));
  private mode: Mode = 'title';
  private paused = false;
  private player: Actor = this.newPlayer();
  private drones: Actor[] = [];
  private bolts: Actor[] = [];
  private rings: Actor[] = [];
  private score = 0;
  private wave = 1;
  private boltClock = 0;
  private droneClock = 0;
  private special = 100;
  private ringClock = 0;
  private showAssets = false;
  private reportAssets = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    this.ctx = ctx;
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
      special: { x: this.w - 112, y: this.h - 86, w: 96, h: 62 },
      assets: { x: this.w - 58, y: 14, w: 42, h: 34 },
    };
  }

  private frame(dt: number): void {
    this.actions();
    this.update(dt);
    this.render();
  }

  private actions(): void {
    if (this.input.consumeDiagnostics()) this.showAssets = !this.showAssets;
    if (this.input.consumePause() && this.mode === 'play') this.paused = !this.paused;
    if (this.input.consumeSpecial() && this.mode === 'play') this.useSpecial();

    const tap = this.input.consumeTap();
    if (!tap) return;
    if (this.mode === 'title' || this.mode === 'results') return this.reset();
    if (inside(this.zone.assets, tap.x, tap.y)) return void (this.showAssets = !this.showAssets);
    if (inside(this.zone.pause, tap.x, tap.y)) return void (this.paused = !this.paused);
    if (inside(this.zone.special, tap.x, tap.y)) this.useSpecial();
  }

  private update(dt: number): void {
    if (this.mode !== 'play' || this.paused) return;
    this.movePlayer(dt);
    this.updateBolts(dt);
    this.updateDrones(dt);
    this.collisions();
    this.updateRings(dt);
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
      this.player.x += axis.x * SPEED * dt;
      this.player.y += axis.y * SPEED * dt;
    }
    this.player.x = clamp(this.player.x, 28, this.w - 28);
    this.player.y = clamp(this.player.y, this.h * 0.34, this.h - 96);
  }

  private updateBolts(dt: number): void {
    this.boltClock -= dt;
    if (this.boltClock <= 0) {
      this.boltClock = BOLT_RATE;
      this.bolts.push({ x: this.player.x, y: this.player.y - 24, w: 5, h: 20, vx: 0, vy: -720 });
    }
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
    }
    this.bolts = this.bolts.filter((bolt) => bolt.y > -40);
  }

  private updateDrones(dt: number): void {
    this.droneClock -= dt;
    if (this.droneClock <= 0) {
      this.droneClock = Math.max(0.28, DRONE_RATE - this.wave * 0.02);
      this.drones.push({ x: 30 + Math.random() * (this.w - 60), y: -35, w: 28, h: 26, vx: Math.sin(performance.now() * 0.001) * 28, vy: 105 + this.wave * 8, hp: 1 });
    }
    for (const drone of this.drones) {
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;
    }
    this.drones = this.drones.filter((drone) => {
      if (drone.y > this.h + 40) {
        this.player.hp = (this.player.hp ?? 3) - 1;
        return false;
      }
      return true;
    });
    this.wave = 1 + Math.floor(this.score / 500);
  }

  private collisions(): void {
    for (const bolt of this.bolts) {
      for (const drone of this.drones) {
        if (overlap(box(bolt, 0.65), box(drone, 0.68))) {
          bolt.life = 0;
          drone.hp = 0;
          this.score += 100;
          this.special = Math.min(100, this.special + 8);
          this.ring(drone.x, drone.y);
        }
      }
    }
    this.bolts = this.bolts.filter((bolt) => bolt.life !== 0);
    this.drones = this.drones.filter((drone) => drone.hp !== 0);

    for (const drone of this.drones) {
      if (overlap(box(drone, 0.62), box(this.player, 0.55))) {
        drone.hp = 0;
        this.player.hp = (this.player.hp ?? 3) - 1;
        this.ring(drone.x, drone.y);
      }
    }
    this.drones = this.drones.filter((drone) => drone.hp !== 0);
  }

  private updateRings(dt: number): void {
    for (const item of this.rings) item.life = (item.life ?? 0) - dt;
    this.rings = this.rings.filter((item) => (item.life ?? 0) > 0);
    if (this.ringClock > 0) {
      this.ringClock -= dt;
      this.drones = this.drones.filter((drone) => {
        const hit = Math.hypot(drone.x - this.player.x, drone.y - this.player.y) < 165;
        if (hit) {
          this.score += 25;
          this.ring(drone.x, drone.y);
        }
        return !hit;
      });
    }
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.background();
    if (this.mode === 'title') this.title();
    if (this.mode === 'play') this.play();
    if (this.mode === 'results') this.results();
    if (this.reportAssets || this.showAssets) this.assetPanel();
  }

  private background(): void {
    this.ctx.fillStyle = '#02060b';
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.strokeStyle = 'rgba(0,255,128,0.08)';
    for (let y = 0; y < this.h; y += 46) line(this.ctx, 0, y, this.w, y);
    for (let x = 0; x < this.w; x += 46) line(this.ctx, x, 0, x, this.h);
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
    this.ctx.fillText('Drag to fly • Space pulse • P pause • D assets', this.w / 2, this.h * 0.64);
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

  private play(): void {
    this.drawPlayer();
    for (const drone of this.drones) this.drawDrone(drone);
    for (const bolt of this.bolts) this.drawBolt(bolt);
    for (const item of this.rings) this.drawRing(item);
    if (this.ringClock > 0) this.drawPulse();
    this.hud();
    if (this.paused) this.pause();
  }

  private drawPlayer(): void {
    const image = this.assets.getImage('ships', 'player');
    if (image) return void this.ctx.drawImage(image, this.player.x - 20, this.player.y - 24, 40, 48);
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.strokeStyle = '#00ff88';
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

  private drawDrone(drone: Actor): void {
    const image = this.assets.getImage('enemies', 'regulator_drone');
    if (image) return void this.ctx.drawImage(image, drone.x - 18, drone.y - 18, 36, 36);
    this.ctx.save();
    this.ctx.translate(drone.x, drone.y);
    this.ctx.strokeStyle = '#ff3355';
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

  private drawBolt(bolt: Actor): void {
    const image = this.assets.getImage('projectiles', 'bb_shot');
    if (image) return void this.ctx.drawImage(image, bolt.x - 4, bolt.y - 12, 8, 24);
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = 3;
    line(this.ctx, bolt.x, bolt.y + 10, bolt.x, bolt.y - 10);
  }

  private drawRing(item: Actor): void {
    const alpha = Math.max(0, (item.life ?? 0) / 0.28);
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(item.x, item.y, (1 - alpha) * 28 + 4, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawPulse(): void {
    const alpha = Math.max(0, this.ringClock / 0.35);
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, (1 - alpha) * 165, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private hud(): void {
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#d8ffe8';
    this.ctx.font = '700 13px ui-sans-serif, system-ui';
    this.ctx.fillText(`SCORE ${this.score}`, 16, 24);
    this.ctx.fillText(`WAVE ${this.wave}`, 16, 44);
    bar(this.ctx, 16, 58, 128, 8, (this.player.hp ?? 0) / 3, '#00ff88');
    bar(this.ctx, this.w - 144, 20, 128, 8, this.special / 100, '#36a3ff');
    this.button(this.zone.pause, 'PAUSE', '#00ff88');
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

  private ring(x: number, y: number): void {
    this.rings.push({ x, y, w: 1, h: 1, vx: 0, vy: 0, life: 0.28 });
  }

  private reset(): void {
    this.mode = 'play';
    this.paused = false;
    this.reportAssets = false;
    this.player = this.newPlayer();
    this.drones = [];
    this.bolts = [];
    this.rings = [];
    this.score = 0;
    this.wave = 1;
    this.special = 100;
  }

  private newPlayer(): Actor {
    return { x: this.w / 2, y: this.h - 112, w: 38, h: 42, vx: 0, vy: 0, hp: 3 };
  }

  private inControls(x: number, y: number): boolean {
    return inside(this.zone.pause, x, y) || inside(this.zone.special, x, y) || inside(this.zone.assets, x, y);
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
