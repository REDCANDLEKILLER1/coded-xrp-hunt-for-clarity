import {
  ONFOOT_PHYSICS,
  REGULATORY_INTERIOR_ROOMS,
  type InteriorEnemySpawn,
  type InteriorPlatform,
  type InteriorRoom,
} from './InteriorRooms';

type Shot = { x: number; y: number; vx: number; vy: number; hostile: boolean; life: number };
type Facing = 'left' | 'right';
type EnemyState = InteriorEnemySpawn & { w: number; h: number; fireClock: number; alive: boolean };

const GREEN = '#00ff00';
const BLUE = '#36a3ff';
const RED = '#ff4c66';
const PLAYER_RENDER_SIZE = 84;

/**
 * L1-I first authored Regulatory Warship interior slice.
 * H2 movement/jump/shooting constants remain locked while presentation and room flow expand.
 * The current XRPMan sheet is still prototype art; this runtime only improves readability.
 */
export class OnFootGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite = new Image();
  private readonly enemySprite = new Image();
  private readonly backgrounds = new Map<string, HTMLImageElement>();
  private visible = false;
  private lastTime = performance.now();
  private roomIndex = 0;
  private room: InteriorRoom = REGULATORY_INTERIOR_ROOMS[0];
  private player = {
    x: this.room.startX,
    y: this.room.startY,
    vx: 0,
    vy: 0,
    health: 100,
    energy: 100,
    facing: 'right' as Facing,
    grounded: false,
  };
  private enemies: EnemyState[] = [];
  private shots: Shot[] = [];
  private keys = new Set<string>();
  private fireCooldown = 0;
  private hurtCooldown = 0;
  private coyoteClock = 0;
  private jumpBufferClock = 0;
  private cameraX = 0;
  private completionClock = 0;
  private introClock = 0;
  private transitionClock = 0;
  private pendingRoomIndex: number | null = null;
  private pointerMove = 0;
  private pointerMoveId: number | null = null;

  constructor(private readonly shell: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'XRPMan Regulatory Warship interior');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '6',
      display: 'none',
      touchAction: 'none',
      background: '#02060b',
    });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('On-foot canvas unavailable.');
    this.ctx = ctx;
    this.sprite.src = '/assets/characters/xrpman_onfoot_proto_sheet.png';
    this.enemySprite.src = '/assets/enemies/regulator_drone.webp';
    for (const room of REGULATORY_INTERIOR_ROOMS) {
      const image = new Image();
      image.src = room.backgroundSrc;
      this.backgrounds.set(room.key, image);
    }
    this.shell.appendChild(this.canvas);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  show(): void {
    this.resetRun();
    this.visible = true;
    this.canvas.style.display = 'block';
    this.introClock = 0.82;
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

    if (this.transitionClock > 0) {
      this.transitionClock = Math.max(0, this.transitionClock - dt);
      if (this.transitionClock === 0 && this.pendingRoomIndex !== null) {
        this.enterRoom(this.pendingRoomIndex, true);
        this.pendingRoomIndex = null;
      }
      return;
    }

    let move = this.pointerMove;
    if (this.keys.has('arrowleft') || this.keys.has('a')) move -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) move += 1;
    move = clamp(move, -1, 1);

    const accel = this.player.grounded ? 16 : 9;
    const desiredVx = move * ONFOOT_PHYSICS.moveSpeed;
    this.player.vx += (desiredVx - this.player.vx) * Math.min(1, dt * accel);
    if (Math.abs(move) < 0.01) this.player.vx *= Math.pow(0.0008, dt);
    if (move < -0.05) this.player.facing = 'left';
    if (move > 0.05) this.player.facing = 'right';

    if (this.player.grounded) this.coyoteClock = ONFOOT_PHYSICS.coyoteSeconds;
    if (this.jumpBufferClock > 0 && (this.player.grounded || this.coyoteClock > 0)) this.performJump();

    this.player.vy = Math.min(ONFOOT_PHYSICS.maxFallSpeed, this.player.vy + ONFOOT_PHYSICS.gravity * dt);
    this.movePlayer(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);

    const viewWidth = innerWidth;
    const targetCamera = this.player.x - viewWidth * 0.42;
    this.cameraX += (targetCamera - this.cameraX) * Math.min(1, dt * 7.5);
    this.cameraX = clamp(this.cameraX, 0, Math.max(0, this.room.worldWidth - viewWidth));

    if (this.roomCleared() && this.player.x > this.room.exitX) this.advanceRoom();

    if (this.player.health <= 0 || this.player.y > this.room.worldHeight + 120) {
      this.hide();
      window.dispatchEvent(new CustomEvent('coded:onfoot-defeat'));
    }
  }

  private movePlayer(dt: number): void {
    const halfW = ONFOOT_PHYSICS.playerWidth / 2;
    const halfH = ONFOOT_PHYSICS.playerHeight / 2;
    const oldY = this.player.y;

    this.player.x = clamp(this.player.x + this.player.vx * dt, halfW + 8, this.room.worldWidth - halfW - 8);
    this.player.y += this.player.vy * dt;
    this.player.grounded = false;

    if (this.player.vy >= 0) {
      const oldBottom = oldY + halfH;
      const newBottom = this.player.y + halfH;
      for (const platform of this.room.platforms) {
        const withinX = this.player.x + halfW - 6 > platform.x && this.player.x - halfW + 6 < platform.x + platform.w;
        const crossedTop = oldBottom <= platform.y + 8 && newBottom >= platform.y;
        if (!withinX || !crossedTop) continue;
        this.player.y = platform.y - halfH;
        this.player.vy = 0;
        this.player.grounded = true;
        break;
      }
    }
  }

  private tryJump(): void {
    this.jumpBufferClock = ONFOOT_PHYSICS.jumpBufferSeconds;
    if (this.player.grounded || this.coyoteClock > 0) this.performJump();
  }

  private performJump(): void {
    this.player.vy = -ONFOOT_PHYSICS.jumpSpeed;
    this.player.grounded = false;
    this.coyoteClock = 0;
    this.jumpBufferClock = 0;
  }

  private fireLiquidityBlast(): void {
    if (!this.visible || this.transitionClock > 0 || this.fireCooldown > 0 || this.player.energy < ONFOOT_PHYSICS.blastCost) return;
    this.fireCooldown = ONFOOT_PHYSICS.blastCooldown;
    this.player.energy -= ONFOOT_PHYSICS.blastCost;
    const direction = this.player.facing === 'right' ? 1 : -1;
    this.shots.push({
      x: this.player.x + direction * 32,
      y: this.player.y - 8,
      vx: direction * ONFOOT_PHYSICS.blastSpeed,
      vy: 0,
      hostile: false,
      life: 1.7,
    });
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.fireClock -= dt;
      if (enemy.fireClock > 0) continue;
      enemy.fireClock = enemy.fireSeconds;
      const dx = this.player.x - enemy.x;
      const dy = (this.player.y - 10) - enemy.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      this.shots.push({
        x: enemy.x,
        y: enemy.y,
        vx: dx / length * 305,
        vy: dy / length * 305,
        hostile: true,
        life: 3.2,
      });
    }
  }

  private updateShots(dt: number): void {
    const kept: Shot[] = [];
    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < -50 || shot.x > this.room.worldWidth + 50) continue;

      if (shot.hostile) {
        if (this.hurtCooldown <= 0 && Math.hypot(shot.x - this.player.x, shot.y - this.player.y) < 30) {
          this.player.health = Math.max(0, this.player.health - 16);
          this.hurtCooldown = 0.75;
          this.player.vx += shot.vx > 0 ? 105 : -105;
          continue;
        }
      } else {
        const hit = this.enemies.find((enemy) => enemy.alive && rectOverlap(
          shot.x - 7, shot.y - 4, 14, 8,
          enemy.x - enemy.w / 2, enemy.y - enemy.h / 2, enemy.w, enemy.h,
        ));
        if (hit) {
          hit.health -= 25;
          if (hit.health <= 0) {
            hit.health = 0;
            hit.alive = false;
          }
          continue;
        }
      }
      kept.push(shot);
    }
    this.shots = kept;
    if (this.roomCleared()) this.shots = this.shots.filter((shot) => !shot.hostile);
  }

  private advanceRoom(): void {
    if (this.roomIndex < REGULATORY_INTERIOR_ROOMS.length - 1) {
      this.pendingRoomIndex = this.roomIndex + 1;
      this.transitionClock = 0.42;
      this.player.vx = 0;
      this.player.vy = 0;
      return;
    }
    if (this.completionClock <= 0) {
      this.completionClock = 999;
      window.dispatchEvent(new CustomEvent('coded:onfoot-prototype-clear', {
        detail: { roomKey: this.room.key, next: 'access_corridor' },
      }));
    }
  }

  private roomCleared(): boolean {
    return this.enemies.every((enemy) => !enemy.alive);
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.fillStyle = '#071321';
    c.fillRect(0, 0, innerWidth, innerHeight);

    c.save();
    c.translate(-this.cameraX, 0);
    this.drawRoomBackground(c);
    this.drawWorld(c);
    this.drawEnemies(c);
    this.drawShots(c);
    this.drawPlayer(c);
    c.restore();

    this.drawAtmosphere(c);
    this.drawHud(c);
    this.drawMobileControls(c);

    if (this.introClock > 0) this.drawRoomIntro(c);
    if (this.transitionClock > 0) {
      c.fillStyle = `rgba(2,6,11,${0.18 + (1 - this.transitionClock / 0.42) * 0.42})`;
      c.fillRect(0, 0, innerWidth, innerHeight);
    }
  }

  private drawRoomBackground(c: CanvasRenderingContext2D): void {
    const image = this.backgrounds.get(this.room.key);
    if (image?.complete && image.naturalWidth > 0) {
      c.save();
      c.filter = 'brightness(1.42) contrast(1.04) saturate(1.08)';
      c.drawImage(image, 0, 0, this.room.worldWidth, this.room.worldHeight);
      c.restore();
    } else {
      c.fillStyle = '#0a1a29';
      c.fillRect(0, 0, this.room.worldWidth, this.room.worldHeight);
    }

    // Keep foreground geometry readable without crushing already-dark concept art.
    const blueLift = c.createLinearGradient(0, 0, 0, this.room.worldHeight);
    blueLift.addColorStop(0, 'rgba(54,163,255,0.055)');
    blueLift.addColorStop(0.55, 'rgba(54,163,255,0.025)');
    blueLift.addColorStop(1, 'rgba(0,0,0,0.10)');
    c.fillStyle = blueLift;
    c.fillRect(0, 0, this.room.worldWidth, this.room.worldHeight);
  }

  private drawWorld(c: CanvasRenderingContext2D): void {
    for (const platform of this.room.platforms) this.drawPlatform(c, platform);
    const doorX = this.room.exitX - 12;
    c.save();
    c.shadowColor = this.roomCleared() ? GREEN : RED;
    c.shadowBlur = this.roomCleared() ? 18 : 10;
    c.strokeStyle = this.roomCleared() ? 'rgba(0,255,0,0.9)' : 'rgba(255,76,102,0.78)';
    c.lineWidth = 3;
    c.strokeRect(doorX, this.room.floorY - 126, 54, 126);
    if (this.roomCleared()) {
      c.fillStyle = 'rgba(0,255,0,0.12)';
      c.fillRect(doorX + 4, this.room.floorY - 121, 46, 116);
    }
    c.restore();
  }

  private drawPlatform(c: CanvasRenderingContext2D, platform: InteriorPlatform): void {
    c.fillStyle = 'rgba(4,12,18,0.16)';
    c.fillRect(platform.x, platform.y, platform.w, platform.h);
    c.fillStyle = 'rgba(0,255,0,0.48)';
    c.fillRect(platform.x, platform.y, platform.w, 2);
    c.strokeStyle = 'rgba(54,163,255,0.34)';
    c.strokeRect(platform.x, platform.y, platform.w, platform.h);
  }

  private drawPlayer(c: CanvasRenderingContext2D): void {
    const flash = this.hurtCooldown > 0 && Math.floor(this.hurtCooldown * 16) % 2 === 0;
    if (flash) c.globalAlpha = 0.35;

    const running = this.player.grounded && Math.abs(this.player.vx) > 40;
    const bob = running ? Math.sin(performance.now() * 0.018) * 2 : 0;

    c.save();
    c.fillStyle = 'rgba(0,0,0,0.34)';
    c.beginPath();
    c.ellipse(this.player.x, this.player.y + ONFOOT_PHYSICS.playerHeight / 2 + 4, 25, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    if (this.sprite.complete && this.sprite.naturalWidth >= 384) {
      const frame = this.fireCooldown > 0.08 ? 5 : 4;
      c.save();
      c.translate(this.player.x, this.player.y + bob - 5);
      c.scale(this.player.facing === 'left' ? -1 : 1, 1);
      c.shadowColor = this.fireCooldown > 0 ? GREEN : BLUE;
      c.shadowBlur = this.fireCooldown > 0 ? 18 : 11;
      c.drawImage(
        this.sprite,
        frame * 64,
        0,
        64,
        64,
        -PLAYER_RENDER_SIZE / 2,
        -PLAYER_RENDER_SIZE / 2,
        PLAYER_RENDER_SIZE,
        PLAYER_RENDER_SIZE,
      );
      c.restore();
    } else {
      c.fillStyle = '#07140d';
      c.fillRect(this.player.x - 21, this.player.y - 38, 42, 76);
      c.strokeStyle = GREEN;
      c.lineWidth = 3;
      c.strokeRect(this.player.x - 21, this.player.y - 38, 42, 76);
    }
    c.globalAlpha = 1;
  }

  private drawEnemies(c: CanvasRenderingContext2D): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      c.save();
      c.translate(enemy.x, enemy.y);
      c.shadowColor = RED;
      c.shadowBlur = 13;
      if (this.enemySprite.complete && this.enemySprite.naturalWidth > 0) {
        c.drawImage(this.enemySprite, -enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
      } else {
        c.fillStyle = '#261018';
        c.fillRect(-enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
        c.strokeStyle = RED;
        c.strokeRect(-enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
      }
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fillRect(enemy.x - 25, enemy.y - enemy.h / 2 - 10, 50, 4);
      c.fillStyle = RED;
      const maxHealth = this.room.key === 'docking_bay' ? 80 : enemy.x > 800 ? 120 : 100;
      c.fillRect(enemy.x - 25, enemy.y - enemy.h / 2 - 10, 50 * enemy.health / maxHealth, 4);
    }
  }

  private drawShots(c: CanvasRenderingContext2D): void {
    for (const shot of this.shots) {
      c.save();
      c.shadowColor = shot.hostile ? RED : GREEN;
      c.shadowBlur = shot.hostile ? 12 : 20;
      c.fillStyle = shot.hostile ? RED : GREEN;
      if (shot.hostile) {
        c.fillRect(shot.x - 7, shot.y - 3, 14, 6);
      } else {
        c.beginPath();
        c.ellipse(shot.x, shot.y, 15, 6, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  private drawAtmosphere(c: CanvasRenderingContext2D): void {
    // A light ambient wash replaces the previous heavy vignette that hid room art on phones.
    const ambient = c.createLinearGradient(0, 0, 0, innerHeight);
    ambient.addColorStop(0, 'rgba(54,163,255,0.045)');
    ambient.addColorStop(0.58, 'rgba(0,255,0,0.018)');
    ambient.addColorStop(1, 'rgba(0,0,0,0.06)');
    c.fillStyle = ambient;
    c.fillRect(0, 0, innerWidth, innerHeight);

    const vignette = c.createRadialGradient(
      innerWidth / 2,
      innerHeight / 2,
      innerHeight * 0.15,
      innerWidth / 2,
      innerHeight / 2,
      innerWidth * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.14)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, innerWidth, innerHeight);
  }

  private drawHud(c: CanvasRenderingContext2D): void {
    const width = Math.min(342, innerWidth - 24);
    c.fillStyle = 'rgba(2,6,11,0.72)';
    c.fillRect(12, 12, width, 82);
    c.strokeStyle = 'rgba(54,163,255,0.62)';
    c.strokeRect(12, 12, width, 82);
    c.textAlign = 'left';
    c.font = '900 12px ui-sans-serif, system-ui';
    c.fillStyle = GREEN;
    c.fillText(`XRPMAN // ${this.room.key.replace('_', ' ').toUpperCase()}`, 24, 32);
    c.fillStyle = '#d8ffe8';
    c.font = '800 10px ui-sans-serif, system-ui';
    c.fillText('HP', 24, 52);
    c.fillStyle = '#173427'; c.fillRect(50, 44, 104, 9);
    c.fillStyle = GREEN; c.fillRect(50, 44, 104 * this.player.health / 100, 9);
    c.fillStyle = '#d8ffe8'; c.fillText('ENERGY', 170, 52);
    c.fillStyle = '#10283a'; c.fillRect(220, 44, 82, 9);
    c.fillStyle = BLUE; c.fillRect(220, 44, 82 * this.player.energy / 100, 9);
    c.fillStyle = 'rgba(216,255,232,0.82)';
    c.fillText(this.roomCleared() ? 'AREA SECURED // EXIT OPEN' : this.room.objective, 24, 75);

    c.textAlign = 'right';
    c.fillStyle = 'rgba(54,163,255,0.95)';
    c.fillText(`${this.roomIndex + 1}/${REGULATORY_INTERIOR_ROOMS.length}`, innerWidth - 20, 30);

    if (this.completionClock > 100) {
      c.textAlign = 'center';
      c.fillStyle = GREEN;
      c.font = '900 17px ui-sans-serif, system-ui';
      c.fillText('SECURITY CHECKPOINT CLEARED', innerWidth / 2, 122);
      c.fillStyle = BLUE;
      c.font = '800 11px ui-sans-serif, system-ui';
      c.fillText('ACCESS CORRIDOR IS NEXT', innerWidth / 2, 143);
    }
  }

  private drawRoomIntro(c: CanvasRenderingContext2D): void {
    c.fillStyle = `rgba(2,6,11,${Math.min(0.54, this.introClock * 0.68)})`;
    c.fillRect(0, 0, innerWidth, innerHeight);
    c.textAlign = 'center';
    c.fillStyle = GREEN;
    c.font = '900 15px ui-sans-serif, system-ui';
    c.fillText(this.room.label, innerWidth / 2, innerHeight * 0.46);
    c.fillStyle = '#8dcfff';
    c.font = '800 11px ui-sans-serif, system-ui';
    c.fillText(this.room.objective, innerWidth / 2, innerHeight * 0.46 + 25);
  }

  private drawMobileControls(c: CanvasRenderingContext2D): void {
    if (!matchMedia('(pointer: coarse)').matches) return;
    const y = innerHeight - 70;
    c.globalAlpha = 0.8;
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
      if (event.pointerId !== this.pointerMoveId) return;
      this.pointerMoveId = null;
      this.pointerMove = 0;
    });
    this.canvas.addEventListener('pointercancel', (event) => {
      if (event.pointerId !== this.pointerMoveId) return;
      this.pointerMoveId = null;
      this.pointerMove = 0;
    });
  }

  private resetRun(): void {
    this.roomIndex = 0;
    this.player.health = 100;
    this.player.energy = 100;
    this.completionClock = 0;
    this.enterRoom(0, false);
  }

  private enterRoom(index: number, preserveVitals: boolean): void {
    const health = preserveVitals ? this.player.health : 100;
    const energy = preserveVitals ? this.player.energy : 100;
    this.roomIndex = index;
    this.room = REGULATORY_INTERIOR_ROOMS[index];
    this.player = {
      x: this.room.startX,
      y: this.room.startY,
      vx: 0,
      vy: 0,
      health,
      energy,
      facing: 'right',
      grounded: false,
    };
    this.enemies = this.room.enemies.map((spawn) => ({
      ...spawn,
      w: 54,
      h: 48,
      fireClock: Math.min(0.8, spawn.fireSeconds),
      alive: true,
    }));
    this.shots = [];
    this.cameraX = 0;
    this.fireCooldown = 0;
    this.hurtCooldown = 0;
    this.coyoteClock = 0;
    this.jumpBufferClock = 0;
    this.pointerMove = 0;
    this.pointerMoveId = null;
    this.introClock = preserveVitals ? 0.68 : 0.82;
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
  c.fillStyle = 'rgba(2,6,11,0.74)';
  c.fillRect(x - w / 2, y - h / 2, w, h);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = color;
  c.fillText(label, x, y + 4);
}
