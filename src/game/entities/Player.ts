import type { Vec2 } from '../core/Types';
import { PLAYER } from '../data/balance';

export class Player {
  pos: Vec2;
  radius = 13;
  health = PLAYER.maxHealth;
  special = 100;
  alive = true;

  constructor(x: number, y: number) {
    this.pos = { x, y };
  }

  update(dt: number, axis: Vec2, target: Vec2 | null, bounds: Vec2): void {
    if (target) {
      this.pos.x += (target.x - this.pos.x) * Math.min(1, dt * 12);
      this.pos.y += (target.y - this.pos.y) * Math.min(1, dt * 12);
    } else {
      const len = Math.hypot(axis.x, axis.y) || 1;
      this.pos.x += (axis.x / len) * PLAYER.speed * dt;
      this.pos.y += (axis.y / len) * PLAYER.speed * dt;
    }
    this.pos.x = Math.max(24, Math.min(bounds.x - 24, this.pos.x));
    this.pos.y = Math.max(80, Math.min(bounds.y - 38, this.pos.y));
    this.special = Math.min(100, this.special + dt * 8);
  }

  damage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) this.alive = false;
  }
}
