export interface ManagedScene {
  setActive(active: boolean): void;
  update(dt: number): void;
  render(): void;
  dispose(): void;
}

/** Serial ownership of simulation/input; a failed load resumes the previous scene. */
export class SceneController {
  private current: ManagedScene | null = null;
  private pending: AbortController | null = null;
  private generation = 0;
  lastError: string | null = null;

  get loading(): boolean { return this.pending !== null; }

  async change(prepare: (signal: AbortSignal) => Promise<ManagedScene>): Promise<boolean> {
    const generation = ++this.generation;
    this.pending?.abort();
    const pending = new AbortController();
    this.pending = pending;
    const previous = this.current;
    previous?.setActive(false);
    this.lastError = null;
    let next: ManagedScene | null = null;
    try {
      next = await prepare(pending.signal);
      if (generation !== this.generation || pending.signal.aborted) { next.dispose(); return false; }
      next.setActive(true);
      this.current = next;
      previous?.dispose();
      return true;
    } catch (error) {
      next?.dispose();
      if (generation === this.generation) {
        this.lastError = error instanceof Error ? error.message : 'Scene could not be loaded';
        previous?.setActive(true);
      }
      return false;
    } finally {
      if (generation === this.generation) this.pending = null;
    }
  }

  frame(dt: number): void {
    if (!this.pending) this.current?.update(Math.min(.05, Math.max(0, dt)));
    this.current?.render();
  }

  clear(): void {
    ++this.generation;
    this.pending?.abort();
    this.pending = null;
    this.current?.setActive(false);
    this.current?.dispose();
    this.current = null;
  }
}
