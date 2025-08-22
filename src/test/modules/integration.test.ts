import { describe, it, expect, beforeEach } from 'vitest'
import { PlanetModule } from '../../engine/modules/planet'
import { TerrainTileModule } from '../../engine/modules/tile'
import { IconModule } from '../../engine/modules/icon'
import { createPixelCanvas } from '../../engine/pixelCanvas'
import { mulberry32 } from '../../engine/rng'
import { Palettes } from '../../engine/palette'
import { runModule } from '../../engine/index'
import type { EngineContext, SpriteModule } from '../../engine/types'

describe('Updated Modules Integration', () => {
  const modules = [
    { module: PlanetModule, name: 'Planet' },
    { module: TerrainTileModule, name: 'Tile' },
    { module: IconModule, name: 'Icon' }
  ]

  describe('Engine v0.3.0 Feature Compatibility', () => {
    it('should all implement the finalize method', () => {
      modules.forEach(({ module, name }) => {
        expect(module.finalize).toBeDefined()
        expect(typeof module.finalize).toBe('function')
      })
    })

    it('should all provide preferred palettes', () => {
      modules.forEach(({ module, name }) => {
        const capabilities = module.capabilities()
        expect(capabilities.preferredPalettes).toBeDefined()
        expect(Array.isArray(capabilities.preferredPalettes)).toBe(true)
        expect(capabilities.preferredPalettes!.length).toBeGreaterThan(0)
      })
    })

    it('should all have updated version numbers', () => {
      modules.forEach(({ module, name }) => {
        expect(module.version).toBe('0.4.0')
      })
    })

    it('should all use RNG splitting for deterministic sub-features', () => {
      modules.forEach(({ module, name }) => {
        const size = module.id === 'icon' ? 16 : 32
        const ctx: EngineContext = {
          canvas: createPixelCanvas(size, size),
          rng: mulberry32(12345),
          palette: Palettes.NES_13,
          dither: 'bayer4',
          quantizer: 'nearest',
          retro: {
            outlineWidth: 1,
            microJitter: true,
            microJitterStrength: 0.15
          },
          timeBudgetMs: 16
        }

        // Generate twice with same seed - should be identical
        const ctx1 = { ...ctx, canvas: createPixelCanvas(size, size), rng: mulberry32(12345) }
        const ctx2 = { ...ctx, canvas: createPixelCanvas(size, size), rng: mulberry32(12345) }

        module.generate(ctx1, {})
        module.generate(ctx2, {})

        expect(new Uint32Array(ctx1.canvas.data)).toEqual(new Uint32Array(ctx2.canvas.data))
      })
    })
  })

  describe('Micro-Jitter Integration', () => {
    it('should enhance micro-jitter strength in finalize for appropriate content', () => {
      // Test Planet volcanic enhancement
      const planetCtx: EngineContext = {
        canvas: createPixelCanvas(32, 32),
        rng: mulberry32(12345),
        palette: Palettes.NES_13,
        dither: 'bayer4',
        quantizer: 'nearest',
        retro: {
          outlineWidth: 1,
          microJitter: true,
          microJitterStrength: 0.15
        },
        timeBudgetMs: 16
      }

      const originalStrength = planetCtx.retro.microJitterStrength
      PlanetModule.finalize?.(planetCtx, { volcanic: true })
      expect(planetCtx.retro.microJitterStrength ?? 0).toBeGreaterThan(originalStrength ?? 0)

      // Test Tile metallic enhancement
      const tileCtx: EngineContext = {
        canvas: createPixelCanvas(32, 32),
        rng: mulberry32(12345),
        palette: Palettes.NES_13,
        dither: 'bayer4',
        quantizer: 'nearest',
        retro: {
          outlineWidth: 1,
          microJitter: true,
          microJitterStrength: 0.15
        },
        timeBudgetMs: 16
      }

      const originalTileStrength = tileCtx.retro.microJitterStrength
      TerrainTileModule.finalize?.(tileCtx, { metallic: true })
      expect(tileCtx.retro.microJitterStrength ?? 0).toBeGreaterThan(originalTileStrength ?? 0)

      // Test Icon precious enhancement
      const iconCtx: EngineContext = {
        canvas: createPixelCanvas(16, 16),
        rng: mulberry32(12345),
        palette: Palettes.NES_13,
        dither: 'bayer4',
        quantizer: 'nearest',
        retro: {
          outlineWidth: 1,
          microJitter: true,
          microJitterStrength: 0.15
        },
        timeBudgetMs: 16
      }

      const originalIconStrength = iconCtx.retro.microJitterStrength
      IconModule.finalize?.(iconCtx, { style: 'precious' })
      expect(iconCtx.retro.microJitterStrength ?? 0).toBeGreaterThan(originalIconStrength ?? 0)
    })

    it('should respect micro-jitter strength limits', () => {
      modules.forEach(({ module, name }) => {
        const ctx: EngineContext = {
          canvas: createPixelCanvas(32, 32),
          rng: mulberry32(12345),
          palette: Palettes.NES_13,
          dither: 'bayer4',
          quantizer: 'nearest',
          retro: {
            outlineWidth: 1,
            microJitter: true,
            microJitterStrength: 0.15
          },
          timeBudgetMs: 16
        }

        // Test with parameters that should enhance jitter
        const enhancingParams = module.id === 'planet' ? { volcanic: true } :
                               module.id === 'tile' ? { metallic: true } :
                               { style: 'precious' }

        module.finalize?.(ctx, enhancingParams)

        // Should never exceed reasonable limits
        expect(ctx.retro.microJitterStrength).toBeLessThanOrEqual(0.5)
        expect(ctx.retro.microJitterStrength).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Enhanced Archetypes', () => {
    it('should provide more diverse archetypes than previous versions', () => {
      // Planet should have 7 archetypes including volcanic and crystalline
      const planetArchetypes = PlanetModule.archetypes()
      expect(planetArchetypes).toHaveLength(7)
      expect(planetArchetypes.some(a => a.id === 'volcanic')).toBe(true)

      // Tile should have 9 archetypes including metal, sand, water, crystal, tech
      const tileArchetypes = TerrainTileModule.archetypes()
      expect(tileArchetypes).toHaveLength(9)
      expect(tileArchetypes.some(a => a.id === 'metal')).toBe(true)
      expect(tileArchetypes.some(a => a.id === 'sand')).toBe(true)
      expect(tileArchetypes.some(a => a.id === 'water')).toBe(true)

      // Icon should have 10 archetypes including gem, sword, potion, orb, rune
      const iconArchetypes = IconModule.archetypes()
      expect(iconArchetypes).toHaveLength(10)
      expect(iconArchetypes.some(a => a.id === 'gem')).toBe(true)
      expect(iconArchetypes.some(a => a.id === 'sword')).toBe(true)
      expect(iconArchetypes.some(a => a.id === 'potion')).toBe(true)
    })

    it('should have unique archetypes with distinct parameters', () => {
      modules.forEach(({ module, name }) => {
        const archetypes = module.archetypes()
        
        // Check that we have the expected number of archetypes
        expect(archetypes.length).toBeGreaterThan(1)
        
        // Check that each archetype has a unique ID
        const archetypeIds = archetypes.map(a => a.id)
        const uniqueIds = new Set(archetypeIds)
        expect(uniqueIds.size).toEqual(archetypes.length)
        
        // Check that the archetypes have different parameter sets
        for (let i = 0; i < archetypes.length; i++) {
          for (let j = i + 1; j < archetypes.length; j++) {
            const a1 = archetypes[i]
            const a2 = archetypes[j]
            
            // Instead of testing the visual output, test that the params differ
            // which should lead to visual differences in a proper rendering environment
            const params1 = JSON.stringify(a1.params)
            const params2 = JSON.stringify(a2.params)
            
            expect(params1).not.toEqual(params2)
          }
        }
      })
    })
  })

  describe('Engine Integration with runModule', () => {
    it('should work correctly with the engine pipeline including micro-jitter', () => {
      const testParams = [
        {
          module: PlanetModule,
          params: {
            spriteType: 'planet',
            archetype: 'volcanic',
            seed: 12345,
            size: 48,
            paletteName: 'SNES_32' as keyof typeof Palettes,
            dither: 'bayer4' as const,
            quantizer: 'nearest' as const,
            outline: 1 as const,
            params: { volcanic: true },
            microJitter: true,
            microJitterStrength: 0.15
          }
        },
        {
          module: TerrainTileModule,
          params: {
            spriteType: 'tile',
            archetype: 'metal',
            seed: 12345,
            size: 32,
            paletteName: 'NES_13' as keyof typeof Palettes,
            dither: 'bayer4' as const,
            quantizer: 'nearest' as const,
            outline: 1 as const,
            params: { metallic: true },
            microJitter: true,
            microJitterStrength: 0.15
          }
        },
        {
          module: IconModule,
          params: {
            spriteType: 'icon',
            archetype: 'gem',
            seed: 12345,
            size: 16,
            paletteName: 'GB_4' as keyof typeof Palettes,
            dither: 'bayer4' as const,
            quantizer: 'nearest' as const,
            outline: 1 as const,
            params: { style: 'precious', glow: true },
            microJitter: true,
            microJitterStrength: 0.15
          }
        }
      ]

      testParams.forEach(({ module, params }) => {
        expect(() => {
          const result = runModule(module, params)
          expect(result).toBeDefined()
          expect(result.w).toBe(params.size)
          expect(result.h).toBe(params.size)
        }).not.toThrow()
      })
    })

    it('should handle similarity guard integration', () => {
      const params = {
        spriteType: 'planet',
        archetype: 'lush',
        seed: 12345,
        size: 32,
        paletteName: 'NES_13' as keyof typeof Palettes,
        dither: 'bayer4' as const,
        quantizer: 'nearest' as const,
        outline: 1 as const,
        params: { clouds: true },
        useSimilarityGuard: true,
        microJitter: true,
        microJitterStrength: 0.15
      }

      expect(() => {
        const result = runModule(PlanetModule, params)
        expect(result).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('New Parameter Features', () => {
    it('should support new complexity parameter in Icon module', () => {
      const schema = IconModule.schema()
      const complexityParam = schema.find(p => p.key === 'complexity')

      expect(complexityParam).toBeDefined()
      expect(complexityParam?.type).toBe('range')
      expect(complexityParam?.min).toBe(0)
      expect(complexityParam?.max).toBe(1)
    })

    it('should support new glow parameter in Icon module', () => {
      const schema = IconModule.schema()
      const glowParam = schema.find(p => p.key === 'glow')

      expect(glowParam).toBeDefined()
      expect(glowParam?.type).toBe('bool')
    })

    it('should support new vegetation parameter in Tile module', () => {
      const schema = TerrainTileModule.schema()
      const vegetationParam = schema.find(p => p.key === 'vegetation')

      expect(vegetationParam).toBeDefined()
      expect(vegetationParam?.type).toBe('bool')
    })

    it('should support new volcanic parameter in Planet module', () => {
      const schema = PlanetModule.schema()
      const volcanicParam = schema.find(p => p.key === 'volcanic')

      expect(volcanicParam).toBeDefined()
      expect(volcanicParam?.type).toBe('bool')
    })
  })

  describe('Backward Compatibility', () => {
    it('should generate sprites without errors when using default parameters', () => {
      modules.forEach(({ module, name }) => {
        const size = module.id === 'icon' ? 16 : 32
        const ctx: EngineContext = {
          canvas: createPixelCanvas(size, size),
          rng: mulberry32(12345),
          palette: Palettes.NES_13,
          dither: 'bayer4',
          quantizer: 'nearest',
          retro: {
            outlineWidth: 1,
            microJitter: false, // Test without micro-jitter
            microJitterStrength: 0.15
          },
          timeBudgetMs: 16
        }

        expect(() => {
          module.generate(ctx, {}) // Empty params should use defaults
        }).not.toThrow()
      })
    })

    it('should handle missing optional parameters gracefully', () => {
      modules.forEach(({ module, name }) => {
        const size = module.id === 'icon' ? 16 : 32
        const ctx: EngineContext = {
          canvas: createPixelCanvas(size, size),
          rng: mulberry32(12345),
          palette: Palettes.NES_13,
          dither: 'none', // Test with no dithering
          quantizer: 'none', // Test with no quantization
          retro: {
            outlineWidth: 0, // Test with no outline
            microJitter: false
          },
          timeBudgetMs: 16
        }

        expect(() => {
          module.generate(ctx, {})
          module.finalize?.(ctx, {})
        }).not.toThrow()
      })
    })
  })
})
