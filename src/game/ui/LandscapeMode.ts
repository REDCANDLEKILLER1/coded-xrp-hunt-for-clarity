type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * Mobile gameplay is landscape-first. Browsers do not universally permit an
 * orientation lock until a user gesture/fullscreen transition, so portrait is
 * blocked immediately by a rotate gate and the first gesture attempts the lock.
 */
export class LandscapeMode {
  private readonly gate: HTMLDivElement;
  private lockAttempted = false;

  constructor() {
    this.gate = document.createElement('div');
    this.gate.className = 'landscape-gate';
    this.gate.setAttribute('role', 'dialog');
    this.gate.setAttribute('aria-live', 'polite');
    this.gate.innerHTML = `
      <div class="landscape-gate__card">
        <div class="landscape-gate__phone" aria-hidden="true">↻</div>
        <div class="landscape-gate__eyebrow">CODED // MOBILE FLIGHT MODE</div>
        <strong>TURN PHONE SIDEWAYS</strong>
        <span>Landscape gives you the full battlefield and enables calibrated tilt steering.</span>
        <button type="button">ENABLE LANDSCAPE</button>
      </div>
    `;
    document.body.appendChild(this.gate);

    this.gate.querySelector('button')?.addEventListener('click', () => void this.activateFromGesture());
    window.addEventListener('resize', this.refresh);
    window.addEventListener('orientationchange', this.refresh);
    screen.orientation?.addEventListener?.('change', this.refresh);
    document.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });
    this.refresh();
  }

  private readonly onFirstGesture = (): void => {
    if (!isMobileLike() || this.lockAttempted) return;
    void this.activateFromGesture();
  };

  private readonly refresh = (): void => {
    const requiresLandscape = isMobileLike() && innerHeight > innerWidth;
    this.gate.classList.toggle('is-visible', requiresLandscape);
    document.documentElement.classList.toggle('mobile-landscape-active', isMobileLike() && innerWidth >= innerHeight);
  };

  private async activateFromGesture(): Promise<void> {
    if (!isMobileLike()) return;
    this.lockAttempted = true;

    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement as FullscreenElement;
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
        else await root.webkitRequestFullscreen?.();
      }
    } catch {
      // Fullscreen is optional. The portrait gate remains the fallback.
    }

    try {
      const orientation = screen.orientation as LockableScreenOrientation;
      if (orientation.lock) await orientation.lock('landscape');
    } catch {
      // Some browsers deny orientation lock outside installed/PWA modes.
    }

    this.refresh();
  }
}

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 1024;
}
