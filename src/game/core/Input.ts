import type { Vec2 } from './Types';

/**
 * How close together, in time and in canvas pixels, two taps have to land to
 * count as one double-tap. 280ms is comfortably above a deliberate double and
 * below the gap between two aimed single taps; 48px is about a thumb, so the
 * gesture survives the drift you get holding a phone one-handed.
 */
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SLOP = 48;

/**
 * Pointer and keyboard input.
 *
 * Tilt steering was removed after playtesting: it was harder to aim than a
 * finger and fought the player for control (a capture showed 54 tilt-driven
 * frames against 33 touch-driven ones in the same run). Touch drag on a phone
 * and mouse drag on a desktop are the control scheme; arrow keys and WASD stay
 * for keyboard play.
 */
export class Input {
  private keys = new Set<string>();
  pointer: Vec2 | null = null;
  /**
   * Where the current gesture started.
   *
   * Steering used to ask "is the finger over a button right now?", which made
   * every button a wall: dragging the fighter across one stopped it dead, and
   * on a phone you cannot lift your thumb over an obstacle. What a gesture is
   * for is decided once, at pointer-down, from this point — a drag that begins
   * on open canvas keeps steering all the way across the button cluster.
   */
  pointerOrigin: Vec2 | null = null;
  private tap: Vec2 | null = null;
  private doubleTap: Vec2 | null = null;
  private lastTapAt = 0;
  private lastTapPoint: Vec2 | null = null;
  private fireSpecial = false;
  private pausePressed = false;
  private diagnosticsPressed = false;
  private bombPressed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  consumeTap(): Vec2 | null {
    const value = this.tap;
    this.tap = null;
    return value;
  }

  /**
   * A double-tap anywhere, reported once.
   *
   * Reaching for the bomb button means lifting the steering thumb off the
   * canvas, which on a phone costs you the fighter for as long as it takes.
   * A double-tap keeps the thumb where it already is.
   */
  consumeDoubleTap(): Vec2 | null {
    const value = this.doubleTap;
    this.doubleTap = null;
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

  /** Keyboard steering only; pointer movement is handled directly by the game. */
  axis(): Vec2 {
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const up = this.keys.has('arrowup') || this.keys.has('w');
    const down = this.keys.has('arrowdown') || this.keys.has('s');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
  }

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
    const point = this.toCanvasPoint(event);
    this.pointer = point;
    this.pointerOrigin = point;
    this.tap = point;

    const now = performance.now();
    const previous = this.lastTapPoint;
    const paired = previous !== null
      && now - this.lastTapAt <= DOUBLE_TAP_MS
      && Math.hypot(point.x - previous.x, point.y - previous.y) <= DOUBLE_TAP_SLOP;
    if (paired) {
      this.doubleTap = point;
      // Consume both taps, so a triple tap is one double and one single rather
      // than two overlapping doubles.
      this.lastTapPoint = null;
      this.lastTapAt = 0;
    } else {
      this.lastTapPoint = point;
      this.lastTapAt = now;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    event.preventDefault();
    if (!this.pointer) return;
    this.pointer = this.toCanvasPoint(event);
  };

  private readonly onPointerUp = (): void => {
    this.pointer = null;
    this.pointerOrigin = null;
  };

  private toCanvasPoint(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
