export type ConvoyStage = 'apron' | 'junction_one' | 'junction_two' | 'siege' | 'delivered';
export type FirstFreightLane = 'express' | 'covered';
export type SecondFreightLane = 'east' | 'west';
export interface ConvoyCheckpoint {
  stage: ConvoyStage;
  first: FirstFreightLane | null;
  second: SecondFreightLane | null;
  hull: [number, number];
  /** Only complete sector clears are kept at the corresponding safe boundary. */
  cleared: string[];
}
export const CONVOY_HULL = 140;
export const CONVOY_SECTORS = ['apron', 'express', 'covered', 'east', 'west', 'siege'] as const;
export function initialConvoyCheckpoint(): ConvoyCheckpoint {
  return { stage: 'apron', first: null, second: null, hull: [CONVOY_HULL, CONVOY_HULL], cleared: [] };
}
/** Older campaign saves may omit this optional chapter record entirely. */
export function validConvoyCheckpoint(value: unknown): value is ConvoyCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const stages: readonly unknown[] = ['apron', 'junction_one', 'junction_two', 'siege', 'delivered'];
  if (!stages.includes(v.stage) || ![null, 'express', 'covered'].includes(v.first as string | null)
    || ![null, 'east', 'west'].includes(v.second as string | null)) return false;
  if (!Array.isArray(v.hull) || v.hull.length !== 2 || !v.hull.every(h => typeof h === 'number' && Number.isFinite(h) && h > 0 && h <= CONVOY_HULL)) return false;
  if (!Array.isArray(v.cleared) || new Set(v.cleared).size !== v.cleared.length
    || !v.cleared.every(id => (CONVOY_SECTORS as readonly unknown[]).includes(id))) return false;
  if (v.stage === 'apron' && (v.first !== null || v.second !== null)) return false;
  if (v.stage === 'junction_one' && v.second !== null) return false;
  if (['junction_two', 'siege', 'delivered'].includes(String(v.stage)) && v.first === null) return false;
  if (['siege', 'delivered'].includes(String(v.stage)) && v.second === null) return false;
  if (v.stage !== 'apron' && !v.cleared.includes('apron')) return false;
  if (['junction_two', 'siege', 'delivered'].includes(String(v.stage)) && !v.cleared.includes(v.first)) return false;
  if (['siege', 'delivered'].includes(String(v.stage)) && !v.cleared.includes(v.second)) return false;
  const allowed = v.stage === 'apron' || v.stage === 'junction_one' ? ['apron']
    : v.stage === 'junction_two' ? ['apron', v.first] : ['apron', v.first, v.second, 'siege'];
  if (!v.cleared.every(sector => allowed.includes(sector))) return false;
  return v.stage !== 'delivered' || v.cleared.includes('siege');
}
