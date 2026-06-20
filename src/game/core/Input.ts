import type { Vec2 } from './Types';

export class Input {
  private keys = new Set<string>();
  pointer: Vec2 | null = null;
  private tap: Vec2 | null = null;
  private fireSpecial = false;
  private pausePressed = false;
  private diagnosticsPressed = false;

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
    if (event.key.toLowerCase() === 'enter') this.tap = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
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
