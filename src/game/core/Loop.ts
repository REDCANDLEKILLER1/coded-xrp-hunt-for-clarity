export class Loop {
  private frameId = 0;
  private previousTime = 0;
  private running = false;

  constructor(private readonly tick: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly frame = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.previousTime) / 1000, 0.033);
    this.previousTime = time;
    this.tick(dt);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
