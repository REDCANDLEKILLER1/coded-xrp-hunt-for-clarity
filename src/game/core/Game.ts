import { AssetLoader } from './AssetLoader';
import { Input } from './Input';
import { Loop } from './Loop';

type Mode = 'title' | 'play' | 'results';

type Actor = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp?: number;
  life?: number;
};

const PLAYER_SPEED = 340;
const FIRE_RATE = 0.14;
const ENEMY_RATE = 0.72;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly assets = new AssetLoader();
  private readonly loop = new Loop((dt) => this.tick(dt));
  private mode: Mode = 'title';
  private paused = false;
  private dpr = 1;
  private player: Actor = this.makePlayer();
  private enemies: Actor[] = [];
  private shots: Actor[] = [];
  private fx: Actor[] = [];
  private score = 0;
  private wave = 1;
  private fireTimer = 0;
  private enemyTimer = 0;
  private special = 100;
  private pulseLife = 0;

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
    this.loop.start();
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private get width(): number {
    return window.innerWidth;
  }

  private get height(): number {
    return window.innerHeight;
  }

  private tick(dt: number): void {
    this.update(dt);
    this.render();
  }

  private update(dt: number): void {
    if (this.input.consumePause() && this.mode === 'play') this.paused = !this.paused;

    if (this.mode === 'title') {
      if (this.input.pointer || this.input.consumeSpecial()) this.resetGame();
      return;
    }

    if (this.mode === 'results') {
      if (this.input.pointer || this.input.consumeSpecial()) this.resetGame();
      return;
    }

    if (this.paused) return;

    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateCollisions();
    this.updateFX(dt);

    this.special = Math.min(100, this.special + 7 * dt);
    if (this.input.consumeSpecial() && this.special >= 100) this.triggerPulse();
    if (this.player.hp !== undefined && this.player.hp <= 0) this.mode = 'results';
  }

  private updatePlayer(dt: number): void {
    const axis = this.input.axis();
    if (this.input.pointer) {
      this.player.x += (this.input.pointer.x / this.dpr - this.player.x) * Math.min(1, dt * 14);
      this.player.y += (this.input.pointer.y / this.dpr - this.player.y) * Math.min(1, dt * 14);
    } else {
      this.player.x += axis.x * PLAYER_SPEED * dt;
      this.player.y += axis.y * PLAYER_SPEED * dt;
    }
    this.player.x = clamp(this.player.x, 28, this.width - 28);
    this.player.y = clamp(this.player.y, this.height * 0.42, this.height - 54);
  }

  private updateWeapons(dt: number): void {
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = FIRE_RATE;
      this.shots.push({ x: this.player.x, y: this.player.y - 24, w: 5, h: 20, vx: 0, vy: -720 });
    }

    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }
    this.shots = this.shots.filter((shot) => shot.y > -40);

    if (this.pulseLife > 0) {
      this.pulseLife -= dt;
      const radius = 165;
      this.enemies = this.enemies.filter((enemy) => {
        const hit = distance(enemy, this.player) < radius;
        if (hit) {
          this.score += 25;
          this.burst(enemy.x, enemy.y);
        }
        return !hit;
      });
    }
  }

  private updateEnemies(dt: number): void {
    this.enemyTimer -= dt;
    if (this.enemyTimer <= 0) {
      this.enemyTimer = Math.max(0.28, ENEMY_RATE - this.wave * 0.02);
      this.enemies.push({
        x: 30 + Math.random() * (this.width - 60),
        y: -35,
        w: 28,
        h: 26,
        vx: Math.sin(performance.now() * 0.001) * 28,
        vy: 105 + this.wave * 8,
        hp: 1,
      });
    }

    for (const enemy of this.enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }

    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.y > this.height + 40) {
        this.player.hp = (this.player.hp ?? 3) - 1;
        return false;
      }
      return true;
    });

    this.wave = 1 + Math.floor(this.score / 500);
  }

  private updateCollisions(): void {
    for (const shot of this.shots) {
      for (const enemy of this.enemies) {
        if (overlaps(hitbox(shot, 0.65), hitbox(enemy, 0.68))) {
          shot.life = 0;
          enemy.hp = 0;
          this.score += 100;
          this.special = Math.min(100, this.special + 8);
          this.burst(enemy.x, enemy.y);
        }
      }
    }
    this.shots = this.shots.filter((shot) => shot.life !== 0);
    this.enemies = this.enemies.filter((enemy) => enemy.hp !== 0);

    for (const enemy of this.enemies) {
      if (overlaps(hitbox(enemy, 0.62), hitbox(this.player, 0.55))) {
        enemy.hp = 0;
        this.player.hp = (this.player.hp ?? 3) - 1;
        this.burst(enemy.x, enemy.y);
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp !== 0);
  }

  private updateFX(dt: number): void {
    for (const particle of this.fx) particle.life = (particle.life ?? 0) - dt;
    this.fx = this.fx.filter((particle) => (particle.life ?? 0) > 0);
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    if (this.mode === 'title') return this.drawTitle();
    if (this.mode === 'results') return this.drawResults();
    this.drawPlay();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#02060b';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = 'rgba(0,255,128,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < this.height; y += 46) line(ctx, 0, y, this.width, y);
    for (let x = 0; x < this.width; x += 46) line(ctx, x, 0, x, this.height);
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff88';
    ctx.font = '700 28px ui-sans-serif, system-ui';
    ctx.fillText('CODED: XRP', this.width / 2, this.height * 0.34);
    ctx.fillStyle = '#36a3ff';
    ctx.font = '600 16px ui-sans-serif, system-ui';
    ctx.fillText('THE HUNT FOR CLARITY', this.width / 2, this.height * 0.39);
    ctx.strokeStyle = '#00ff88';
    ctx.strokeRect(this.width / 2 - 78, this.height * 0.54 - 24, 156, 48);
    ctx.fillStyle = '#d8ffe8';
    ctx.font = '700 18px ui-sans-serif, system-ui';
    ctx.fillText('START', this.width / 2, this.height * 0.54 + 7);
    ctx.font = '12px ui-sans-serif, system-ui';
    ctx.fillStyle = 'rgba(216,255,232,0.7)';
    ctx.fillText('Drag to fly • Space for pulse • P to pause', this.width / 2, this.height * 0.64);
  }

  private drawResults(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3355';
    ctx.font = '700 26px ui-sans-serif, system-ui';
    ctx.fillText('SYSTEM FAILURE', this.width / 2, this.height * 0.38);
    ctx.fillStyle = '#d8ffe8';
    ctx.font = '600 16px ui-sans-serif, system-ui';
    ctx.fillText(`SCORE ${this.score}`, this.width / 2, this.height * 0.46);
    ctx.fillText('TAP TO RESTART', this.width / 2, this.height * 0.56);
  }

  private drawPlay(): void {
    const ctx = this.ctx;
    this.drawPlayer();
    for (const enemy of this.enemies) this.drawEnemy(enemy);
    for (const shot of this.shots) this.drawShot(shot);
    for (const particle of this.fx) this.drawBurst(particle);
    if (this.pulseLife > 0) this.drawPulse();
    this.drawHUD();
    if (this.paused) this.drawPause();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.strokeStyle = '#00ff88';
    ctx.fillStyle = 'rgba(0,255,128,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(18, 18);
    ctx.lineTo(0, 10);
    ctx.lineTo(-18, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#36a3ff';
    line(ctx, -9, 20, -18, 31);
    line(ctx, 9, 20, 18, 31);
    ctx.restore();
  }

  private drawEnemy(enemy: Actor): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.strokeStyle = '#ff3355';
    ctx.fillStyle = 'rgba(255,51,85,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(18, -10);
    ctx.lineTo(0, -18);
    ctx.lineTo(-18, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawShot(shot: Actor): void {
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = 3;
    line(this.ctx, shot.x, shot.y + 10, shot.x, shot.y - 10);
  }

  private drawBurst(particle: Actor): void {
    const alpha = Math.max(0, (particle.life ?? 0) / 0.28);
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, (1 - alpha) * 28 + 4, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawPulse(): void {
    const alpha = Math.max(0, this.pulseLife / 0.35);
    this.ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, (1 - alpha) * 165, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawHUD(): void {
    const ctx = this.ctx;
    const hp = this.player.hp ?? 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8ffe8';
    ctx.font = '700 13px ui-sans-serif, system-ui';
    ctx.fillText(`SCORE ${this.score}`, 16, 24);
    ctx.fillText(`WAVE ${this.wave}`, 16, 44);
    bar(ctx, 16, 58, 128, 8, hp / 3, '#00ff88');
    bar(ctx, this.width - 144, 20, 128, 8, this.special / 100, '#36a3ff');
    ctx.strokeStyle = '#00ff88';
    ctx.strokeRect(this.width - 80, this.height - 76, 64, 48);
    ctx.textAlign = 'center';
    ctx.fillText('PULSE', this.width - 48, this.height - 47);
    ctx.strokeRect(16, this.height - 76, 64, 48);
    ctx.fillText('PAUSE', 48, this.height - 47);
  }

  private drawPause(): void {
    this.ctx.fillStyle = 'rgba(2,6,11,0.72)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#36a3ff';
    this.ctx.font = '700 28px ui-sans-serif, system-ui';
    this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
  }

  private triggerPulse(): void {
    this.special = 0;
    this.pulseLife = 0.35;
  }

  private burst(x: number, y: number): void {
    this.fx.push({ x, y, w: 1, h: 1, vx: 0, vy: 0, life: 0.28 });
  }

  private resetGame(): void {
    this.mode = 'play';
    this.paused = false;
    this.player = this.makePlayer();
    this.enemies = [];
    this.shots = [];
    this.fx = [];
    this.score = 0;
    this.wave = 1;
    this.special = 100;
  }

  private makePlayer(): Actor {
    return { x: this.width / 2, y: this.height - 96, w: 38, h: 42, vx: 0, vy: 0, hp: 3 };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Actor, b: Actor): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitbox(actor: Actor, scale: number) {
  return {
    x: actor.x - (actor.w * scale) / 2,
    y: actor.y - (actor.h * scale) / 2,
    w: actor.w * scale,
    h: actor.h * scale,
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
