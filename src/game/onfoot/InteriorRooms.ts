export type InteriorPlatform = { x: number; y: number; w: number; h: number };
export type InteriorEnemySpawn = { x: number; y: number; health: number; fireSeconds: number };

export type InteriorRoom = {
  key: 'docking_bay' | 'security_checkpoint';
  label: string;
  objective: string;
  backgroundSrc: string;
  worldWidth: number;
  worldHeight: number;
  floorY: number;
  startX: number;
  startY: number;
  exitX: number;
  platforms: InteriorPlatform[];
  enemies: InteriorEnemySpawn[];
};

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const FLOOR_Y = 626;

export const REGULATORY_INTERIOR_ROOMS: InteriorRoom[] = [
  {
    key: 'docking_bay',
    label: 'REGULATORY WARSHIP // DOCKING BAY',
    objective: 'SECURE THE HANGAR // REACH SECURITY',
    backgroundSrc: '/assets/interior/regulatory_docking_bay.webp',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    floorY: FLOOR_Y,
    startX: 110,
    startY: 520,
    exitX: 1206,
    platforms: [
      { x: 0, y: FLOOR_Y, w: WORLD_WIDTH, h: 94 },
      { x: 180, y: 516, w: 250, h: 20 },
      { x: 505, y: 455, w: 220, h: 20 },
      { x: 785, y: 520, w: 205, h: 20 },
      { x: 1030, y: 438, w: 185, h: 20 },
    ],
    enemies: [
      { x: 840, y: 482, health: 80, fireSeconds: 1.3 },
    ],
  },
  {
    key: 'security_checkpoint',
    label: 'REGULATORY WARSHIP // SECURITY CHECKPOINT',
    objective: 'BREAK SECURITY CONTROL // OPEN ACCESS CORRIDOR',
    backgroundSrc: '/assets/interior/regulatory_security_checkpoint.webp',
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    floorY: FLOOR_Y,
    startX: 90,
    startY: 520,
    exitX: 1204,
    platforms: [
      { x: 0, y: FLOOR_Y, w: WORLD_WIDTH, h: 94 },
      { x: 110, y: 512, w: 245, h: 20 },
      { x: 380, y: 423, w: 210, h: 20 },
      { x: 620, y: 530, w: 220, h: 20 },
      { x: 870, y: 398, w: 205, h: 20 },
      { x: 1080, y: 514, w: 155, h: 20 },
    ],
    enemies: [
      { x: 500, y: 382, health: 100, fireSeconds: 1.4 },
      { x: 946, y: 356, health: 120, fireSeconds: 1.05 },
    ],
  },
];

export const ONFOOT_PHYSICS = {
  gravity: 1900,
  moveSpeed: 270,
  jumpSpeed: 690,
  maxFallSpeed: 980,
  playerWidth: 42,
  playerHeight: 64,
  blastSpeed: 660,
  blastCost: 10,
  blastCooldown: 0.18,
  coyoteSeconds: 0.1,
  jumpBufferSeconds: 0.12,
};

export function validateInteriorRooms(): string[] {
  const errors: string[] = [];
  if (REGULATORY_INTERIOR_ROOMS.length < 2) errors.push('interior: first playable slice must contain at least two rooms');
  const keys = new Set<string>();
  for (const room of REGULATORY_INTERIOR_ROOMS) {
    if (keys.has(room.key)) errors.push(`interior: duplicate room ${room.key}`);
    keys.add(room.key);
    if (!room.backgroundSrc.startsWith('/assets/interior/')) errors.push(`interior: ${room.key} must use a manifest-tracked interior asset`);
    if (room.platforms.length < 4) errors.push(`interior: ${room.key} needs traversal geometry`);
    if (room.enemies.length < 1) errors.push(`interior: ${room.key} needs authored combat pressure`);
    if (room.exitX <= room.startX + 600) errors.push(`interior: ${room.key} traversal span is too short`);
  }
  if (ONFOOT_PHYSICS.coyoteSeconds <= 0 || ONFOOT_PHYSICS.jumpBufferSeconds <= 0) errors.push('interior: accepted responsive jump assists must remain enabled');
  return errors;
}
