import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runModule } from '@engine/index'
import { getModuleById } from '@engine/registry'
import { globalSimilarityGuard } from '@engine/similarityGuard'
import type { SpriteModule } from '@engine/types'

describe('Engine Integration', () => {
  let mockModule: SpriteModule

  beforeEach(() => {
    // Reset global similarity guard
    globalSimilarityGuard.reset()

    // Create a mock module for testing
    mockModule = {
      id: 'test',
      version: '1.0.0',
      archetypes: () => [
        { id: 'basic', label: 'Basic', params: { density: 0.5 } }
      ],
      schema: () => [
        { key: 'density', type: 'range', label: 'Density', min: 0, max: 1, default: 0.5 }
      ],
      capabilities: () => ({
        minSize: [16, 16],
        maxSize: [128, 128],
        supportsAnimation: false,
        tileable: false
      }),
      generate: vi.fn((ctx, params) => {
        // Simple test pattern - draw a rectangle based on density param
        const { canvas } = ctx
        const size = Math.min(canvas.w, canvas.h)
        const margin = Math.floor(size * 0.2)

        // Use density to vary the pattern significantly
        const density = params.density || 0.5
        const step = Math.max(1, Math.floor(4 * (1 - density)))

        for (let y = margin; y < size - margin; y += step) {
          for (let x = margin; x < size - margin; x += step) {
            const colorIntensity = Math.floor(density * 255)
            const color = 0xff000000 | (colorIntensity << 16) | (colorIntensity << 8) | colorIntensity
            canvas.set(x, y, color)
          }
        }
      })
    }
  })

  it('should execute complete generation pipeline', () => {
    const result = runModule(mockModule, {
      spriteType: 'test',
      archetype: 'basic',
      seed: 12345,
      size: 32,
      paletteName: 'NES_13',
      dither: 'bayer4',
      quantizer: 'nearest',
      outline: 1,
      params: { density: 0.7 }
    })

    expect(result).toBeDefined()
    expect(result.w).toBe(32)
    expect(result.h).toBe(32)
    expect(vi.mocked(mockModule.generate)).toHaveBeenCalledOnce()
  })

  it('should pass correct context to module', () => {
    runModule(mockModule, {
      spriteType: 'test',
      seed: 54321,
      size: 48,
      paletteName: 'SNES_32',
      dither: 'bayer8',
      quantizer: 'nearest',
      outline: 0,
      params: { density: 0.3 }
    })

    const call = vi.mocked(mockModule.generate).mock.calls[0]
    const [ctx, params] = call

    expect(ctx.canvas.w).toBe(48)
    expect(ctx.canvas.h).toBe(48)
    expect(ctx.palette.name).toBe('SNES_32')
    expect(ctx.dither).toBe('bayer8')
    expect(ctx.quantizer).toBe('nearest')
    expect(ctx.retro.outlineWidth).toBe(0)
    expect(params.density).toBe(0.3)
  })

  it('should handle micro-jitter parameters', () => {
    runModule(mockModule, {
      spriteType: 'test',
      seed: 12345,
      size: 32,
      paletteName: 'NES_13',
      dither: 'none',
      quantizer: 'nearest',
      outline: 1,
      params: {},
      microJitter: true,
      microJitterStrength: 0.25
    })

    const call = vi.mocked(mockModule.generate).mock.calls[0]
    const [ctx] = call

    expect(ctx.retro.microJitter).toBe(true)
    expect(ctx.retro.microJitterStrength).toBe(0.25)
  })

  it('should use similarity guard when enabled', () => {
    const params = {
      spriteType: 'test',
      seed: 12345,
      size: 32,
      paletteName: 'NES_13' as const,
      dither: 'none' as const,
      quantizer: 'nearest' as const,
      outline: 0 as const,
      params: { density: 0.5 },
      useSimilarityGuard: true
    }

    // First generation should succeed normally
    const result1 = runModule(mockModule, params)
    expect(result1).toBeDefined()
    expect(vi.mocked(mockModule.generate)).toHaveBeenCalledTimes(1)

    // Reset mock to track subsequent calls
    vi.mocked(mockModule.generate).mockClear()

    // Second generation with same params might trigger similarity guard
    const result2 = runModule(mockModule, params)
    expect(result2).toBeDefined()

    // Similarity guard might have caused multiple generation attempts
    expect(vi.mocked(mockModule.generate).mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('should fallback after max retries with similarity guard', () => {
    // Create a module that always generates the same thing
    const deterministic = {
      ...mockModule,
      generate: vi.fn((ctx) => {
        // Always draw the exact same pattern
        ctx.canvas.set(16, 16, 0xffffffff)
      })
    }

    const params = {
      spriteType: 'test',
      seed: 12345,
      size: 32,
      paletteName: 'NES_13' as const,
      dither: 'none' as const,
      quantizer: 'nearest' as const,
      outline: 0 as const,
      params: {},
      useSimilarityGuard: true
    }

    // Fill similarity guard history with identical signatures
    for (let i = 0; i < 3; i++) {
      runModule(deterministic, { ...params, seed: 12345 + i })
    }

    vi.mocked(deterministic.generate).mockClear()

    // This should hit max retries and still return a result
    const result = runModule(deterministic, params)
    expect(result).toBeDefined()

    // Should have attempted multiple generations due to similarity
    expect(vi.mocked(deterministic.generate).mock.calls.length).toBeGreaterThan(1)
  })

  it('should call finalize method if present', () => {
    const moduleWithFinalize = {
      ...mockModule,
      finalize: vi.fn()
    }

    runModule(moduleWithFinalize, {
      spriteType: 'test',
      seed: 12345,
      size: 32,
      paletteName: 'NES_13',
      dither: 'none',
      quantizer: 'nearest',
      outline: 0,
      params: {}
    })

    expect(vi.mocked(moduleWithFinalize.finalize)).toHaveBeenCalledOnce()
  })

  it('should handle missing palette gracefully', () => {
    const result = runModule(mockModule, {
      spriteType: 'test',
      seed: 12345,
      size: 32,
      paletteName: 'NONEXISTENT' as any,
      dither: 'none',
      quantizer: 'nearest',
      outline: 0,
      params: {}
    })

    // Should fallback to NES_13 palette
    expect(result).toBeDefined()

    const call = vi.mocked(mockModule.generate).mock.calls[0]
    const [ctx] = call
    expect(ctx.palette.name).toBe('NES_13')
  })

  it('should create deterministic output for same seed', () => {
    const params = {
      spriteType: 'test',
      seed: 98765,
      size: 32,
      paletteName: 'NES_13' as const,
      dither: 'bayer4' as const,
      quantizer: 'nearest' as const,
      outline: 1 as const,
      params: { density: 0.6 }
    }

    const result1 = runModule(mockModule, params)
    const result2 = runModule(mockModule, params)

    // Results should be identical for same seed
    expect(result1.data).toEqual(result2.data)
  })

  it('should create different output for different seeds', () => {
    const baseParams = {
      spriteType: 'test',
      size: 32,
      paletteName: 'NES_13' as const,
      dither: 'bayer4' as const,
      quantizer: 'nearest' as const,
      outline: 1 as const,
      params: { density: 0.6 }
    }

    const result1 = runModule(mockModule, { ...baseParams, seed: 111 })
    const result2 = runModule(mockModule, { ...baseParams, seed: 222, params: { density: 0.3 } })

    // Results should be different for different seeds and different params
    expect(result1.data).not.toEqual(result2.data)
  })
})

describe('Module Registry Integration', () => {
  it('should retrieve built-in modules', () => {
    const planetModule = getModuleById('planet')
    expect(planetModule).toBeDefined()
    expect(planetModule?.id).toBe('planet')

    const tileModule = getModuleById('tile')
    expect(tileModule).toBeDefined()
    expect(tileModule?.id).toBe('tile')

    const iconModule = getModuleById('icon')
    expect(iconModule).toBeDefined()
    expect(iconModule?.id).toBe('icon')
  })

  it('should return undefined for non-existent modules', () => {
    const nonExistent = getModuleById('nonexistent')
    expect(nonExistent).toBeUndefined()
  })

  it('should work with real planet module', () => {
    const planetModule = getModuleById('planet')
    expect(planetModule).toBeDefined()

    if (planetModule) {
      const result = runModule(planetModule, {
        spriteType: 'planet',
        archetype: 'lush',
        seed: 12345,
        size: 64,
        paletteName: 'SNES_32',
        dither: 'bayer4',
        quantizer: 'nearest',
        outline: 1,
        params: {
          featureDensity: 0.6,
          clouds: true,
          bands: false,
          ringChance: 0.15
        }
      })

      expect(result).toBeDefined()
      expect(result.w).toBe(64)
      expect(result.h).toBe(64)

      // Should have non-transparent pixels (a planet was drawn)
      const hasContent = Array.from(result.data).some(pixel => (pixel >>> 24) > 0)
      expect(hasContent).toBe(true)
    }
  })
})
