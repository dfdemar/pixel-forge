import { describe, it, expect, beforeEach } from 'vitest'
import { SimilarityGuard } from '../engine/similarityGuard'
import { createPixelCanvas, argb } from '../engine/pixelCanvas'
import { mulberry32 } from '../engine/rng'

describe('Similarity Guard (Milestone 2)', () => {
  let guard: SimilarityGuard
  let canvas1: ReturnType<typeof createPixelCanvas>
  let canvas2: ReturnType<typeof createPixelCanvas>

  beforeEach(() => {
    guard = new SimilarityGuard({
      maxHistory: 10,
      edgeThreshold: 0.8,
      paletteThreshold: 0.85,
      maxRetries: 3
    })
    canvas1 = createPixelCanvas(32, 32)
    canvas2 = createPixelCanvas(32, 32)
  })

  it('should detect identical sprites as similar', () => {
    // Create identical patterns
    for (let i = 0; i < 10; i++) {
      canvas1.set(i, i, argb(255, 255, 0, 0))
      canvas2.set(i, i, argb(255, 255, 0, 0))
    }

    const sig1 = guard.generateSignature(canvas1, {})
    const sig2 = guard.generateSignature(canvas2, {})

    guard.addToHistory(sig1)
    expect(guard.isSimilar(sig2)).toBe(true)
  })

  it('should detect different sprites as dissimilar', () => {
    // Create different patterns
    for (let i = 0; i < 10; i++) {
      canvas1.set(i, i, argb(255, 255, 0, 0)) // Diagonal red line
      canvas2.set(i, 31 - i, argb(255, 0, 255, 0)) // Anti-diagonal green line
    }

    const sig1 = guard.generateSignature(canvas1, {})
    const sig2 = guard.generateSignature(canvas2, {})

    guard.addToHistory(sig1)
    expect(guard.isSimilar(sig2)).toBe(false)
  })

  it('should generate consistent signatures for same sprite', () => {
    // Create a test pattern
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        canvas1.set(x, y, argb(255, 128, 64, 32))
      }
    }

    const sig1 = guard.generateSignature(canvas1, { test: 'param' })
    const sig2 = guard.generateSignature(canvas1, { test: 'param' })

    expect(sig1.edgeHistogram).toEqual(sig2.edgeHistogram)
    expect(sig1.paletteUsage).toEqual(sig2.paletteUsage)
  })

  it('should maintain history within limits', () => {
    guard = new SimilarityGuard({ maxHistory: 3 })

    // Add more signatures than the limit
    for (let i = 0; i < 5; i++) {
      canvas1.set(i, i, argb(255, i * 50, 0, 0))
      const sig = guard.generateSignature(canvas1, {})
      guard.addToHistory(sig)
    }

    // History should be limited to maxHistory
    expect(guard['history'].length).toBe(3)
  })

  it('should suggest parameter nudges', () => {
    const rng = mulberry32(12345)
    const originalParams = {
      featureDensity: 0.5,
      clouds: true,
      someNumber: 0.8
    }

    const nudgedParams = guard.suggestParamNudges(originalParams, rng)

    // Numeric params should be nudged
    expect(nudgedParams.featureDensity).not.toBe(originalParams.featureDensity)
    expect(nudgedParams.someNumber).not.toBe(originalParams.someNumber)

    // Boolean params should remain unchanged
    expect(nudgedParams.clouds).toBe(originalParams.clouds)

    // Values should stay within reasonable bounds
    expect(nudgedParams.featureDensity).toBeGreaterThanOrEqual(0)
    expect(nudgedParams.featureDensity).toBeLessThanOrEqual(1)
  })

  it('should reset history correctly', () => {
    // Add some signatures
    for (let i = 0; i < 3; i++) {
      canvas1.set(i, i, argb(255, 255, 0, 0))
      const sig = guard.generateSignature(canvas1, {})
      guard.addToHistory(sig)
    }

    expect(guard['history'].length).toBe(3)

    guard.reset()
    expect(guard['history'].length).toBe(0)
  })

  it('should handle edge histogram generation', () => {
    // Create a sprite with clear edges
    for (let i = 8; i < 24; i++) {
      canvas1.set(i, 8, argb(255, 255, 255, 255)) // Top edge
      canvas1.set(i, 23, argb(255, 255, 255, 255)) // Bottom edge
      canvas1.set(8, i, argb(255, 255, 255, 255)) // Left edge
      canvas1.set(23, i, argb(255, 255, 255, 255)) // Right edge
    }

    const sig = guard.generateSignature(canvas1, {})

    // Should have detected edges in the histogram
    expect(sig.edgeHistogram.length).toBe(8)
    expect(sig.edgeHistogram.some(val => val > 0)).toBe(true)
  })

  it('should handle palette usage computation', () => {
    // Create sprite with multiple colors
    canvas1.set(10, 10, argb(255, 255, 0, 0)) // Red
    canvas1.set(11, 10, argb(255, 0, 255, 0)) // Green
    canvas1.set(12, 10, argb(255, 0, 0, 255)) // Blue
    canvas1.set(13, 10, argb(255, 255, 0, 0)) // Red again

    const sig = guard.generateSignature(canvas1, {})

    expect(sig.paletteUsage.length).toBe(32)
    expect(sig.paletteUsage.some(val => val > 0)).toBe(true)
  })

  it('should ignore transparent pixels in analysis', () => {
    // Create sprite with transparent areas
    canvas1.set(10, 10, argb(255, 255, 0, 0)) // Opaque red
    canvas1.set(11, 10, 0x00000000) // Transparent
    canvas1.set(12, 10, argb(128, 0, 255, 0)) // Semi-transparent green

    const sig = guard.generateSignature(canvas1, {})

    // Should have valid signature despite transparent pixels
    expect(sig.edgeHistogram).toBeDefined()
    expect(sig.paletteUsage).toBeDefined()
  })

  it('should handle empty sprites gracefully', () => {
    // Empty canvas (all transparent)
    const sig = guard.generateSignature(canvas1, {})

    expect(sig.edgeHistogram.every(val => val === 0)).toBe(true)
    expect(sig.paletteUsage.every(val => val === 0)).toBe(true)
    expect(guard.isSimilar(sig)).toBe(false)
  })

  it('should use configurable thresholds', () => {
    const strictGuard = new SimilarityGuard({
      edgeThreshold: 0.99,
      paletteThreshold: 0.99
    })

    // Create significantly different sprites
    for (let i = 0; i < 10; i++) {
      canvas1.set(i, i, argb(255, 255, 0, 0)) // Red diagonal
    }
    for (let i = 0; i < 5; i++) {
      canvas2.set(i * 2, i * 2, argb(255, 0, 255, 0)) // Sparse green diagonal
    }

    const sig1 = strictGuard.generateSignature(canvas1, {})
    const sig2 = strictGuard.generateSignature(canvas2, {})

    strictGuard.addToHistory(sig1)

    // With strict thresholds, different sprites should not be similar
    expect(strictGuard.isSimilar(sig2)).toBe(false)
  })
})
