type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

/**
 * Mobile gameplay is landscape-first, and landscape is only worth anything with
 * the browser chrome gone — a phone in landscape with the URL bar still up
 * loses a third of an already short screen.
 *
 * Fullscreen and orientation lock both require transient user activation:
 * rotating the phone is not a gesture, so no amount of listening to
 * `orientationchange` can hide that bar. Something has to be tapped. So the
 * gate leads with an explicit START button, and once past it a small FULLSCREEN
 * nudge stays available for as long as the game is running outside fullscreen —
 * a player who backed out, or who arrived already in landscape and never saw
 * the gate, still has a deliberate way to force it.
 *
 * Neither call is guaranteed: iOS Safari exposes no element fullscreen and no
 * screen.orientation.lock, and a device with rotation lock on stays portrait.
 * The gate therefore must never be the only way forward — when the lock cannot
 * be performed the player gets a manual-rotate hint plus an explicit escape
 * into portrait play.
 */
export class LandscapeMode {
  private readonly gate: HTMLDivElement;
  private readonly fallback: HTMLDivElement;
  private readonly nudge: HTMLButtonElement;
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
        <span>Landscape gives you the full battlefield. Drag anywhere to fly.</span>
        <button type="button" class="landscape-gate__start">PRESS START</button>
        <span class="landscape-gate__note">Start goes fullscreen and locks landscape, so the address bar gets out of the way.</span>
        <div class="landscape-gate__fallback" hidden>
          <span class="landscape-gate__hint">This browser will not rotate the screen for us. Turn the phone sideways yourself — or keep playing in portrait.</span>
          <button type="button" class="landscape-gate__skip">CONTINUE ANYWAY</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.gate);

    // The nudge lives outside the gate: its whole job is to be reachable once
    // the gate is gone but the browser chrome is still on screen.
    this.nudge = document.createElement('button');
    this.nudge.type = 'button';
    this.nudge.className = 'fullscreen-nudge';
    this.nudge.textContent = '⛶ FULLSCREEN';
    this.nudge.title = 'Hide the address bar and lock landscape';
    document.body.appendChild(this.nudge);

    this.fallback = this.gate.querySelector<HTMLDivElement>('.landscape-gate__fallback')!;
    this.gate.querySelector<HTMLButtonElement>('.landscape-gate__start')
      ?.addEventListener('click', () => void this.goFullscreen());
    this.gate.querySelector<HTMLButtonElement>('.landscape-gate__skip')
      ?.addEventListener('click', () => this.dismiss());
    this.nudge.addEventListener('click', () => void this.goFullscreen());

    window.addEventListener('resize', this.refresh);
    window.addEventListener('orientationchange', this.refresh);
    screen.orientation?.addEventListener?.('change', this.refresh);
    document.addEventListener('fullscreenchange', this.refresh);
    document.addEventListener('webkitfullscreenchange', this.refresh);

    // If the platform cannot lock orientation at all, say so up front rather
    // than letting the player discover it by pressing a button that half-works.
    if (!canLockOrientation()) this.revealFallback();
    this.refresh();
  }

  private readonly refresh = (): void => {
    const mobile = isMobileLike();
    const portrait = innerHeight > innerWidth;
    const requiresLandscape = mobile && portrait && !this.dismissed;
    this.gate.classList.toggle('is-visible', requiresLandscape);
    document.documentElement.classList.toggle('mobile-landscape-active', mobile && !portrait);
    // Offer the nudge exactly when it can still do something: on a phone, out
    // of fullscreen, and not already behind the gate's own START button.
    this.nudge.classList.toggle('is-visible', mobile && !isFullscreen() && !requiresLandscape);
  };

  /** Let the player through in portrait. Landscape stays the recommended orientation. */
  private dismiss(): void {
    this.dismissed = true;
    this.refresh();
  }

  private revealFallback(): void {
    this.fallback.hidden = false;
  }

  /**
   * Called straight from a click so the transient user activation is still
   * live. Deliberately not latched: a refused or exited fullscreen must leave
   * the player able to try again.
   */
  private async goFullscreen(): Promise<void> {
    try {
      if (!isFullscreen()) {
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

function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function canLockOrientation(): boolean {
  return typeof (screen.orientation as LockableScreenOrientation | undefined)?.lock === 'function';
}

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 1024;
}
