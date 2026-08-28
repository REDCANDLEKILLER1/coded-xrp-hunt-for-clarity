import { debugLog } from '../core/DebugLog';

interface TrackDef {
  src: string;
  title: string;
  loop: boolean;
  gain: number;
}

interface AudioManifest {
  tracks: Record<string, TrackDef>;
  cues: Record<string, string | null>;
}

const MANIFEST_URL = '/assets/audio/manifest.json';
const MUTE_STORAGE_KEY = 'coded.music.muted';
const FADE_MS = 900;
const FADE_STEP_MS = 50;

/**
 * Music playback for the campaign.
 *
 * The game already dispatched `coded:music-cue` events from every scene change
 * — title, flight, each boss, the disabled warship — but nothing listened, so
 * the whole game was silent. This is the listener.
 *
 * Three constraints shape it:
 *
 * 1. Autoplay is blocked until a gesture. Nothing can be heard before the
 *    player touches something, so the first cue is remembered and replayed the
 *    moment a gesture arrives. PRESS START is usually that gesture.
 * 2. The tracks are 3.5–4.4 MB each. They are `preload="none"` and only fetched
 *    when their cue actually fires, so booting the game downloads no audio.
 * 3. Cues repeat constantly (every act change re-cues `level1`). Re-cueing the
 *    track that is already playing must be a no-op, or the music restarts from
 *    the top every few seconds.
 *
 * Track changes crossfade rather than cut, and `paused` is a special cue: it
 * swaps to the theme and remembers what to go back to.
 */
export class MusicDirector {
  private manifest: AudioManifest | null = null;
  private readonly elements = new Map<string, HTMLAudioElement>();
  private currentTrack: string | null = null;
  private currentCue: string | null = null;
  /** What to return to when the pause menu closes. */
  private resumeCue: string | null = null;
  /** A cue that arrived before the browser would let us make noise. */
  private pendingCue: string | null = null;
  private unlocked = false;
  private muted = false;
  private fadeTimers = new Map<string, number>();

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      // Storage can be unavailable in private modes; default to audible.
    }

    window.addEventListener('coded:music-cue', this.onCue as EventListener);
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      document.addEventListener(type, this.onGesture, { capture: true, passive: true });
    }
    void this.loadManifest();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Non-fatal: the setting just will not survive a reload.
    }
    if (muted) {
      this.stopAll();
      return;
    }
    // Unmuting replays whatever the game last asked for.
    const cue = this.currentCue ?? this.pendingCue;
    this.currentCue = null;
    this.currentTrack = null;
    if (cue) this.play(cue);
  }

  /** Cue directly, for callers that hold a reference rather than firing an event. */
  cue(cue: string): void {
    this.play(cue);
  }

  private readonly onCue = (event: CustomEvent<{ cue: string }>): void => {
    const cue = event.detail?.cue;
    if (typeof cue === 'string') this.play(cue);
  };

  private readonly onGesture = (): void => {
    if (this.unlocked) return;
    this.unlocked = true;
    const cue = this.pendingCue;
    this.pendingCue = null;
    if (cue) this.play(cue);
  };

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`audio manifest HTTP ${response.status}`);
      this.manifest = (await response.json()) as AudioManifest;
      // A cue may have fired while the manifest was in flight.
      const cue = this.pendingCue;
      if (cue && this.unlocked) {
        this.pendingCue = null;
        this.play(cue);
      }
    } catch (error) {
      debugLog.log('audio', 'manifest unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private play(cue: string): void {
    if (cue === 'paused') {
      // Remember the flight/boss track so unpausing goes back to it.
      if (this.currentCue && this.currentCue !== 'paused') this.resumeCue = this.currentCue;
    } else if (this.currentCue === 'paused' && cue === 'resume') {
      const back = this.resumeCue ?? 'level1';
      this.resumeCue = null;
      this.play(back);
      return;
    }

    if (!this.manifest || !this.unlocked || this.muted) {
      // Hold the latest intent: whichever gate opens last will replay it.
      this.pendingCue = cue === 'resume' ? this.resumeCue ?? 'level1' : cue;
      return;
    }

    const resolved = cue === 'resume' ? this.resumeCue ?? 'level1' : cue;
    const trackKey = this.manifest.cues[resolved] ?? null;
    this.currentCue = resolved;

    if (!trackKey) {
      this.stopAll();
      this.currentTrack = null;
      return;
    }
    // The game re-cues the same track on every act change. Without this the
    // music restarts from the top every few seconds.
    if (trackKey === this.currentTrack) return;

    const def = this.manifest.tracks[trackKey];
    if (!def) {
      debugLog.log('audio', 'unknown track for cue', { cue: resolved, trackKey });
      return;
    }

    const previous = this.currentTrack;
    this.currentTrack = trackKey;
    if (previous) this.fade(previous, 0, () => this.elements.get(previous)?.pause());

    const element = this.element(trackKey, def);
    element.volume = 0;
    void element.play().then(
      () => this.fade(trackKey, def.gain),
      (error: unknown) => {
        // Autoplay refused after all: wait for the next real gesture.
        this.unlocked = false;
        this.pendingCue = resolved;
        this.currentTrack = previous;
        debugLog.log('audio', 'play refused', {
          cue: resolved,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    );
    debugLog.log('audio', 'cue', { cue: resolved, track: trackKey, title: def.title });
  }

  private element(trackKey: string, def: TrackDef): HTMLAudioElement {
    const existing = this.elements.get(trackKey);
    if (existing) return existing;
    const element = new Audio();
    element.src = def.src;
    element.loop = def.loop;
    // 3.5-4.4 MB per track: nothing downloads until its cue actually fires.
    element.preload = 'none';
    element.volume = 0;
    this.elements.set(trackKey, element);
    return element;
  }

  private fade(trackKey: string, target: number, done?: () => void): void {
    const element = this.elements.get(trackKey);
    if (!element) return;
    const existing = this.fadeTimers.get(trackKey);
    if (existing !== undefined) clearInterval(existing);

    const start = element.volume;
    const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);
      element.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (t < 1) return;
      clearInterval(timer);
      this.fadeTimers.delete(trackKey);
      done?.();
    }, FADE_STEP_MS);
    this.fadeTimers.set(trackKey, timer);
  }

  private stopAll(): void {
    for (const [key, element] of this.elements) {
      const timer = this.fadeTimers.get(key);
      if (timer !== undefined) {
        clearInterval(timer);
        this.fadeTimers.delete(key);
      }
      element.pause();
      element.volume = 0;
    }
    this.currentTrack = null;
  }
}
