import { describe, it, expect, beforeEach } from 'vitest'
import { PlanetModule } from '../../engine/modules/planet'
import { createPixelCanvas } from '../../engine/pixelCanvas'
import { mulberry32 } from '../../engine/rng'
import { Palettes } from '../../engine/palette'
import type { EngineContext } from '../../engine/types'

describe('PlanetModule', () => {
  let ctx: EngineContext

  beforeEach(() => {
    ctx = {
      canvas: createPixelCanvas(64, 64),
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
  })

  describe('Module Structure', () => {
    it('should have correct module metadata', () => {
      expect(PlanetModule.id).toBe('planet')
      expect(PlanetModule.version).toBe('0.4.0')
    })

    it('should provide valid archetypes', () => {
      const archetypes = PlanetModule.archetypes()
      expect(archetypes).toHaveLength(7)

      const archetypeIds = archetypes.map(a => a.id)
      expect(archetypeIds).toContain('lush')
      expect(archetypeIds).toContain('arid')
      expect(archetypeIds).toContain('ice')
      expect(archetypeIds).toContain('gas')
      expect(archetypeIds).toContain('volcanic')
      expect(archetypeIds).toContain('barren')
      expect(archetypeIds).toContain('crystalline')

      // Check that volcanic archetype has correct params
      const volcanic = archetypes.find(a => a.id === 'volcanic')
      expect(volcanic?.params.volcanic).toBe(true)
      expect(volcanic?.params.clouds).toBe(false)
    })

    it('should provide valid schema', () => {
      const schema = PlanetModule.schema()
      const paramKeys = schema.map(p => p.key)

      expect(paramKeys).toContain('size')
      expect(paramKeys).toContain('featureDensity')
      expect(paramKeys).toContain('clouds')
      expect(paramKeys).toContain('bands')
      expect(paramKeys).toContain('ringChance')
      expect(paramKeys).toContain('atmosphere')
      expect(paramKeys).toContain('volcanic')

      // Check size parameter constraints
      const sizeParam = schema.find(p => p.key === 'size')
      expect(sizeParam?.min).toBe(32)
      expect(sizeParam?.max).toBe(96)
      expect(sizeParam?.default).toBe(64)
    })

    it('should have correct capabilities', () => {
      const capabilities = PlanetModule.capabilities()
      expect(capabilities.minSize).toEqual([32, 32])
      expect(capabilities.maxSize).toEqual([96, 96])
      expect(capabilities.supportsAnimation).toBe(false)
      expect(capabilities.tileable).toBe(false)
      expect(capabilities.preferredPalettes).toContain('SNES_32')
      expect(capabilities.preferredPalettes).toContain('NES_13')
    })
  })

  describe('Generation', () => {
    it('should generate deterministic output with same seed', () => {
      const params = { size: 32, featureDensity: 0.5, clouds: true }

      // Generate first planet
      const ctx1 = { ...ctx, canvas: createPixelCanvas(32, 32), rng: mulberry32(12345) }
      PlanetModule.generate(ctx1, params)
      const data1 = new Uint32Array(ctx1.canvas.data)

      // Generate second planet with same seed
      const ctx2 = { ...ctx, canvas: createPixelCanvas(32, 32), rng: mulberry32(12345) }
      PlanetModule.generate(ctx2, params)
      const data2 = new Uint32Array(ctx2.canvas.data)

      expect(data1).toEqual(data2)
    })

    it('should generate different output with different seeds', () => {
      const params = { size: 32, featureDensity: 0.5, clouds: true }

      // Generate with seed 1
      const ctx1 = { ...ctx, canvas: createPixelCanvas(32, 32), rng: mulberry32(12345) }
      PlanetModule.generate(ctx1, params)
      const data1 = new Uint32Array(ctx1.canvas.data)

      // Generate with seed 2
      const ctx2 = { ...ctx, canvas: createPixelCanvas(32, 32), rng: mulberry32(54321) }
      PlanetModule.generate(ctx2, params)
      const data2 = new Uint32Array(ctx2.canvas.data)

      expect(data1).not.toEqual(data2)
    })

    it('should respect size parameter bounds', () => {
      // Test minimum size
      const ctxSmall = { ...ctx, canvas: createPixelCanvas(16, 16) }
      PlanetModule.generate(ctxSmall, { size: 16 })
      expect(ctxSmall.canvas.w).toBe(16)
      expect(ctxSmall.canvas.h).toBe(16)

      // Test maximum size
      const ctxLarge = { ...ctx, canvas: createPixelCanvas(128, 128) }
      PlanetModule.generate(ctxLarge, { size: 128 })
      expect(ctxLarge.canvas.w).toBe(128)
      expect(ctxLarge.canvas.h).toBe(128)
    })

    it('should generate planets with circular shape', () => {
      const size = 32
      const ctx32 = { ...ctx, canvas: createPixelCanvas(size, size) }
      PlanetModule.generate(ctx32, { size })

      const center = size / 2
      const radius = size / 2

      // Check that pixels near center are non-transparent
      const centerPixel = ctx32.canvas.get(center, center)
      expect(centerPixel >>> 24).toBeGreaterThan(0) // Has alpha

      // Check that corners are transparent (outside circle)
      const cornerPixel = ctx32.canvas.get(0, 0)
      expect(cornerPixel >>> 24).toBe(0) // Transparent
    })

    it('should generate gas giant bands when bands=true', () => {
      const size = 32
      const ctx32 = { ...ctx, canvas: createPixelCanvas(size, size) }
      PlanetModule.generate(ctx32, { size, bands: true })

      // Gas giants should have horizontal band patterns
      // Check that there's variation across Y axis
      let yVariations = 0
      const centerX = size / 2
      let lastColor = 0

      for (let y = 5; y < size - 5; y++) {
        const pixel = ctx32.canvas.get(centerX, y)
        if (pixel !== lastColor && (pixel >>> 24) > 0) {
          yVariations++
          lastColor = pixel
        }
      }

      expect(yVariations).toBeGreaterThan(2) // Should have band transitions
    })

    it('should generate volcanic effects when volcanic=true', () => {
      const size = 48
      const ctx48 = { ...ctx, canvas: createPixelCanvas(size, size) }
      PlanetModule.generate(ctx48, { size, volcanic: true, featureDensity: 0.8 })

      // Check for red/orange volcanic colors
      let volcanicPixels = 0
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const pixel = ctx48.canvas.get(x, y)
          if ((pixel >>> 24) > 0) { // Non-transparent
            const r = (pixel >>> 16) & 0xFF
            const g = (pixel >>> 8) & 0xFF
            const b = pixel & 0xFF

            // Look for reddish pixels (volcanic heat)
            if (r > g + 50 && r > b + 50) {
              volcanicPixels++
            }
          }
        }
      }

      expect(volcanicPixels).toBeGreaterThan(0)
    })

    it('should generate atmospheric glow when atmosphere=true', () => {
      const size = 48
      const ctx48 = { ...ctx, canvas: createPixelCanvas(size, size) }
      PlanetModule.generate(ctx48, { size, atmosphere: true })

      const center = size / 2
      const radius = size / 2

      // Check for semi-transparent pixels just outside the planet radius
      let glowPixels = 0
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center
          const dy = y - center
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist > radius && dist <= radius * 1.2) {
            const pixel = ctx48.canvas.get(x, y)
            const alpha = (pixel >>> 24) & 0xFF
            if (alpha > 0 && alpha < 255) {
              glowPixels++
            }
          }
        }
      }

      expect(glowPixels).toBeGreaterThan(0)
    })

    it('should generate clouds when clouds=true', () => {
      const size = 48
      const ctx48 = { ...ctx, canvas: createPixelCanvas(size, size) }

      // Generate without clouds first
      PlanetModule.generate(ctx48, { size, clouds: false })
      const dataWithoutClouds = new Uint32Array(ctx48.canvas.data)

      // Generate with clouds
      ctx48.canvas.clear(0)
      PlanetModule.generate(ctx48, { size, clouds: true })
      const dataWithClouds = new Uint32Array(ctx48.canvas.data)

      // Should be different when clouds are added
      expect(dataWithClouds).not.toEqual(dataWithoutClouds)

      // Look for bright cloud pixels
      let cloudPixels = 0
      for (let i = 0; i < dataWithClouds.length; i++) {
        const pixel = dataWithClouds[i]
        if ((pixel >>> 24) > 0) {
          const r = (pixel >>> 16) & 0xFF
          const g = (pixel >>> 8) & 0xFF
          const b = pixel & 0xFF

          // Look for bright white/gray pixels (clouds)
          if (r > 200 && g > 200 && b > 200) {
            cloudPixels++
          }
        }
      }

      expect(cloudPixels).toBeGreaterThan(0)
    })
  })

  describe('Finalize Effects', () => {
    it('should enhance micro-jitter for volcanic planets', () => {
      const params = { volcanic: true }
      const originalStrength = ctx.retro.microJitterStrength

      PlanetModule.finalize?.(ctx, params)

      if (ctx.retro.microJitter) {
        expect(ctx.retro.microJitterStrength ?? 0).toBeGreaterThan(originalStrength ?? 0)
        expect(ctx.retro.microJitterStrength ?? 0).toBeLessThanOrEqual(0.25)
      }
    })

    it('should not modify jitter strength for non-volcanic planets', () => {
      const params = { volcanic: false }
      const originalStrength = ctx.retro.microJitterStrength

      PlanetModule.finalize?.(ctx, params)

      expect(ctx.retro.microJitterStrength).toBe(originalStrength)
    })
  })

  describe('Parameter Variations', () => {
    it('should vary output based on featureDensity', () => {
      const size = 32

      // Low density
      const ctxLow = { ...ctx, canvas: createPixelCanvas(size, size), rng: mulberry32(12345) }
      PlanetModule.generate(ctxLow, { size, featureDensity: 0.1 })
      const dataLow = new Uint32Array(ctxLow.canvas.data)

      // High density
      const ctxHigh = { ...ctx, canvas: createPixelCanvas(size, size), rng: mulberry32(12345) }
      PlanetModule.generate(ctxHigh, { size, featureDensity: 0.9 })
      const dataHigh = new Uint32Array(ctxHigh.canvas.data)

      expect(dataLow).not.toEqual(dataHigh)
    })

    it('should generate rings based on ringChance', () => {
      const size = 48
      let planetsWithRings = 0
      const totalTests = 20

      for (let i = 0; i < totalTests; i++) {
        const testCtx = { ...ctx, canvas: createPixelCanvas(size, size), rng: mulberry32(12345 + i) }
        PlanetModule.generate(testCtx, { size, ringChance: 0.8 }) // High ring chance

        // Check for ring pixels outside planet radius
        const center = size / 2
        const planetRadius = center
        let hasRings = false

        for (let y = 0; y < size && !hasRings; y++) {
          for (let x = 0; x < size && !hasRings; x++) {
            const dx = x - center
            const dy = y - center
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist > planetRadius * 1.05 && dist < planetRadius * 1.45) {
              const pixel = testCtx.canvas.get(x, y)
              if ((pixel >>> 24) > 0) {
                hasRings = true
              }
            }
          }
        }

        if (hasRings) planetsWithRings++
      }

      // With 80% ring chance, we should see rings in most tests
      expect(planetsWithRings).toBeGreaterThan(totalTests * 0.3) // At least 30% should have rings
    })
  })
})
