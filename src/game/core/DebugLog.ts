/**
 * Lightweight in-memory event log for on-device debugging.
 *
 * Phones have no usable console, so a playtester needs to be able to finish a
 * run and then hand over a transcript of what the game actually did. Events are
 * kept in a ring buffer, mirrored to sessionStorage so a reload does not lose
 * them, and rendered as selectable text by the `?log` route.
 *
 * Rules that keep this safe to leave switched on:
 *  - fixed memory ceiling (ring buffer, oldest dropped first);
 *  - `sample()` throttles high-frequency sources so per-frame data cannot flood;
 *  - every storage access is wrapped, so private mode cannot break the game.
 */

const MAX_ENTRIES = 1500;
const STORAGE_KEY = 'coded.debuglog.v1';

export type LogCategory =
  | 'boot' | 'input' | 'tilt' | 'orientation' | 'mode'
  | 'mission' | 'combat' | 'asset' | 'error' | 'note';

type Entry = { t: number; cat: LogCategory; msg: string; data?: Record<string, unknown> };

class DebugLog {
  private entries: Entry[] = [];
  private readonly start = Date.now();
  private lastSample = new Map<string, number>();
  private restored = false;

  log(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
    this.entries.push({ t: Date.now() - this.start, cat, msg, data });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    this.persistSoon();
  }

  /**
   * Log at most once per `everyMs` for a given key. Use for per-frame values
   * (tilt readings, player position) that would otherwise fill the buffer.
   */
  sample(key: string, everyMs: number, cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
    const now = Date.now();
    const last = this.lastSample.get(key) ?? -Infinity;
    if (now - last < everyMs) return;
    this.lastSample.set(key, now);
    this.log(cat, msg, data);
  }

  clear(): void {
    this.entries = [];
    this.lastSample.clear();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }

  /** Plain-text transcript, oldest first. This is what a tester hands over. */
  dump(): string {
    this.restore();
    const head = [
      `CODED debug log`,
      `captured : ${new Date().toISOString()}`,
      `agent    : ${navigator.userAgent}`,
      `screen   : ${innerWidth}x${innerHeight} dpr=${devicePixelRatio} orientation=${screen.orientation?.angle ?? 'n/a'}`,
      `entries  : ${this.entries.length}${this.entries.length >= MAX_ENTRIES ? ' (ring buffer full, oldest dropped)' : ''}`,
      '',
    ].join('\n');
    const body = this.entries.map((e) => {
      const secs = (e.t / 1000).toFixed(2).padStart(8);
      const extra = e.data ? ' ' + JSON.stringify(e.data) : '';
      return `${secs}s [${e.cat}] ${e.msg}${extra}`;
    }).join('\n');
    return head + body + '\n';
  }

  size(): number { return this.entries.length; }

  private persistTimer: number | null = null;
  private persistSoon(): void {
    if (this.persistTimer !== null) return;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(-MAX_ENTRIES)));
      } catch { /* quota or private mode: keep running in memory only */ }
    }, 1000);
  }

  /** Pull back anything written before a reload, so a crash still leaves a trail. */
  restore(): void {
    if (this.restored) return;
    this.restored = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const prior = JSON.parse(raw) as Entry[];
      if (!Array.isArray(prior) || prior.length === 0) return;
      // Prior-session entries first, so the transcript reads chronologically.
      const marker: Entry = { t: 0, cat: 'boot', msg: '--- reload ---' };
      this.entries = [...prior, marker, ...this.entries].slice(-MAX_ENTRIES);
    } catch { /* unreadable: ignore */ }
  }
}

export const debugLog = new DebugLog();

// Reachable from a desktop console when one is available; harmless on a phone.
(window as unknown as { codedLog?: unknown }).codedLog = debugLog;

window.addEventListener('error', (e) => {
  debugLog.log('error', 'uncaught', { message: String(e.message), source: `${e.filename}:${e.lineno}` });
});
window.addEventListener('unhandledrejection', (e) => {
  debugLog.log('error', 'unhandled rejection', { reason: String((e as PromiseRejectionEvent).reason) });
});
