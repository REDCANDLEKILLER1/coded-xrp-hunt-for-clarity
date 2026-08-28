/**
 * Forces players onto a new build.
 *
 * People keep the game open on a phone for a long time, so a deploy used to
 * reach nobody who was already playing -- they carried on in whatever build
 * they loaded first, and bug reports came back against code that no longer
 * existed. This watches for a new deploy and restarts into it.
 *
 * Detection needs no build step or version file: Vite content-hashes the
 * entry bundle, so `assets/index-<hash>.js` in the served HTML IS the version.
 * Fetch the page, read the name, compare it to the one this session is
 * running.
 */

/** How often to look, and how long the notice shows before the reload. */
const POLL_MS = 60_000;
const NOTICE_MS = 2400;
const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;
/** Remembers which build we already reloaded for, so a stale edge cannot loop. */
const PENDING_KEY = 'coded:update-target';

const read = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null): void => {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Private browsing can throw on write. A watcher that cannot remember is
    // still better than no watcher; it just loses the loop guard.
  }
};

/** The entry bundle this session is running, or null in dev. */
export function currentBundle(moduleUrl: string): string | null {
  return BUNDLE_RE.exec(moduleUrl)?.[0] ?? null;
}

/** The entry bundle the server is serving right now. */
export function bundleFromHtml(html: string): string | null {
  return BUNDLE_RE.exec(html)?.[0] ?? null;
}

function showNotice(): void {
  if (document.getElementById('update-notice')) return;
  const notice = document.createElement('div');
  notice.id = 'update-notice';
  notice.className = 'update-notice';
  notice.innerHTML = '<strong>NEW VERSION</strong><span>RESTARTING…</span>';
  document.body.appendChild(notice);
}

export function watchForUpdates(moduleUrl: string): void {
  const running = currentBundle(moduleUrl);
  // Dev serves /src/main.ts unhashed, so there is no version to compare and
  // nothing to do. Never poll there.
  if (!running) return;

  // If we reloaded for a build and are now running it, the update landed.
  if (read(PENDING_KEY) === running) write(PENDING_KEY, null);

  let restarting = false;

  const check = async (): Promise<void> => {
    if (restarting || document.hidden) return;
    let html: string;
    try {
      // Cache-busted and uncached: an edge or service worker holding the old
      // HTML would otherwise report the running build forever.
      const response = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      html = await response.text();
    } catch {
      // Offline, or the network blinked. Try again next tick.
      return;
    }

    const latest = bundleFromHtml(html);
    if (!latest || latest === running) return;
    // Already reloaded once for this exact build and still not running it --
    // something upstream is serving stale HTML, and reloading again would
    // just spin.
    if (read(PENDING_KEY) === latest) return;

    restarting = true;
    write(PENDING_KEY, latest);
    showNotice();
    setTimeout(() => location.reload(), NOTICE_MS);
  };

  setInterval(check, POLL_MS);
  // Coming back to a backgrounded tab is the most likely moment to be behind.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  void check();
}
