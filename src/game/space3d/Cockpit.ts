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
/**
 * The canopy arch is retired from normal play.
 *
 * Drawing the whole frame left only ~29% of a landscape screen as sky, against
 * ~81% in portrait -- measured, and the reason "you can't see anything on
 * landscape". The artwork's own opening is barely a third of its area, so ANY
 * layout that shows the full canopy inherits that. Both orientations now show
 * the console band and give the rest of the screen to the view, with the
 * artwork's outer struts drawn down the screen edges so it still reads as
 * sitting inside a ship rather than as a HUD floating in space.
 *
 * Kept as a threshold rather than deleted: a very wide, short window still
 * wants slightly different treatment, and the value documents the decision.
 */
const CONSOLE_ASPECT = 99;
/** How much of the artwork's width is strut, drawn down each screen edge. */
const STRUT_SOURCE_WIDTH = 0.13;
/** Strut slice width as a fraction of the screen. */
const STRUT_SCREEN_WIDTH = 0.085;
/** Where the console band starts in the artwork -- just below the glass. */
const CONSOLE_TOP = 0.55;
/**
 * ...and where it ends.
 *
 * Cropped above the artwork's two corner radar dishes. Showing the full depth
 * of the console left only ~40% of a landscape screen as sky; stopping here
 * gives ~58%, which is the difference between being able to find a fight and
 * not. The dishes are no loss: the radar moves to the centre screen, where it
 * is large enough to actually read.
 */
const CONSOLE_BOTTOM = 0.86;
/**
 * ...but only in landscape.
 *
 * The crop exists to buy a landscape screen its sky. Portrait already had 81%
 * and does not need it -- and applying it there squeezed the band to 80px,
 * which put the missile button 7px from the bottom edge with a 22px radius and
 * left the radar 50px tall. Portrait keeps the full console depth.
 */
const CONSOLE_BOTTOM_PORTRAIT = 1.0;
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

/**
 * Where the weapon buttons sit on the canopy, as fractions of the artwork.
 *
 * The right shoulder of the console, checked against the art: clear panel
 * between the strut and the radar dish. They are drawn as machined bezels so
 * they read as part of the panel rather than as chrome floating over it.
 */
const BUTTON_ART = {
  guns: { x: 0.836, y: 0.676, r: 0.029 },
  missile: { x: 0.887, y: 0.745, r: 0.024 },
  // Warp sits on the LEFT shoulder, away from the weapons: it is a flight
  // control, and putting it under the trigger thumb would mean jumping to
  // lightspeed every time you meant to shoot.
  warp: { x: 0.163, y: 0.676, r: 0.029 },
} as const;
/**
 * Portrait cannot use those fractions. The band is drawn at 1.18x screen
 * width, which puts the right shoulder 18-36px from the edge -- too cramped
 * for a thumb, which needs about 44px. Portrait therefore places the buttons
 * at explicit screen positions instead, inset from the edge and larger.
 */
const CONSOLE_BUTTON_INSET = 46;
const CONSOLE_BUTTON_RADIUS = 27;
const CONSOLE_BUTTON_GAP = 66;

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
  /** The held lock. Marked distinctly, because it is the one the missile goes to. */
  locked?: boolean;
  /** An incoming seeker. Plotted small and red, and it flashes. */
  seeker?: boolean;
}

/** What the right screen says about the thing you are locked onto. */
export interface CockpitLock {
  label: string;
  /** World units. */
  range: number;
  /**
   * Closure, world units per second. POSITIVE means closing.
   *
   * Sign matters more than magnitude here: it is the difference between a
   * target you are catching and one that is leaving, which decides whether to
   * keep chasing at all.
   */
  closure: number;
  /** 0..1 for a capital ship; null for anything without a health readout. */
  health: number | null;
}

export type CockpitButtonId = 'guns' | 'missile' | 'warp';

/** A round console button: one circle, used for BOTH painting and hit-testing. */
export interface CockpitButton {
  id: CockpitButtonId;
  cx: number;
  cy: number;
  r: number;
}

export interface CockpitState {
  hull: number;
  hullMax: number;
  /** Forward shield bank, 0..1. */
  shieldFore: number;
  /** Aft shield bank, 0..1. Being tailed is what drains this one. */
  shieldAft: number;
  /** 0..1; at 1 the guns have slowed themselves down. */
  gunHeat: number;
  gunsFiring: boolean;
  /** 0..1 charge on the missile. */
  missileCharge: number;
  /** 0..1 warp coil heat. At 1 the drive cuts out until it cools. */
  warpHeat: number;
  warpEngaged: boolean;
  /** False while the coil is too hot to re-engage. */
  warpReady: boolean;
  throttle: number;
  /** Seekers still carrying your scent. Drives the inbound warning. */
  inbound: number;
  /** False while the flare dispenser is reloading. */
  flareReady: boolean;
  /** 0..1, or null when nothing is engaged. */
  bossHealth: number | null;
  bossLabel: string;
  /** Text for the main screen. */
  status: string;
  /** Short tilt state, shown so a tester can say which stage is failing. */
  tiltStatus: string;
  contacts: CockpitContact[];
  /** The held lock, or null. */
  lock: CockpitLock | null;
  /** 0..1 dwell toward a lock that has not been acquired yet. */
  lockProgress: number;
  /** Radar's outer ring, in world units. */
  radarRange: number;

  /**
   * The ship's own attitude, for the horizon.
   *
   * Elevation wraps a full turn now, so these are what tells the player they
   * are inverted. Before the loop existed, pitch was clamped to 76 degrees and
   * the panel had no reason to know either number.
   */
  pitch: number;
  roll: number;
  clock: number;
}

/** Where the cockpit puts the flight view on screen. */
export interface CockpitFrame {
  /** 'canopy' shows the whole frame; 'console' shows only the panel band. */
  mode: 'canopy' | 'console';
  /**
   * True when the band is overscanned wider than the screen.
   *
   * Buttons branch on THIS, not on `mode`. Both orientations render the
   * console band now, so branching on mode silently sent landscape down the
   * portrait path and parked the buttons at the screen edge instead of on the
   * artwork's shoulders -- where they had been carefully placed and where the
   * art actually has flat panel for them.
   */
  overscanned: boolean;
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
      overscanned: false,
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
    // Portrait wants the band wider than the screen so the instruments are
    // legible; a wide landscape screen does not -- overscanning there would
    // make the console taller than the view it is supposed to sit under.
    const portrait = w / h < 1;
    const overscan = portrait ? CONSOLE_OVERSCAN : 1;
    const bottom = portrait ? CONSOLE_BOTTOM_PORTRAIT : CONSOLE_BOTTOM;
    const artW = w * overscan;
    const artH = artW / ART_ASPECT;
    const artX = (w - artW) / 2;
    // Anchor the DRAWN edge, not the artwork's edge.
    //
    // The band is cropped at CONSOLE_BOTTOM, so anchoring the full art height
    // to the bottom of the screen left the missing 14% as a gap and the
    // console floated with sky both above and below it. Position it so the
    // cropped bottom lands where the console is meant to sit.
    const artY = h - CONSOLE_LIFT - bottom * artH;
    const bandH = (bottom - CONSOLE_TOP) * artH + CONSOLE_LIFT;
    return {
      mode: 'console',
      overscanned: portrait,
      cx: w / 2,
      // The view centre sits above the band, biased high so the reticle is not
      // buried in the panel on a very tall screen.
      cy: (h - bandH) * 0.46,
      aperture: { x: 0, y: 0, w, h: h - bandH },
      art: { x: artX, y: artY, w: artW, h: artH },
      source: { x: 0, y: ART_H * CONSOLE_TOP, w: ART_W, h: ART_H * (bottom - CONSOLE_TOP) },
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

  /**
   * Where the weapon buttons are, in screen pixels.
   *
   * This is the ONLY definition. Both the painter and the hit test call it, so
   * the circle you can see and the circle you can press cannot drift apart --
   * which is the classic way a touch control quietly stops working after a
   * layout change.
   */
  buttons(frame: CockpitFrame): CockpitButton[] {
    if (frame.overscanned) {
      const x = frame.aperture.w - CONSOLE_BUTTON_INSET;
      const base = frame.art.y + frame.art.h * 0.70;
      return [
        { id: 'guns', cx: x, cy: base, r: CONSOLE_BUTTON_RADIUS },
        { id: 'missile', cx: x, cy: base + CONSOLE_BUTTON_GAP, r: CONSOLE_BUTTON_RADIUS * 0.82 },
        { id: 'warp', cx: CONSOLE_BUTTON_INSET, cy: base, r: CONSOLE_BUTTON_RADIUS * 0.82 },
      ];
    }
    const { art } = frame;
    return (['guns', 'missile', 'warp'] as CockpitButtonId[]).map((id) => ({
      id,
      cx: art.x + BUTTON_ART[id].x * art.w,
      cy: art.y + BUTTON_ART[id].y * art.h,
      r: BUTTON_ART[id].r * art.w,
    }));
  }

  /**
   * Machined bezels, so they belong to the panel.
   *
   * @param held which button the player currently has a finger on
   */
  drawButtons(frame: CockpitFrame, state: CockpitState, held: ReadonlySet<CockpitButtonId>): void {
    const { ctx } = this;
    for (const button of this.buttons(frame)) {
      const isGuns = button.id === 'guns';
      const isWarp = button.id === 'warp';
      const down = held.has(button.id);
      // The missile needs BOTH charge and a lock, so the button says both.
      const ready = isGuns ? true : isWarp ? state.warpReady : (state.missileCharge >= 1 && state.lock !== null);
      const fill = isGuns ? state.gunHeat : isWarp ? state.warpHeat : state.missileCharge;

      ctx.save();
      ctx.translate(button.cx, button.cy);

      // Seat: a well cut INTO the panel, not a disc laid on top of it. The
      // outer ring is the shadowed cut line and the inner one the lit lip, in
      // the artwork's own red rather than a neutral grey that would read as UI.
      ctx.fillStyle = 'rgba(10,4,6,0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, button.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(2, button.r * 0.16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(196,74,74,0.55)';
      ctx.lineWidth = Math.max(1, button.r * 0.07);
      ctx.beginPath();
      ctx.arc(0, 0, button.r * 0.93, 0, Math.PI * 2);
      ctx.stroke();

      // The ring IS the readout: heat climbing on the guns, charge filling on
      // the missile. A separate gauge would be one more thing to look away at.
      if (fill > 0.01) {
        ctx.strokeStyle = isGuns
          ? (state.gunHeat > 0.75 ? RED : AMBER)
          : isWarp
            ? (state.warpHeat > 0.75 ? RED : '#a97bff')
            : (ready ? '#4fd8ff' : 'rgba(79,216,255,0.55)');
        ctx.lineWidth = Math.max(2, button.r * 0.16);
        ctx.beginPath();
        ctx.arc(0, 0, button.r * 0.80, -Math.PI / 2, -Math.PI / 2 + Math.min(1, fill) * Math.PI * 2);
        ctx.stroke();
      }

      // Face.
      ctx.globalAlpha = down ? 1 : 0.82;
      ctx.fillStyle = isGuns
        ? (down ? '#ff6a3d' : 'rgba(255,80,60,0.5)')
        : isWarp
          ? (ready ? (down ? '#c9a8ff' : 'rgba(169,123,255,0.55)') : 'rgba(90,110,130,0.45)')
          : (ready ? (down ? '#8fe9ff' : 'rgba(79,216,255,0.6)') : 'rgba(90,110,130,0.45)');
      ctx.beginPath();
      ctx.arc(0, 0, button.r * (down ? 0.52 : 0.58), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = down ? '#fff' : 'rgba(255,225,220,0.85)';
      ctx.font = `700 ${Math.max(6, button.r * 0.34)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isGuns ? 'GUN' : isWarp ? 'WARP' : 'MSL', 0, button.r * 0.02);
      ctx.restore();
    }
  }

  /** Draws everything that moves: radar, gauges, screens. */
  drawInstruments(frame: CockpitFrame, state: CockpitState): void {
    const { art } = frame;
    const px = (fx: number) => art.x + fx * art.w;
    const py = (fy: number) => art.y + fy * art.h;
    const pr = (fr: number) => fr * art.w;

    // The radar IS the main screen now. It used to be a 38px corner dish that
    // could show a dot but never a situation.
    this.drawRadar(px(ART.mainScreen.x), py(ART.mainScreen.y), pr(ART.mainScreen.w), ART.mainScreen.h * art.h, state);
    this.drawHullScreen(px(ART.leftScreen.x), py(ART.leftScreen.y), pr(ART.leftScreen.w), ART.leftScreen.h * art.h, state);
    this.drawTargetScreen(px(ART.rightScreen.x), py(ART.rightScreen.y), pr(ART.rightScreen.w), ART.rightScreen.h * art.h, state);
    // Drawn from `frame.aperture`, which BOTH layouts supply -- the canopy's
    // is measured off the artwork's alpha hole, the console's is the whole
    // area above the band. Keying it off `art` instead would put it on the
    // panel in one orientation and nowhere in the other.
    this.drawAttitude(frame, state);
    this.drawInbound(frame, state);
  }

  /**
   * The artificial horizon: the instrument the pitch clamp existed instead of.
   *
   * Elevation used to stop at 76 degrees, reasoned as "pitching past vertical
   * would invert the world with no horizon to tell you it had happened". That
   * is an argument for a horizon, not for a wall, and a phone test found the
   * wall the way players find walls -- by flying into it. So the nose is free
   * and this says which way is up.
   *
   * A real ADI: a ladder that slides DOWN as the nose comes up, rotated
   * opposite the bank so it stays level with the world while the ship banks
   * around it, against a fixed nose marker that never moves. Sky and ground
   * are tinted differently, which is what makes inverted readable at a glance
   * rather than something to work out from a number.
   */
  /**
   * The missile warning, and the state of the thing that answers it.
   *
   * Only on screen when something is actually inbound. A warning light that is
   * always lit is furniture; one that appears is information -- and this is the
   * only threat in the level a player cannot see coming by looking around,
   * because a seeker approaches from wherever it was launched.
   */
  private drawInbound(frame: CockpitFrame, state: CockpitState): void {
    if (state.inbound <= 0) return;
    const { ctx } = this;
    const { aperture } = frame;
    const size = Math.max(9, Math.min(aperture.w * 0.032, 17));
    const cx = aperture.x + aperture.w * 0.5;
    const cy = aperture.y + aperture.h * 0.17;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${size}px "Courier New", monospace`;
    // Flashing, because it is a warning. Steady red at the top of the view
    // reads as decoration inside about two seconds.
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(state.clock * 7));
    ctx.fillStyle = RED;
    ctx.fillText(state.inbound > 1 ? `MISSILE INBOUND x${state.inbound}` : 'MISSILE INBOUND', cx, cy);
    ctx.globalAlpha = 1;
    ctx.font = `${size * 0.8}px "Courier New", monospace`;
    ctx.fillStyle = state.flareReady ? 'rgba(79,216,255,0.85)' : 'rgba(150,160,175,0.7)';
    ctx.fillText(state.flareReady ? 'FLARES READY' : 'FLARES RELOADING', cx, cy + size * 1.3);
    ctx.restore();
  }

  private drawAttitude(frame: CockpitFrame, state: CockpitState): void {
    const { ctx } = this;
    const { aperture } = frame;
    // Sits low in the view so it never fights the reticle or a target bracket.
    const size = Math.min(aperture.w * 0.19, aperture.h * 0.34);
    if (size < 26) return;
    const cx = aperture.x + aperture.w * 0.5;
    const cy = aperture.y + aperture.h - size * 0.72;
    const r = size * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.save();
    ctx.translate(cx, cy);
    // Opposite the camera roll: the world stays level, the ship banks past it.
    ctx.rotate(-state.roll);
    // sin() rather than the raw angle, so the ladder eases to a stop at the
    // vertical and comes back the other way through a loop instead of running
    // off and snapping when the angle wraps.
    const slide = Math.sin(state.pitch) * r * 1.15;
    // Past vertical the ground is overhead. This is the whole point of the
    // instrument, so it is a real state and not a special case.
    const inverted = Math.cos(state.pitch) < 0;
    ctx.fillStyle = inverted ? 'rgba(90,40,20,0.55)' : 'rgba(20,50,90,0.55)';
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 2 + slide);
    ctx.fillStyle = inverted ? 'rgba(20,50,90,0.55)' : 'rgba(90,40,20,0.55)';
    ctx.fillRect(-r * 2, slide, r * 4, r * 2);

    ctx.strokeStyle = inverted ? 'rgba(255,150,90,0.95)' : 'rgba(120,220,255,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 1.6, slide);
    ctx.lineTo(r * 1.6, slide);
    ctx.stroke();

    // Ladder rungs, so rate of change is visible and not just position.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(190,225,245,0.5)';
    for (const step of [-2, -1, 1, 2]) {
      const y = slide + step * r * 0.42;
      const half = step % 2 === 0 ? r * 0.5 : r * 0.28;
      ctx.beginPath();
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // Bezel and the fixed nose marker, OUTSIDE the clip and the rotation:
    // the ship's own reference does not move, which is what everything else is
    // read against.
    ctx.save();
    ctx.strokeStyle = 'rgba(150,190,215,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.42, cy);
    ctx.lineTo(cx - r * 0.14, cy);
    ctx.moveTo(cx + r * 0.14, cy);
    ctx.lineTo(cx + r * 0.42, cy);
    ctx.moveTo(cx, cy - r * 0.1);
    ctx.lineTo(cx, cy + r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The 360 degree plan radar, on the biggest screen in the panel.
   *
   * Your nose is always at the top; a contact drawn at the BOTTOM is directly
   * behind you. Range sets distance from the middle, so the ring you are
   * inside tells you how close something is.
   *
   * This was a 38-pixel corner dish. At that size it could show that something
   * existed but never where, which in open space is most of what you need to
   * know -- so it moves here, where it is readable.
   */
  private drawRadar(x: number, y: number, w: number, h: number, state: CockpitState): void {
    const { ctx } = this;
    if (w < 40) return;
    const cx = x + w / 2;
    const cy = y + h * 0.52;
    const r = Math.min(w * 0.42, h * 0.42);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(2,10,4,0.82)';
    ctx.fillRect(x, y, w, h);

    // Range rings.
    ctx.strokeStyle = 'rgba(0,255,106,0.28)';
    ctx.lineWidth = 1;
    for (const ring of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Cardinals, relative to the nose.
    ctx.fillStyle = 'rgba(0,255,106,0.55)';
    ctx.font = `${Math.max(6, r * 0.17)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - r - r * 0.14);
    ctx.fillText('S', cx, cy + r + r * 0.14);
    ctx.fillText('E', cx + r + r * 0.14, cy);
    ctx.fillText('W', cx - r - r * 0.14, cy);

    // Sweep, so a radar with nothing on it still looks alive.
    const sweep = (state.clock * 1.1) % (Math.PI * 2);
    const grad = ctx.createConicGradient?.(sweep - Math.PI / 2, cx, cy);
    if (grad) {
      grad.addColorStop(0, 'rgba(0,255,106,0.22)');
      grad.addColorStop(0.1, 'rgba(0,255,106,0)');
      grad.addColorStop(1, 'rgba(0,255,106,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const contact of state.contacts) {
      const t = Math.min(1, contact.range / state.radarRange);
      if (t >= 1) continue;
      const px = cx + Math.sin(contact.bearing) * t * r;
      const py = cy - Math.cos(contact.bearing) * t * r;
      const size = contact.capital ? Math.max(3.4, r * 0.09) : Math.max(2.2, r * 0.045);
      ctx.save();
      // A seeker flashes. It is smaller than a fighter and it is the one blip
      // on here that is going to hit you if you do nothing about it, so it has
      // to be the one that catches the eye rather than the one that hides.
      if (contact.seeker) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(state.clock * 9));
      ctx.fillStyle = contact.capital ? AMBER : RED;
      ctx.beginPath();
      ctx.arc(px, py, contact.seeker ? size * 0.8 : size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The lock gets a ring, not a colour. Colour already carries capital vs
      // fighter here, and stacking a second meaning on it would lose one.
      if (contact.locked) {
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = Math.max(1, size * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, size * 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Above or below gets an arrow, because a plan radar alone cannot say so
      // and out here a contact really can be directly over your head.
      if (Math.abs(contact.elevation) > 0.25) {
        const up = contact.elevation > 0;
        const a = size * 2.1;
        ctx.beginPath();
        ctx.moveTo(px + size * 1.7, py + (up ? a : -a));
        ctx.lineTo(px + size * 1.7 - size * 0.9, py + (up ? -a * 0.1 : a * 0.1));
        ctx.lineTo(px + size * 1.7 + size * 0.9, py + (up ? -a * 0.1 : a * 0.1));
        ctx.closePath();
        ctx.fill();
      }
    }

    // You, at the middle, always pointing up.
    ctx.fillStyle = '#00ff6a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.13);
    ctx.lineTo(cx + r * 0.08, cy + r * 0.07);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.07);
    ctx.closePath();
    ctx.fill();

    // Footer, the way the reference lays it out.
    ctx.fillStyle = 'rgba(0,255,106,0.6)';
    ctx.font = `${Math.max(5, w * 0.045)}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`RNG ${(state.radarRange / 1000).toFixed(1)}k`, x + w * 0.04, y + h * 0.93);
    ctx.textAlign = 'right';
    ctx.fillText(`CONTACTS ${state.contacts.length}`, x + w * 0.96, y + h * 0.93);
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
    ctx.textBaseline = 'alphabetic';
    const label = Math.max(5, w * 0.085);

    const bar = (row: number, name: string, value: number, colour: string) => {
      const by = y + h * row;
      ctx.fillStyle = 'rgba(255,45,61,0.62)';
      ctx.font = `${label}px "Courier New", monospace`;
      ctx.fillText(name, x + w * 0.07, by + h * 0.09);
      const bx = x + w * 0.30;
      const bw = w * 0.62;
      const bh = Math.max(3, h * 0.11);
      ctx.fillStyle = 'rgba(120,30,40,0.32)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = colour;
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, value)), bh);
    };

    // Shields first: they are what you lose before it starts to matter.
    bar(0.13, 'FWD', state.shieldFore, state.shieldFore > 0.25 ? CYAN : AMBER);
    bar(0.38, 'AFT', state.shieldAft, state.shieldAft > 0.25 ? CYAN : AMBER);

    // Hull as discrete segments -- a bar would let you ignore losing one.
    ctx.fillStyle = 'rgba(255,45,61,0.62)';
    ctx.font = `${label}px "Courier New", monospace`;
    ctx.fillText('HULL', x + w * 0.07, y + h * 0.72);
    const segments = state.hullMax;
    const segW = (w * 0.62) / segments;
    for (let i = 0; i < segments; i += 1) {
      const lit = i < state.hull;
      ctx.fillStyle = lit ? (state.hull <= 2 ? RED : AMBER) : 'rgba(120,30,40,0.3)';
      ctx.fillRect(x + w * 0.30 + i * segW, y + h * 0.63, segW * 0.74, h * 0.11);
    }

    // This corner used to read ROLL RDY. The roll is gone and the double-tap it
    // was bound to is the trigger now, so the space says what the gesture does
    // -- a control that changed under the player needs telling, once, where
    // they are already looking.
    ctx.fillStyle = state.gunsFiring ? 'rgba(79,216,255,0.9)' : 'rgba(120,140,160,0.55)';
    ctx.font = `${Math.max(5, w * 0.075)}px "Courier New", monospace`;
    ctx.fillText(state.gunsFiring ? 'FIRING' : '2x TAP = GUNS', x + w * 0.07, y + h * 0.93);
    ctx.restore();
  }

  /**
   * The right screen: what the ship is doing, and anything urgent.
   *
   * It absorbed the old centre screen's readouts when the radar took that slot
   * -- boss health during a fight, and tilt state the rest of the time, which
   * is what tells a tester whether the sensor is live at all.
   */
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
    ctx.textBaseline = 'alphabetic';
    const label = Math.max(5, w * 0.085);

    // Priority: the lock, then the boss, then tilt. A player with a target
    // held wants to know about THAT; tilt state is a setup readout and only
    // earns the screen when nothing is happening.
    if (state.lock) {
      ctx.fillStyle = CYAN;
      ctx.font = `700 ${label}px "Courier New", monospace`;
      ctx.fillText(state.lock.label.slice(0, 16), x + w * 0.07, y + h * 0.2);
      ctx.font = `${label}px "Courier New", monospace`;
      ctx.fillStyle = 'rgba(79,216,255,0.8)';
      const km = (state.lock.range / 1000).toFixed(1);
      // Closing or opening, said in a word. The sign is the decision.
      const closing = state.lock.closure >= 0;
      ctx.fillText(`${km}k ${closing ? 'CLOSING' : 'OPENING'}`, x + w * 0.07, y + h * 0.36);
      if (state.lock.health !== null) {
        ctx.fillStyle = 'rgba(120,30,40,0.32)';
        ctx.fillRect(x + w * 0.07, y + h * 0.41, w * 0.86, Math.max(3, h * 0.1));
        ctx.fillStyle = RED;
        ctx.fillRect(x + w * 0.07, y + h * 0.41, w * 0.86 * state.lock.health, Math.max(3, h * 0.1));
      }
    } else if (state.bossHealth !== null) {
      ctx.fillStyle = RED;
      ctx.font = `700 ${label}px "Courier New", monospace`;
      ctx.fillText(state.bossLabel.slice(0, 16), x + w * 0.07, y + h * 0.2);
      ctx.fillStyle = 'rgba(120,30,40,0.32)';
      ctx.fillRect(x + w * 0.07, y + h * 0.27, w * 0.86, Math.max(3, h * 0.12));
      ctx.fillStyle = RED;
      ctx.fillRect(x + w * 0.07, y + h * 0.27, w * 0.86 * state.bossHealth, Math.max(3, h * 0.12));
    } else if (state.lockProgress > 0.02) {
      // Dwelling. Showing the acquisition as it happens is what tells you the
      // lock is a thing you DO rather than something that occasionally occurs.
      ctx.fillStyle = 'rgba(79,216,255,0.75)';
      ctx.font = `${label}px "Courier New", monospace`;
      ctx.fillText('ACQUIRING', x + w * 0.07, y + h * 0.2);
      ctx.fillStyle = 'rgba(20,60,80,0.5)';
      ctx.fillRect(x + w * 0.07, y + h * 0.27, w * 0.86, Math.max(3, h * 0.1));
      ctx.fillStyle = CYAN;
      ctx.fillRect(x + w * 0.07, y + h * 0.27, w * 0.86 * state.lockProgress, Math.max(3, h * 0.1));
    } else {
      ctx.fillStyle = state.tiltStatus === 'READY' ? 'rgba(79,216,255,0.85)' : AMBER;
      ctx.font = `${label}px "Courier New", monospace`;
      ctx.fillText(`TILT ${state.tiltStatus}`, x + w * 0.07, y + h * 0.24);
    }

    // Throttle: the control the whole rescale exists to make worth having.
    ctx.fillStyle = 'rgba(255,45,61,0.62)';
    ctx.font = `${label}px "Courier New", monospace`;
    ctx.fillText(`THR ${Math.round(state.throttle * 100)}%`, x + w * 0.07, y + h * 0.58);
    ctx.fillStyle = 'rgba(120,30,40,0.32)';
    ctx.fillRect(x + w * 0.07, y + h * 0.65, w * 0.86, Math.max(3, h * 0.12));
    ctx.fillStyle = state.throttle > 0.85 ? '#ff8a3d' : AMBER;
    ctx.fillRect(x + w * 0.07, y + h * 0.65, w * 0.86 * state.throttle, Math.max(3, h * 0.12));

    const hostiles = state.contacts.filter((c) => c.hostile).length;
    ctx.fillStyle = 'rgba(255,45,61,0.6)';
    ctx.font = `${Math.max(5, w * 0.075)}px "Courier New", monospace`;
    ctx.fillText(`CONTACTS ${hostiles}`, x + w * 0.07, y + h * 0.93);
    ctx.restore();
  }
}
