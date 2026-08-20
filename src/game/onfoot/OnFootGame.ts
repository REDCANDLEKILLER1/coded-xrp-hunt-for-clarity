import { SIDEVIEW_ROOM, type Platform } from './SideViewRoom';

type Shot = { x: number; y: number; vx: number; vy: number; hostile: boolean; life: number };
type Facing = 'left' | 'right';

const GREEN = '#00ff00';
const BLUE = '#36a3ff';
const RED = '#ff4c66';

/**
 * L1-H2 side-view proof-of-feel runtime.
 * This intentionally stays self-contained so the validated flight engine is untouched.
 */
export class OnFootGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite = new Image();
  private visible = false;
  private lastTime = performance.now();
  private player = {
    x: SIDEVIEW_ROOM.startX,
    y: SIDEVIEW_ROOM.startY,
    vx: 0,
    vy: 0,
    health: 100,
    energy: 100,
    facing: 'right' as Facing,
    grounded: false,
  };
  private enemy = { x: 1085, y: 380, w: 42, h: 58, health: 100, fireClock: 1.1, alive: true };
  private shots: Shot[] = [];
  private keys = new Set<string>();
  private fireCooldown = 0;
  private hurtCooldown = 0;
  private coyoteClock = 0;
  private jumpBufferClock = 0;
  private cameraX = 0;
  private completionClock = 0;
  private introClock = 0;
  private pointerMove = 0;
  private pointerMoveId: number | null = null;

  constructor(private readonly shell: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'XRPMan side-view interior prototype');
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
    this.introClock = 1.1;
    window.dispatchEvent(new CustomEvent('coded:music-cue', { detail: { cue: 'warship_interior' } }));
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
    this.keys.clear();
    this.pointerMove = 0;
    this.pointerMoveId = null;
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
    this.introClock = Math.max(0, this.introClock - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.coyoteClock = Math.max(0, this.coyoteClock - dt);
    this.jumpBufferClock = Math.max(0, this.jumpBufferClock - dt);
    this.completionClock = Math.max(0, this.completionClock - dt);
    this.player.energy = Math.min(100, this.player.energy + 22 * dt);

    let move = this.pointerMove;
    if (this.keys.has('arrowleft') || this.keys.has('a')) move -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) move += 1;
    move = Math.max(-1, Math.min(1, move));

    const accel = this.player.grounded ? 16 : 9;
    const desiredVx = move * SIDEVIEW_ROOM.moveSpeed;
    this.player.vx += (desiredVx - this.player.vx) * Math.min(1, dt * accel);
    if (Math.abs(move) < 0.01) this.player.vx *= Math.pow(0.0008, dt);
    if (move < -0.05) this.player.facing = 'left';
    if (move > 0.05) this.player.facing = 'right';

    if (this.player.grounded) this.coyoteClock = SIDEVIEW_ROOM.coyoteSeconds;
    if (this.jumpBufferClock > 0 && (this.player.grounded || this.coyoteClock > 0)) this.performJump();

    this.player.vy = Math.min(SIDEVIEW_ROOM.maxFallSpeed, this.player.vy + SIDEVIEW_ROOM.gravity * dt);
    this.movePlayer(dt);

    if (this.enemy.alive) this.updateEnemy(dt);
    this.updateShots(dt);

    const viewWidth = innerWidth;
    const targetCamera = this.player.x - viewWidth * 0.42;
    this.cameraX += (targetCamera - this.cameraX) * Math.min(1, dt * 7.5);
    this.cameraX = clamp(this.cameraX, 0, Math.max(0, SIDEVIEW_ROOM.worldWidth - viewWidth));

    if (!this.enemy.alive && this.player.x > SIDEVIEW_ROOM.worldWidth - 125 && this.completionClock <= 0) {
      this.completionClock = 999;
      window.dispatchEvent(new CustomEvent('coded:onfoot-prototype-clear'));
    }

    if (this.player.health <= 0 || this.player.y > SIDEVIEW_ROOM.worldHeight + 120) {
      this.hide();
      window.dispatchEvent(new CustomEvent('coded:onfoot-defeat'));
    }
  }

  private movePlayer(dt: number): void {
    const halfW = SIDEVIEW_ROOM.playerWidth / 2;
    const halfH = SIDEVIEW_ROOM.playerHeight / 2;
    const oldY = this.player.y;

    this.player.x = clamp(this.player.x + this.player.vx * dt, halfW + 8, SIDEVIEW_ROOM.worldWidth - halfW - 8);
    this.player.y += this.player.vy * dt;
    this.player.grounded = false;

    if (this.player.vy >= 0) {
      const oldBottom = oldY + halfH;
      const newBottom = this.player.y + halfH;
      for (const platform of SIDEVIEW_ROOM.platforms) {
        const withinX = this.player.x + halfW - 6 > platform.x && this.player.x - halfW + 6 < platform.x + platform.w;
        const crossedTop = oldBottom <= platform.y + 8 && newBottom >= platform.y;
        if (withinX && crossedTop) {
          this.player.y = platform.y - halfH;
          this.player.vy = 0;
          this.player.grounded = true;
          break;
        }
      }
    }

    // Simple side collision against the two tall machinery blocks in the test chamber.
    const blocks = [
      { x: 665, y: 565, w: 54, h: 75 },
      { x: 1270, y: 520, w: 62, h: 120 },
    ];
    for (const block of blocks) {
      const px = this.player.x - halfW;
      const py = this.player.y - halfH;
      if (!rectOverlap(px, py, SIDEVIEW_ROOM.playerWidth, SIDEVIEW_ROOM.playerHeight, block.x, block.y, block.w, block.h)) continue;
      if (this.player.vx > 0) this.player.x = block.x - halfW;
      else if (this.player.vx < 0) this.player.x = block.x + block.w + halfW;
      this.player.vx = 0;
    }
  }

  private tryJump(): void {
    this.jumpBufferClock = SIDEVIEW_ROOM.jumpBufferSeconds;
    if (this.player.grounded || this.coyoteClock > 0) this.performJump();
  }

  private performJump(): void {
    this.player.vy = -SIDEVIEW_ROOM.jumpSpeed;
    this.player.grounded = false;
    this.coyoteClock = 0;
    this.jumpBufferClock = 0;
  }

  private fireLiquidityBlast(): void {
    if (!this.visible || this.fireCooldown > 0 || this.player.energy < SIDEVIEW_ROOM.blastCost) return;
    this.fireCooldown = SIDEVIEW_ROOM.blastCooldown;
    this.player.energy -= SIDEVIEW_ROOM.blastCost;
    const direction = this.player.facing === 'right' ? 1 : -1;
    this.shots.push({
      x: this.player.x + direction * 28,
      y: this.player.y - 8,
      vx: direction * SIDEVIEW_ROOM.blastSpeed,
      vy: 0,
      hostile: false,
      life: 1.7,
    });
  }

  private updateEnemy(dt: number): void {
    this.enemy.fireClock -= dt;
    if (this.enemy.fireClock > 0) return;
    this.enemy.fireClock = 1.25;
    const dx = this.player.x - this.enemy.x;
    const dy = (this.player.y - 10) - this.enemy.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    this.shots.push({
      x: this.enemy.x,
      y: this.enemy.y,
      vx: dx / length * 310,
      vy: dy / length * 310,
      hostile: true,
      life: 3.2,
    });
  }

  private updateShots(dt: number): void {
    const kept: Shot[] = [];
    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < -50 || shot.x > SIDEVIEW_ROOM.worldWidth + 50) continue;

      if (shot.hostile) {
        if (this.hurtCooldown <= 0 && Math.hypot(shot.x - this.player.x, shot.y - this.player.y) < 30) {
          this.player.health = Math.max(0, this.player.health - 18);
          this.hurtCooldown = 0.75;
          this.player.vx += shot.vx > 0 ? 105 : -105;
          continue;
        }
      } else if (this.enemy.alive && rectOverlap(shot.x - 7, shot.y - 4, 14, 8, this.enemy.x - this.enemy.w / 2, this.enemy.y - this.enemy.h / 2, this.enemy.w, this.enemy.h)) {
        this.enemy.health -= 25;
        if (this.enemy.health <= 0) {
          this.enemy.alive = false;
          this.enemy.health = 0;
          this.shots = this.shots.filter((item) => !item.hostile);
        }
        continue;
      }
      kept.push(shot);
    }
    this.shots = kept;
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, innerWidth, innerHeight);
    this.drawBackground(c);

    c.save();
    c.translate(-this.cameraX, 0);
    this.drawWorld(c);
    this.drawEnemy(c);
    this.drawShots(c);
    this.drawPlayer(c);
    c.restore();

    this.drawHud(c);
    this.drawMobileControls(c);

    if (this.introClock > 0) {
      c.fillStyle = `rgba(2,6,11,${Math.min(0.88, this.introClock)})`;
      c.fillRect(0, 0, innerWidth, innerHeight);
      c.fillStyle = GREEN;
      c.textAlign = 'center';
      c.font = '900 15px ui-sans-serif, system-ui';
      c.fillText('REGULATORY WARSHIP // DOCKING BAY', innerWidth / 2, innerHeight * 0.47);
      c.fillStyle = BLUE;
      c.font = '800 11px ui-sans-serif, system-ui';
      c.fillText('XRPMan on foot', innerWidth / 2, innerHeight * 0.47 + 24);
    }
  }

  private drawBackground(c: CanvasRenderingContext2D): void {
    const gradient = c.createLinearGradient(0, 0, 0, innerHeight);
    gradient.addColorStop(0, '#071322');
    gradient.addColorStop(0.56, '#030912');
    gradient.addColorStop(1, '#010306');
    c.fillStyle = gradient;
    c.fillRect(0, 0, innerWidth, innerHeight);

    c.strokeStyle = 'rgba(54,163,255,0.12)';
    c.lineWidth = 1;
    for (let y = 110; y < innerHeight; y += 82) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(innerWidth, y); c.stroke();
    }
  }

  private drawWorld(c: CanvasRenderingContext2D): void {
    // Rear hull ribs create horizontal side-view depth without pretending this is final art.
    for (let x = 40; x < SIDEVIEW_ROOM.worldWidth; x += 150) {
      c.fillStyle = 'rgba(16,34,48,0.82)';
      c.fillRect(x, 85, 24, 555);
      c.strokeStyle = 'rgba(54,163,255,0.22)';
      c.strokeRect(x, 85, 24, 555);
    }

    for (const platform of SIDEVIEW_ROOM.platforms) this.drawPlatform(c, platform);

    c.fillStyle = '#111b25';
    c.fillRect(665, 565, 54, 75);
    c.fillRect(1270, 520, 62, 120);
    c.strokeStyle = BLUE;
    c.strokeRect(665, 565, 54, 75);
    c.strokeRect(1270, 520, 62, 120);

    const doorX = SIDEVIEW_ROOM.worldWidth - 92;
    c.fillStyle = this.enemy.alive ? '#220c12' : '#06190f';
    c.fillRect(doorX, SIDEVIEW_ROOM.floorY - 132, 68, 132);
    c.strokeStyle = this.enemy.alive ? RED : GREEN;
    c.lineWidth = 3;
    c.strokeRect(doorX, SIDEVIEW_ROOM.floorY - 132, 68, 132);
    c.fillStyle = this.enemy.alive ? RED : GREEN;
    c.font = '900 11px ui-sans-serif, system-ui';
    c.textAlign = 'center';
    c.fillText(this.enemy.alive ? 'LOCKED' : 'OPEN', doorX + 34, SIDEVIEW_ROOM.floorY - 144);
  }

  private drawPlatform(c: CanvasRenderingContext2D, platform: Platform): void {
    c.fillStyle = '#0b141c';
    c.fillRect(platform.x, platform.y, platform.w, platform.h);
    c.fillStyle = 'rgba(0,255,0,0.55)';
    c.fillRect(platform.x, platform.y, platform.w, 3);
    c.strokeStyle = 'rgba(54,163,255,0.25)';
    c.strokeRect(platform.x, platform.y, platform.w, platform.h);
  }

  private drawPlayer(c: CanvasRenderingContext2D): void {
    const flash = this.hurtCooldown > 0 && Math.floor(this.hurtCooldown * 16) % 2 === 0;
    if (flash) c.globalAlpha = 0.35;

    if (this.sprite.complete && this.sprite.naturalWidth >= 384) {
      const frame = this.fireCooldown > 0.08 ? 5 : 4;
      c.save();
      c.translate(this.player.x, this.player.y);
      const flip = this.player.facing === 'left' ? -1 : 1;
      c.scale(flip, 1);
      c.drawImage(this.sprite, frame * 64, 0, 64, 64, -32, -32, 64, 64);
      c.restore();
    } else {
      c.fillStyle = '#07140d';
      c.fillRect(this.player.x - 18, this.player.y - 32, 36, 64);
      c.strokeStyle = GREEN;
      c.lineWidth = 3;
      c.strokeRect(this.player.x - 18, this.player.y - 32, 36, 64);
      c.fillStyle = BLUE;
      c.fillRect(this.player.x - 4, this.player.y - 7, 8, 8);
    }
    c.globalAlpha = 1;
  }

  private drawEnemy(c: CanvasRenderingContext2D): void {
    if (!this.enemy.alive) return;
    c.save();
    c.translate(this.enemy.x, this.enemy.y);
    c.fillStyle = '#261018';
    c.fillRect(-21, -29, 42, 58);
    c.strokeStyle = RED;
    c.lineWidth = 3;
    c.strokeRect(-21, -29, 42, 58);
    c.fillStyle = RED;
    c.fillRect(this.player.x < this.enemy.x ? -27 : 18, -7, 10, 6);
    c.restore();

    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(this.enemy.x - 28, this.enemy.y - 43, 56, 5);
    c.fillStyle = RED;
    c.fillRect(this.enemy.x - 28, this.enemy.y - 43, 56 * this.enemy.health / 100, 5);
  }

  private drawShots(c: CanvasRenderingContext2D): void {
    for (const shot of this.shots) {
      c.save();
      c.shadowColor = shot.hostile ? RED : GREEN;
      c.shadowBlur = 14;
      c.fillStyle = shot.hostile ? RED : GREEN;
      c.fillRect(shot.x - 7, shot.y - 3, 14, 6);
      c.restore();
    }
  }

  private drawHud(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(2,6,11,0.78)';
    c.fillRect(12, 12, Math.min(318, innerWidth - 24), 78);
    c.strokeStyle = 'rgba(54,163,255,0.5)';
    c.strokeRect(12, 12, Math.min(318, innerWidth - 24), 78);
    c.textAlign = 'left';
    c.font = '900 12px ui-sans-serif, system-ui';
    c.fillStyle = GREEN;
    c.fillText('XRPMAN // WARSHIP INTERIOR', 24, 32);
    c.fillStyle = '#d8ffe8';
    c.font = '800 10px ui-sans-serif, system-ui';
    c.fillText('HP', 24, 52);
    c.fillStyle = '#173427'; c.fillRect(50, 44, 104, 9);
    c.fillStyle = GREEN; c.fillRect(50, 44, 104 * this.player.health / 100, 9);
    c.fillStyle = '#d8ffe8'; c.fillText('ENERGY', 170, 52);
    c.fillStyle = '#10283a'; c.fillRect(220, 44, 82, 9);
    c.fillStyle = BLUE; c.fillRect(220, 44, 82 * this.player.energy / 100, 9);
    c.fillStyle = 'rgba(216,255,232,0.66)';
    c.fillText(this.enemy.alive ? 'OBJECTIVE: CLEAR SECURITY // REACH EXIT' : 'SECURITY DOWN // EXIT OPEN', 24, 73);

    if (this.completionClock > 100) {
      c.textAlign = 'center';
      c.fillStyle = GREEN;
      c.font = '900 18px ui-sans-serif, system-ui';
      c.fillText('SIDE-VIEW PROTOTYPE CLEAR', innerWidth / 2, 120);
    }
  }

  private drawMobileControls(c: CanvasRenderingContext2D): void {
    if (!matchMedia('(pointer: coarse)').matches) return;
    const y = innerHeight - 74;
    c.globalAlpha = 0.7;
    c.textAlign = 'center';
    c.font = '900 12px ui-sans-serif, system-ui';

    button(c, innerWidth * 0.09, y, 58, 48, '◀', BLUE);
    button(c, innerWidth * 0.26, y, 58, 48, '▶', BLUE);
    button(c, innerWidth * 0.68, y, 66, 48, 'JUMP', GREEN);
    button(c, innerWidth * 0.89, y, 66, 48, 'BLAST', GREEN);
    c.globalAlpha = 1;
  }

  private bindInput(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      const key = event.key.toLowerCase();
      this.keys.add(key);
      if (key === ' ' || key === 'w' || key === 'arrowup') {
        event.preventDefault();
        this.tryJump();
      }
      if (key === 'x' || key === 'f' || key === 'enter') this.fireLiquidityBlast();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));

    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.visible) return;
      this.canvas.setPointerCapture(event.pointerId);
      const x = event.clientX / innerWidth;
      const y = event.clientY / innerHeight;
      if (y < 0.68) {
        // Tapping the upper playfield fires in current facing direction.
        this.fireLiquidityBlast();
        return;
      }
      if (x < 0.18) {
        this.pointerMoveId = event.pointerId;
        this.pointerMove = -1;
      } else if (x < 0.42) {
        this.pointerMoveId = event.pointerId;
        this.pointerMove = 1;
      } else if (x < 0.79) {
        this.tryJump();
      } else {
        this.fireLiquidityBlast();
      }
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (event.pointerId === this.pointerMoveId) {
        this.pointerMoveId = null;
        this.pointerMove = 0;
      }
    });
    this.canvas.addEventListener('pointercancel', (event) => {
      if (event.pointerId === this.pointerMoveId) {
        this.pointerMoveId = null;
        this.pointerMove = 0;
      }
    });
  }

  private resetRoom(): void {
    this.player = {
      x: SIDEVIEW_ROOM.startX,
      y: SIDEVIEW_ROOM.startY,
      vx: 0,
      vy: 0,
      health: 100,
      energy: 100,
      facing: 'right',
      grounded: false,
    };
    this.enemy = { x: 1085, y: 380, w: 42, h: 58, health: 100, fireClock: 1.1, alive: true };
    this.shots = [];
    this.cameraX = 0;
    this.fireCooldown = 0;
    this.hurtCooldown = 0;
    this.coyoteClock = 0;
    this.jumpBufferClock = 0;
    this.completionClock = 0;
    this.pointerMove = 0;
    this.pointerMoveId = null;
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function button(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, color: string): void {
  c.fillStyle = 'rgba(2,6,11,0.78)';
  c.fillRect(x - w / 2, y - h / 2, w, h);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = color;
  c.fillText(label, x, y + 4);
}
