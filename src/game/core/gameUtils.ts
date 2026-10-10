/** Shared pure helpers extracted from Game2A.ts (Phase 1 decomposition). */
import type { Rect } from './Types';

/** Minimal shape for box(); Game2A's Actor satisfies this structurally. */
type Boxable = { x: number; y: number; w: number; h: number };

/** Trim a label with an ellipsis so it never spills out of its box. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function box(actor: Boxable, scale: number): Rect {
  return { x: actor.x - (actor.w * scale) / 2, y: actor.y - (actor.h * scale) / 2, w: actor.w * scale, h: actor.h * scale };
}

export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Circular hit test with a few px of thumb forgiveness past the drawn edge. */
/**
 * Rotate `from` toward `to` by at most `step`, taking the shortest way round.
 * Exported so the duel's turning can be tested directly: the wrap-around is
 * exactly the part that is easy to get wrong and invisible in a screenshot.
 */
export function turnToward(from: number, to: number, step: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + clamp(delta, -step, step);
}

/** True on the ?log / ?debug routes, where the developer panels belong. */
export function hasDiagnosticsFlag(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    return params.has('log') || params.has('debug');
  } catch {
    return false;
  }
}

export function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string): void {
  ctx.strokeStyle = 'rgba(216,255,232,0.55)';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.min(1, pct)) * (w - 2), h - 2);
}
