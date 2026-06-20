import { Player } from '../entities/Player';
import { PLAYER } from '../data/balance';

export class HUDSystem {
  render(ctx: CanvasRenderingContext2D, player: Player, score: number, wave: number, width: number, paused: boolean): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(10, 10, width - 20, 54);
    ctx.strokeStyle = '#00ff88';
    ctx.strokeRect(10, 10, width - 20, 54);
    ctx.fillStyle = '#dfffea';
    ctx.font = '12px monospace';
    ctx.fillText('SCORE ' + score, 20, 30);
    ctx.fillText('WAVE ' + wave, width - 86, 30);
    this.bar(ctx, 20, 42, 110, 8, player.health / PLAYER.maxHealth, '#00ff00');
    this.bar(ctx, 148, 42, 110, 8, player.special / 100, '#36a3ff');
    ctx.fillText('SPECIAL', 148, 38);
    if (paused) {
      ctx.fillStyle = '#ff4545';
      ctx.fillText('PAUSED', width / 2 - 24, 38);
    }
    ctx.restore();
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4) * Math.max(0, Math.min(1, value)), h - 4);
  }
}
