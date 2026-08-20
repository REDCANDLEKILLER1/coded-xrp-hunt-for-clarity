import type { Vec2 } from './Types';

type TiltPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export type TiltStatus = 'unavailable' | 'needs_permission' | 'calibrating' | 'ready' | 'denied';

const TILT_DEADZONE = 2.2;
const TILT_FULL_SCALE = 13;

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

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('orientationchange', this.resetTiltCalibration);
    screen.orientation?.addEventListener?.('change', this.resetTiltCalibration);
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

  calibrateTilt(): void {
    this.calibrationPending = true;
    this.tilt = { x: 0, y: 0 };
    if (this.tiltStatusValue === 'ready') this.tiltStatusValue = 'calibrating';
  }

  private prepareTilt(): void {
    if (typeof DeviceOrientationEvent === 'undefined') {
      this.tiltStatusValue = 'unavailable';
      return;
    }
    const eventType = DeviceOrientationEvent as TiltPermissionEvent;
    if (typeof eventType.requestPermission === 'function') {
      this.tiltStatusValue = 'needs_permission';
      return;
    }
    this.tiltStatusValue = 'calibrating';
    this.bindTiltListener();
  }

  private requestTiltPermission(): void {
    if (this.tiltStatusValue !== 'needs_permission') return;
    const eventType = DeviceOrientationEvent as TiltPermissionEvent;
    const request = eventType.requestPermission;
    if (!request) return;
    void request.call(DeviceOrientationEvent).then((result) => {
      if (result !== 'granted') {
        this.tiltStatusValue = 'denied';
        return;
      }
      this.tiltStatusValue = 'calibrating';
      this.bindTiltListener();
    }).catch(() => {
      this.tiltStatusValue = 'denied';
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
      this.neutralBeta = event.beta;
      this.neutralGamma = event.gamma;
      this.calibrationPending = false;
      this.tilt = { x: 0, y: 0 };
      this.tiltStatusValue = 'ready';
      return;
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
  };

  private readonly resetTiltCalibration = (): void => {
    this.calibrateTilt();
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
