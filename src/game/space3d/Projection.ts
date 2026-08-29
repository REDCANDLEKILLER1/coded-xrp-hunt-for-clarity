/**
 * The whole 3D of this segment, in one file.
 *
 * There is no 3D engine here and no 3D art. The camera sits at the origin
 * looking down +z; every object carries a depth, and a perspective divide turns
 * that depth into a screen position and a scale. A sprite drawn at `size *
 * scale` grows as it closes, and growth is what the eye reads as approach --
 * the same trick Afterburner and Star Fox ran on hardware that could not do
 * polygons either.
 *
 * Keeping it here rather than inline in the renderer means the maths is
 * testable without a canvas, which is how the near-plane and horizon cases get
 * checked at all.
 */

export interface Camera {
  /** Lateral and vertical offset of the eye, in world units. */
  x: number;
  y: number;
  /** Half-width and half-height of the viewport, in pixels. */
  cx: number;
  cy: number;
  /**
   * Focal length in pixels: the distance from the eye to the screen plane.
   * Larger is a longer lens -- less dramatic approach, flatter field.
   */
  focal: number;
  /** Roll, in radians. Applied to the projected plane so the horizon banks. */
  roll: number;
}

export interface Projected {
  sx: number;
  sy: number;
  /** Pixels per world unit at this depth. */
  scale: number;
  /** False when the point is at or behind the near plane and must not be drawn. */
  visible: boolean;
}

/**
 * Closer than this and the divide explodes: scale runs to infinity and a
 * sprite fills the screen for one frame before it is culled. Everything is
 * culled at the near plane instead.
 */
export const NEAR_PLANE = 30;
/** Where objects enter. Past this they are too small to be worth a draw call. */
export const FAR_PLANE = 1500;

export function project(camera: Camera, x: number, y: number, z: number): Projected {
  if (z <= NEAR_PLANE) return { sx: 0, sy: 0, scale: 0, visible: false };
  const scale = camera.focal / z;
  let dx = (x - camera.x) * scale;
  let dy = (y - camera.y) * scale;
  if (camera.roll !== 0) {
    const cos = Math.cos(camera.roll);
    const sin = Math.sin(camera.roll);
    const rx = dx * cos - dy * sin;
    dy = dx * sin + dy * cos;
    dx = rx;
  }
  return { sx: camera.cx + dx, sy: camera.cy + dy, scale, visible: true };
}

/**
 * How much of the screen a hull of this world size covers at this depth.
 * Used for both drawing and hit tests, so what you see is what you can hit.
 */
export function screenSize(camera: Camera, worldSize: number, z: number): number {
  if (z <= NEAR_PLANE) return 0;
  return (worldSize * camera.focal) / z;
}

/**
 * Fog by distance. Far contacts wash toward the backdrop instead of popping in
 * at full contrast, which is the second depth cue after scale and costs one
 * multiply.
 */
export function depthAlpha(z: number): number {
  if (z <= NEAR_PLANE) return 0;
  if (z >= FAR_PLANE) return 0;
  const t = 1 - (z - NEAR_PLANE) / (FAR_PLANE - NEAR_PLANE);
  // Ease in, so the far half of the lane stays faint and the near quarter is solid.
  return Math.min(1, t * t * 1.9);
}

/**
 * Painter's algorithm: far things first, near things over them.
 * Sorting is what stops a distant fighter drawing on top of the boss.
 */
export function sortByDepth<T extends { z: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.z - a.z);
}

/**
 * True when a world point projects inside the viewport, with a margin in
 * screen pixels. Off-screen contacts still update -- a flanker that stops
 * existing when it leaves the frame cannot come back down the flank.
 */
export function onScreen(camera: Camera, p: Projected, margin: number): boolean {
  if (!p.visible) return false;
  return p.sx > -margin && p.sx < camera.cx * 2 + margin && p.sy > -margin && p.sy < camera.cy * 2 + margin;
}
