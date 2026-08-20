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
    });
    const ctx = this.overlay.getContext('2d');
    if (!ctx) throw new Error('Direct boarding overlay context unavailable.');
    this.ctx = ctx;
    this.shell.appendChild(this.overlay);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((time) => this.frame(time));
  }

  private frame(time: number): void {
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
      requestAnimationFrame((next) => this.frame(next));
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

    requestAnimationFrame((next) => this.frame(next));
  }

  private draw(target: BoardingTarget, warship: ReadableActor, state: string): void {
    this.clear();
    const open = this.director.openingProgress;
    const capture = this.director.captureProgress;
    const apertureWidth = target.w * Math.max(0.08, open);
    const apertureX = target.x + (target.w - apertureWidth) / 2;
    const upperHullY = warship.y + 22;

    this.ctx.save();
    this.ctx.fillStyle = `rgba(0,0,0,${0.72 * open})`;
    this.ctx.strokeStyle = `rgba(0,255,136,${0.35 + open * 0.65})`;
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00ff88';
    this.ctx.shadowBlur = 12 + open * 14;
    this.ctx.fillRect(apertureX, target.y, apertureWidth, target.h);
    this.ctx.strokeRect(apertureX, target.y, apertureWidth, target.h);

    if (open > 0.15) {
      this.ctx.globalAlpha = 0.18 + open * 0.34;
      this.ctx.fillStyle = '#36a3ff';
      this.ctx.beginPath();
      this.ctx.moveTo(apertureX, target.y + target.h);
      this.ctx.lineTo(apertureX + apertureWidth, target.y + target.h);
      this.ctx.lineTo(warship.x + 22, upperHullY);
      this.ctx.lineTo(warship.x - 22, upperHullY);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
    this.ctx.textAlign = 'center';
    this.ctx.font = '900 15px ui-sans-serif, system-ui';
    this.ctx.fillStyle = state === 'opening' ? '#ffd24a' : '#00ff88';
    const label = state === 'opening'
      ? 'HANGAR BREACH OPENING'
      : state === 'capturing'
        ? 'ENTERING WARSHIP'
        : state === 'complete'
          ? 'BOARDING COMPLETE // INTERIOR HANDOFF READY'
          : 'FLY INTO THE HANGAR';
    this.ctx.fillText(label, innerWidth / 2, Math.min(innerHeight - 132, target.y + target.h + 56));

    if (state === 'capturing') {
      const barWidth = Math.min(190, innerWidth * 0.48);
      const x = (innerWidth - barWidth) / 2;
      const y = Math.min(innerHeight - 112, target.y + target.h + 70);
      this.ctx.strokeStyle = 'rgba(216,255,232,0.7)';
      this.ctx.strokeRect(x, y, barWidth, 6);
      this.ctx.fillStyle = '#00ff88';
      this.ctx.fillRect(x + 1, y + 1, (barWidth - 2) * capture, 4);
    }
    this.ctx.restore();
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
