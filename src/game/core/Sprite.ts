import type { AssetLoader } from './AssetLoader';
import type { SpriteSheetMeta } from './Types';

/**
 * Draws a manifest image into the destination rect.
 *
 * - When `sheet` is undefined or describes a single frame, the whole image is
 *   drawn — identical to a plain `ctx.drawImage(image, dx, dy, dw, dh)`.
 * - When `sheet` describes multiple frames, the frame for the given elapsed
 *   time is sliced out of the sheet and drawn. Frames are laid out left-to-right,
 *   top-to-bottom; columns/rows are derived from the image size and frame size.
 * - Invalid sheet metadata (non-positive frame size) degrades to drawing the
 *   whole image rather than throwing.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sheet: SpriteSheetMeta | undefined,
  elapsedSeconds: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  if (!sheet || sheet.frames <= 1 || sheet.frameWidth <= 0 || sheet.frameHeight <= 0) {
    ctx.drawImage(image, dx, dy, dw, dh);
    return;
  }

  const fps = sheet.fps && sheet.fps > 0 ? sheet.fps : 12;
  const frame = Math.floor(Math.max(0, elapsedSeconds) * fps) % sheet.frames;
  const cols = Math.max(1, Math.floor(image.width / sheet.frameWidth));
  const sx = (frame % cols) * sheet.frameWidth;
  const sy = Math.floor(frame / cols) * sheet.frameHeight;

  ctx.drawImage(image, sx, sy, sheet.frameWidth, sheet.frameHeight, dx, dy, dw, dh);
}

/**
 * Thin convenience wrapper around an {@link AssetLoader} + canvas context.
 *
 * `draw` returns `true` when a manifest image was rendered and `false` when the
 * asset is missing, so callers can keep their existing procedural fallback:
 *
 *   if (this.sprites.draw('vfx', 'burst_ring', x, y, w, h, t)) return;
 *   // ...procedural fallback...
 */
export class SpriteRenderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: AssetLoader,
  ) {}

  draw(
    category: string,
    id: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    elapsedSeconds: number,
  ): boolean {
    const image = this.assets.getImage(category, id);
    if (!image) return false;
    drawSprite(this.ctx, image, this.assets.getSheet(category, id), elapsedSeconds, dx, dy, dw, dh);
    return true;
  }
}
