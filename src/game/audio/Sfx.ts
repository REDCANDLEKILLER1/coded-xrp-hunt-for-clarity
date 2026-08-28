/**
 * Game sound effects, synthesised.
 *
 * Every sound here is built from oscillators and generated noise rather than
 * loaded from a file. That is deliberate: the three music tracks already cost
 * 11MB, and a shooter fires several times a second, so a sample set would both
 * bloat the download and need artwork-grade assets that do not exist yet. A few
 * hundred bytes of WebAudio gets arcade blips, thumps and explosions with
 * nothing to download and no manifest entry to keep in sync.
 *
 * The context cannot exist before a user gesture (autoplay policy), so it is
 * created lazily on the first sound and stays suspended until then. Everything
 * is a no-op while muted or before the first gesture — never an exception.
 */

type Voice = 'shoot' | 'enemyShoot' | 'hit' | 'explode' | 'bigExplode' | 'pickup' | 'levelUp' | 'bomb' | 'pulse' | 'hurt' | 'deny';

const MUTE_STORAGE_KEY = 'coded.sfx.muted';
/** Cheap guard against the same sound stacking into a wall of noise. */
const MIN_GAP_MS: Partial<Record<Voice, number>> = { shoot: 55, enemyShoot: 70, hit: 40, explode: 45 };

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private lastAt = new Map<Voice, number>();

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      // Private mode: default to audible.
    }
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
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  play(voice: Voice, intensity = 1): void {
    if (this.muted) return;
    const now = Date.now();
    const gap = MIN_GAP_MS[voice];
    if (gap !== undefined && now - (this.lastAt.get(voice) ?? 0) < gap) return;
    this.lastAt.set(voice, now);

    const ctx = this.context();
    if (!ctx) return;
    // A tab restored from the background comes back suspended.
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    switch (voice) {
      case 'shoot':
        this.blip(t, 'square', 880, 300, 0.07, 0.16);
        break;
      case 'enemyShoot':
        this.blip(t, 'sawtooth', 420, 170, 0.09, 0.1);
        break;
      case 'hit':
        this.blip(t, 'square', 240, 120, 0.05, 0.12);
        break;
      case 'explode':
        this.burst(t, 0.34, 1400, 0.34 * intensity);
        this.blip(t, 'triangle', 180, 50, 0.22, 0.16 * intensity);
        break;
      case 'bigExplode':
        this.burst(t, 0.9, 900, 0.5);
        this.blip(t, 'triangle', 120, 32, 0.7, 0.3);
        break;
      case 'pickup':
        this.blip(t, 'sine', 620, 1180, 0.16, 0.2);
        break;
      case 'levelUp':
        // A little rising arpeggio: the one moment worth a fanfare.
        [523, 659, 784, 1046].forEach((freq, i) => this.blip(t + i * 0.085, 'triangle', freq, freq, 0.16, 0.2));
        break;
      case 'bomb':
        this.burst(t, 1.1, 700, 0.45);
        this.blip(t, 'sine', 260, 40, 0.9, 0.28);
        break;
      case 'pulse':
        this.blip(t, 'sine', 300, 1500, 0.5, 0.22);
        break;
      case 'hurt':
        this.blip(t, 'sawtooth', 340, 90, 0.3, 0.24);
        break;
      case 'deny':
        this.blip(t, 'square', 190, 150, 0.11, 0.12);
        break;
    }
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.noise = this.buildNoise(this.ctx);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** One second of white noise, reused by every explosion. */
  private buildNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A pitched tone that slides from `from` to `to` and decays to silence. */
  private blip(at: number, type: OscillatorType, from: number, to: number, length: number, peak: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** Filtered noise sweeping downwards: the body of an explosion. */
  private burst(at: number, length: number, cutoffFrom: number, peak: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFrom, at);
    filter.frequency.exponentialRampToValueAtTime(120, at + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + length + 0.02);
  }
}

export const sfx = new Sfx();
export type { Voice as SfxVoice };
