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
 * Fullscreen, offered rather than demanded.
 *
 * This used to be a portrait gate: a full-screen card telling the player to
 * turn the phone sideways, with START behind it. Landscape is still the better
 * way to play a wide battlefield, but a gate is a wall, and the game works
 * portrait -- the flight game is a vertical shooter, and the warship interior
 * scrolls, so a narrow window simply shows less of the room at once.
 *
 * What is left is a small chip in the corner. Fullscreen and orientation lock
 * both need transient user activation -- rotating a phone is not a gesture, so
 * no amount of listening to `orientationchange` can hide the address bar --
 * which is why the option has to be a tap and cannot simply happen. It shows
 * only while it can still do something: on a phone, outside fullscreen.
 *
 * Neither call is guaranteed. iOS Safari exposes no element fullscreen and no
 * screen.orientation.lock, and a device with rotation lock on stays portrait.
 * Nothing depends on either succeeding.
 */
export class LandscapeMode {
  private readonly nudge: HTMLButtonElement;

  constructor() {
    this.nudge = document.createElement('button');
    this.nudge.type = 'button';
    this.nudge.className = 'fullscreen-nudge';
    this.nudge.textContent = '⛶';
    this.nudge.setAttribute('aria-label', 'Fullscreen');
    this.nudge.title = 'Fullscreen and lock landscape';
    document.body.appendChild(this.nudge);
    this.nudge.addEventListener('click', () => void this.goFullscreen());

    window.addEventListener('resize', this.refresh);
    window.addEventListener('orientationchange', this.refresh);
    screen.orientation?.addEventListener?.('change', this.refresh);
    document.addEventListener('fullscreenchange', this.refresh);
    document.addEventListener('webkitfullscreenchange', this.refresh);
    this.refresh();
  }

  private readonly refresh = (): void => {
    const mobile = isMobileLike();
    const portrait = innerHeight > innerWidth;
    // Landscape still gets the tighter phone layout; portrait uses the roomier
    // one, because it has the height to spend.
    document.documentElement.classList.toggle('mobile-landscape-active', mobile && !portrait);
    document.documentElement.classList.toggle('mobile-portrait-active', mobile && portrait);
    // Offered only while it can still do something.
    this.nudge.classList.toggle('is-visible', mobile && !isFullscreen());
  };

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
      // Fullscreen is optional and always has been. Portrait play is the norm.
    }

    try {
      const orientation = screen.orientation as LockableScreenOrientation;
      if (orientation.lock) await orientation.lock('landscape');
    } catch {
      // Some browsers deny orientation lock outside installed/PWA modes.
      // Nothing depends on it: the game plays in whatever orientation it gets.
    }

    this.refresh();
  }
}

function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 1024;
}
