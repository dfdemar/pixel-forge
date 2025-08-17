import type { EngineContext, SpriteModule, Palette, DitherMode, Quantizer } from './types'
import { createPixelCanvas } from './pixelCanvas'
import { mulberry32 } from './rng'
import { Palettes } from './palette'
import { enforceRetro } from './retro'
import { globalSimilarityGuard } from './similarityGuard'

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
  useSimilarityGuard?: boolean;
}

export function runModule(mod: SpriteModule, opts: EngineParams){
  const palette: Palette = Palettes[opts.paletteName] || Palettes.NES_13;
  let rng = mulberry32(opts.seed>>>0);
  const canvas = createPixelCanvas(opts.size, opts.size);

  let finalParams = opts.params || {};
  let retryCount = 0;
  const maxRetries = 5;

  // Similarity guard logic for variation
  if (opts.useSimilarityGuard) {
    while (retryCount < maxRetries) {
      // Create context for this attempt
      const ctx: EngineContext = {
        canvas: createPixelCanvas(opts.size, opts.size),
        rng: rng.split(`attempt_${retryCount}`),
        palette,
        dither: opts.dither,
        quantizer: opts.quantizer,
        retro: { outlineWidth: opts.outline },
        timeBudgetMs: 16
      }

      // Generate sprite
      mod.generate(ctx, finalParams);
      enforceRetro(ctx);
      if(mod.finalize) mod.finalize(ctx, finalParams);

      // Check similarity
      const signature = globalSimilarityGuard.generateSignature(ctx.canvas, finalParams);

      if (!globalSimilarityGuard.isSimilar(signature)) {
        // Not similar - use this result
        globalSimilarityGuard.addToHistory(signature);
        canvas.blit(ctx.canvas, 0, 0);
        return canvas;
      }

      // Too similar - nudge parameters and try again
      finalParams = globalSimilarityGuard.suggestParamNudges(finalParams, rng);
      retryCount++;
    }
  }

  // Standard generation (no similarity guard or max retries reached)
  const ctx: EngineContext = {
    canvas, rng,
    palette,
    dither: opts.dither,
    quantizer: opts.quantizer,
    retro: { outlineWidth: opts.outline },
    timeBudgetMs: 16
  }

  mod.generate(ctx, finalParams);
  enforceRetro(ctx);
  if(mod.finalize) mod.finalize(ctx, finalParams);

  // Add to history even if we didn't use similarity guard for this generation
  if (opts.useSimilarityGuard) {
    const signature = globalSimilarityGuard.generateSignature(canvas, finalParams);
    globalSimilarityGuard.addToHistory(signature);
  }

  return canvas;
}
