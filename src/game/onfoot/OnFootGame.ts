import { sfx } from '../audio/Sfx';
import {
  ONFOOT_PHYSICS,
  REGULATORY_INTERIOR_ROOMS,
  type InteriorEnemySpawn,
  type InteriorPlatform,
  type InteriorRoom,
} from './InteriorRooms';

type Shot = { x: number; y: number; vx: number; vy: number; hostile: boolean; life: number };
type Facing = 'left' | 'right';
type EnemyState = InteriorEnemySpawn & { w: number; h: number; fireClock: number; alive: boolean; maxHealth: number };

const GREEN = '#00ff00';
const BLUE = '#36a3ff';
const RED = '#ff4c66';
type AnimKey = 'idle' | 'run' | 'jump' | 'fire';

/**
 * Frame counts and playback for each strip, and which frames of the jump
 * sequence stand for which part of a leap.
 *
 * The jump sheet is one continuous crouch-leap-tumble-land sequence, not a
 * loop, so it is indexed by what the body is doing rather than played through:
 * gathering on the way up, extended at the top, tucked on the way down.
 */
const ANIMS: Record<AnimKey, { frames: number; fps: number }> = {
  idle: { frames: 6, fps: 6 },
  run: { frames: 8, fps: 14 },
  jump: { frames: 8, fps: 10 },
  fire: { frames: 7, fps: 16 },
};
const ANIM_CELL = 128;
const JUMP_RISE_FRAME = 2;
const JUMP_APEX_FRAME = 4;
const JUMP_FALL_FRAME = 5;
const PLAYER_RENDER_SIZE = 84;
/** Seconds of squash after a landing. */
const ONFOOT_LAND_SQUASH = 0.17;

/**
 * L1-I authored Regulatory Warship interior slice.
 * H2 movement/jump/shooting constants remain locked while presentation and room flow expand.
 * Mobile landscape uses a zoomed-out world camera so XRPMan becomes a smaller character in a
 * larger visible play field without changing physics, collision dimensions, or weapon cadence.
 */
export class OnFootGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite = new Image();
  /**
   * The real character animations, cut from the uploaded sheets.
   *
   * The old proto sheet was six near-identical standing frames, which is why
   * XRPMan stood bolt upright through everything. These are separate strips
   * because they have different frame counts and run at different speeds.
   */
  private readonly anims: Record<AnimKey, HTMLImageElement> = {
    idle: new Image(),
    run: new Image(),
    jump: new Image(),
    fire: new Image(),
  };
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
  /**
   * Animation state carried between frames.
   *
   * The character sheet is six near-identical standing frames -- there is no
   * walk cycle, no jump pose and no firing pose in it, which is why XRPMan
   * stood bolt upright through everything. Until real frames exist, the motion
   * is built here instead: `stride` advances with distance travelled rather
   * than with time, so the gait matches the speed, and `landClock` drives the
   * squash on touchdown.
   */
  private stride = 0;
  private landClock = 0;
  private wasGrounded = false;
  private coyoteClock = 0;
  private jumpBufferClock = 0;
  private cameraX = 0;
  private cameraY = 0;
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
    for (const key of Object.keys(this.anims) as AnimKey[]) {
      this.anims[key].src = `/assets/characters/xrpman_${key}.png`;
    }
    this.enemySprite.src = '/assets/enemies/regulator_drone.webp';
    // Only rooms that actually have art request it. A room without a
    // backgroundSrc draws its procedural interior by design, and asking the
    // network for a file nobody made would just be a 404 per room per load.
    for (const room of REGULATORY_INTERIOR_ROOMS) {
      if (!room.backgroundSrc) continue;
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

  /**
   * @param startRoom Room index to open in, for playtesting a single room
   *   without walking the whole warship to reach it. Defaults to the first.
   */
  show(startRoom = 0): void {
    this.resetRun(startRoom);
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
    this.landClock = Math.max(0, this.landClock - dt);
    // Distance-driven, so the legs keep up with however fast he is going.
    if (this.player.grounded) this.stride += Math.abs(this.player.vx) * dt * 0.055;
    if (this.player.grounded && !this.wasGrounded) this.landClock = ONFOOT_LAND_SQUASH;
    this.wasGrounded = this.player.grounded;
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
    this.updateCamera(dt);

    if (this.roomCleared() && this.atExit()) this.advanceRoom();

    if (this.player.health <= 0 || this.player.y > this.room.worldHeight + 120) {
      this.hide();
      window.dispatchEvent(new CustomEvent('coded:onfoot-defeat'));
    }
  }

  private updateCamera(dt: number): void {
    const scale = this.worldScale();
    const visibleWorldWidth = innerWidth / scale;
    const visibleWorldHeight = innerHeight / scale;
    const targetCameraX = this.player.x - visibleWorldWidth * 0.42;
    const maxCameraX = Math.max(0, this.room.worldWidth - visibleWorldWidth);
    this.cameraX += (targetCameraX - this.cameraX) * Math.min(1, dt * 7.5);
    this.cameraX = clamp(this.cameraX, 0, maxCameraX);

    const floorScreenTarget = innerHeight - (this.isLandscapeMobile() ? 34 : 0);
    const maxCameraY = Math.max(0, this.room.worldHeight - visibleWorldHeight);
    if (this.room.verticalCamera) {
      // A climb needs the camera to climb too. Pinning the floor would leave
      // the top of the shaft permanently off-screen.
      const followY = this.player.y - visibleWorldHeight * 0.58;
      this.cameraY += (clamp(followY, 0, maxCameraY) - this.cameraY) * Math.min(1, dt * 6);
      this.cameraY = clamp(this.cameraY, 0, maxCameraY);
      return;
    }
    const targetCameraY = this.room.floorY - floorScreenTarget / scale;
    this.cameraY = clamp(targetCameraY, 0, maxCameraY);
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
    sfx.play('shoot');
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
      sfx.play('enemyShoot');
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
          sfx.play('hurt');
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
            sfx.play('explode');
          } else {
            sfx.play('hit');
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
    sfx.play('pickup');
    if (this.roomIndex < REGULATORY_INTERIOR_ROOMS.length - 1) {
      this.pendingRoomIndex = this.roomIndex + 1;
      this.transitionClock = 0.42;
      this.player.vx = 0;
      this.player.vy = 0;
      return;
    }
    if (this.completionClock <= 0) {
      this.completionClock = 999;
      sfx.play('levelUp');
      window.dispatchEvent(new CustomEvent('coded:onfoot-prototype-clear', {
        detail: { roomKey: this.room.key, next: 'core_access' },
      }));
    }
  }

  private roomCleared(): boolean {
    return this.enemies.every((enemy) => !enemy.alive);
  }

  /**
   * Rooms whose exit sits at a height must be climbed to, not walked past --
   * without the height check the shaft's far wall is reachable along its floor
   * and the whole climb is optional.
   */
  private atExit(): boolean {
    if (this.player.x <= this.room.exitX) return false;
    if (this.room.exitY === undefined) return true;
    return Math.abs(this.player.y - this.room.exitY) < 130;
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.fillStyle = '#071321';
    c.fillRect(0, 0, innerWidth, innerHeight);

    const scale = this.worldScale();
    c.save();
    c.scale(scale, scale);
    c.translate(-this.cameraX, -this.cameraY);
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
      this.drawRoomCover(c, image);
      c.restore();
    } else {
      this.drawProceduralInterior(c);
    }

    const blueLift = c.createLinearGradient(0, 0, 0, this.room.worldHeight);
    blueLift.addColorStop(0, 'rgba(54,163,255,0.055)');
    blueLift.addColorStop(0.55, 'rgba(54,163,255,0.025)');
    blueLift.addColorStop(1, 'rgba(0,0,0,0.10)');
    c.fillStyle = blueLift;
    c.fillRect(0, 0, this.room.worldWidth, this.room.worldHeight);
  }

  /**
   * Fit the art to the room without distorting it.
   *
   * This used to stretch the image straight onto the room's dimensions. Every
   * background is 1024x576, and on the wide decks that was a squash you would
   * not notice. The maintenance shaft is the one vertical room -- 980x1180 --
   * and there the same call smeared the art to twice its height. Scale by
   * whichever axis needs more, centre across, and anchor to the bottom so
   * floor detail lands on the floor rather than halfway up the wall.
   */
  private drawRoomCover(c: CanvasRenderingContext2D, image: HTMLImageElement): void {
    const { worldWidth: w, worldHeight: h } = this.room;
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    c.drawImage(image, (w - dw) / 2, h - dh, dw, dh);
  }

  /**
   * Stand-in interior for rooms whose art has not landed yet.
   *
   * A flat fill read as a bug rather than a room, and with four new rooms
   * shipping ahead of their backgrounds that is most of the level. This paints
   * hull plating, bulkhead ribs, strip lighting and floor grating in the room's
   * own accent -- enough that the space reads as a deck of a warship. Every
   * value is derived from the room's fixed geometry, so nothing shimmers frame
   * to frame.
   */
  private drawProceduralInterior(c: CanvasRenderingContext2D): void {
    const { worldWidth: w, worldHeight: h, floorY, accent } = this.room;
    // Two constraints decide where this detail goes. The camera pins the floor
    // to the bottom of a short landscape screen, so only ~430px above the floor
    // is ever on screen; and the objective panel covers the top of that. So the
    // structure lives in the lower band, where it is actually seen, and it is
    // drawn at real opacity -- the first pass used 4% alphas that vanished.
    const ceiling = Math.max(0, floorY - 430);
    const band = floorY - ceiling;

    const base = c.createLinearGradient(0, ceiling, 0, h);
    base.addColorStop(0, '#04101c');
    base.addColorStop(0.55, '#0b1e2f');
    base.addColorStop(1, '#040c15');
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);

    // Bulkhead ribs down the length of the room.
    const ribGap = 200;
    c.save();
    for (let x = ribGap * 0.5; x < w; x += ribGap) {
      c.fillStyle = 'rgba(126,186,232,0.10)';
      c.fillRect(x - 30, ceiling, 60, band);
      c.fillStyle = 'rgba(126,186,232,0.20)';
      c.fillRect(x - 30, ceiling, 3, band);
      c.fillRect(x + 27, ceiling, 3, band);
    }
    c.restore();

    // Wall panelling across the lower two-thirds, where the eye actually is.
    c.save();
    c.strokeStyle = 'rgba(126,186,232,0.14)';
    c.lineWidth = 2;
    for (let y = floorY - 70; y > ceiling + band * 0.28; y -= 86) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let x = 100; x < w; x += 100) {
      c.strokeStyle = 'rgba(126,186,232,0.07)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, floorY - 240);
      c.lineTo(x, floorY);
      c.stroke();
    }
    c.restore();

    // Accent strip lighting, low enough to clear the objective panel.
    c.save();
    const lightY = ceiling + band * 0.42;
    for (let x = 70; x < w; x += ribGap) {
      const glow = c.createRadialGradient(x + ribGap * 0.26, lightY, 4, x + ribGap * 0.26, lightY, 150);
      glow.addColorStop(0, `${accent}55`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = glow;
      c.fillRect(x - 80, lightY - 130, ribGap + 160, 260);
      c.fillStyle = accent;
      c.globalAlpha = 0.85;
      c.fillRect(x, lightY - 3, ribGap * 0.5, 6);
      c.globalAlpha = 1;
    }
    c.restore();

    // Floor grating, and a bright deck line so the ground reads as solid.
    c.save();
    c.fillStyle = 'rgba(4,11,19,0.94)';
    c.fillRect(0, floorY, w, h - floorY);
    c.strokeStyle = 'rgba(126,186,232,0.22)';
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 36) {
      c.beginPath();
      c.moveTo(x, floorY);
      c.lineTo(x, h);
      c.stroke();
    }
    c.strokeStyle = accent;
    c.globalAlpha = 0.7;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, floorY);
    c.lineTo(w, floorY);
    c.stroke();
    c.restore();
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

  /**
   * Marks a standable edge without drawing a box around it.
   *
   * This used to be a full blue outline rectangle plus a 2px line of solid
   * green. Over the procedural interior that WAS the level -- there was
   * nothing else to see. Over the painted rooms it read as leftover debug
   * geometry: bright wireframe boxes stamped across the art.
   *
   * The edge still has to be marked, because the collision line and the
   * painted ledge underneath it are not the same thing. So: no outline, and a
   * soft glowing lip on the top edge only, at the alpha where you can find it
   * when you look for it and stop noticing it when you do not.
   */
  private drawPlatform(c: CanvasRenderingContext2D, platform: InteriorPlatform): void {
    c.save();
    c.fillStyle = 'rgba(4,12,18,0.14)';
    c.fillRect(platform.x, platform.y, platform.w, platform.h);
    c.shadowColor = 'rgba(0,255,0,0.5)';
    c.shadowBlur = 5;
    c.fillStyle = 'rgba(0,255,0,0.24)';
    c.fillRect(platform.x, platform.y, platform.w, 1);
    c.restore();
  }

  /**
   * Which strip is playing, and which frame of it.
   *
   * Priority is what the body is most committed to: firing wins, then being
   * off the ground, then running. The run cycle is driven by `stride`, which
   * advances with distance travelled, so the legs keep pace with the actual
   * speed instead of cycling at a fixed rate while he skates.
   */
  private currentPose(running: boolean, airborne: boolean): { key: AnimKey; frame: number } {
    if (this.fireCooldown > 0) {
      const spent = 1 - this.fireCooldown / ONFOOT_PHYSICS.blastCooldown;
      const frame = Math.min(ANIMS.fire.frames - 1, Math.floor(spent * ANIMS.fire.frames));
      return { key: 'fire', frame };
    }
    if (airborne) {
      const frame = this.player.vy < -120 ? JUMP_RISE_FRAME
        : this.player.vy > 120 ? JUMP_FALL_FRAME
          : JUMP_APEX_FRAME;
      return { key: 'jump', frame };
    }
    if (running) {
      return { key: 'run', frame: Math.floor(this.stride * 1.35) % ANIMS.run.frames };
    }
    const t = performance.now() / 1000 * ANIMS.idle.fps;
    return { key: 'idle', frame: Math.floor(t) % ANIMS.idle.frames };
  }

  private drawPlayer(c: CanvasRenderingContext2D): void {
    const flash = this.hurtCooldown > 0 && Math.floor(this.hurtCooldown * 16) % 2 === 0;
    if (flash) c.globalAlpha = 0.35;

    const running = this.player.grounded && Math.abs(this.player.vx) > 40;
    const airborne = !this.player.grounded;

    // The gait. Two beats per stride cycle: he rises on the push and drops on
    // the plant, and leans into the direction he is actually moving.
    const gait = Math.sin(this.stride);
    const bob = running ? -Math.abs(gait) * 3.2 : Math.sin(performance.now() * 0.0022) * 0.8;
    const lean = running ? Math.sign(this.player.vx) * 0.1 + gait * 0.035 : 0;
    // Airborne: stretch on the way up, gather on the way down.
    const rise = airborne ? clamp(-this.player.vy / 520, -1, 1) : 0;
    // Landing squash, and its opposite while stretched in the air.
    const land = this.landClock / ONFOOT_LAND_SQUASH;
    const squash = 1 - land * 0.22 + rise * 0.1;
    const widen = 1 + land * 0.2 - rise * 0.08 + (running ? Math.abs(gait) * 0.03 : 0);
    // Firing kicks him back off the shot.
    const recoil = this.fireCooldown > 0 ? Math.min(1, this.fireCooldown / 0.18) : 0;

    c.save();
    c.fillStyle = 'rgba(0,0,0,0.34)';
    c.beginPath();
    // The shadow shrinks and fades as he climbs away from the floor.
    const lift = airborne ? clamp(1 - Math.abs(this.player.vy) / 700, 0.45, 1) : 1;
    c.globalAlpha = lift;
    c.ellipse(this.player.x, this.player.y + ONFOOT_PHYSICS.playerHeight / 2 + 4, 25 * lift, 6 * lift, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    const pose = this.currentPose(running, airborne);
    const strip = this.anims[pose.key];
    if (strip.complete && strip.naturalWidth >= ANIM_CELL) {
      const face = this.player.facing === 'left' ? -1 : 1;
      c.save();
      c.translate(this.player.x - face * recoil * 3, this.player.y + bob - 5);
      c.rotate(lean + (airborne ? face * 0.07 : 0));
      c.scale(face * widen, squash);
      c.shadowColor = this.fireCooldown > 0 ? GREEN : BLUE;
      c.shadowBlur = this.fireCooldown > 0 ? 18 : 11;
      c.drawImage(
        strip,
        pose.frame * ANIM_CELL,
        0,
        ANIM_CELL,
        ANIM_CELL,
        -PLAYER_RENDER_SIZE / 2,
        -PLAYER_RENDER_SIZE / 2,
        PLAYER_RENDER_SIZE,
        PLAYER_RENDER_SIZE,
      );
      c.restore();
    } else if (this.sprite.complete && this.sprite.naturalWidth >= 384) {
      // The proto sheet, still the fallback if a strip fails to load.
      const frame = this.fireCooldown > 0.08 ? 5 : 4;
      const face = this.player.facing === 'left' ? -1 : 1;
      c.save();
      c.translate(this.player.x - face * recoil * 3, this.player.y + bob - 5);
      c.rotate(lean + (airborne ? face * 0.07 : 0));
      c.scale(face * widen, squash);
      c.shadowColor = this.fireCooldown > 0 ? GREEN : BLUE;
      c.shadowBlur = this.fireCooldown > 0 ? 18 : 11;
      c.drawImage(this.sprite, frame * 64, 0, 64, 64,
        -PLAYER_RENDER_SIZE / 2, -PLAYER_RENDER_SIZE / 2, PLAYER_RENDER_SIZE, PLAYER_RENDER_SIZE);
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
      c.fillRect(enemy.x - 25, enemy.y - enemy.h / 2 - 10, 50 * enemy.health / enemy.maxHealth, 4);
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

  /**
   * A slim strip, not a panel.
   *
   * This was a bordered 304x64 box in the top-left. On a landscape phone --
   * about 350x230 of CSS pixels -- that is most of the width and a quarter of
   * the height, sitting on top of the room the player is trying to read. Now
   * the rooms have painted art, boxing it off costs more than it buys: three
   * short lines with a shadow read fine straight over the background.
   */
  private drawHud(c: CanvasRenderingContext2D): void {
    const compact = this.isLandscapeMobile();
    const barW = compact ? 54 : 72;
    const energyX = compact ? 92 : 118;

    c.save();
    // A shadow instead of a filled panel: legible over art, hides nothing.
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 4;
    c.textAlign = 'left';
    c.font = `900 ${compact ? 9 : 11}px ui-sans-serif, system-ui`;
    c.fillStyle = GREEN;
    c.fillText(`XRPMAN // ${this.room.key.replace('_', ' ').toUpperCase()}`, 12, compact ? 16 : 19);

    const barY = compact ? 22 : 27;
    c.fillStyle = '#173427'; c.fillRect(12, barY, barW, 3);
    c.fillStyle = GREEN; c.fillRect(12, barY, barW * this.player.health / 100, 3);
    c.fillStyle = '#10283a'; c.fillRect(energyX, barY, barW, 3);
    c.fillStyle = BLUE; c.fillRect(energyX, barY, barW * this.player.energy / 100, 3);

    c.font = `700 ${compact ? 7 : 8}px ui-sans-serif, system-ui`;
    c.fillStyle = 'rgba(216,255,232,0.5)';
    c.fillText('HP', 12 + barW + 5, barY + 3);
    c.fillText('EN', energyX + barW + 5, barY + 3);

    c.font = `700 ${compact ? 8 : 9}px ui-sans-serif, system-ui`;
    c.fillStyle = 'rgba(216,255,232,0.66)';
    c.fillText(
      this.roomCleared() ? 'AREA SECURED // EXIT OPEN' : this.room.objective,
      12,
      compact ? 37 : 44,
    );

    c.textAlign = 'right';
    c.fillStyle = 'rgba(54,163,255,0.9)';
    c.fillText(`${this.roomIndex + 1}/${REGULATORY_INTERIOR_ROOMS.length}`, innerWidth - 12, compact ? 16 : 19);
    c.restore();

    if (this.completionClock > 100) {
      c.textAlign = 'center';
      c.fillStyle = GREEN;
      c.font = '900 15px ui-sans-serif, system-ui';
      c.fillText('WARSHIP INTERIOR CLEARED', innerWidth / 2, compact ? 86 : 122);
      c.fillStyle = BLUE;
      c.font = '800 10px ui-sans-serif, system-ui';
      c.fillText('CORE ACCESS // LEDGER DEFENSE CORE IS NEXT', innerWidth / 2, compact ? 103 : 143);
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
    const compact = this.isLandscapeMobile();
    const y = innerHeight - (compact ? 42 : 70);
    const controlHeight = compact ? 38 : 48;
    c.globalAlpha = compact ? 0.67 : 0.8;
    c.textAlign = 'center';
    c.font = `900 ${compact ? 10 : 12}px ui-sans-serif, system-ui`;
    button(c, innerWidth * 0.075, y, compact ? 48 : 58, controlHeight, '◀', BLUE);
    button(c, innerWidth * 0.19, y, compact ? 48 : 58, controlHeight, '▶', BLUE);
    button(c, innerWidth * 0.78, y, compact ? 58 : 66, controlHeight, 'JUMP', GREEN);
    button(c, innerWidth * 0.92, y, compact ? 58 : 66, controlHeight, 'BLAST', GREEN);
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
      if (y < 0.64) {
        this.fireLiquidityBlast();
        return;
      }
      if (x < 0.14) {
        this.pointerMoveId = event.pointerId;
        this.pointerMove = -1;
      } else if (x < 0.30) {
        this.pointerMoveId = event.pointerId;
        this.pointerMove = 1;
      } else if (x < 0.85) {
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

  private resetRun(startRoom = 0): void {
    const index = Math.max(0, Math.min(REGULATORY_INTERIOR_ROOMS.length - 1, Math.floor(startRoom)));
    this.roomIndex = index;
    this.player.health = 100;
    this.player.energy = 100;
    this.completionClock = 0;
    this.enterRoom(index, false);
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
      maxHealth: spawn.health,
    }));
    this.shots = [];
    this.cameraX = 0;
    this.cameraY = 0;
    this.fireCooldown = 0;
    this.hurtCooldown = 0;
    this.coyoteClock = 0;
    this.jumpBufferClock = 0;
    this.pointerMove = 0;
    this.pointerMoveId = null;
    this.introClock = preserveVitals ? 0.68 : 0.82;
    this.updateCamera(1);
  }

  private worldScale(): number {
    if (!this.isLandscapeMobile()) return 1;
    return clamp(innerHeight / 520, 0.62, 0.74);
  }

  private isLandscapeMobile(): boolean {
    return matchMedia('(pointer: coarse)').matches && innerWidth > innerHeight;
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.visible) this.updateCamera(1);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function button(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, color: string): void {
  c.fillStyle = 'rgba(2,6,11,0.66)';
  c.fillRect(x - w / 2, y - h / 2, w, h);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = color;
  c.fillText(label, x, y + 4);
}
