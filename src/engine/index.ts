import type { EngineContext, SpriteModule, Palette, DitherMode, Quantizer } from './types'
import { createPixelCanvas } from './pixelCanvas'
import { mulberry32 } from './rng'
import { Palettes } from './palette'
import { enforceRetro } from './retro'

export type EngineParams = {
  spriteType: string;
  archetype?: string;
  seed: number;
  size: number;
  paletteName: keyof typeof Palettes;
  dither: DitherMode;
  quantizer: Quantizer;
  outline: 0|1|2;
  params: Record<string, any>;
}

export function runModule(mod: SpriteModule, opts: EngineParams){
  const palette: Palette = Palettes[opts.paletteName] || Palettes.NES_13;
  const rng = mulberry32(opts.seed>>>0);
  const canvas = createPixelCanvas(opts.size, opts.size);
  const ctx: EngineContext = {
    canvas, rng,
    palette,
    dither: opts.dither,
    quantizer: opts.quantizer,
    retro: { outlineWidth: opts.outline },
    timeBudgetMs: 16
  }
  mod.generate(ctx, opts.params||{});
  enforceRetro(ctx);
  if(mod.finalize) mod.finalize(ctx, opts.params||{});
  return canvas;
}
