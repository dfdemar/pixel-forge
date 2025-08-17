export type RNG = {
  nextFloat(): number;
  nextInt(n: number): number;
  split(label?: string): RNG;
};

export type Palette = {
  name: string;
  colors: Uint32Array; // ARGB
  maxColors: number;
};

export type DitherMode = 'none' | 'bayer4' | 'bayer8';
export type Quantizer = 'none' | 'nearest';

export type RetroPolicy = {
  outlineWidth: 0 | 1 | 2;
  microJitter?: boolean;
  microJitterStrength?: number;
};

export type PixelCanvas = {
  w: number; h: number;
  data: Uint32Array; // ARGB
  clear(argb: number): void;
  set(x: number, y: number, argb: number): void;
  get(x: number, y: number): number;
  blit(src: PixelCanvas, dx: number, dy: number): void;
  toImageData(): ImageData;
};

export type EngineContext = {
  canvas: PixelCanvas;
  rng: RNG;
  palette: Palette;
  dither: DitherMode;
  quantizer: Quantizer;
  retro: RetroPolicy;
  timeBudgetMs: number;
};

export type ModuleParam = {
  key: string;
  type: 'range' | 'enum' | 'int' | 'bool' | 'seed';
  label: string;
  min?: number; max?: number; step?: number;
  options?: string[];
  default: any;
};

export type SpriteModule = {
  id: string;
  version: string;
  archetypes(): { id: string; label: string; params: Partial<Record<string, any>> }[];
  schema(): ModuleParam[];
  capabilities(): {
    minSize: [number, number];
    maxSize: [number, number];
    supportsAnimation: boolean;
    tileable: boolean;
    preferredPalettes?: string[];
  };
  generate(ctx: EngineContext, params: Record<string, any>): void;
  finalize?(ctx: EngineContext, params: Record<string, any>): void;
};

// New types for similarity guard
export type SpriteSignature = {
  edgeHistogram: number[];
  paletteUsage: number[];
  timestamp: number;
  params: Record<string, any>;
};

export type SimilarityGuardConfig = {
  maxHistory: number;
  edgeThreshold: number;
  paletteThreshold: number;
  maxRetries: number;
};
