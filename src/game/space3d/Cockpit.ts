import type { AssetLoader } from '../core/AssetLoader';

/**
 * The stolen Regulatory Warship's canopy, and the instruments in it.
 *
 * The overlay is one authored PNG with a real alpha aperture -- 41% of the
 * image is punched clean through, and that hole is the forward view. Nothing
 * is drawn over the glass: the frame is composited on TOP of the flight, so
 * what you see through it is the actual scene rather than a picture of one.
 *
 * The instruments are NOT in the art. The panel ships with dead screens and
 * dark radar dishes on purpose, and everything that moves is drawn here in
 * code, registered to the fixed positions the art puts them in. A radar
 * baked into a PNG is a decoration; this one is the only thing that tells you
 * what is behind you, which in open space is half of what is shooting at you.
 */

/** Where things sit in the overlay, as fractions of the artwork. */
const ART = {
  /** The alpha aperture's usable rectangle, measured off the source PNG. */
  aperture: { left: 0.2016, right: 0.7972, top: 0.0340, bottom: 0.5749 },
  /** Where the forward view's vanishing point belongs inside that aperture. */
  vanishing: { x: 0.4994, y: 0.3045 },
  radarLeft: { x: 0.105, y: 0.935, r: 0.038 },
  radarRight: { x: 0.897, y: 0.935, r: 0.038 },
  mainScreen: { x: 0.407, y: 0.648, w: 0.191, h: 0.192 },
  leftScreen: { x: 0.221, y: 0.680, w: 0.138, h: 0.128 },
  rightScreen: { x: 0.643, y: 0.680, w: 0.140, h: 0.128 },
} as const;

const ART_W = 1672;
const ART_H = 941;
const ART_ASPECT = ART_W / ART_H;
/** Below this viewport aspect the canopy stops fitting and the console takes over. */
const CONSOLE_ASPECT = 1.15;
/** Where the console band starts in the artwork -- just below the glass. */
const CONSOLE_TOP = 0.55;
/**
 * How much wider than the screen the portrait band is drawn.
 *
 * Wider is more legible, but the radar dishes sit at 0.105 and 0.897 of the
 * artwork: past about 1.2 they slide off both edges, and the two instruments
 * that make free flight playable are the first things lost. This is the widest
 * value that keeps both dishes fully on screen.
 */
const CONSOLE_OVERSCAN = 1.18;
/** Lifts the portrait band clear of the shell's own bottom-left buttons. */
const CONSOLE_LIFT = 32;

const RED = '#ff2d3d';
const AMBER = '#ffb020';
const CYAN = '#4fd8ff';

export interface CockpitContact {
  /** Bearing relative to the nose, radians. 0 ahead, +/-PI behind. */
  bearing: number;
  /** Straight-line range in world units. */
  range: number;
  /** -1 (fully below) .. 1 (fully above), for the elevation dish. */
  elevation: number;
  hostile: boolean;
  /** Draws larger and brighter. */
  capital?: boolean;
}

export interface CockpitState {
  hull: number;
  hullMax: number;
  throttle: number;
  /** 0..1, or null when nothing is engaged. */
  bossHealth: number | null;
  bossLabel: string;
  /** Text for the main screen. */
  status: string;
  contacts: CockpitContact[];
  /** Radar's outer ring, in world units. */
  radarRange: number;
  rollReady: boolean;
  clock: number;
}

/** Where the cockpit puts the flight view on screen. */
export interface CockpitFrame {
  /** 'canopy' shows the whole frame; 'console' shows only the panel band. */
  mode: 'canopy' | 'console';
  /** Vanishing point, in screen pixels. */
  cx: number;
  cy: number;
  /** The aperture, in screen pixels: the field the flight must stay inside. */
  aperture: { x: number; y: number; w: number; h: number };
  /** Where the WHOLE artwork would sit, so instrument fractions stay mode-agnostic. */
  art: { x: number; y: number; w: number; h: number };
  /** The part of the artwork actually drawn. */
  source: { x: number; y: number; w: number; h: number };
  /** False when the overlay could not be drawn and the caller must fall back. */
  present: boolean;
}

export class Cockpit {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: AssetLoader,
  ) {}

  /**
   * Fits the canopy to the viewport and reports where the view goes.
   *
   * The artwork is a 1.78 landscape frame and a portrait phone is about 0.49.
   * That gap cannot be closed by scaling: covering a tall screen crops three
   * quarters of the width away, and containing it shrinks the aperture to a
   * letterbox you cannot fight in. Both were tried; both were unusable.
   *
   * So portrait does not show the canopy at all. It shows the CONSOLE -- the
   * band of the same artwork below the glass, with the screens and both radar
   * dishes -- laid across the bottom, and gives the whole screen above it to
   * the view. You are looking over the panel instead of through the windscreen,
   * which is what a cockpit looks like on a tall screen, and it is the same
   * asset either way.
   */
  layout(w: number, h: number): CockpitFrame {
    const aspect = w / h;
    return aspect >= CONSOLE_ASPECT ? this.canopyLayout(w, h) : this.consoleLayout(w, h);
  }

  /** Landscape: the full canopy, covering the viewport, anchored to the panel. */
  private canopyLayout(w: number, h: number): CockpitFrame {
    const scale = Math.max(w / ART_W, h / ART_H);
    const artW = ART_W * scale;
    const artH = ART_H * scale;
    const artX = (w - artW) / 2;
    // Anchor the panel to the bottom: the console has to stay reachable and
    // legible, the top of the canopy does not.
    const artY = h - artH;
    const px = (fx: number) => artX + fx * artW;
    const py = (fy: number) => artY + fy * artH;
    return {
      mode: 'canopy',
      cx: px(ART.vanishing.x),
      cy: py(ART.vanishing.y),
      aperture: {
        x: px(ART.aperture.left),
        y: py(ART.aperture.top),
        w: (ART.aperture.right - ART.aperture.left) * artW,
        h: (ART.aperture.bottom - ART.aperture.top) * artH,
      },
      art: { x: artX, y: artY, w: artW, h: artH },
      source: { x: 0, y: 0, w: ART_W, h: ART_H },
      present: true,
    };
  }

  /**
   * Portrait: only the console band, across the bottom, over an open view.
   *
   * The band is drawn wider than the screen and centred, so the instruments
   * come up to a readable size and what gets cropped is the outer strut ends,
   * which carry nothing. `art` still describes where the WHOLE artwork would
   * sit, so every instrument position stays a plain fraction of it and none of
   * the placement maths has to know which mode it is in.
   */
  private consoleLayout(w: number, h: number): CockpitFrame {
    const artW = w * CONSOLE_OVERSCAN;
    const artH = artW / ART_ASPECT;
    const artX = (w - artW) / 2;
    // Lifted off the bottom edge rather than flush to it: the app shell parks
    // its log and mute buttons in that corner, and they land straight on the
    // left radar dish otherwise.
    const artY = h - artH - CONSOLE_LIFT;
    const bandH = (1 - CONSOLE_TOP) * artH + CONSOLE_LIFT;
    return {
      mode: 'console',
      cx: w / 2,
      // The view centre sits above the band, biased high so the reticle is not
      // buried in the panel on a very tall screen.
      cy: (h - bandH) * 0.46,
      aperture: { x: 0, y: 0, w, h: h - bandH },
      art: { x: artX, y: artY, w: artW, h: artH },
      source: { x: 0, y: ART_H * CONSOLE_TOP, w: ART_W, h: ART_H * (1 - CONSOLE_TOP) },
      present: true,
    };
  }

  /**
   * Draws the canopy over the flight. Returns false when the art is missing.
   *
   * Goes through the loader rather than SpriteRenderer because portrait needs
   * a SOURCE rect -- only the console band of the sheet -- and the convenience
   * wrapper only ever draws a whole image.
   */
  drawFrame(frame: CockpitFrame): boolean {
    const image = this.assets.getImage('ui', 'regulatory_warship_cockpit');
    if (!image) return false;
    const { source, art } = frame;
    const scale = art.h / ART_H;
    this.ctx.drawImage(
      image,
      source.x, source.y, source.w, source.h,
      art.x + source.x * (art.w / ART_W), art.y + source.y * scale,
      source.w * (art.w / ART_W), source.h * scale,
    );
    return true;
  }

  /** Draws everything that moves: radar, gauges, screens. */
  drawInstruments(frame: CockpitFrame, state: CockpitState): void {
    const { art } = frame;
    const px = (fx: number) => art.x + fx * art.w;
    const py = (fy: number) => art.y + fy * art.h;
    const pr = (fr: number) => fr * art.w;

    this.drawRadar(px(ART.radarLeft.x), py(ART.radarLeft.y), pr(ART.radarLeft.r), state);
    this.drawThreatDish(px(ART.radarRight.x), py(ART.radarRight.y), pr(ART.radarRight.r), state);
    this.drawMainScreen(px(ART.mainScreen.x), py(ART.mainScreen.y), pr(ART.mainScreen.w), ART.mainScreen.h * art.h, state);
    this.drawHullScreen(px(ART.leftScreen.x), py(ART.leftScreen.y), pr(ART.leftScreen.w), ART.leftScreen.h * art.h, state);
    this.drawTargetScreen(px(ART.rightScreen.x), py(ART.rightScreen.y), pr(ART.rightScreen.w), ART.rightScreen.h * art.h, state);
  }

  /**
   * The 360 degree plan radar: a top-down disc with your nose at 12 o'clock.
   *
   * Bearing sets the angle, range sets the distance from the middle, so a
   * contact drawn at the BOTTOM of the dish is directly behind you. This is
   * the instrument that makes free flight playable instead of a guessing game.
   */
  private drawRadar(cx: number, cy: number, r: number, state: CockpitState): void {
    const { ctx } = this;
    if (r < 6) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(4,1,2,0.82)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.strokeStyle = 'rgba(255,45,61,0.35)';
    ctx.lineWidth = 1;
    for (const ring of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Sweep, so a dead radar and a radar with nothing on it look different.
    const sweep = (state.clock * 1.5) % (Math.PI * 2);
    const grad = ctx.createConicGradient?.(sweep - Math.PI / 2, cx, cy);
    if (grad) {
      grad.addColorStop(0, 'rgba(255,45,61,0.34)');
      grad.addColorStop(0.12, 'rgba(255,45,61,0)');
      grad.addColorStop(1, 'rgba(255,45,61,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    for (const contact of state.contacts) {
      const t = Math.min(1, contact.range / state.radarRange);
      if (t >= 1) continue;
      // Screen up is forward, so bearing 0 plots at the top.
      const x = cx + Math.sin(contact.bearing) * t * r;
      const y = cy - Math.cos(contact.bearing) * t * r;
      const size = contact.capital ? Math.max(2.4, r * 0.13) : Math.max(1.3, r * 0.065);
      ctx.fillStyle = contact.capital ? AMBER : contact.hostile ? RED : CYAN;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // You, always at the middle, always pointing up.
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.16);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.09);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.09);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The right dish reads elevation instead of repeating the left one.
   * Out here a contact can be directly above or below you, and a plan radar
   * cannot say so -- two identical dishes would waste the one that could.
   */
  private drawThreatDish(cx: number, cy: number, r: number, state: CockpitState): void {
    const { ctx } = this;
    if (r < 6) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(4,1,2,0.82)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(255,45,61,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,45,61,0.5)';
    ctx.font = `${Math.max(5, r * 0.24)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('ELEV', cx, cy - r * 0.62);

    const nearest = [...state.contacts].sort((a, b) => a.range - b.range).slice(0, 9);
    for (const contact of nearest) {
      const t = Math.min(1, contact.range / state.radarRange);
      const x = cx + Math.sin(contact.bearing) * t * r * 0.9;
      const y = cy - (contact.elevation) * r * 0.8;
      ctx.fillStyle = contact.capital ? AMBER : RED;
      ctx.beginPath();
      ctx.arc(x, y, contact.capital ? Math.max(2.2, r * 0.12) : Math.max(1.2, r * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawMainScreen(x: number, y: number, w: number, h: number, state: CockpitState): void {
    const { ctx } = this;
    if (w < 30) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(6,1,3,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = RED;
    ctx.font = `700 ${Math.max(7, w * 0.075)}px "Courier New", monospace`;
    ctx.fillText(state.status, x + w / 2, y + h * 0.3);

    if (state.bossHealth !== null) {
      ctx.fillStyle = 'rgba(255,45,61,0.75)';
      ctx.font = `${Math.max(6, w * 0.058)}px "Courier New", monospace`;
      ctx.fillText(state.bossLabel, x + w / 2, y + h * 0.52);
      const barW = w * 0.76;
      ctx.fillStyle = 'rgba(255,45,61,0.22)';
      ctx.fillRect(x + (w - barW) / 2, y + h * 0.62, barW, Math.max(3, h * 0.07));
      ctx.fillStyle = RED;
      ctx.fillRect(x + (w - barW) / 2, y + h * 0.62, barW * state.bossHealth, Math.max(3, h * 0.07));
    } else {
      // A scrolling nav trace, so the screen is alive between fights.
      ctx.strokeStyle = 'rgba(255,45,61,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 40; i += 1) {
        const t = i / 40;
        const sx = x + t * w;
        const sy = y + h * 0.62 + Math.sin(t * 9 + state.clock * 2.2) * h * 0.14;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHullScreen(x: number, y: number, w: number, h: number, state: CockpitState): void {
    const { ctx } = this;
    if (w < 24) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(6,1,3,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,45,61,0.7)';
    ctx.font = `${Math.max(6, w * 0.1)}px "Courier New", monospace`;
    ctx.fillText('HULL', x + w * 0.08, y + h * 0.24);

    const segments = state.hullMax;
    const segW = (w * 0.84) / segments;
    for (let i = 0; i < segments; i += 1) {
      const lit = i < state.hull;
      ctx.fillStyle = lit ? (state.hull <= 2 ? RED : AMBER) : 'rgba(120,30,40,0.3)';
      ctx.fillRect(x + w * 0.08 + i * segW, y + h * 0.36, segW * 0.72, h * 0.2);
    }
    ctx.fillStyle = 'rgba(255,45,61,0.6)';
    ctx.font = `${Math.max(5, w * 0.085)}px "Courier New", monospace`;
    ctx.fillText(state.rollReady ? 'ROLL RDY' : 'ROLL ...', x + w * 0.08, y + h * 0.82);
    ctx.restore();
  }

  private drawTargetScreen(x: number, y: number, w: number, h: number, state: CockpitState): void {
    const { ctx } = this;
    if (w < 24) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(6,1,3,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,45,61,0.7)';
    ctx.font = `${Math.max(6, w * 0.1)}px "Courier New", monospace`;
    const hostiles = state.contacts.filter((c) => c.hostile).length;
    ctx.fillText(`CONTACTS ${hostiles}`, x + w * 0.08, y + h * 0.24);

    // Throttle bar: the one thing the art has no dial for and flight needs.
    ctx.fillStyle = 'rgba(120,30,40,0.3)';
    ctx.fillRect(x + w * 0.08, y + h * 0.4, w * 0.84, h * 0.16);
    ctx.fillStyle = AMBER;
    ctx.fillRect(x + w * 0.08, y + h * 0.4, w * 0.84 * state.throttle, h * 0.16);
    ctx.fillStyle = 'rgba(255,45,61,0.6)';
    ctx.font = `${Math.max(5, w * 0.085)}px "Courier New", monospace`;
    ctx.fillText(`THR ${Math.round(state.throttle * 100)}%`, x + w * 0.08, y + h * 0.82);
    ctx.restore();
  }
}
