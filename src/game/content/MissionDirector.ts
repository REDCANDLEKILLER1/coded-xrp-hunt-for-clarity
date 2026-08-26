import type { MissionActDef, MissionDef } from './missions/types';

/**
 * Small state holder for authored campaign missions.
 *
 * Encounter completion remains owned by later Level 1 phases. This director
 * only owns deterministic mission position so checkpoints can safely resume at
 * authored act boundaries instead of restoring live bullets/enemies.
 */
export class MissionDirector {
  private mission: MissionDef | null = null;
  private actIndex = 0;

  start(mission: MissionDef): MissionActDef {
    if (mission.acts.length === 0) throw new Error(`Mission ${mission.key} has no acts.`);
    this.mission = mission;
    this.actIndex = 0;
    return mission.acts[0];
  }

  startAtAct(mission: MissionDef, actKey: string): MissionActDef {
    if (mission.acts.length === 0) throw new Error(`Mission ${mission.key} has no acts.`);
    const index = mission.acts.findIndex((act) => act.key === actKey);
    if (index < 0) throw new Error(`Mission ${mission.key} has no act "${actKey}".`);
    this.mission = mission;
    this.actIndex = index;
    return mission.acts[index];
  }

  clear(): void {
    this.mission = null;
    this.actIndex = 0;
  }

  restart(): MissionActDef | undefined {
    if (!this.mission) return undefined;
    this.actIndex = 0;
    return this.mission.acts[0];
  }

  advance(): MissionActDef | undefined {
    if (!this.mission) return undefined;
    if (this.actIndex < this.mission.acts.length - 1) this.actIndex += 1;
    return this.currentAct;
  }

  get activeMission(): MissionDef | null {
    return this.mission;
  }

  get currentAct(): MissionActDef | undefined {
    return this.mission?.acts[this.actIndex];
  }

  get currentActIndex(): number {
    return this.actIndex;
  }

  get isComplete(): boolean {
    return Boolean(this.mission && this.currentAct?.mode === 'complete');
  }
}
