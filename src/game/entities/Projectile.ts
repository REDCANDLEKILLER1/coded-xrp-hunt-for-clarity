import type { Vec2 } from '../core/Types';

export class Projectile {
  id = crypto.randomUUID();
  pos: Vec2;
  vel: Vec2;
  radius = 4;
  alive = true;
  owner: 'player' | 'enemy';

  constructor(x: number, y: number, vy: number, owner: 'player' | 'enemy' = 'player') {
    this.pos = { x, y };
    this.vel = { x: 0, y: vy };
    this.owner = owner;
  }

  update(dt: number): void {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
}
