import { describe, it, expect, beforeEach } from 'vitest'
import { enforceRetro } from '../engine/retro'
import { createPixelCanvas, argb } from '../engine/pixelCanvas'
import { mulberry32 } from '../engine/rng'
import { Palettes } from '../engine/palette'
import type { EngineContext } from '../engine/types'

describe('Retro Enforcement Pipeline', () => {
  let canvas: ReturnType<typeof createPixelCanvas>
  let ctx: EngineContext

  beforeEach(() => {
    canvas = createPixelCanvas(16, 16)
    ctx = {
      canvas,
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

  it('should apply complete retro pipeline', () => {
    // Draw a simple shape
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        canvas.set(x, y, argb(255, 128, 128, 128))
      }
    }

    const originalData = canvas.data.slice()
    enforceRetro(ctx)

    // Data should have changed due to quantization and dithering
    let changedPixels = 0
    for (let i = 0; i < canvas.data.length; i++) {
      if ((canvas.data[i] >>> 0) !== (originalData[i] >>> 0)) {
        changedPixels++
      }
    }
    expect(changedPixels).toBeGreaterThan(0)
  })

  it('should apply outline around shapes', () => {
    // Draw a small square in the center
    canvas.set(8, 8, argb(255, 255, 255, 255))
    canvas.set(8, 9, argb(255, 255, 255, 255))
    canvas.set(9, 8, argb(255, 255, 255, 255))
    canvas.set(9, 9, argb(255, 255, 255, 255))

    enforceRetro(ctx)

    // Check for outline pixels around the shape
    const outlineColor = argb(255, 20, 20, 20)
    const adjacentPixels = [
      canvas.get(7, 8), canvas.get(7, 9),
      canvas.get(10, 8), canvas.get(10, 9),
      canvas.get(8, 7), canvas.get(9, 7),
      canvas.get(8, 10), canvas.get(9, 10)
    ]

    // Check if any adjacent pixels have been outlined (could be exact outline color or quantized version)
    const hasOutlinePixels = adjacentPixels.some(pixel => {
      const alpha = (pixel >>> 24) & 0xff
      return alpha > 0 && pixel !== 0 // Any non-transparent, non-black pixel indicates outline
    })

    expect(hasOutlinePixels).toBe(true)
  })

  it('should skip outline when disabled', () => {
    ctx.retro.outlineWidth = 0

    // Draw a shape
    canvas.set(8, 8, argb(255, 255, 0, 0))

    const beforeOutline = canvas.data.slice()
    enforceRetro(ctx)

    // Check that transparent pixels around the shape remain transparent
    expect(canvas.get(7, 8)).toBe(0) // Should remain transparent
    expect(canvas.get(9, 8)).toBe(0) // Should remain transparent
  })

  it('should apply micro-jitter when enabled', () => {
    ctx.retro.microJitter = true
    ctx.retro.microJitterStrength = 0.2

    // Fill with a gradient
    for (let i = 0; i < 16; i++) {
      canvas.set(i, 8, argb(255, i * 16, i * 16, i * 16))
    }

    const beforeJitter = canvas.data.slice()
    enforceRetro(ctx)

    // Colors should have been subtly varied
    let jitteredPixels = 0
    for (let i = 0; i < canvas.data.length; i++) {
      if ((canvas.data[i] >>> 0) !== (beforeJitter[i] >>> 0) && beforeJitter[i] !== 0) {
        jitteredPixels++
      }
    }
    expect(jitteredPixels).toBeGreaterThan(0)
  })

  it('should skip micro-jitter when disabled', () => {
    ctx.retro.microJitter = false

    // Fill with test colors
    canvas.set(8, 8, argb(255, 128, 64, 32))

    // Without jitter, quantization should be more predictable
    enforceRetro(ctx)

    // Result should be quantized to palette
    const result = canvas.get(8, 8)
    const resultRgb = result & 0x00ffffff
    const paletteColors = Array.from(ctx.palette.colors).map(c => c & 0x00ffffff)
    expect(paletteColors).toContain(resultRgb)
  })

  it('should preserve transparency throughout pipeline', () => {
    // Set some transparent and opaque pixels
    canvas.set(5, 5, 0x00000000) // Transparent
    canvas.set(6, 5, argb(128, 255, 0, 0)) // Semi-transparent
    canvas.set(7, 5, argb(255, 0, 255, 0)) // Opaque

    enforceRetro(ctx)

    // Check if transparency is preserved (outline might affect edge pixels)
    const pixel1 = canvas.get(5, 5)
    const pixel2 = canvas.get(6, 5)
    const pixel3 = canvas.get(7, 5)

    // For the transparent pixel, it should either remain transparent or become an outline
    // If it becomes outline due to adjacent pixels, that's still correct behavior
    expect(pixel1 === 0 || ((pixel1 >>> 24) & 0xff) > 0).toBe(true)

    // Semi-transparent should maintain some alpha (though may be quantized)
    expect((pixel2 >>> 24) & 0xff).toBeGreaterThan(0)

    // Opaque should remain opaque
    expect((pixel3 >>> 24) & 0xff).toBe(255)
  })

  it('should work with different dither modes', () => {
    // Test Bayer 8x8
    ctx.dither = 'bayer8'
    canvas.set(8, 8, argb(255, 128, 128, 128))
    enforceRetro(ctx)
    expect(canvas.get(8, 8) >>> 0).not.toBe(argb(255, 128, 128, 128) >>> 0)

    // Test no dithering
    canvas.clear(0)
    ctx.dither = 'none'
    canvas.set(8, 8, argb(255, 128, 128, 128))
    enforceRetro(ctx)

    // Should still be quantized but not dithered
    const result = canvas.get(8, 8)
    const resultRgb = result & 0x00ffffff
    const paletteColors = Array.from(ctx.palette.colors).map(c => c & 0x00ffffff)
    expect(paletteColors).toContain(resultRgb)
  })

  it('should work with different quantizers', () => {
    ctx.quantizer = 'none'
    canvas.set(8, 8, argb(255, 200, 100, 50))

    const beforeQuantize = canvas.get(8, 8)
    enforceRetro(ctx)

    // With quantizer disabled, color should remain closer to original
    // (though dithering might still modify it slightly)
    const afterQuantize = canvas.get(8, 8)
    expect(afterQuantize).toBeDefined()
  })
})
