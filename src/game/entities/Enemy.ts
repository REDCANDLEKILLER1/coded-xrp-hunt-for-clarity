import type { Vec2 } from '../core/Types';

export class Enemy {
  id = crypto.randomUUID();
  pos: Vec2;
  vel: Vec2;
  radius = 14;
  alive = true;

  constructor(x: number, y: number, speed: number) {
    this.pos = { x, y };
    this.vel = { x: 0, y: speed };
  }

  update(dt: number): void {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
}
