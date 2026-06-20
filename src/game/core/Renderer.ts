export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(root: HTMLElement) {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    root.appendChild(this.canvas);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get width(): number { return window.innerWidth; }
  get height(): number { return window.innerHeight; }

  clear(): void {
    this.ctx.fillStyle = '#02060b';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}
