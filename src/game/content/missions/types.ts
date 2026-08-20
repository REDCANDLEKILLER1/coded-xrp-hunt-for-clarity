export type MissionActMode = 'flight' | 'boss' | 'transition' | 'on_foot' | 'complete';

export interface MissionActDef {
  key: string;
  label: string;
  objective: string;
  mode: MissionActMode;
}

export interface MissionCheckpointDef {
  key: string;
  label: string;
  resumeActKey: string;
}

export interface MissionDef {
  key: string;
  planetKey: string;
  label: string;
  acts: MissionActDef[];
  checkpoints: MissionCheckpointDef[];
}
