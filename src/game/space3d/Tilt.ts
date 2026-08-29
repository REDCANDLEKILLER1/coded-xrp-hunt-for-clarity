import { debugLog } from '../core/DebugLog';

/**
 * Tilt steering, for the 3D transit level only.
 *
 * Tilt was built for the top-down game once, playtested, and removed on the
 * owner's instruction: it fought his finger for control of a ship that was
 * being flown by drag. `scripts/validate-mobile-landscape.mjs` still fails the
 * build if tilt reappears in `src/game/core/Input.ts`, and that gate stays --
 * the top-down game is finger-only and stays that way.
 *
 * This is a different situation. Here the ship is flown from inside a cockpit,
 * nothing else wants the accelerometer, and both thumbs are needed for the
 * weapon buttons on the console. So the sensor is not competing with the
 * finger; it is what frees it.
 *
 * The maths below is recovered rather than re-derived. The earlier
 * implementation solved two bugs that are not obvious from first principles,
 * and both are preserved here with their reasoning.
 */

export type TiltStatus = 'unavailable' | 'needs_permission' | 'calibrating' | 'ready' | 'denied';

export interface TiltSample {
  /** Front-to-back tilt, degrees. */
  beta: number;
  /** Left-to-right tilt, degrees. */
  gamma: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Everything the reader needs from the outside world.
 *
 * Injected rather than reached for, because a device sensor cannot be driven
 * in a headless browser -- and the case that broke this last time (a phone held
 * in landscape, where the Euler angles go singular) is precisely the one that
 * has to be tested rather than hoped about.
 */
export interface TiltEnvironment {
  /** Registers a listener; returns an unsubscribe. */
  subscribe(handler: (sample: TiltSample) => void): () => void;
  /** iOS 13+ gate. Absent where no permission is required. */
  requestPermission?: () => Promise<boolean>;
  /** Screen rotation in degrees: 0, 90, 180 or 270. */
  screenAngle(): number;
  now(): number;
}

const DEG = Math.PI / 180;

/**
 * Response curve, in degrees of physical tilt.
 *
 * These are wider than the top-down game's (which used 5 and 8.5): that was a
 * cursor being nudged, this is an aircraft being flown, and a ship that hits
 * full rate at five degrees of wrist is unflyable while also aiming. The
 * deadzone exists because no one holds a phone perfectly still.
 */
const TILT_DEADZONE_DEG = 1.6;
const TILT_FULL_SCALE_X = 12;
const TILT_FULL_SCALE_Y = 14;
/** Smoothing on the stick, per frame. Lower is calmer and laggier. */
const TILT_SMOOTHING = 0.24;

/**
 * Calibration must never latch a neutral pose while the phone is still moving.
 *
 * `orientationchange` fires mid-rotation, so sampling the first reading after
 * it captures a pose nobody is holding and leaves the ship permanently drifting
 * toward one edge. Samples are held until the device has been steady.
 */
const SETTLE_MS = 550;
const STABLE_SPREAD_DEG = 2.5;
const CALIBRATION_TIMEOUT_MS = 2600;

/**
 * The gravity direction implied by a device-orientation reading.
 *
 * THIS is the fix for the landscape singularity. A phone held in landscape
 * sits at gamma close to +/-90 degrees, where beta flips through ~180 and a
 * naive angular delta reads 172-177 degrees -- pinning the ship at full
 * deflection while the player holds it still. Gravity as a unit vector is
 * continuous across that pose, so the difference between two orientations
 * stays small when the physical movement is small.
 */
export function gravityFromOrientation(beta: number, gamma: number): Vec3 {
  const b = beta * DEG;
  const g = gamma * DEG;
  return normalize({
    x: -Math.cos(b) * Math.sin(g),
    y: -Math.sin(b),
    z: -Math.cos(b) * Math.cos(g),
  });
}

/**
 * How far the device has rotated away from its neutral pose, split onto the
 * screen's own axes and expressed in degrees.
 *
 * Rotation about the screen normal -- twisting the phone in its own plane --
 * is deliberately discarded, so spinning the handset does not steer.
 */
export function projectToScreen(gravity: Vec3, neutral: Vec3, screenAngle: number): { right: number; down: number } {
  const a = screenAngle * DEG;
  const screenRight: Vec3 = { x: Math.cos(a), y: Math.sin(a), z: 0 };
  const screenDown: Vec3 = { x: Math.sin(a), y: -Math.cos(a), z: 0 };

  const n = normalize(neutral);
  const c = normalize(gravity);
  const axis = cross(n, c);
  const sin = Math.hypot(axis.x, axis.y, axis.z);
  if (sin < 1e-9) return { right: 0, down: 0 };
  const degrees = Math.atan2(sin, clamp(dot(n, c), -1, 1)) / DEG;
  const r: Vec3 = { x: (axis.x / sin) * degrees, y: (axis.y / sin) * degrees, z: (axis.z / sin) * degrees };

  // Rotation about the screen's vertical axis leans the ship left and right;
  // rotation about its horizontal axis leans it forward and back.
  return { right: dot(r, screenDown), down: -dot(r, screenRight) };
}

/** Degrees of tilt to a -1..1 stick, with the deadzone removed rather than clipped. */
export function normalizeTilt(value: number, fullScale: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= TILT_DEADZONE_DEG) return 0;
  const normalized = Math.min(1, (magnitude - TILT_DEADZONE_DEG) / (fullScale - TILT_DEADZONE_DEG));
  return Math.sign(value) * normalized;
}

/** Snaps a reported screen rotation to the four right angles. */
export function normalizeScreenAngle(value: number): number {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

export class TiltSource {
  private statusValue: TiltStatus = 'unavailable';
  private neutral: Vec3 | null = null;
  private latest: Vec3 | null = null;
  private stick = { x: 0, y: 0 };
  private samples: Vec3[] = [];
  private calibrationStart = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly env: TiltEnvironment = browserEnvironment()) {
    if (!this.env.subscribe) {
      this.statusValue = 'unavailable';
      return;
    }
    if (this.env.requestPermission) {
      // iOS: nothing can be bound until a gesture grants it.
      this.statusValue = 'needs_permission';
      return;
    }
    this.bind();
  }

  get status(): TiltStatus {
    return this.statusValue;
  }

  get ready(): boolean {
    return this.statusValue === 'ready';
  }

  /**
   * Asks for sensor access. Must be called from inside a user gesture, which
   * is why the caller owns the timing rather than this class.
   */
  async requestPermission(): Promise<boolean> {
    if (!this.env.requestPermission) return this.statusValue === 'ready';
    try {
      const granted = await this.env.requestPermission();
      if (!granted) {
        this.statusValue = 'denied';
        debugLog.log('input', 'tilt permission denied');
        return false;
      }
      this.bind();
      return true;
    } catch {
      this.statusValue = 'denied';
      return false;
    }
  }

  /** The current stick, -1..1 on each axis. Zero until calibrated. */
  read(): { x: number; y: number } {
    return { x: this.stick.x, y: this.stick.y };
  }

  /**
   * Advances smoothing. Called once per frame with the frame delta so the
   * response is frame-rate independent rather than faster on a fast phone.
   */
  update(dt: number): void {
    if (this.statusValue !== 'ready' || !this.neutral || !this.latest) return;
    const lean = projectToScreen(this.latest, this.neutral, normalizeScreenAngle(this.env.screenAngle()));
    // Dip the screen's right edge -> turn right. Tip the top away from you ->
    // nose down, the same sense as dragging down on the drag fallback.
    //
    // Both signs pass straight through, and that was worth measuring rather
    // than reasoning about: projectToScreen already reports positive `right`
    // for a dipped right edge and positive `down` for a tipped-away top, in
    // all four screen orientations. Deriving the sense from beta/gamma instead
    // gives the opposite answer, because which way those Euler axes point
    // depends on the orientation you happen to be holding.
    const targetX = normalizeTilt(lean.right, TILT_FULL_SCALE_X);
    const targetY = normalizeTilt(lean.down, TILT_FULL_SCALE_Y);
    const ease = Math.min(1, dt * 60 * TILT_SMOOTHING);
    this.stick.x += (targetX - this.stick.x) * ease;
    this.stick.y += (targetY - this.stick.y) * ease;
  }

  /** Drops the neutral pose and starts sampling for a new one. */
  recalibrate(reason: string): void {
    if (this.statusValue === 'unavailable' || this.statusValue === 'denied') return;
    this.neutral = null;
    this.samples = [];
    this.calibrationStart = this.env.now();
    this.stick.x = 0;
    this.stick.y = 0;
    this.statusValue = 'calibrating';
    debugLog.log('input', 'tilt recalibrating', { reason });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private bind(): void {
    if (this.unsubscribe) return;
    this.statusValue = 'calibrating';
    this.calibrationStart = this.env.now();
    this.samples = [];
    this.unsubscribe = this.env.subscribe((sample) => this.onSample(sample));
  }

  private onSample(sample: TiltSample): void {
    if (!Number.isFinite(sample.beta) || !Number.isFinite(sample.gamma)) return;
    const gravity = gravityFromOrientation(sample.beta, sample.gamma);
    this.latest = gravity;
    if (this.neutral) return;

    // Collect until the pose has held still, then latch it.
    this.samples.push(gravity);
    if (this.samples.length > 40) this.samples.shift();
    const elapsed = this.env.now() - this.calibrationStart;

    const window = this.samples.slice(-8);
    if (window.length >= 4) {
      const mean = normalize(meanVec(window));
      const spread = Math.max(...window.map((v) => angleBetweenDeg(v, mean)));
      const heldLongEnough = elapsed >= SETTLE_MS;
      if (spread <= STABLE_SPREAD_DEG && heldLongEnough) {
        this.latchNeutral(mean, 'steady');
        return;
      }
    }
    if (elapsed >= CALIBRATION_TIMEOUT_MS && this.samples.length > 0) {
      // Never leave the player unable to steer because they are on a train.
      this.latchNeutral(normalize(meanVec(this.samples)), 'timeout');
    }
  }

  private latchNeutral(neutral: Vec3, how: string): void {
    this.neutral = neutral;
    this.statusValue = 'ready';
    debugLog.log('input', 'tilt calibrated', { how, samples: this.samples.length });
  }
}

/** The real browser sensor, kept out of the class so tests never touch it. */
export function browserEnvironment(): TiltEnvironment {
  const hasSensor = typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
  const permissioned = hasSensor
    && typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';

  return {
    subscribe: hasSensor
      ? (handler) => {
        const listener = (event: DeviceOrientationEvent): void => {
          if (event.beta === null || event.gamma === null) return;
          handler({ beta: event.beta, gamma: event.gamma });
        };
        window.addEventListener('deviceorientation', listener);
        return () => window.removeEventListener('deviceorientation', listener);
      }
      : (undefined as unknown as TiltEnvironment['subscribe']),
    requestPermission: permissioned
      ? async () => {
        const request = (window.DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<'granted' | 'denied'>;
        }).requestPermission;
        const result = await request.call(window.DeviceOrientationEvent);
        return result === 'granted';
      }
      : undefined,
    screenAngle: () => {
      const fromApi = screen.orientation?.angle;
      if (typeof fromApi === 'number') return fromApi;
      const legacy = (window as Window & { orientation?: number }).orientation;
      return typeof legacy === 'number' ? legacy : 0;
    },
    now: () => performance.now(),
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
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

function angleBetweenDeg(a: Vec3, b: Vec3): number {
  return Math.acos(clamp(dot(a, b), -1, 1)) / DEG;
}

function meanVec(values: Vec3[]): Vec3 {
  const sum = values.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / values.length, y: sum.y / values.length, z: sum.z / values.length };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
