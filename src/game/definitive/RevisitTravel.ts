import type { CampaignSave, SaveResult } from './CampaignSave';
import type { SpaceCheckpoint } from './SpaceCheckpoint';
import { canRevisitOrbit, type RevisitWorld } from './CampaignNavigation';
import { EARTH_MARS_ROUTE, MARS_FOG_ROUTE, FOG_BULLION_ROUTE } from './SpaceRoutes';

/** Geometry stays in the lazy 3D path. Return travel never replays reward waves. */
export function revisitCheckpoint(save: CampaignSave, world: RevisitWorld): SpaceCheckpoint | null {
  const state = save.snapshot;
  if (!canRevisitOrbit(state, world)) return null;
  const route = world === 'mars' ? EARTH_MARS_ROUTE : world === 'fog_moon' ? MARS_FOG_ROUTE : FOG_BULLION_ROUTE;
  return {
    ...state.transit!, route: route.id, phase: world === 'mars' ? 'mars' : 'arrival',
    position: route.approach.toArray() as [number, number, number],
    orientation: [0, 0, 0, 1], wave: route.waves.length,
  };
}

/** Called only after the candidate scene exists; storage/conflict failures leave the old route intact. */
export function beginRevisit(save: CampaignSave, world: RevisitWorld, expectedRevision: number): SaveResult {
  if (save.snapshot.revision !== expectedRevision) return { ok: false, reason: 'conflict' };
  const checkpoint = revisitCheckpoint(save, world);
  if (!checkpoint) return { ok: false, reason: 'condition' };
  return save.update(draft => {
    draft.transit = checkpoint;
    draft.location = { mode: 'space', world, checkpoint: `space.${world}_orbit` };
    draft.earth.currentPlanet = world;
  });
}
