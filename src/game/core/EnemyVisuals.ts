export type EnemyWeaponVisual = 'pulse' | 'plasma' | 'missile' | 'shrapnel' | 'laser';

// Bake the light once per loaded sprite. Canvas filters are not available on
// every iPhone; explicit RGB adjustment works there and preserves alpha.
const litSprites = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
export function drawBrightEnemy(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
  x: number, y: number, width: number, height: number): boolean {
  let lit = litSprites.get(image);
  if (!lit) {
    lit = document.createElement('canvas');
    lit.width = image.naturalWidth || image.width;
    lit.height = image.naturalHeight || image.height;
    const bake = lit.getContext('2d');
    if (!bake || !lit.width || !lit.height) return false;
    bake.drawImage(image, 0, 0);
    const pixels = bake.getImageData(0, 0, lit.width, lit.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[i + channel] = Math.min(255, pixels.data[i + channel] * 1.65 + 18);
      }
    }
    bake.putImageData(pixels, 0, 0);
    litSprites.set(image, lit);
  }
  ctx.drawImage(lit, x - width / 2, y - height / 2, width, height);
  return true;
}

/** Distinct silhouettes at phone scale; collision sizes and damage stay in Game2A. */
export function drawEnemyWeapon(ctx: CanvasRenderingContext2D, visual: EnemyWeaponVisual,
  x: number, y: number, angle: number, size: number): void {
  const color = visual === 'plasma' ? '#ff66dd' : visual === 'laser' ? '#ffad50' : '#ff4545';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (visual === 'pulse') {
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff0ec';
    ctx.beginPath();ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);ctx.fill();
  } else if (visual === 'plasma') {
    ctx.ellipse(0, 0, size * 0.9, size * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();ctx.stroke();
    ctx.fillStyle = '#ffe8ff';
    ctx.beginPath();ctx.ellipse(0, 0, size * 0.48, size * 0.24, 0, 0, Math.PI * 2);ctx.fill();
  } else if (visual === 'missile') {
    ctx.moveTo(size, 0);ctx.lineTo(size * 0.25, -size * 0.3);
    ctx.lineTo(-size * 0.65, -size * 0.3);ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.65, size * 0.3);ctx.lineTo(size * 0.25, size * 0.3);
    ctx.closePath();ctx.fillStyle = '#ffe0d5';ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-size * 0.5, 0);ctx.lineTo(-size * 1.4, 0);ctx.stroke();
  } else if (visual === 'shrapnel') {
    ctx.moveTo(size * 0.75, 0);ctx.lineTo(0, -size * 0.5);
    ctx.lineTo(-size * 0.65, 0);ctx.lineTo(0, size * 0.5);
    ctx.closePath();ctx.fill();ctx.stroke();
  } else {
    ctx.lineWidth = 4;ctx.moveTo(-size * 1.5, 0);ctx.lineTo(size, 0);ctx.stroke();
    ctx.strokeStyle = '#fff4dd';ctx.lineWidth = 1.5;
    ctx.beginPath();ctx.moveTo(-size * 1.3, 0);ctx.lineTo(size, 0);ctx.stroke();
  }
  ctx.restore();
}
