export type InteriorPlatform = { x: number; y: number; w: number; h: number };
export type InteriorEnemySpawn = { x: number; y: number; health: number; fireSeconds: number };

export type InteriorRoomKey =
  | 'docking_bay'
  | 'security_checkpoint'
  | 'access_corridor'
  | 'maintenance_shaft'
  | 'field_control'
  | 'defense_deck';

export type InteriorRoom = {
  key: InteriorRoomKey;
  label: string;
  objective: string;
  /**
   * Painted background. Rooms without one draw a procedural interior instead
   * -- deliberately, not as a failure -- so a room can ship and play before
   * its art lands. All six rooms set it now.
   *
   * Getting here took two rounds. The docking bay and security checkpoint
   * originally pointed at files that had reached the repo truncated: 7,506
   * bytes of the 87,056 and 70,976 their headers declared. They were not
   * simply broken links -- Chromium DECODES a truncated WebP, reports
   * naturalWidth 1024, and paints the fragment as a near-blank wash, so the
   * usual `complete && naturalWidth > 0` guard passed and those rooms drew an
   * almost-empty background instead of falling back to the procedural one.
   * Pointing at a partial file is worse than pointing at nothing, which is why
   * `npm run verify:rooms` checks byte length and sha256 against the author's
   * manifest before anything is wired here.
   */
  backgroundSrc?: string;
  /** Drives the procedural interior's lighting, and the room's UI accents. */
  accent: string;
  worldWidth: number;
  worldHeight: number;
  floorY: number;
  startX: number;
  startY: number;
  exitX: number;
  /**
   * Height the exit sits at, for rooms where reaching it is the challenge.
   * Without this the shaft could be skipped by walking along its floor to the
   * far wall; with it, the climb is the door.
   */
  exitY?: number;
  /**
   * Let the camera follow the player up instead of pinning the floor to the
   * bottom of the screen. Only the shaft needs it -- every other room is a
   * side-scroller and the pinned floor reads better there.
   */
  verticalCamera?: boolean;
  platforms: InteriorPlatform[];
  enemies: InteriorEnemySpawn[];
};

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const FLOOR_Y = 626;

export const REGULATORY_INTERIOR_ROOMS: InteriorRoom[] = [
  {
    key: 'docking_bay',
    backgroundSrc: '/assets/interior/regulatory_docking_bay.webp',
    label: 'REGULATORY WARSHIP // DOCKING BAY',
    objective: 'SECURE THE HANGAR // REACH SECURITY',
    accent: '#36a3ff',
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
    backgroundSrc: '/assets/interior/regulatory_security_checkpoint.webp',
    label: 'REGULATORY WARSHIP // SECURITY CHECKPOINT',
    objective: 'BREAK SECURITY CONTROL // OPEN ACCESS CORRIDOR',
    accent: '#ff8a3d',
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
  // A long, low run with almost no headroom: the first room where the shape of
  // the space is the pressure rather than the enemy count.
  {
    key: 'access_corridor',
    backgroundSrc: '/assets/interior/regulatory_access_corridor.webp',
    label: 'REGULATORY WARSHIP // ACCESS CORRIDOR',
    objective: 'PUSH THROUGH THE CORRIDOR // REACH THE MAINTENANCE SHAFT',
    accent: '#00d8a4',
    worldWidth: 1460,
    worldHeight: WORLD_HEIGHT,
    floorY: FLOOR_Y,
    startX: 90,
    startY: 520,
    exitX: 1390,
    platforms: [
      { x: 0, y: FLOOR_Y, w: 1460, h: 94 },
      { x: 150, y: 540, w: 190, h: 18 },
      { x: 420, y: 486, w: 200, h: 18 },
      { x: 700, y: 542, w: 180, h: 18 },
      { x: 950, y: 470, w: 210, h: 18 },
      { x: 1230, y: 536, w: 170, h: 18 },
    ],
    enemies: [
      { x: 520, y: 444, health: 100, fireSeconds: 1.25 },
      { x: 1046, y: 428, health: 110, fireSeconds: 1.1 },
    ],
  },
  // The only vertical room. The exit is at the top, and exitY makes the climb
  // mandatory -- otherwise the far wall could be reached along the floor.
  {
    key: 'maintenance_shaft',
    backgroundSrc: '/assets/interior/regulatory_maintenance_shaft.webp',
    label: 'REGULATORY WARSHIP // MAINTENANCE SHAFT',
    objective: 'CLIMB THE SHAFT // REACH FIELD CONTROL',
    accent: '#ffd24a',
    worldWidth: 980,
    worldHeight: 1180,
    floorY: 1086,
    startX: 90,
    startY: 980,
    exitX: 830,
    exitY: 300,
    verticalCamera: true,
    platforms: [
      { x: 0, y: 1086, w: 980, h: 94 },
      { x: 120, y: 1000, w: 180, h: 18 },
      { x: 380, y: 916, w: 170, h: 18 },
      { x: 150, y: 826, w: 170, h: 18 },
      { x: 420, y: 736, w: 180, h: 18 },
      { x: 180, y: 646, w: 170, h: 18 },
      { x: 460, y: 556, w: 180, h: 18 },
      { x: 200, y: 466, w: 170, h: 18 },
      { x: 500, y: 376, w: 200, h: 18 },
      { x: 740, y: 300, w: 220, h: 18 },
    ],
    enemies: [
      { x: 470, y: 692, health: 100, fireSeconds: 1.3 },
      { x: 560, y: 332, health: 120, fireSeconds: 1.05 },
    ],
  },
  // An open arena with pillars: the first room that surrounds the player
  // instead of funnelling them.
  {
    key: 'field_control',
    backgroundSrc: '/assets/interior/regulatory_field_control.webp',
    label: 'REGULATORY WARSHIP // FIELD CONTROL CHAMBER',
    objective: 'CUT THE FIELD CONTROL // OPEN THE DEFENSE DECK',
    accent: '#b56cff',
    worldWidth: 1340,
    worldHeight: WORLD_HEIGHT,
    floorY: FLOOR_Y,
    startX: 80,
    startY: 520,
    exitX: 1270,
    platforms: [
      { x: 0, y: FLOOR_Y, w: 1340, h: 94 },
      { x: 230, y: 500, w: 150, h: 18 },
      { x: 470, y: 420, w: 150, h: 18 },
      { x: 700, y: 500, w: 150, h: 18 },
      { x: 930, y: 420, w: 150, h: 18 },
      { x: 1130, y: 508, w: 150, h: 18 },
      { x: 560, y: 302, w: 220, h: 18 },
    ],
    enemies: [
      { x: 300, y: 456, health: 100, fireSeconds: 1.2 },
      { x: 660, y: 258, health: 130, fireSeconds: 1.0 },
      { x: 1000, y: 376, health: 110, fireSeconds: 1.15 },
    ],
  },
  // The last room before the core, and the hardest: four guns across three
  // layers, with the exit behind the highest of them.
  {
    key: 'defense_deck',
    backgroundSrc: '/assets/interior/regulatory_defense_deck.webp',
    label: 'REGULATORY WARSHIP // DEFENSE SYSTEMS DECK',
    objective: 'SILENCE THE DECK // CORE ACCESS BEYOND',
    accent: '#ff4c66',
    worldWidth: 1520,
    worldHeight: WORLD_HEIGHT,
    floorY: FLOOR_Y,
    startX: 80,
    startY: 520,
    exitX: 1450,
    platforms: [
      { x: 0, y: FLOOR_Y, w: 1520, h: 94 },
      { x: 170, y: 528, w: 180, h: 18 },
      { x: 400, y: 442, w: 170, h: 18 },
      { x: 620, y: 536, w: 180, h: 18 },
      { x: 850, y: 448, w: 170, h: 18 },
      { x: 1070, y: 360, w: 190, h: 18 },
      { x: 1310, y: 470, w: 170, h: 18 },
      { x: 300, y: 328, w: 200, h: 18 },
    ],
    enemies: [
      { x: 460, y: 398, health: 110, fireSeconds: 1.15 },
      { x: 400, y: 284, health: 120, fireSeconds: 1.05 },
      { x: 916, y: 404, health: 120, fireSeconds: 1.0 },
      { x: 1160, y: 316, health: 140, fireSeconds: 0.92 },
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
  // Docking Bay, Security Checkpoint, Access Corridor, Maintenance Shaft,
  // Field Control Chamber, Defense Systems Deck. Core Access is the checkpoint
  // that hands off to the Ledger Defense Core, not a sixth combat room.
  if (REGULATORY_INTERIOR_ROOMS.length < 6) errors.push('interior: the warship interior must contain all six authored rooms');
  const keys = new Set<string>();
  for (const room of REGULATORY_INTERIOR_ROOMS) {
    if (keys.has(room.key)) errors.push(`interior: duplicate room ${room.key}`);
    keys.add(room.key);
    if (room.backgroundSrc !== undefined && !room.backgroundSrc.startsWith('/assets/interior/')) {
      errors.push(`interior: ${room.key} must use a manifest-tracked interior asset`);
    }
    if (!/^#[0-9a-f]{6}$/i.test(room.accent)) errors.push(`interior: ${room.key} needs an accent colour`);
    if (room.platforms.length < 4) errors.push(`interior: ${room.key} needs traversal geometry`);
    if (room.enemies.length < 1) errors.push(`interior: ${room.key} needs authored combat pressure`);
    if (room.exitX <= room.startX + 600) errors.push(`interior: ${room.key} traversal span is too short`);

    // A room's platforms have to be reachable from the floor and from each
    // other, or the exit is unreachable and the run soft-locks.
    const rise = ONFOOT_PHYSICS.jumpSpeed ** 2 / (2 * ONFOOT_PHYSICS.gravity);
    const ledges = [...room.platforms].sort((a, b) => b.y - a.y);
    for (let i = 1; i < ledges.length; i++) {
      const step = ledges[i - 1].y - ledges[i].y;
      if (step > rise) {
        errors.push(`interior: ${room.key} has a ${Math.round(step)}px step, past the ${Math.round(rise)}px jump height`);
      }
    }

    // A room whose exit sits at a height needs a ledge at that height to
    // stand on, otherwise the door can never be reached.
    if (room.exitY !== undefined) {
      const landing = room.platforms.some((platform) => Math.abs(platform.y - room.exitY!) < 130 && platform.x + platform.w > room.exitX - 40);
      if (!landing) errors.push(`interior: ${room.key} exit sits at y=${room.exitY} with no ledge to reach it`);
    }
  }
  if (ONFOOT_PHYSICS.coyoteSeconds <= 0 || ONFOOT_PHYSICS.jumpBufferSeconds <= 0) errors.push('interior: accepted responsive jump assists must remain enabled');
  return errors;
}
