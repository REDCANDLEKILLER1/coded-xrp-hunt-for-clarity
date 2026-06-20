import { Projectile } from '../entities/Projectile';
import { Player } from '../entities/Player';
import { PLAYER } from '../data/balance';

export class WeaponSystem {
  private fireTimer = 0;

  update(dt: number, player: Player, shots: Projectile[]): void {
    this.fireTimer -= dt;
    if (this.fireTimer > 0 || !player.alive) return;
    this.fireTimer = PLAYER.fireRate;
    shots.push(new Projectile(player.pos.x, player.pos.y - 18, PLAYER.projectileSpeed));
  }
}
