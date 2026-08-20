export type Platform = { x: number; y: number; w: number; h: number };

export const SIDEVIEW_ROOM = {
  worldWidth: 1680,
  worldHeight: 720,
  floorY: 640,
  startX: 120,
  startY: 520,
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
  platforms: [
    { x: 0, y: 640, w: 1680, h: 80 },
    { x: 250, y: 540, w: 210, h: 24 },
    { x: 540, y: 470, w: 180, h: 24 },
    { x: 810, y: 560, w: 210, h: 24 },
    { x: 1090, y: 445, w: 190, h: 24 },
    { x: 1370, y: 535, w: 190, h: 24 },
  ] as Platform[],
};

export function validateSideViewRoom(): string[] {
  const errors: string[] = [];
  if (SIDEVIEW_ROOM.gravity < 1000) errors.push('side-view: gravity too weak');
  if (SIDEVIEW_ROOM.jumpSpeed < 500) errors.push('side-view: jump too weak');
  if (SIDEVIEW_ROOM.platforms.length < 5) errors.push('side-view: insufficient traversal platforms');
  if (SIDEVIEW_ROOM.worldWidth < 1400) errors.push('side-view: room too short to evaluate traversal');
  if (SIDEVIEW_ROOM.coyoteSeconds <= 0 || SIDEVIEW_ROOM.jumpBufferSeconds <= 0) errors.push('side-view: responsive jump assists required');
  return errors;
}
