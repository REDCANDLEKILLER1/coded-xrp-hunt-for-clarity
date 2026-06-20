import type { Vec2 } from '../core/Types';

export interface Burst {
  pos: Vec2;
  age: number;
  maxAge: number;
  radius: number;
  color: string;
}

export class FXSystem {
  bursts: Burst[] = [];

  addBurst(pos: Vec2, radius = 34, color = '#00ff00'): void {
    this.bursts.push({ pos: { ...pos }, age: 0, maxAge: 0.32, radius, color });
  }

  update(dt: number): void {
    for (const burst of this.bursts) burst.age += dt;
    this.bursts = this.bursts.filter((burst) => burst.age < burst.maxAge);
  }
}
