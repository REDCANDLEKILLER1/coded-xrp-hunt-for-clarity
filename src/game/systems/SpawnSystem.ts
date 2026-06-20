import { Enemy } from '../entities/Enemy';
import { ENEMY } from '../data/balance';

export class SpawnSystem {
  private timer = 0;

  update(dt: number, width: number, wave: number, enemies: Enemy[]): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = Math.max(0.28, ENEMY.spawnEvery - wave * 0.05);
    const x = 28 + Math.random() * Math.max(1, width - 56);
    const speed = ENEMY.speedMin + Math.random() * (ENEMY.speedMax - ENEMY.speedMin) + wave * 12;
    enemies.push(new Enemy(x, -24, speed));
  }
}
