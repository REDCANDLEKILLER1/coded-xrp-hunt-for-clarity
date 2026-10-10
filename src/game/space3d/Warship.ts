import { forward, toView, type Camera, type ViewPoint } from './Projection';

/**
 * Captured warship: departure-reveal presentation constants.
 *
 * Salvaged from PR #122. Presentation only: the 3.8 s arrival reveal that
 * names the captured vessel, drawn from the v03 Blender exterior atlas.
 * Battery, heat, and combat systems are deliberately not part of this
 * module (owner ruling: keep heat management).
 */
export const WARSHIP_ASSET = 'captured_warship';
export const WARSHIP_FRAMES = 3;
export const WARSHIP_FRAME_WIDTH = 512;
export const WARSHIP_FRAME_HEIGHT = 384;
/** How long the departure reveal runs before the reticle and attitude return. */
export const WARSHIP_REVEAL_SECONDS = 3.8;

/**
 * Swept hull collision (PR #122 salvage, additive stage).
 *
 * One-meter adapter for the gameplay hull. The muzzle hardpoints from the
 * PR's audited node contract are omitted: the battery was not salvaged.
 * Only the origin and camera nodes needed by the hull test are kept.
 */
export const WARSHIP_UNITS_PER_METER = 3;
// Blender meters, audited v03 node contract. Nose -Y; port +X; up +Z.
export const WARSHIP_NODES = {
  Ship_Origin: [0, 0, 0],
  Camera_Chase: [0, 185, 76], Camera_Cockpit_Forward: [0, -13, 15.3],
} as const;

/** Local right/down/forward into world, inverse of projection including bank. */
export function shipOffset(camera: Camera, p: ViewPoint): ViewPoint {
  const cr = Math.cos(camera.roll), sr = Math.sin(camera.roll);
  const x = p.x * cr + p.y * sr, y = -p.x * sr + p.y * cr;
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  const upY = y * cp - p.z * sp, z = y * sp + p.z * cp;
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  return { x: x * cy + z * sy, y: upY, z: -x * sy + z * cy };
}

export function nodePosition(camera: Camera, name: keyof typeof WARSHIP_NODES): ViewPoint {
  const node = WARSHIP_NODES[name], eye = WARSHIP_NODES.Camera_Cockpit_Forward;
  const offset = shipOffset(camera, {
    x: -(node[0] - eye[0]) * WARSHIP_UNITS_PER_METER,
    y: -(node[2] - eye[2]) * WARSHIP_UNITS_PER_METER,
    z: -(node[1] - eye[1]) * WARSHIP_UNITS_PER_METER,
  });
  return { x: camera.x + offset.x, y: camera.y + offset.y, z: camera.z + offset.z };
}

/** Tight, forgiving central hull ellipsoid; the wide blade tips are not a tax. */
export const WARSHIP_HIT_RADII_METERS = { x: 8, y: 5, z: 30 };
/**
 * Swept segment vs hull ellipsoid. Catches fast projectiles that tunnel past
 * point checks between frames. Additive: existing proximity checks keep
 * working exactly as before; this only adds hits they miss.
 */
export function hitsWarship(camera: Camera, from: ViewPoint, to: ViewPoint, padding = 0): boolean {
  const center = nodePosition(camera, 'Ship_Origin');
  const localCamera = { ...camera, x: center.x, y: center.y, z: center.z };
  const local = (p: ViewPoint) => {
    const v = toView(localCamera, p.x, p.y, p.z);
    const c = Math.cos(camera.roll), s = Math.sin(camera.roll);
    const radius = WARSHIP_HIT_RADII_METERS;
    return {
      x: (v.x * c - v.y * s) / (radius.x * WARSHIP_UNITS_PER_METER + padding),
      y: (v.x * s + v.y * c) / (radius.y * WARSHIP_UNITS_PER_METER + padding),
      z: v.z / (radius.z * WARSHIP_UNITS_PER_METER + padding),
    };
  };
  const a = local(from), b = local(to);
  const d = { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z };
  const length = d.x*d.x + d.y*d.y + d.z*d.z;
  const t = length > 0
    ? Math.max(0, Math.min(1, -(a.x*d.x + a.y*d.y + a.z*d.z) / length))
    : 0;
  return (a.x+t*d.x)**2 + (a.y+t*d.y)**2 + (a.z+t*d.z)**2 <= 1;
}

/**
 * Envelope clamp for the additive swept stage.
 *
 * The hull ellipsoid is capital-ship geometry: centred ~60 units from the
 * cockpit camera with a 90-unit half-length, it reaches far past the
 * camera-centric proximity thresholds the combat rules are built on (seeker
 * 60, bolt 46). An unclamped swept test therefore turns "inside the hull
 * volume" into a hit for objects the primary rules explicitly reject --
 * including stationary ones, which can never be tunneling between frames.
 *
 * This keeps the additive stage honest: the swept test may only convert a
 * miss into a hit when the projectile's segment came within the existing
 * threshold of the camera this frame, i.e. when discrete sampling is the
 * only reason the point check missed it. The stage can never extend the
 * effective range of any combat rule.
 */
export function segmentWithinRange(camera: Camera, from: ViewPoint, to: ViewPoint, range: number): boolean {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  let px = from.x, py = from.y, pz = from.z;
  if (len2 > 0) {
    const t = Math.max(0, Math.min(1,
      ((camera.x - from.x) * dx + (camera.y - from.y) * dy + (camera.z - from.z) * dz) / len2));
    px = from.x + t * dx; py = from.y + t * dy; pz = from.z + t * dz;
  }
  const ox = px - camera.x, oy = py - camera.y, oz = pz - camera.z;
  return ox * ox + oy * oy + oz * oz <= range * range;
}
