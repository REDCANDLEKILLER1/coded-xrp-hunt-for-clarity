import type { Game2A } from '../core/Game2A';
import {
  boardingTargetForWarship,
  DirectBoardingDirector,
  EARTH_WARSHIP_BOARDING,
  type BoardingTarget,
} from '../content/DirectBoarding';

type ReadableActor = { x: number; y: number; w: number; h: number; state?: string };
type BoardingReadableGame = {
  player?: ReadableActor;
  warship?: ReadableActor | null;
};

/**
 * Temporary bridge between the validated flight runtime and the future on-foot engine.
 * It never changes fighter physics. It reads the live fighter/disabled-warship positions,
 * renders the hangar guidance on a transparent overlay, and calls the public suspend()
 * method once the actual fighter has been held inside the aperture.
 *
 * Game2A uses TypeScript `private` fields (not JS #private fields), so the read-only
 * snapshot is structurally available at runtime. L1-H can replace this bridge with an
 * explicit flight->on-foot interface when the interior engine exists.
 */
export class DirectBoardingRuntime {
  private readonly overlay: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly director = new DirectBoardingDirector();
  private active = false;
  private completedForCurrentWarship = false;
  private lastTime = performance.now();
  private completionClock = 0;
  private enabled=true;
  private frameId=0;

  constructor(private readonly game: Game2A, private readonly shell: HTMLElement) {
    this.overlay = document.createElement('canvas');
    this.overlay.setAttribute('aria-hidden', 'true');
    Object.assign(this.overlay.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2',
      // The global `canvas` rule paints an opaque #02060b background. This is a
      // positioned overlay stacked above the static game canvas, so inheriting
      // that would hide the entire game behind a flat dark rectangle. It must
      // stay transparent so only the hangar guidance drawn here is visible.
      background: 'transparent',
    });
    const ctx = this.overlay.getContext('2d');
    if (!ctx) throw new Error('Direct boarding overlay context unavailable.');
    this.ctx = ctx;
    this.shell.appendChild(this.overlay);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.schedule();
  }

  /**
   * Explicit lifecycle reset for a boarding retry.
   *
   * The frame loop can only clear its own latch when it SAMPLES a frame with no
   * disabled warship. A checkpoint restore clears and rebuilds the disabled
   * warship inside one synchronous reset(), so no animation frame ever observes
   * that intermediate state and the latch would survive into the retry. Any
   * caller that restores a flight checkpoint must therefore reset this bridge
   * explicitly, before the restore runs.
   */
  resetForRetry(): void {
    this.setEnabled(true);
    this.active = false;
    this.completedForCurrentWarship = false;
    this.completionClock = 0;
    this.director.reset();
    this.clear();
  }

  setEnabled(value:boolean):void {
    if(this.enabled===value)return;this.enabled=value;
    if(value){this.lastTime=performance.now();this.schedule();}
    else{cancelAnimationFrame(this.frameId);this.frameId=0;this.clear();}
  }
  private schedule():void {if(this.enabled)this.frameId=requestAnimationFrame(time=>this.frame(time));}

  private frame(time: number): void {
    if(!this.enabled)return;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const snapshot = this.game as unknown as BoardingReadableGame;
    const warship = snapshot.warship;
    const player = snapshot.player;

    if (!warship || warship.state !== 'disabled') {
      this.active = false;
      this.completedForCurrentWarship = false;
      this.completionClock = 0;
      this.director.reset();
      this.clear();
      this.schedule();
      return;
    }

    if (!this.active && !this.completedForCurrentWarship) {
      this.active = true;
      this.director.start();
    }

    if (this.active && player) {
      // The normal fighter lane intentionally stops short of the top HUD. Once the
      // capital ship is disabled, drift only the inert ship down into that reachable
      // lane while the hangar opens. Fighter movement/clamps remain untouched.
      const reachableWarshipY = Math.max(132, innerHeight * 0.34 - EARTH_WARSHIP_BOARDING.entryYOffset + 12);
      warship.y += (reachableWarshipY - warship.y) * Math.min(1, dt * 1.45);

      const target = boardingTargetForWarship(warship.x, warship.y);
      const inside = overlap(centerBox(player, 0.5), target);
      const state = this.director.update(dt, inside);
      this.draw(target, warship, state);

      if (state === 'complete' && !this.completedForCurrentWarship) {
        this.completedForCurrentWarship = true;
        this.completionClock = 2.2;
        this.game.suspend();
        window.dispatchEvent(new CustomEvent('coded:boarding-complete', {
          detail: { planetKey: 'ledger_prime', checkpointKey: 'earth.boarding_lock' },
        }));
      }
    }

    if (this.completedForCurrentWarship) {
      this.completionClock = Math.max(0, this.completionClock - dt);
      if (this.completionClock <= 0) {
        this.active = false;
        this.clear();
      }
    }

    this.schedule();
  }

  /**
   * The portal, and the way in.
   *
   * This used to be a rectangle that widened -- a flat door cut into the hull,
   * which read as a hatch rather than as anything worth flying into. It is a
   * round iris now: leaves that retract to open a real aperture, a rim that
   * lights as it goes, and a shaft of light coming out of it. The shape is the
   * point. You are flying into the ship you just beat.
   */
  private draw(target: BoardingTarget, warship: ReadableActor, state: string): void {
    this.clear();
    const open = this.director.openingProgress;
    const capture = this.director.captureProgress;
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const outer = Math.max(target.w, target.h) * 0.62;
    // The hole itself: closed at rest, wide open when it is time to fly in.
    const hole = outer * (0.08 + 0.72 * open);
    const t = performance.now() / 1000;

    const ctx = this.ctx;
    ctx.save();

    // The shaft of light, drawn first so the portal sits on top of it.
    // Optional-called and guarded, the same way the radar treats
    // createConicGradient: the boarding validator drives this draw against a
    // stub context that has no gradient support, and a portal that throws is
    // worse than one without a glow.
    if (open > 0.12) {
      const glow = ctx.createRadialGradient?.(cx, cy, hole * 0.2, cx, cy, hole * 3.4);
      if (glow) {
        glow.addColorStop(0, `rgba(120,220,255,${0.5 * open})`);
        glow.addColorStop(0.45, `rgba(54,163,255,${0.16 * open})`);
        glow.addColorStop(1, 'rgba(54,163,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, hole * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Interior: black, so the aperture reads as depth rather than as a disc.
    ctx.fillStyle = `rgba(0,0,0,${0.55 + 0.4 * open})`;
    ctx.beginPath();
    ctx.arc(cx, cy, hole, 0, Math.PI * 2);
    ctx.fill();

    // Iris leaves, retracting as it opens.
    const leaves = 8;
    ctx.fillStyle = `rgba(18,26,34,${0.92 - 0.25 * open})`;
    ctx.strokeStyle = `rgba(0,255,136,${0.28 + 0.5 * open})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < leaves; i += 1) {
      const a0 = (i / leaves) * Math.PI * 2 + t * 0.15;
      const a1 = a0 + (Math.PI * 2) / leaves;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, a0, a1);
      ctx.arc(cx, cy, hole, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Rim, brightening as it opens, with a slow counter-rotating tick ring so
    // it reads as machinery rather than a painted circle.
    ctx.strokeStyle = `rgba(0,255,136,${0.4 + 0.6 * open})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10 + open * 18;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(54,163,255,${0.25 + 0.45 * open})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 - t * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * outer * 1.06, cy + Math.sin(a) * outer * 1.06);
      ctx.lineTo(cx + Math.cos(a) * outer * 1.14, cy + Math.sin(a) * outer * 1.14);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '900 15px ui-sans-serif, system-ui';
    ctx.fillStyle = state === 'opening' ? '#ffd24a' : '#00ff88';
    const label = state === 'opening'
      ? 'PORTAL OPENING'
      : state === 'capturing'
        ? 'ENTERING WARSHIP'
        : state === 'complete'
          ? 'HELM TRANSFERRED'
          : 'FLY INTO THE PORTAL';
    ctx.fillText(label, innerWidth / 2, Math.min(innerHeight - 132, cy + outer + 46));

    if (state === 'capturing') {
      const barWidth = Math.min(190, innerWidth * 0.48);
      const x = (innerWidth - barWidth) / 2;
      const y = Math.min(innerHeight - 112, cy + outer + 60);
      ctx.strokeStyle = 'rgba(216,255,232,0.7)';
      ctx.strokeRect(x, y, barWidth, 6);
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(x + 1, y + 1, (barWidth - 2) * capture, 4);
    }
    ctx.restore();
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.overlay.width = Math.max(1, Math.floor(innerWidth * dpr));
    this.overlay.height = Math.max(1, Math.floor(innerHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function centerBox(actor: ReadableActor, scale: number): BoardingTarget {
  return {
    x: actor.x - actor.w * scale / 2,
    y: actor.y - actor.h * scale / 2,
    w: actor.w * scale,
    h: actor.h * scale,
  };
}

function overlap(a: BoardingTarget, b: BoardingTarget): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
