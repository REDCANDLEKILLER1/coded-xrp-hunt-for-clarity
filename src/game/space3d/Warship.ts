import { forward, toView, type Camera, type ViewPoint } from './Projection';

/** One meter adapter for geometry-derived attachments and the gameplay hull. */
export const WARSHIP_UNITS_PER_METER = 3;
export const WARSHIP_LENGTH_METERS = 119.9968;
export const WARSHIP_ASSET = 'captured_warship';
export const WARSHIP_FRAMES = 3;
export const WARSHIP_FRAME_WIDTH = 512;
export const WARSHIP_FRAME_HEIGHT = 384;
export const WARSHIP_REVEAL_SECONDS = 3.8;
export const WARSHIP_AIM_DISTANCE = 1800;
// Blender meters, audited v03 node contract. Nose -Y; port +X; up +Z.
export const WARSHIP_NODES = {
  Ship_Origin: [0, 0, 0],
  Muzzle_FL: [15.1525, -36.05, 9.5], Muzzle_FR: [-15.1525, -36.05, 9.5],
  Muzzle_L: [24.035, 6.95, 10.3], Muzzle_R: [-24.035, 6.95, 10.3],
  Engine_L: [8, 57.1, 0], Engine_R: [-8, 57.1, 0],
  Camera_Chase: [0, 185, 76], Camera_Cockpit_Forward: [0, -13, 15.3],
} as const;
export type Hardpoint = 'Muzzle_FL' | 'Muzzle_FR' | 'Muzzle_L' | 'Muzzle_R';
export const BATTERY_PAIRS: readonly (readonly Hardpoint[])[] = [
  ['Muzzle_FL', 'Muzzle_FR'], ['Muzzle_L', 'Muzzle_R'],
];

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

export function batteryShot(camera: Camera, hardpoint: Hardpoint) {
  const origin = nodePosition(camera, hardpoint), nose = forward(camera);
  const target = {
    x: camera.x + nose.x * WARSHIP_AIM_DISTANCE,
    y: camera.y + nose.y * WARSHIP_AIM_DISTANCE,
    z: camera.z + nose.z * WARSHIP_AIM_DISTANCE,
  };
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const length = Math.hypot(dx, dy, dz);
  return {
    origin, direction: { x: dx / length, y: dy / length, z: dz / length },
    target, hardpoint,
  };
}

/** Tight, forgiving central hull ellipsoid; the wide blade tips are not a tax. */
export const WARSHIP_HIT_RADII_METERS = { x: 8, y: 5, z: 30 };
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
