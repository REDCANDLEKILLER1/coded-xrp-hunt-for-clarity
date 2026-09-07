import type {WebGLRenderer} from 'three';
export type GraphicsQuality='full'|'low';
export const GRAPHICS_QUALITY_KEY='coded-definitive-graphics-quality';
/** The low preset preserves models, faction colors and gameplay. Its savings
 * come from fewer rendered pixels and disabling dynamic shadow passes. */
export function applyGraphicsQuality(renderer:Pick<WebGLRenderer,'setPixelRatio'|'shadowMap'>,quality:GraphicsQuality,deviceRatio:number):void{
  const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  renderer.setPixelRatio(Math.min(ratio,quality==='low'?1:1.75));renderer.shadowMap.enabled=quality==='full';renderer.shadowMap.needsUpdate=true;
}
