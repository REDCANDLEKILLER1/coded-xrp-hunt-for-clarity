import type { Vec2 } from '../core/Types';

export function overlaps(a: Vec2, ar: number, b: Vec2, br: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= ar + br;
}
