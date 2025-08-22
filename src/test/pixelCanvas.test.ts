import { describe, it, expect, beforeEach } from 'vitest'
import { createPixelCanvas, argb } from '../engine/pixelCanvas'

describe('PixelCanvas', () => {
  let canvas: ReturnType<typeof createPixelCanvas>

  beforeEach(() => {
    canvas = createPixelCanvas(32, 32)
  })

  it('should create a canvas with correct dimensions', () => {
    expect(canvas.w).toBe(32)
    expect(canvas.h).toBe(32)
    expect(canvas.data.length).toBe(32 * 32)
  })

  it('should initialize with transparent pixels', () => {
    for (let i = 0; i < canvas.data.length; i++) {
      expect(canvas.data[i]).toBe(0)
    }
  })

  it('should set and get pixels correctly', () => {
    const color = argb(255, 128, 64, 32)
    canvas.set(5, 10, color)
    // Use unsigned comparison for ARGB values
    expect(canvas.get(5, 10) >>> 0).toBe(color >>> 0)
  })

  it('should handle out-of-bounds coordinates gracefully', () => {
    const color = argb(255, 128, 64, 32)
    canvas.set(-1, -1, color)
    canvas.set(50, 50, color)
    // Should not throw and should not affect valid pixels
    expect(canvas.get(0, 0)).toBe(0)
  })

  it('should clear canvas with specified color', () => {
    const fillColor = argb(255, 100, 150, 200)
    canvas.clear(fillColor)

    for (let i = 0; i < canvas.data.length; i++) {
      expect(canvas.data[i] >>> 0).toBe(fillColor >>> 0)
    }
  })

  it('should blit one canvas onto another', () => {
    const source = createPixelCanvas(16, 16)
    const testColor = argb(255, 255, 0, 0)
    source.set(8, 8, testColor)

    canvas.blit(source, 5, 5)
    expect(canvas.get(13, 13) >>> 0).toBe(testColor >>> 0) // 5 + 8 = 13
  })

  it('should create valid ImageData', () => {
    const color = argb(255, 128, 64, 32)
    canvas.set(0, 0, color)

    const imageData = canvas.toImageData()
    expect(imageData.width).toBe(32)
    expect(imageData.height).toBe(32)
    expect(imageData.data.length).toBe(32 * 32 * 4)

    // Check RGBA conversion (ImageData uses RGBA, we use ARGB)
    expect(imageData.data[0]).toBe(128) // R
    expect(imageData.data[1]).toBe(64)  // G
    expect(imageData.data[2]).toBe(32)  // B
    expect(imageData.data[3]).toBe(255) // A
  })
})

describe('ARGB utility', () => {
  it('should pack ARGB values correctly', () => {
    const color = argb(255, 128, 64, 32)
    // Use unsigned right shift to handle JavaScript number representation
    expect((color >>> 24) & 0xff).toBe(255) // A
    expect((color >>> 16) & 0xff).toBe(128) // R
    expect((color >>> 8) & 0xff).toBe(64)   // G
    expect(color & 0xff).toBe(32)           // B
  })

  it('should handle edge values', () => {
    const black = argb(255, 0, 0, 0)
    const white = argb(255, 255, 255, 255)
    const transparent = argb(0, 0, 0, 0)

    // Use unsigned comparison to handle JavaScript's signed 32-bit integers
    expect(black >>> 0).toBe(0xff000000)
    expect(white >>> 0).toBe(0xffffffff)
    expect(transparent >>> 0).toBe(0x00000000)
  })
})
