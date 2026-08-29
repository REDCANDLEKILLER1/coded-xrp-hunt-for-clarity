/**
 * The 3D of this segment, in one file.
 *
 * There is no 3D engine here and no 3D art. The camera has a position and an
 * orientation in open space; every contact carries a world position; a rotation
 * turns world space into view space and a perspective divide turns that into a
 * screen position and a scale. A sprite drawn at `size * scale` grows as it
 * closes, and growth is what the eye reads as approach -- the same trick the
 * arcade flight games ran on hardware that could not do polygons either.
 *
 * The camera turns, which is what makes this open space rather than a lane.
 * There is no up and no down out here: yaw and pitch are free, contacts exist
 * all the way around you, and a target you fly past ends up BEHIND the camera
 * rather than off the end of a track. That case is the one worth reading
 * carefully -- see `toView`.
 *
 * Keeping the maths here rather than inline in the renderer means it is
 * testable without a canvas, which is how the behind-the-camera and
 * near-plane cases get checked at all.
 */

export interface Camera {
  /** Position in open space. */
  x: number;
  y: number;
  z: number;
  /** Heading, radians. 0 looks down +z; positive turns right. */
  yaw: number;
  /** Elevation, radians. Positive looks up. */
  pitch: number;
  /** Roll, radians, applied to the projected plane. */
  roll: number;
  /** Half-width and half-height of the viewport, in pixels. */
  cx: number;
  cy: number;
  /** Distance from the eye to the screen plane, in pixels. */
  focal: number;
}

export interface Projected {
  sx: number;
  sy: number;
  /** Pixels per world unit at this depth. */
  scale: number;
  /** False when the point is at or behind the near plane and must not be drawn. */
  visible: boolean;
  /** Distance along the view axis. Negative means the point is behind you. */
  depth: number;
}

/** View-space coordinates: +x right, +y down, +z forward along the look axis. */
export interface ViewPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Closer than this and the divide explodes: scale runs to infinity and a
 * sprite fills the screen for one frame before it is culled. Everything is
 * culled at the near plane instead.
 */
export const NEAR_PLANE = 30;
/**
 * Past this a contact is too small to be worth a draw call -- but it still exists.
 *
 * Pushed out with the rest of the scale. Contacts are engaged from thousands
 * of units away now, and a far plane closer than the spawn range would simply
 * refuse to draw the approach that the whole rescale exists to give you.
 */
export const FAR_PLANE = 12000;

/**
 * World space into view space: translate to the eye, then unrotate by the
 * camera's heading and elevation.
 *
 * The result's `z` is signed, and the sign is load-bearing. A contact you have
 * flown past has negative z, and a perspective divide by a negative depth
 * projects it back onto the screen MIRRORED -- an enemy behind you drawn as a
 * ghost in front of you. Callers must check the sign (or use `project`, which
 * does) rather than trusting the screen coordinates.
 */
export function toView(camera: Camera, x: number, y: number, z: number): ViewPoint {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const dz = z - camera.z;

  // Undoing a heading of theta is NOT a rotation by -theta here: the forward
  // vector is (sin, cos) rather than (cos, sin), so the inverse map that takes
  // the nose to +z carries +theta. Negating it silently flips left and right,
  // which reads as a working game where every turn goes the wrong way.
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const rx = dx * cosYaw - dz * sinYaw;
  const rz = dx * sinYaw + dz * cosYaw;

  const cosPitch = Math.cos(-camera.pitch);
  const sinPitch = Math.sin(-camera.pitch);
  const ry = dy * cosPitch - rz * sinPitch;
  const fz = dy * sinPitch + rz * cosPitch;

  return { x: rx, y: ry, z: fz };
}

export function project(camera: Camera, x: number, y: number, z: number): Projected {
  const view = toView(camera, x, y, z);
  if (view.z <= NEAR_PLANE) return { sx: 0, sy: 0, scale: 0, visible: false, depth: view.z };
  const scale = camera.focal / view.z;
  let dx = view.x * scale;
  let dy = view.y * scale;
  if (camera.roll !== 0) {
    const cos = Math.cos(camera.roll);
    const sin = Math.sin(camera.roll);
    const rx = dx * cos - dy * sin;
    dy = dx * sin + dy * cos;
    dx = rx;
  }
  return { sx: camera.cx + dx, sy: camera.cy + dy, scale, visible: true, depth: view.z };
}

/**
 * How much of the screen a hull of this world size covers at this view depth.
 * Used for both drawing and hit tests, so what you see is what you can hit.
 */
export function screenSize(camera: Camera, worldSize: number, depth: number): number {
  if (depth <= NEAR_PLANE) return 0;
  return (worldSize * camera.focal) / depth;
}

/**
 * Where a contact sits on a 360 degree radar, relative to where you are
 * pointing. Returns radians: 0 is dead ahead, +/-PI is directly behind.
 *
 * Free flight is unplayable without this. In a lane everything worth shooting
 * is in front of you by construction; out here half the traffic can be behind
 * your shoulder, and the radar is the only thing that says so.
 */
export function bearing(view: ViewPoint): number {
  return Math.atan2(view.x, view.z);
}

/** Straight-line distance from the eye, sign-free. */
export function rangeTo(view: ViewPoint): number {
  return Math.hypot(view.x, view.y, view.z);
}

/**
 * Fog by distance. Far contacts wash toward the backdrop instead of popping in
 * at full contrast, which is the second depth cue after scale.
 */
export function depthAlpha(depth: number): number {
  if (depth <= NEAR_PLANE) return 0;
  if (depth >= FAR_PLANE) return 0;
  const t = 1 - (depth - NEAR_PLANE) / (FAR_PLANE - NEAR_PLANE);
  // Ease in, so the far half stays faint and the near quarter is solid.
  //
  // The multiplier is tied to the far plane. At 2.6 it was tuned for a 4200
  // plane; against the rescaled 12000 it saturated at 1 for everything inside
  // 2000 units, so nothing read as distant any more and the depth cue died
  // silently. Distance has to keep costing contrast all the way out.
  return Math.min(1, t * t * 1.15);
}

/**
 * Painter's algorithm: far things first, near things over them.
 * Sorting is what stops a distant fighter drawing on top of the warship.
 */
export function sortByDepth<T extends { depth: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.depth - a.depth);
}

/**
 * True when a projected point falls inside the viewport, with a margin.
 * Off-screen contacts still update -- a fighter that stops existing when it
 * leaves the frame cannot come back around behind you, which out here is the
 * whole point.
 */
export function onScreen(camera: Camera, p: Projected, margin: number): boolean {
  if (!p.visible) return false;
  return p.sx > -margin && p.sx < camera.cx * 2 + margin && p.sy > -margin && p.sy < camera.cy * 2 + margin;
}

/** Wraps an angle into -PI..PI, so heading arithmetic never walks off. */
export function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/** The camera's forward unit vector, for thrust and for aiming. */
export function forward(camera: Camera): { x: number; y: number; z: number } {
  const cosPitch = Math.cos(camera.pitch);
  return {
    x: Math.sin(camera.yaw) * cosPitch,
    y: -Math.sin(camera.pitch),
    z: Math.cos(camera.yaw) * cosPitch,
  };
}
