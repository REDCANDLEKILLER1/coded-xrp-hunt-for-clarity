import type { CampaignSave, DefinitiveSave } from './CampaignSave';
import { savedChapterScene } from './ChapterTransitions';

export type RevisitWorld = 'mars' | 'fog_moon' | 'bullion_reach';
export interface ChapterRecord {
  orbital: string; orbitalCleared: boolean; surface: string; surfaceCleared: boolean; briefing: string;
}

/** Rebuilt chapter records use earned quest receipts, independently of legacy boss names. */
export function chapterRecord(save: CampaignSave, world: string): ChapterRecord | undefined {
  const has = (flag: string) => save.snapshot.quests.includes(flag);
  if (world === 'mars') return {
    orbital: 'RELIEF APPROACH', orbitalCleared: has('mars.orbit_reached'),
    surface: 'MARGIN WARDEN', surfaceCleared: has('mars.margin_warden_defeated'),
    briefing: has('mars.restored') ? 'Corn’s relief site is restored. Revisit the pumps and secured extraction route, or continue your voyage.'
      : 'Reach Corn’s relief site, restore the water pumps and break the Margin Warden’s extraction blockade.',
  };
  if (world === 'fog_moon') return {
    orbital: 'FOG PATROL ROUTE', orbitalCleared: has('fog_moon.orbit_reached'),
    surface: 'RELAY CITADEL', surfaceCleared: has('fog_moon.restored'),
    briefing: has('fog_moon.restored') ? 'Boo’s relays are restored and the Citadel is quiet. The scout shelter remains open for return visits.'
      : 'Follow the scout shelter beacon. Meet Boo, reveal the hidden relays and silence the hostile Citadel.',
  };
  if (world === 'bullion_reach') return {
    orbital:'FREIGHT INTERCEPTION',orbitalCleared:has('bullion_reach.orbit_reached'),
    surface:'MARKET SIEGE ENGINE',surfaceCleared:has('bullion_reach.restored'),
    briefing:has('bullion_reach.restored')?'LEX’s relief convoy is delivered. The freight route and logistics service are restored.':'Meet LEX, escort two relief haulers through the junctions and break the siege engine’s blockade.',
  };
  return undefined;
}
type ChapterScene = Exclude<ReturnType<typeof savedChapterScene>, 'earth'>;
export type CampaignNavigation =
  | { action: 'earth'; label: null }
  | { action: 'continue'; label: string; scene: ChapterScene }
  | { action: 'fogVoyage'; label: string }
  | { action: 'bullionVoyage'; label: string }
  | { action: 'revisit'; label: string; world: RevisitWorld }
  | { action: 'blocked'; label: string };

/** Pure data only: the initial map must not load the mesh renderer. */
export function safeOrbit(save: DefinitiveSave): RevisitWorld | null {
  const transit = save.transit;
  if (!save.warshipOwned || !transit || transit.hull <= 0 || !['space', 'hub'].includes(save.location.mode)) return null;
  const world = transit.phase === 'mars' && (transit.route ?? 'earth_mars') === 'earth_mars' ? 'mars'
    : transit.phase === 'arrival' && transit.route === 'mars_fog_moon' ? 'fog_moon'
    : transit.phase === 'arrival' && transit.route === 'fog_bullion_reach' ? 'bullion_reach' : null;
  return world === save.location.world ? world : null;
}

export function canRevisitOrbit(save: DefinitiveSave, world: string): world is RevisitWorld {
  const origin = safeOrbit(save);
  return (world === 'mars' || world === 'fog_moon' || world === 'bullion_reach') && origin !== null && origin !== world
    && save.quests.includes(`${world}.orbit_reached`);
}

export function canStartFogVoyage(save: DefinitiveSave): boolean {
  return save.location.mode === 'space' && safeOrbit(save) === 'mars'
    && save.quests.includes('mars.restored') && !save.quests.includes('fog_moon.voyage_started');
}
export function canStartBullionVoyage(save: DefinitiveSave): boolean {
  return save.location.mode==='space' && safeOrbit(save)==='fog_moon'
    && save.quests.includes('fog_moon.restored') && !save.quests.includes('bullion_reach.voyage_started');
}

export function campaignNavigation(save: CampaignSave, world: string): CampaignNavigation {
  const state = save.snapshot;
  if (!['ledger_prime', 'mars', 'fog_moon', 'bullion_reach'].includes(world)) {
    return { action: 'blocked', label: 'CHAPTER NOT AVAILABLE IN THIS PREVIEW' };
  }
  if (!state.warshipOwned) {
    if (world !== 'ledger_prime') return { action: 'blocked', label: 'CAPTURE THE WARSHIP TO TRAVEL' };
    const scene = savedChapterScene(save);
    return scene === 'earth' ? { action: 'earth', label: null }
      : { action: 'continue', scene, label: scene === 'landing' ? 'CONTINUE ARRIVAL' : 'CONTINUE BOARDING' };
  }
  if (canRevisitOrbit(state, world)) {
    return { action: 'revisit', world, label: `RETURN TO ${world.replace(/_/g,' ').toUpperCase()} ORBIT` };
  }
  if (world === 'fog_moon' && canStartFogVoyage(state)) return { action: 'fogVoyage', label: 'PLOT FOG MOON' };
  if (world === 'bullion_reach' && canStartBullionVoyage(state)) return { action: 'bullionVoyage', label: 'PLOT BULLION REACH' };
  const saved = savedChapterScene(save), scene = saved === 'earth' ? 'boarding' : saved;
  const label = scene === 'bullion' ? 'CONTINUE BULLION REACH' : scene === 'fog' ? 'CONTINUE FOG MOON'
    : scene === 'mars' ? 'CONTINUE MARS SURFACE'
    : scene === 'space' ? `CONTINUE ${state.location.world === 'ledger_prime'?'EARTH':state.location.world.replace(/_/g,' ').toUpperCase()} FLIGHT`
    : scene === 'landing' ? 'CONTINUE ARRIVAL' : 'RETURN TO THE BRIDGE';
  return { action: 'continue', scene, label };
}
