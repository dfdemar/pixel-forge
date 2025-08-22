import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../engine/rng'

describe('RNG - Mulberry32', () => {
  it('should produce deterministic sequences', () => {
    const rng1 = mulberry32(12345)
    const rng2 = mulberry32(12345)

    // Same seed should produce identical sequences
    for (let i = 0; i < 100; i++) {
      expect(rng1.nextFloat()).toBe(rng2.nextFloat())
    }
  })

  it('should produce different sequences for different seeds', () => {
    const rng1 = mulberry32(12345)
    const rng2 = mulberry32(54321)

    let identical = 0
    for (let i = 0; i < 100; i++) {
      if (rng1.nextFloat() === rng2.nextFloat()) {
        identical++
      }
    }

    // Should be very unlikely to have many identical values
    expect(identical).toBeLessThan(10)
  })

  it('should generate floats in [0, 1) range', () => {
    const rng = mulberry32(42)

    for (let i = 0; i < 1000; i++) {
      const val = rng.nextFloat()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('should generate integers in correct range', () => {
    const rng = mulberry32(42)

    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(10)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(10)
      expect(Number.isInteger(val)).toBe(true)
    }
  })

  it('should handle edge cases for nextInt', () => {
    const rng = mulberry32(42)

    expect(rng.nextInt(1)).toBe(0)
    expect(() => rng.nextInt(0)).not.toThrow()
  })

  it('should create independent sub-streams with split', () => {
    const rng = mulberry32(12345)
    const sub1 = rng.split('test1')
    const sub2 = rng.split('test2')

    // Sub-streams should be different from each other
    let identical = 0
    for (let i = 0; i < 100; i++) {
      if (sub1.nextFloat() === sub2.nextFloat()) {
        identical++
      }
    }
    expect(identical).toBeLessThan(10)

    // Same label should produce same sub-stream when created from fresh RNG
    const rng2 = mulberry32(12345)
    const sub1_copy = rng2.split('test1')

    // Reset both to compare fresh streams
    const rng3 = mulberry32(12345)
    const rng4 = mulberry32(12345)
    const freshSub1 = rng3.split('test1')
    const freshSub1Copy = rng4.split('test1')

    for (let i = 0; i < 10; i++) {
      expect(freshSub1.nextFloat()).toBe(freshSub1Copy.nextFloat())
    }
  })

  it('should maintain determinism across split operations', () => {
    const rng1 = mulberry32(999)
    const rng2 = mulberry32(999)

    // Both should produce same sequence even after splits
    const sub1a = rng1.split('a')
    const sub1b = rng1.split('b')

    const sub2a = rng2.split('a')
    const sub2b = rng2.split('b')

    for (let i = 0; i < 10; i++) {
      expect(sub1a.nextFloat()).toBe(sub2a.nextFloat())
      expect(sub1b.nextFloat()).toBe(sub2b.nextFloat())
    }
  })
})
