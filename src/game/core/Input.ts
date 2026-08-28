import type { Vec2 } from './Types';
import { debugLog } from './DebugLog';

type TiltPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export type TiltStatus = 'unavailable' | 'needs_permission' | 'calibrating' | 'ready' | 'denied';

// Reaching full deflection took 15 degrees of tilt, which playtesting found
// far too much — the ship felt sluggish next to touch control.
//
// The two axes get different scales on purpose. Held in landscape the phone is
// already rolled steeply, and in that pose a left/right lean is largely a twist
// of the screen in its own plane; twist correctly does not steer, so the same
// physical effort yields roughly 40% of the lean that a forward/back tilt does.
// A smaller left/right scale makes the two directions feel matched.
const TILT_DEADZONE = 1.4;
const TILT_FULL_SCALE_X = 5;
const TILT_FULL_SCALE_Y = 8.5;

// Calibration must never latch a neutral pose while the phone is still moving.
// `orientationchange` fires mid-rotation, so sampling the first reading after it
// captured a bogus neutral and left the ship permanently drifting toward one
// edge. Instead, hold samples until the device has been still for a while.
const SETTLE_MS = 550;        // how long the pose must stay steady
const STABLE_SPREAD_DEG = 2.5; // max beta/gamma spread that still counts as still
const CALIBRATION_TIMEOUT_MS = 2600; // fall back to the median if never steady

export class Input {
  private keys = new Set<string>();
  pointer: Vec2 | null = null;
  private tap: Vec2 | null = null;
  private fireSpecial = false;
  private pausePressed = false;
  private diagnosticsPressed = false;
  private bombPressed = false;
  private tilt: Vec2 = { x: 0, y: 0 };
  private tiltStatusValue: TiltStatus = 'unavailable';
  private tiltListenerBound = false;
  private calibrationPending = true;
  private neutralGravity: Vec3 = { x: 0, y: 0, z: -1 };
  private settleSamples: { t: number; g: Vec3 }[] = [];
  private calibrationStartedAt = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('orientationchange', this.resetTiltCalibration);
    screen.orientation?.addEventListener?.('change', this.resetTiltCalibration);

    // Tilt turns itself on. Where the platform needs an explicit grant (iOS),
    // take it from the first gesture anywhere on the page rather than making
    // the player hunt for a button.
    document.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });
    document.addEventListener('touchend', this.onFirstGesture, { capture: true, passive: true });

    this.prepareTilt();
  }

  consumeTap(): Vec2 | null {
    const value = this.tap;
    this.tap = null;
    return value;
  }

  consumeSpecial(): boolean {
    const value = this.fireSpecial;
    this.fireSpecial = false;
    return value;
  }

  consumePause(): boolean {
    const value = this.pausePressed;
    this.pausePressed = false;
    return value;
  }

  consumeDiagnostics(): boolean {
    const value = this.diagnosticsPressed;
    this.diagnosticsPressed = false;
    return value;
  }

  consumeBomb(): boolean {
    const value = this.bombPressed;
    this.bombPressed = false;
    return value;
  }

  get tiltStatus(): TiltStatus {
    return this.tiltStatusValue;
  }

  get tiltReady(): boolean {
    return this.tiltStatusValue === 'ready';
  }

  axis(): Vec2 {
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const up = this.keys.has('arrowup') || this.keys.has('w');
    const down = this.keys.has('arrowdown') || this.keys.has('s');
    const keyboard = { x: Number(right) - Number(left), y: Number(down) - Number(up) };
    if (keyboard.x !== 0 || keyboard.y !== 0) return keyboard;
    if (this.tiltReady && matchMedia('(pointer: coarse)').matches && innerWidth > innerHeight) return this.tilt;
    return keyboard;
  }

  calibrateTilt(reason = 'manual'): void {
    this.calibrationPending = true;
    this.settleSamples = [];
    this.calibrationStartedAt = performance.now();
    this.tilt = { x: 0, y: 0 };
    if (this.tiltStatusValue === 'ready') this.tiltStatusValue = 'calibrating';
    debugLog.log('tilt', 'calibration started', { reason });
  }

  private readonly onFirstGesture = (): void => {
    if (this.tiltStatusValue === 'needs_permission') this.requestTiltPermission();
  };

  private prepareTilt(): void {
    if (typeof DeviceOrientationEvent === 'undefined') {
      this.tiltStatusValue = 'unavailable';
      return;
    }
    const eventType = DeviceOrientationEvent as TiltPermissionEvent;
    if (typeof eventType.requestPermission === 'function') {
      // iOS: cannot bind until a user gesture grants it; onFirstGesture will.
      this.tiltStatusValue = 'needs_permission';
      debugLog.log('tilt', 'awaiting permission grant (iOS-style)');
      return;
    }
    this.tiltStatusValue = 'calibrating';
    this.calibrationStartedAt = performance.now();
    debugLog.log('tilt', 'auto-enabled, no permission required');
    this.bindTiltListener();
  }

  private requestTiltPermission(): void {
    if (this.tiltStatusValue !== 'needs_permission') return;
    const eventType = DeviceOrientationEvent as TiltPermissionEvent;
    const request = eventType.requestPermission;
    if (!request) return;
    debugLog.log('tilt', 'requesting permission');
    void request.call(DeviceOrientationEvent).then((result) => {
      if (result !== 'granted') {
        this.tiltStatusValue = 'denied';
        debugLog.log('tilt', 'permission denied by user');
        return;
      }
      this.tiltStatusValue = 'calibrating';
      this.calibrationStartedAt = performance.now();
      debugLog.log('tilt', 'permission granted');
      this.bindTiltListener();
    }).catch((error) => {
      this.tiltStatusValue = 'denied';
      debugLog.log('tilt', 'permission request failed', { error: String(error) });
    });
  }

  private bindTiltListener(): void {
    if (this.tiltListenerBound) return;
    this.tiltListenerBound = true;
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
  }

  private readonly onDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (event.beta == null || event.gamma == null) return;
    if (this.calibrationPending) {
      this.collectCalibrationSample(gravityFromOrientation(event.beta, event.gamma));
      if (this.calibrationPending) return;
    }

    // Steering is derived from the gravity direction, not from raw beta/gamma.
    // Euler angles are degenerate near gamma = +/-90deg, which is exactly how a
    // phone is held in landscape: beta flips by ~180deg there, so naive
    // subtraction produced deltas of 172-177deg and pinned the ship at full
    // deflection until the phone was turned back. The gravity vector stays
    // continuous through that singularity.
    const gravity = gravityFromOrientation(event.beta, event.gamma);
    const angle = normalizeOrientationAngle(screen.orientation?.angle ?? legacyOrientation());
    const { right, down } = projectToScreen(gravity, this.neutralGravity, angle);

    const targetX = normalizeTilt(right, TILT_FULL_SCALE_X);
    const targetY = normalizeTilt(down, TILT_FULL_SCALE_Y);
    this.tilt.x += (targetX - this.tilt.x) * 0.24;
    this.tilt.y += (targetY - this.tilt.y) * 0.24;

    debugLog.sample('tilt', 1000, 'tilt', 'reading', {
      angle,
      rightDeg: round2(right),
      downDeg: round2(down),
      x: round2(this.tilt.x),
      y: round2(this.tilt.y),
    });
  };

  /**
   * Hold readings until the phone has actually been still, then average them.
   *
   * Latching the first sample is what produced the permanent drift: the reset
   * is triggered by `orientationchange`, which fires while the device is still
   * being turned, so "neutral" was recorded at a angle the player never holds.
   */
  private collectCalibrationSample(g: Vec3): void {
    const now = performance.now();
    this.settleSamples.push({ t: now, g });
    const cutoff = now - SETTLE_MS;
    while (this.settleSamples.length > 0 && this.settleSamples[0].t < cutoff) this.settleSamples.shift();

    const spanned = this.settleSamples.length > 1
      && (now - this.settleSamples[0].t) >= SETTLE_MS * 0.9;
    const timedOut = (now - this.calibrationStartedAt) >= CALIBRATION_TIMEOUT_MS;

    if (spanned) {
      // Stability is measured as angular spread of the gravity direction, which
      // behaves sensibly in every orientation unlike per-axis Euler spread.
      const mean = normalize(meanVec(this.settleSamples.map((s) => s.g)));
      const spreadDeg = Math.max(...this.settleSamples.map((s) => angleBetweenDeg(s.g, mean)));
      if (spreadDeg <= STABLE_SPREAD_DEG) {
        this.applyNeutral(mean, 'settled', { spread: round2(spreadDeg), samples: this.settleSamples.length });
        return;
      }
    }

    if (timedOut && this.settleSamples.length > 0) {
      // Never became still (walking, in a car): the mean direction is still a
      // far better guess than any single reading.
      this.applyNeutral(normalize(meanVec(this.settleSamples.map((s) => s.g))), 'timeout-mean', {
        samples: this.settleSamples.length,
      });
    }
  }

  private applyNeutral(g: Vec3, how: string, extra: Record<string, unknown>): void {
    this.neutralGravity = g;
    this.calibrationPending = false;
    this.settleSamples = [];
    this.tilt = { x: 0, y: 0 };
    this.tiltStatusValue = 'ready';
    debugLog.log('tilt', 'calibrated', {
      how, gx: round2(g.x), gy: round2(g.y), gz: round2(g.z), ...extra,
    });
  }

  private readonly resetTiltCalibration = (): void => {
    debugLog.log('orientation', 'orientation changed', {
      angle: screen.orientation?.angle ?? legacyOrientation(),
      viewport: `${innerWidth}x${innerHeight}`,
    });
    this.calibrateTilt('orientationchange');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.key.toLowerCase());
    if (event.code === 'Space') this.fireSpecial = true;
    if (event.key.toLowerCase() === 'p') this.pausePressed = true;
    if (event.key.toLowerCase() === 'd') this.diagnosticsPressed = true;
    if (event.key.toLowerCase() === 'b') this.bombPressed = true;
    if (event.key.toLowerCase() === 'enter') this.tap = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (matchMedia('(pointer: coarse)').matches) this.requestTiltPermission();
    const point = this.toCanvasPoint(event);
    this.pointer = point;
    this.tap = point;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    event.preventDefault();
    if (!this.pointer) return;
    this.pointer = this.toCanvasPoint(event);
  };

  private readonly onPointerUp = (): void => {
    this.pointer = null;
  };

  private toCanvasPoint(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}

type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

/**
 * Unit vector pointing along gravity, in device coordinates.
 *
 * Derived from the deviceorientation Z-X'-Y'' angles. Unlike the angles
 * themselves this is continuous everywhere, including the gamma = +/-90deg
 * attitude a phone sits at while being held in landscape.
 */
function gravityFromOrientation(beta: number, gamma: number): Vec3 {
  const b = beta * DEG;
  const g = gamma * DEG;
  return normalize({
    x: -Math.cos(b) * Math.sin(g),
    y: -Math.sin(b),
    z: -Math.cos(b) * Math.cos(g),
  });
}

/**
 * Lean away from the calibrated pose, in real degrees, along the screen's axes.
 *
 * Takes the rotation that carries the calibrated gravity direction to the
 * current one and splits it across the screen axes. Projecting the raw vector
 * difference instead loses most of the motion once the phone is already rolled
 * — a 12 degree roll registered as 3.7 — because a component difference is not
 * an angle. Rotation about the screen normal is discarded: twisting the phone
 * in its own plane should not steer.
 */
function projectToScreen(g: Vec3, neutral: Vec3, angle: number): { right: number; down: number } {
  const a = angle * DEG;
  const screenRight: Vec3 = { x: Math.cos(a), y: Math.sin(a), z: 0 };
  const screenDown: Vec3 = { x: Math.sin(a), y: -Math.cos(a), z: 0 };

  const n = normalize(neutral);
  const c = normalize(g);
  const axis = cross(n, c);
  const sin = Math.hypot(axis.x, axis.y, axis.z);
  if (sin < 1e-9) return { right: 0, down: 0 };
  const degrees = Math.atan2(sin, Math.max(-1, Math.min(1, dot(n, c)))) / DEG;
  const r: Vec3 = { x: axis.x / sin * degrees, y: axis.y / sin * degrees, z: axis.z / sin * degrees };

  // Rotation about the screen's vertical axis leans the ship left/right;
  // rotation about its horizontal axis leans it forward/back.
  return { right: dot(r, screenDown), down: -dot(r, screenRight) };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function meanVec(values: Vec3[]): Vec3 {
  const sum = values.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / values.length, y: sum.y / values.length, z: sum.z / values.length };
}

function angleBetweenDeg(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTilt(value: number, fullScale: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= TILT_DEADZONE) return 0;
  const normalized = Math.min(1, (magnitude - TILT_DEADZONE) / (fullScale - TILT_DEADZONE));
  return Math.sign(value) * normalized;
}

function normalizeOrientationAngle(value: number): number {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

function legacyOrientation(): number {
  const value = (window as Window & { orientation?: number }).orientation;
  return typeof value === 'number' ? value : 0;
}
