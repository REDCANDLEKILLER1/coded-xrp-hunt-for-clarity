type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * Mobile gameplay is landscape-first. Browsers do not universally permit an
 * orientation lock until a user gesture/fullscreen transition, so portrait shows
 * a rotate prompt and the first gesture anywhere attempts the lock. There is no
 * "enable" button to press — turning the phone is the whole interaction.
 *
 * The lock is not guaranteed to be available at all: iOS Safari exposes neither
 * element fullscreen nor screen.orientation.lock, and any device with rotation
 * lock enabled stays portrait regardless. The gate must therefore never be the
 * only way forward — when the lock cannot be performed the player is offered a
 * manual-rotate hint plus an explicit escape into portrait play.
 */
export class LandscapeMode {
  private readonly gate: HTMLDivElement;
  private readonly fallback: HTMLDivElement;
  private lockAttempted = false;
  private dismissed = false;

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
        <span>Landscape gives you the full battlefield. Tilt steering turns itself on.</span>
        <div class="landscape-gate__fallback" hidden>
          <span class="landscape-gate__hint">This browser will not rotate the screen for us. Turn the phone sideways yourself — or keep playing in portrait.</span>
          <button type="button" class="landscape-gate__skip">CONTINUE ANYWAY</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.gate);

    this.fallback = this.gate.querySelector<HTMLDivElement>('.landscape-gate__fallback')!;
    // No "enable" button: the lock is attempted automatically from the first
    // gesture anywhere on the page. Players just turn the phone.
    this.gate.querySelector<HTMLButtonElement>('.landscape-gate__skip')
      ?.addEventListener('click', () => this.dismiss());

    window.addEventListener('resize', this.refresh);
    window.addEventListener('orientationchange', this.refresh);
    screen.orientation?.addEventListener?.('change', this.refresh);
    document.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });

    // If the platform cannot lock orientation at all, say so up front rather
    // than making the player discover it by tapping a button that does nothing.
    if (!canLockOrientation()) this.revealFallback();
    this.refresh();
  }

  private readonly onFirstGesture = (): void => {
    if (!isMobileLike() || this.lockAttempted) return;
    void this.activateFromGesture();
  };

  private readonly refresh = (): void => {
    const requiresLandscape = isMobileLike() && innerHeight > innerWidth && !this.dismissed;
    this.gate.classList.toggle('is-visible', requiresLandscape);
    document.documentElement.classList.toggle('mobile-landscape-active', isMobileLike() && innerWidth >= innerHeight);
  };

  /** Let the player through in portrait. Landscape stays the recommended orientation. */
  private dismiss(): void {
    this.dismissed = true;
    this.refresh();
  }

  private revealFallback(): void {
    this.fallback.hidden = false;
  }

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

    // The lock either was unavailable or was refused: the device is still
    // portrait. Offer the manual route so the gate can never be a dead end.
    if (innerHeight > innerWidth) this.revealFallback();

    this.refresh();
  }
}

function canLockOrientation(): boolean {
  return typeof (screen.orientation as LockableScreenOrientation | undefined)?.lock === 'function';
}

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 1024;
}
