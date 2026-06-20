export interface WaveDef {
  label: string;
  enemyBudget: number;
  speedBonus: number;
}

export const WAVES: WaveDef[] = [
  { label: 'clarity-scan', enemyBudget: 12, speedBonus: 0 },
  { label: 'fog-lane', enemyBudget: 18, speedBonus: 20 },
  { label: 'regulator-net', enemyBudget: 24, speedBonus: 40 },
];
