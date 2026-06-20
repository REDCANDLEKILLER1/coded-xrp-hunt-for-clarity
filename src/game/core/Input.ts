import type { Vec2 } from './Types';

export class Input {
  private keys = new Set<string>();
  pointer: Vec2 | null = null;
  fireSpecial = false;
  pausePressed = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.key.toLowerCase());
      if (event.code === 'Space') this.fireSpecial = true;
      if (event.key.toLowerCase() === 'p') this.pausePressed = true;
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    canvas.addEventListener('pointerdown', this.onPointer);
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerup', () => (this.pointer = null));
    canvas.addEventListener('pointercancel', () => (this.pointer = null));
  }

  private onPointer = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  };

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

  axis(): Vec2 {
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const up = this.keys.has('arrowup') || this.keys.has('w');
    const down = this.keys.has('arrowdown') || this.keys.has('s');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
  }
}
