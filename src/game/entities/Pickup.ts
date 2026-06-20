import type { Vec2 } from '../core/Types';

export class Pickup {
  id = crypto.randomUUID();
  pos: Vec2;
  radius = 10;
  alive = true;
  kind: 'repair' | 'special';

  constructor(x: number, y: number, kind: 'repair' | 'special') {
    this.pos = { x, y };
    this.kind = kind;
  }

  update(dt: number): void {
    this.pos.y += 70 * dt;
  }
}
