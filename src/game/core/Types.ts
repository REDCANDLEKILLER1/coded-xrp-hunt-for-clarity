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

export type SpriteSheetMeta = {
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps?: number;
};

export type AssetDefinition =
  | string
  | {
      src: string;
      type?: 'image' | 'spritesheet';
      sheet?: SpriteSheetMeta;
      notes?: string;
    };

export type AssetManifest = Record<string, Record<string, AssetDefinition>>;

export type AssetDiagnostic = {
  id: string;
  category: string;
  src: string;
  status: 'loaded' | 'missing' | 'error';
  type: 'image' | 'spritesheet';
  sheet?: SpriteSheetMeta;
};

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
