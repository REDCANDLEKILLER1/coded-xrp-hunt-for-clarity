// Locations.ts — contextual arena definitions for the turn-based system.
//
// Pure data: no DOM, no Three.js. Arena.ts renders these; the validator
// checks structural invariants (props stay clear of the combat circle).
//
// Design rule (per owner): the room must match the fight. A bridge fight
// looks like a bridge; a lunar base fight looks like a lunar base.
// No generic rooms.

export interface PropSpec {
  kind: 'console' | 'pillar' | 'crate' | 'arch' | 'tank';
  /** Arena-plane position. */
  x: number;
  z: number;
  /** Dimensions. */
  w: number;
  h: number;
  d: number;
  color: number;
  /** Glowing trim color, 0 = none. */
  emissive?: number;
}

export interface ArenaLocation {
  id: string;
  name: string;
  /** Scene background. */
  background: number;
  /** Fog color + density for depth mood. */
  fogColor: number;
  fogDensity: number;
  floorColor: number;
  ambientColor: number;
  ambientIntensity: number;
  keyLightColor: number;
  keyLightIntensity: number;
  /** Accent color for props / UI trim. */
  accentColor: number;
  /** Ring colors for the painted range bands (melee/short/long). */
  ringColors: [string, string, string];
  props: PropSpec[];
}

/**
 * Minimum distance from arena center for any prop. Keeps the combat
 * circle (radius ~7) clear so movement and range bands stay readable.
 */
export const PROP_CLEAR_RADIUS = 9.5;

/** Warship bridge: dark metallic, blue command accents, dim + focused light. */
export const WARSHIP_BRIDGE: ArenaLocation = {
  id: 'warship_bridge',
  name: 'Warship Bridge',
  background: 0x070c16,
  fogColor: 0x070c16,
  fogDensity: 0.012,
  floorColor: 0x141b2a,
  ambientColor: 0x4a5f8a,
  ambientIntensity: 0.55,
  keyLightColor: 0xbcd2ff,
  keyLightIntensity: 1.6,
  accentColor: 0x2a7fff,
  ringColors: ['#ff5a5a', '#ffb84d', '#5ad1ff'],
  props: [
    { kind: 'console', x: -11, z: -6, w: 3.2, h: 1.4, d: 1.2, color: 0x1c2740, emissive: 0x2a7fff },
    { kind: 'console', x: 11, z: -6, w: 3.2, h: 1.4, d: 1.2, color: 0x1c2740, emissive: 0x2a7fff },
    { kind: 'console', x: -11, z: 6, w: 3.2, h: 1.4, d: 1.2, color: 0x1c2740, emissive: 0x2a7fff },
    { kind: 'console', x: 11, z: 6, w: 3.2, h: 1.4, d: 1.2, color: 0x1c2740, emissive: 0x2a7fff },
    { kind: 'pillar', x: 0, z: -12, w: 1.6, h: 7, d: 1.6, color: 0x232f4a, emissive: 0x2a7fff },
    { kind: 'arch', x: 0, z: 12.5, w: 8, h: 5.5, d: 1.2, color: 0x1a2338 },
    { kind: 'tank', x: -12.5, z: 0, w: 2, h: 3.4, d: 2, color: 0x101827, emissive: 0x1a5fd0 },
    { kind: 'tank', x: 12.5, z: 0, w: 2, h: 3.4, d: 2, color: 0x101827, emissive: 0x1a5fd0 },
  ],
};

/** Lunar base interior: grey industrial, harsh white light, sterile. */
export const LUNAR_BASE: ArenaLocation = {
  id: 'lunar_base',
  name: 'Lunar Base Interior',
  background: 0x111318,
  fogColor: 0x111318,
  fogDensity: 0.008,
  floorColor: 0x3a3d44,
  ambientColor: 0xd8dce4,
  ambientIntensity: 0.85,
  keyLightColor: 0xffffff,
  keyLightIntensity: 2.4,
  accentColor: 0xffb84d,
  ringColors: ['#ff5a5a', '#ff8a3d', '#7dffce'],
  props: [
    { kind: 'crate', x: -11, z: -7, w: 2.4, h: 2.4, d: 2.4, color: 0x4a4e57 },
    { kind: 'crate', x: -11, z: -4, w: 1.8, h: 1.8, d: 1.8, color: 0x555a64 },
    { kind: 'crate', x: 11, z: 7, w: 2.4, h: 2.4, d: 2.4, color: 0x4a4e57 },
    { kind: 'crate', x: 11, z: 4, w: 1.8, h: 1.8, d: 1.8, color: 0x555a64 },
    { kind: 'pillar', x: -12, z: 2, w: 1.4, h: 8, d: 1.4, color: 0x62666f },
    { kind: 'pillar', x: 12, z: -2, w: 1.4, h: 8, d: 1.4, color: 0x62666f },
    { kind: 'pillar', x: 0, z: -12.5, w: 1.4, h: 8, d: 1.4, color: 0x62666f },
    { kind: 'console', x: 0, z: 12, w: 4, h: 1.6, d: 1.4, color: 0x3f434c, emissive: 0xffb84d },
    { kind: 'tank', x: -12, z: -11, w: 2.2, h: 4, d: 2.2, color: 0x2e3138, emissive: 0x9fe8ff },
  ],
};

/** All prototype locations. */
export const LOCATIONS: ArenaLocation[] = [WARSHIP_BRIDGE, LUNAR_BASE];

export function locationById(id: string): ArenaLocation | undefined {
  return LOCATIONS.find((l) => l.id === id);
}
