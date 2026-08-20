type Point = { x: number; y: number };
type Shot = Point & { vx: number; vy: number; hostile: boolean; life: number };

type Facing = 'front' | 'back' | 'left' | 'right';

const GREEN = '#00ff00';
const BLUE = '#36a3ff';
const ROOM_PAD = 34;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 235;
const BLAST_SPEED = 520;
const BLAST_COST = 12;
const BLAST_COOLDOWN = 0.18;

/**
 * L1-H2 proof-of-feel room. This is intentionally a self-contained runtime so the
 * validated flight engine stays untouched while XRPMan movement/combat is tested.
 */
export class OnFootGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite = new Image();
  private visible = false;
  private lastTime = performance.now();
  private player = { x: innerWidth * 0.5, y: innerHeight * 0.7, health: 100, energy: 100, facing: 'front' as Facing };
  private enemy = { x: innerWidth * 0.5, y: innerHeight * 0.27, health: 80, fireClock: 0.8, respawn: 0 };
  private shots: Shot[] = [];
  private keys = new Set<string>();
  private movePointer: number | null = null;
  private moveTarget: Point | null = null;
  private fireCooldown = 0;
  private hurtCooldown = 0;
  private kills = 0;
  private transitionClock = 0;

  constructor(private readonly shell: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'XRPMan interior combat prototype');
    Object.assign(this.canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '6',
      display: 'none', touchAction: 'none', background: '#02060b',
    });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('On-foot canvas unavailable.');
    this.ctx = ctx;
    this.sprite.src = '/assets/characters/xrpman_onfoot_proto_sheet.png';
    this.shell.appendChild(this.canvas);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  show(): void {
    this.resetRoom();
    this.visible = true;
    this.canvas.style.display = 'block';
    this.transitionClock = 1.35;
    window.dispatchEvent(new CustomEvent('coded:music-cue', { detail: { cue: 'warship_interior' } }));
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
    this.keys.clear();
    this.movePointer = null;
    this.moveTarget = null;
  }

  get active(): boolean { return this.visible; }

  private frame(time: number): void {
    const dt = Math.min(0.033, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.visible) {
      this.update(dt);
      this.draw();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number): void {
    if (this.transitionClock > 0) {
      this.transitionClock = Math.max(0, this.transitionClock - dt);
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.player.energy = Math.min(100, this.player.energy + 20 * dt);

    const keyboard = this.keyboardVector();
    let dx = keyboard.x;
    let dy = keyboard.y;
    if (this.moveTarget && keyboard.x === 0 && keyboard.y === 0) {
      const vx = this.moveTarget.x - this.player.x;
      const vy = this.moveTarget.y - this.player.y;
      const d = Math.hypot(vx, vy);
      if (d > 10) { dx = vx / d; dy = vy / d; }
    }
    if (dx || dy) {
      const mag = Math.hypot(dx, dy) || 1;
      dx /= mag; dy /= mag;
      this.player.x += dx * PLAYER_SPEED * dt;
      this.player.y += dy * PLAYER_SPEED * dt;
      this.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'back' : 'front');
    }
    this.resolvePlayerRoomCollision();

    if (this.enemy.respawn > 0) {
      this.enemy.respawn -= dt;
      if (this.enemy.respawn <= 0) this.spawnEnemy();
    } else {
      const toPlayerX = this.player.x - this.enemy.x;
      const toPlayerY = this.player.y - this.enemy.y;
      const dist = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
      if (dist > 150) {
        this.enemy.x += (toPlayerX / dist) * 62 * dt;
        this.enemy.y += (toPlayerY / dist) * 62 * dt;
      }
      this.enemy.fireClock -= dt;
      if (this.enemy.fireClock <= 0) {
        this.enemy.fireClock = 1.15;
        this.spawnShot(this.enemy.x, this.enemy.y, this.player.x, this.player.y, true, 260);
      }
      if (dist < PLAYER_RADIUS + 18) this.damagePlayer(18);
    }

    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.hostile && distance(shot, this.player) < PLAYER_RADIUS + 5) {
        shot.life = 0;
        this.damagePlayer(14);
      } else if (!shot.hostile && this.enemy.respawn <= 0 && distance(shot, this.enemy) < 24) {
        shot.life = 0;
        this.enemy.health -= 28;
        if (this.enemy.health <= 0) {
          this.enemy.respawn = 1.7;
          this.kills += 1;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.x > -40 && s.x < innerWidth + 40 && s.y > -40 && s.y < innerHeight + 40);

    if (this.player.health <= 0) {
      this.hide();
      window.dispatchEvent(new CustomEvent('coded:onfoot-defeat', { detail: { planetKey: 'ledger_prime' } }));
    }
  }

  private fireAt(x: number, y: number): void {
    if (!this.visible || this.transitionClock > 0 || this.fireCooldown > 0 || this.player.energy < BLAST_COST) return;
    this.player.energy -= BLAST_COST;
    this.fireCooldown = BLAST_COOLDOWN;
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    if (Math.abs(dx) > Math.abs(dy)) this.player.facing = dx < 0 ? 'left' : 'right';
    else this.player.facing = dy < 0 ? 'back' : 'front';
    this.spawnShot(this.player.x, this.player.y, x, y, false, BLAST_SPEED);
  }

  private spawnShot(x: number, y: number, tx: number, ty: number, hostile: boolean, speed: number): void {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.shots.push({ x, y, vx: dx / d * speed, vy: dy / d * speed, hostile, life: 2.4 });
  }

  private damagePlayer(amount: number): void {
    if (this.hurtCooldown > 0) return;
    this.hurtCooldown = 0.55;
    this.player.health = Math.max(0, this.player.health - amount);
  }

  private spawnEnemy(): void {
    this.enemy.x = innerWidth * 0.5;
    this.enemy.y = Math.max(110, innerHeight * 0.25);
    this.enemy.health = 80;
    this.enemy.fireClock = 0.9;
    this.enemy.respawn = 0;
  }

  private resetRoom(): void {
    this.player = { x: innerWidth * 0.5, y: innerHeight * 0.72, health: 100, energy: 100, facing: 'back' };
    this.enemy = { x: innerWidth * 0.5, y: Math.max(110, innerHeight * 0.25), health: 80, fireClock: 0.9, respawn: 0 };
    this.shots = [];
    this.kills = 0;
    this.fireCooldown = 0;
    this.hurtCooldown = 0;
  }

  private resolvePlayerRoomCollision(): void {
    this.player.x = clamp(this.player.x, ROOM_PAD + PLAYER_RADIUS, innerWidth - ROOM_PAD - PLAYER_RADIUS);
    this.player.y = clamp(this.player.y, 92 + PLAYER_RADIUS, innerHeight - ROOM_PAD - PLAYER_RADIUS);
    const box = this.centerObstacle();
    const nx = clamp(this.player.x, box.x, box.x + box.w);
    const ny = clamp(this.player.y, box.y, box.y + box.h);
    const dx = this.player.x - nx;
    const dy = this.player.y - ny;
    if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
      if (Math.abs(dx) > Math.abs(dy)) this.player.x = nx + Math.sign(dx || 1) * PLAYER_RADIUS;
      else this.player.y = ny + Math.sign(dy || 1) * PLAYER_RADIUS;
    }
  }

  private keyboardVector(): Point {
    return {
      x: (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0),
      y: (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0),
    };
  }

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        const target = this.enemy.respawn <= 0 ? this.enemy : { x: this.player.x, y: this.player.y - 100 };
        this.fireAt(target.x, target.y);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.canvas.addEventListener('pointerdown', (e) => {
      const p = this.localPoint(e);
      if (p.x < innerWidth * 0.56 && this.movePointer === null) {
        this.movePointer = e.pointerId;
        this.moveTarget = p;
        this.canvas.setPointerCapture(e.pointerId);
      } else {
        this.fireAt(p.x, p.y);
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.movePointer) this.moveTarget = this.localPoint(e);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.movePointer) {
        this.movePointer = null;
        this.moveTarget = null;
      }
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }

  private localPoint(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    this.drawRoom(ctx);
    if (this.enemy.respawn <= 0) this.drawEnemy(ctx);
    for (const shot of this.shots) this.drawShot(ctx, shot);
    this.drawPlayer(ctx);
    this.drawHud(ctx);
    this.drawTouchHints(ctx);
    if (this.transitionClock > 0) this.drawIntro(ctx);
  }

  private drawRoom(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#03070d';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.strokeStyle = 'rgba(54,163,255,0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM_PAD, 86, innerWidth - ROOM_PAD * 2, innerHeight - 86 - ROOM_PAD);
    for (let y = 106; y < innerHeight - ROOM_PAD; y += 42) {
      ctx.strokeStyle = 'rgba(0,255,0,0.055)';
      ctx.beginPath(); ctx.moveTo(ROOM_PAD, y); ctx.lineTo(innerWidth - ROOM_PAD, y); ctx.stroke();
    }
    const box = this.centerObstacle();
    ctx.fillStyle = 'rgba(5,18,28,0.94)';
    ctx.strokeStyle = 'rgba(54,163,255,0.6)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = 'rgba(0,255,0,0.15)';
    ctx.fillRect(innerWidth * 0.5 - 36, 88, 72, 7);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const frame = ({ front: 0, back: 1, left: 2, right: 3 } as const)[this.player.facing];
    ctx.save();
    if (this.hurtCooldown > 0) ctx.globalAlpha = Math.sin(performance.now() * 0.04) > 0 ? 0.35 : 1;
    if (this.sprite.complete && this.sprite.naturalWidth >= 256) {
      ctx.drawImage(this.sprite, frame * 64, 0, 64, 64, this.player.x - 32, this.player.y - 32, 64, 64);
    } else {
      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.arc(this.player.x, this.player.y, 18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.enemy.x, this.enemy.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#501018';
    ctx.strokeStyle = '#ff425c';
    ctx.lineWidth = 3;
    ctx.fillRect(-17, -17, 34, 34);
    ctx.strokeRect(-17, -17, 34, 34);
    ctx.restore();
    const w = 54;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(this.enemy.x - w / 2, this.enemy.y - 34, w, 4);
    ctx.fillStyle = '#ff425c';
    ctx.fillRect(this.enemy.x - w / 2, this.enemy.y - 34, w * Math.max(0, this.enemy.health) / 80, 4);
  }

  private drawShot(ctx: CanvasRenderingContext2D, shot: Shot): void {
    ctx.save();
    ctx.fillStyle = shot.hostile ? '#ff425c' : GREEN;
    ctx.shadowColor = shot.hostile ? '#ff425c' : BLUE;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.hostile ? 5 : 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(2,6,11,0.9)';
    ctx.fillRect(0, 0, innerWidth, 78);
    ctx.fillStyle = '#d8ffe8';
    ctx.font = '800 12px ui-sans-serif,system-ui';
    ctx.fillText('XRP MAN // REGULATORY WARSHIP // DOCKING BAY', 18, 23);
    this.drawBar(ctx, 18, 38, Math.min(180, innerWidth * 0.38), 8, this.player.health / 100, '#ff425c', 'HP');
    this.drawBar(ctx, 18, 57, Math.min(180, innerWidth * 0.38), 8, this.player.energy / 100, GREEN, 'ENERGY');
    ctx.textAlign = 'right';
    ctx.fillStyle = BLUE;
    ctx.fillText(`LIQUIDITY BLAST // KILLS ${this.kills}`, innerWidth - 18, 24);
    ctx.fillStyle = 'rgba(216,255,232,0.6)';
    ctx.fillText('LEFT: MOVE   RIGHT: FIRE', innerWidth - 18, 57);
    ctx.textAlign = 'left';
  }

  private drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, color: string, label: string): void {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(value, 0, 1), h);
    ctx.fillStyle = 'rgba(216,255,232,0.7)'; ctx.font = '700 8px ui-sans-serif,system-ui'; ctx.fillText(label, x + w + 7, y + 7);
  }

  private drawTouchHints(ctx: CanvasRenderingContext2D): void {
    if (innerWidth > 820) return;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(72, innerHeight - 72, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GREEN;
    ctx.beginPath(); ctx.arc(innerWidth - 72, innerHeight - 72, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(2,6,11,0.72)'; ctx.fillRect(0, 78, innerWidth, innerHeight - 78);
    ctx.textAlign = 'center';
    ctx.fillStyle = GREEN; ctx.font = '900 20px ui-sans-serif,system-ui';
    ctx.fillText('BOARDING COMPLETE', innerWidth / 2, innerHeight * 0.46);
    ctx.fillStyle = BLUE; ctx.font = '800 12px ui-sans-serif,system-ui';
    ctx.fillText('XRP MAN // SECURE THE DOCKING BAY', innerWidth / 2, innerHeight * 0.46 + 30);
    ctx.textAlign = 'left';
  }

  private centerObstacle() {
    const w = Math.min(170, innerWidth * 0.34);
    return { x: innerWidth * 0.5 - w / 2, y: innerHeight * 0.47, w, h: 72 };
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
