// Encounter orchestration for authored flight acts.
//
// Extraction #2 of the Game2A decomposition (Phase 0). Game2A remains the
// orchestrator: it owns the combat entities (drones, hazards), the mission
// director, and the act-completion flow. This module owns the encounter
// sequencing -- which encounter def is active for the current act, ticking
// the director, requesting spawns, and reporting completion.
//
// Everything the orchestration needs from Game2A arrives through the
// EncounterHost interface below -- this module never imports Game2A, so the
// dependency points one way.
//
// Phase 0B: the director lookup is planet-aware. A mission def may carry its
// own `encounters` record (actKey -> def); when absent, the lookup falls back
// to the Earth-authored table so existing content keeps working unchanged.

import {
  EarthFlightEncounterDirector,
  earthFlightEncounterFor,
  type EarthFlightEncounterDef,
} from '../content/EarthFlightEncounters';
import type { MissionDef } from '../content/missions/types';

/** Everything the encounter orchestration needs from its Game2A host. */
export interface EncounterHost {
  // -- threat counting -----------------------------------------------------
  droneCount(): number;
  /** Hazards that count as active threats (excludes friendly ground unless the beacon lesson is showing them). */
  threatHazardCount(beaconLesson: boolean): number;
  /** Screen height, for the beacon-lesson visibility band. */
  screenHeight(): number;
  /** True when every drone is gone and every hazard is friendly ground. */
  threatsCleared(): boolean;
  // -- ground-restoration gate -----------------------------------------------
  /** True when the level is waiting on district restoration with no threats. */
  groundRestorationBlocking(): boolean;
  clearHostileShots(): void;
  // -- spawning (Game2A combat owns entity creation) -------------------------
  spawnEnemy(enemyKey: string, xRatio: number): void;
  spawnHazard(hazardKey: string, xRatio: number, side?: -1 | 1): void;
  // -- movement (Game2A combat) ------------------------------------------------
  moveDrones(dt: number): void;
  moveHazards(dt: number): void;
  // -- act flow -----------------------------------------------------------------
  completeFlightAct(): void;
}

/**
 * Planet-aware encounter lookup. A mission def may carry its own encounters;
 * otherwise the Earth-authored table is consulted so legacy content resolves
 * without modification.
 */
export function encounterDefFor(
  mission: MissionDef | null | undefined,
  actKey: string,
): EarthFlightEncounterDef | undefined {
  return mission?.encounters?.[actKey] ?? earthFlightEncounterFor(actKey);
}

/**
 * Pure authored-group sequencer driver. It never owns actors; the game
 * reports threat counts and performs spawns through the host.
 */
export class EncounterOrchestrator {
  private readonly director = new EarthFlightEncounterDirector();

  constructor(private readonly host: EncounterHost) {}

  /**
   * Start the encounter for an act, resolving the def from the mission first
   * and falling back to the Earth table. A null/undefined mission behaves
   * exactly like the legacy Earth-only path.
   *
   * The single-arg form `start(actKey)` is the legacy validator path and
   * resolves through the Earth table only.
   */
  start(mission: MissionDef | null | undefined, actKey: string): void;
  start(actKey: string): void;
  start(missionOrActKey: MissionDef | null | undefined | string, actKey?: string): void {
    if (typeof missionOrActKey === 'string') {
      this.director.startWithDef(encounterDefFor(undefined, missionOrActKey));
    } else {
      this.director.startWithDef(encounterDefFor(missionOrActKey, actKey ?? ''));
    }
  }

  clear(): void {
    this.director.clear();
  }

  get active(): boolean {
    return this.director.active;
  }

  get stageKey(): string | undefined {
    return this.director.stageKey;
  }

  get currentGroupLabel(): string | undefined {
    return this.director.currentGroupLabel;
  }

  get currentGroupNumber(): number {
    return this.director.currentGroupNumber;
  }

  get totalGroups(): number {
    return this.director.totalGroups;
  }

  /** True when the given act has an authored encounter under the mission. */
  hasEncounter(mission: MissionDef | null | undefined, actKey: string): boolean {
    return encounterDefFor(mission, actKey) !== undefined;
  }

  /**
   * Tick the authored encounter: pace groups against live threat counts,
   * request spawns through the host, move combat entities, and complete the
   * flight act when the director and the screen agree it is done.
   */
  update(dt: number): void {
    const beaconLesson = this.director.currentGroupLabel?.startsWith('CLARITY BEACON') ?? false;
    const activeThreats = this.host.droneCount() + this.host.threatHazardCount(beaconLesson);
    if (activeThreats === 0 && this.host.groundRestorationBlocking()) {
      this.host.clearHostileShots();
      return;
    }
    const state = this.director.update(dt, activeThreats);
    for (const spawn of state.spawns) {
      if (spawn.kind === 'enemy') this.host.spawnEnemy(spawn.enemyKey, spawn.x);
      else this.host.spawnHazard(spawn.hazardKey, spawn.x, spawn.side);
    }
    this.host.moveDrones(dt);
    this.host.moveHazards(dt);

    if (state.completed && this.host.threatsCleared()) this.host.completeFlightAct();
  }
}
