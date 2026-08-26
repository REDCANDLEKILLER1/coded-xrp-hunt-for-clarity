import type { Vec2 } from './Types';
import { debugLog } from './DebugLog';

type TiltPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export type TiltStatus = 'unavailable' | 'needs_permission' | 'calibrating' | 'ready' | 'denied';

const TILT_DEADZONE = 2.2;
const TILT_FULL_SCALE = 13;

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
  private neutralBeta = 0;
  private neutralGamma = 0;
  private settleSamples: { t: number; beta: number; gamma: number }[] = [];
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
      this.collectCalibrationSample(event.beta, event.gamma);
      if (this.calibrationPending) return;
    }

    const beta = event.beta - this.neutralBeta;
    const gamma = event.gamma - this.neutralGamma;
    const angle = normalizeOrientationAngle(screen.orientation?.angle ?? legacyOrientation());
    let rawX = gamma;
    let rawY = beta;

    if (angle === 90) {
      rawX = beta;
      rawY = -gamma;
    } else if (angle === 270) {
      rawX = -beta;
      rawY = gamma;
    } else if (angle === 180) {
      rawX = -gamma;
      rawY = -beta;
    }

    const targetX = normalizeTilt(rawX);
    const targetY = normalizeTilt(rawY);
    this.tilt.x += (targetX - this.tilt.x) * 0.24;
    this.tilt.y += (targetY - this.tilt.y) * 0.24;

    debugLog.sample('tilt', 1000, 'tilt', 'reading', {
      angle,
      dBeta: round2(beta),
      dGamma: round2(gamma),
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
  private collectCalibrationSample(beta: number, gamma: number): void {
    const now = performance.now();
    this.settleSamples.push({ t: now, beta, gamma });
    // Keep only the trailing settle window.
    const cutoff = now - SETTLE_MS;
    while (this.settleSamples.length > 0 && this.settleSamples[0].t < cutoff) this.settleSamples.shift();

    const spanned = this.settleSamples.length > 1
      && (now - this.settleSamples[0].t) >= SETTLE_MS * 0.9;
    const timedOut = (now - this.calibrationStartedAt) >= CALIBRATION_TIMEOUT_MS;

    if (spanned) {
      const betas = this.settleSamples.map((s) => s.beta);
      const gammas = this.settleSamples.map((s) => s.gamma);
      const spread = Math.max(spreadOf(betas), spreadOf(gammas));
      if (spread <= STABLE_SPREAD_DEG) {
        this.applyNeutral(mean(betas), mean(gammas), 'settled', { spread: round2(spread), samples: betas.length });
        return;
      }
    }

    if (timedOut && this.settleSamples.length > 0) {
      // Never became still (walking, in a car). Median is the best guess and is
      // far more robust than a single reading.
      const betas = this.settleSamples.map((s) => s.beta);
      const gammas = this.settleSamples.map((s) => s.gamma);
      this.applyNeutral(median(betas), median(gammas), 'timeout-median', { samples: betas.length });
    }
  }

  private applyNeutral(beta: number, gamma: number, how: string, extra: Record<string, unknown>): void {
    this.neutralBeta = beta;
    this.neutralGamma = gamma;
    this.calibrationPending = false;
    this.settleSamples = [];
    this.tilt = { x: 0, y: 0 };
    this.tiltStatusValue = 'ready';
    debugLog.log('tilt', 'calibrated', { how, beta: round2(beta), gamma: round2(gamma), ...extra });
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

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function spreadOf(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTilt(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= TILT_DEADZONE) return 0;
  const normalized = Math.min(1, (magnitude - TILT_DEADZONE) / (TILT_FULL_SCALE - TILT_DEADZONE));
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
