export type SceneName = 'title' | 'play' | 'results';

export type Vec2 = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AssetEntry = {
  id: string;
  src: string;
  notes?: string;
};

export type AssetManifest = Record<string, AssetEntry[]>;

export type Scene = {
  enter?: () => void;
  exit?: () => void;
  update: (dt: number) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
};

export type GameStats = {
  score: number;
  wave: number;
  health: number;
  maxHealth: number;
  special: number;
  gameOver: boolean;
};
