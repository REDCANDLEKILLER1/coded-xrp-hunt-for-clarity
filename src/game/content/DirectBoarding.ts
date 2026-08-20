export type BoardingState = 'sealed' | 'opening' | 'ready' | 'capturing' | 'complete';

export interface BoardingConfig {
  openingSeconds: number;
  captureHoldSeconds: number;
  entryWidth: number;
  entryHeight: number;
  entryYOffset: number;
}

export interface BoardingTarget {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const EARTH_WARSHIP_BOARDING: BoardingConfig = {
  openingSeconds: 2.4,
  captureHoldSeconds: 0.65,
  entryWidth: 48,
  entryHeight: 42,
  entryYOffset: 28,
};

/**
 * Small deterministic state machine for the Level 1 direct-fighter boarding beat.
 * It owns timing only. Game2A continues to own movement/render/collision.
 */
export class DirectBoardingDirector {
  private elapsed = 0;
  private captureElapsed = 0;
  private current: BoardingState = 'sealed';

  start(): void {
    this.elapsed = 0;
    this.captureElapsed = 0;
    this.current = 'opening';
  }

  reset(): void {
    this.elapsed = 0;
    this.captureElapsed = 0;
    this.current = 'sealed';
  }

  update(dt: number, fighterInsideEntry: boolean): BoardingState {
    const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (this.current === 'opening') {
      this.elapsed += safeDt;
      if (this.elapsed >= EARTH_WARSHIP_BOARDING.openingSeconds) this.current = 'ready';
    }

    if (this.current === 'ready') {
      if (!fighterInsideEntry) {
        this.captureElapsed = 0;
        return this.current;
      }
      this.current = 'capturing';
      this.captureElapsed = 0;
    }

    if (this.current === 'capturing') {
      if (!fighterInsideEntry) {
        this.current = 'ready';
        this.captureElapsed = 0;
        return this.current;
      }
      this.captureElapsed += safeDt;
      if (this.captureElapsed >= EARTH_WARSHIP_BOARDING.captureHoldSeconds) this.current = 'complete';
    }

    return this.current;
  }

  get state(): BoardingState { return this.current; }
  get apertureOpen(): boolean { return this.current === 'ready' || this.current === 'capturing' || this.current === 'complete'; }
  get openingProgress(): number {
    if (this.current === 'sealed') return 0;
    if (this.current !== 'opening') return 1;
    return Math.max(0, Math.min(1, this.elapsed / EARTH_WARSHIP_BOARDING.openingSeconds));
  }
  get captureProgress(): number {
    if (this.current === 'complete') return 1;
    if (this.current !== 'capturing') return 0;
    return Math.max(0, Math.min(1, this.captureElapsed / EARTH_WARSHIP_BOARDING.captureHoldSeconds));
  }
}

export function boardingTargetForWarship(warshipX: number, warshipY: number): BoardingTarget {
  return {
    x: warshipX - EARTH_WARSHIP_BOARDING.entryWidth / 2,
    y: warshipY + EARTH_WARSHIP_BOARDING.entryYOffset - EARTH_WARSHIP_BOARDING.entryHeight / 2,
    w: EARTH_WARSHIP_BOARDING.entryWidth,
    h: EARTH_WARSHIP_BOARDING.entryHeight,
  };
}

export function validateDirectBoarding(): string[] {
  const errors: string[] = [];
  if (EARTH_WARSHIP_BOARDING.openingSeconds < 1.5) errors.push('boarding: hangar opening is too abrupt');
  if (EARTH_WARSHIP_BOARDING.captureHoldSeconds < 0.4) errors.push('boarding: capture hold is too short to prove the fighter entered');
  if (EARTH_WARSHIP_BOARDING.entryWidth <= 0 || EARTH_WARSHIP_BOARDING.entryHeight <= 0) errors.push('boarding: entry target must be positive');

  const director = new DirectBoardingDirector();
  director.start();
  director.update(EARTH_WARSHIP_BOARDING.openingSeconds + 0.01, false);
  if (director.state !== 'ready' || !director.apertureOpen) errors.push('boarding: aperture did not become ready after opening');
  director.update(0.1, true);
  if (director.state !== 'capturing') errors.push('boarding: fighter entry did not begin capture');
  director.update(EARTH_WARSHIP_BOARDING.captureHoldSeconds + 0.01, true);
  if (director.state !== 'complete') errors.push('boarding: held fighter entry did not complete');
  return errors;
}
