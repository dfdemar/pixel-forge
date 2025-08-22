import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Palettes,
  nearestColorIndex,
  quantizeNearest,
  applyBayer,
  applyPaletteMicroJitter,
  addCustomPalette,
  removeCustomPalette,
  getAllPalettes,
  getCustomPalettes,
  exportCustomPalettes,
  importCustomPalettes
} from '../engine/palette'
import { mulberry32 } from '../engine/rng'
import type { Palette } from '../engine/types'

describe('Palette System', () => {
  describe('Built-in Palettes', () => {
    it('should have required built-in palettes', () => {
      expect(Palettes.NES_13).toBeDefined()
      expect(Palettes.SNES_32).toBeDefined()
      expect(Palettes.GB_4).toBeDefined()
    })

    it('should have correct structure for NES_13 palette', () => {
      const nes = Palettes.NES_13
      expect(nes.name).toBe('NES_13')
      expect(nes.colors.length).toBe(13)
      expect(nes.maxColors).toBe(13)
      expect(nes.colors).toBeInstanceOf(Uint32Array)
    })

    it('should have correct structure for SNES_32 palette', () => {
      const snes = Palettes.SNES_32
      expect(snes.name).toBe('SNES_32')
      expect(snes.colors.length).toBe(32) // Corrected - actually has 32 colors
      expect(snes.maxColors).toBe(32)
    })

    it('should have correct structure for GB_4 palette', () => {
      const gb = Palettes.GB_4
      expect(gb.name).toBe('GB_4')
      expect(gb.colors.length).toBe(4)
      expect(gb.maxColors).toBe(4)
    })
  })

  describe('Custom Palette Management', () => {
    beforeEach(() => {
      // Clean up any existing custom palettes
      const customPalettes = getCustomPalettes()
      Object.keys(customPalettes).forEach(id => {
        removeCustomPalette(id)
      })
    })

    it('should add custom palettes', () => {
      const customPalette: Palette = {
        name: 'Test Palette',
        colors: new Uint32Array([0xff000000, 0xffffffff, 0xffff0000]),
        maxColors: 3
      }

      addCustomPalette(customPalette)

      const allPalettes = getAllPalettes()
      expect(allPalettes.Test_Palette).toBeDefined()
      expect(allPalettes.Test_Palette.name).toBe('Test Palette')
      expect(allPalettes.Test_Palette.colors.length).toBe(3)
    })

    it('should remove custom palettes', () => {
      const customPalette: Palette = {
        name: 'Remove Me',
        colors: new Uint32Array([0xff000000, 0xffffffff]),
        maxColors: 2
      }

      addCustomPalette(customPalette)
      expect(getAllPalettes().Remove_Me).toBeDefined()

      removeCustomPalette('Remove_Me')
      expect(getAllPalettes().Remove_Me).toBeUndefined()
    })

    it('should export and import custom palettes', () => {
      const palette1: Palette = {
        name: 'Export Test 1',
        colors: new Uint32Array([0xff000000, 0xffffffff]),
        maxColors: 2
      }
      const palette2: Palette = {
        name: 'Export Test 2',
        colors: new Uint32Array([0xffff0000, 0xff00ff00, 0xff0000ff]),
        maxColors: 3
      }

      addCustomPalette(palette1)
      addCustomPalette(palette2)

      // Export BEFORE clearing palettes
      const exported = exportCustomPalettes()
      expect(exported).toContain('Export_Test_1')
      expect(exported).toContain('Export_Test_2')

      // Get the actual keys that were created
      const beforeExport = getAllPalettes()
      const createdKeys = Object.keys(beforeExport).filter(key =>
        !['NES_13', 'SNES_32', 'GB_4'].includes(key)
      )

      // Clear palettes using the actual keys that were created
      createdKeys.forEach(key => removeCustomPalette(key))

      // Verify they're gone
      const afterRemoval = getAllPalettes()
      createdKeys.forEach(key => {
        expect(afterRemoval[key]).toBeUndefined()
      })

      // Import back
      const success = importCustomPalettes(exported)
      expect(success).toBe(true)

      // Check that the palettes are available after import by content, not by key
      const afterImport = getAllPalettes()
      const importedPalettes = Object.values(afterImport).filter(p =>
        !['NES_13', 'SNES_32', 'GB_4'].includes(p.name)
      )

      // Check if we have the right number of imported palettes
      expect(importedPalettes.length).toBe(2)

      // Check if palettes with the expected content exist
      const hasExportTest1 = importedPalettes.some(p =>
        p.name === 'Export Test 1' && p.colors.length === 2
      )
      const hasExportTest2 = importedPalettes.some(p =>
        p.name === 'Export Test 2' && p.colors.length === 3
      )

      expect(hasExportTest1).toBe(true)
      expect(hasExportTest2).toBe(true)
    })

    it('should handle invalid import data', () => {
      const success1 = importCustomPalettes('invalid json')
      expect(success1).toBe(false)

      const success2 = importCustomPalettes('{"invalid": "structure"}')
      expect(success2).toBe(false) // Should fail since no valid palettes were imported
    })
  })

  describe('Color Quantization', () => {
    it('should find nearest color correctly', () => {
      const palette = Palettes.NES_13

      // Test with exact matches
      const blackIndex = nearestColorIndex(palette, 0xff000000)
      expect((palette.colors[blackIndex] >>> 0)).toBe(0xff000000)

      // Test with approximate matches
      const nearBlackIndex = nearestColorIndex(palette, 0xff101010)
      expect(nearBlackIndex).toBe(blackIndex) // Should still map to black
    })

    it('should quantize image data preserving transparency', () => {
      const palette = Palettes.GB_4
      const data = new Uint32Array([
        0xff808080, // Gray - should quantize
        0x00000000, // Transparent - should preserve
        0xffffffff, // White - should quantize
        0x80ff0000  // Semi-transparent red - should preserve alpha
      ])

      quantizeNearest(palette, data)

      // Transparent pixel should remain transparent
      expect(data[1]).toBe(0x00000000)

      // Non-transparent pixels should be quantized but maintain alpha
      expect((data[0] >>> 24) & 0xff).toBe(255) // Alpha preserved
      expect((data[3] >>> 24) & 0xff).toBe(128) // Alpha preserved
    })
  })

  describe('Palette Micro-Jitter (Milestone 2)', () => {
    it('should apply subtle color variations', () => {
      const palette = Palettes.NES_13
      const rng = mulberry32(12345)
      const original = new Uint32Array([0xff808080, 0xff404040, 0xffc0c0c0])
      const jittered = original.slice()

      applyPaletteMicroJitter(jittered, palette, rng, 0.2)

      // Colors should be slightly different but still valid
      expect(jittered[0] >>> 0).not.toBe(original[0] >>> 0)
      expect(jittered[1] >>> 0).not.toBe(original[1] >>> 0)
      expect(jittered[2] >>> 0).not.toBe(original[2] >>> 0)

      // Alpha should be preserved
      expect((jittered[0] >>> 24) & 0xff).toBe(255)
      expect((jittered[1] >>> 24) & 0xff).toBe(255)
      expect((jittered[2] >>> 24) & 0xff).toBe(255)
    })

    it('should skip transparent pixels', () => {
      const palette = Palettes.NES_13
      const rng = mulberry32(12345)
      const data = new Uint32Array([0x00000000, 0xff808080])
      const original = data.slice()

      applyPaletteMicroJitter(data, palette, rng, 0.2)

      // Transparent pixel should remain unchanged
      expect(data[0]).toBe(original[0])
      // Opaque pixel should be jittered
      expect(data[1] >>> 0).not.toBe(original[1] >>> 0)
    })
  })

  describe('Ordered Dithering (Milestone 1)', () => {
    it('should apply Bayer 4x4 dithering', () => {
      const palette = Palettes.GB_4
      const data = new Uint32Array(16) // 4x4 image

      // Fill with gray values
      for (let i = 0; i < 16; i++) {
        data[i] = 0xff808080
      }

      const original = data.slice()
      applyBayer(data, 4, 4, palette, 4)

      // Should have quantized all pixels
      for (let i = 0; i < 16; i++) {
        expect(data[i] >>> 0).not.toBe(original[i] >>> 0)
        // Should be one of the palette colors (with preserved alpha)
        const rgb = data[i] & 0x00ffffff
        const paletteRgbs = Array.from(palette.colors).map(c => c & 0x00ffffff)
        expect(paletteRgbs).toContain(rgb)
      }
    })

    it('should apply Bayer 8x8 dithering', () => {
      const palette = Palettes.NES_13
      const data = new Uint32Array(64) // 8x8 image

      // Fill with gray values
      for (let i = 0; i < 64; i++) {
        data[i] = 0xff606060
      }

      applyBayer(data, 8, 8, palette, 8)

      // Should have quantized all pixels to palette colors
      for (let i = 0; i < 64; i++) {
        const rgb = data[i] & 0x00ffffff
        const paletteRgbs = Array.from(palette.colors).map(c => c & 0x00ffffff)
        expect(paletteRgbs).toContain(rgb)
      }
    })

    it('should preserve transparency during dithering', () => {
      const palette = Palettes.GB_4
      const data = new Uint32Array([
        0x00000000, // Transparent
        0xff808080, // Opaque gray
        0x80404040, // Semi-transparent
        0xff000000  // Opaque black
      ])

      applyBayer(data, 2, 2, palette, 4)

      // Transparent pixel should remain transparent
      expect(data[0]).toBe(0x00000000)

      // Other pixels should maintain their alpha channels
      expect((data[1] >>> 24) & 0xff).toBe(255)
      expect((data[2] >>> 24) & 0xff).toBe(128)
      expect((data[3] >>> 24) & 0xff).toBe(255)
    })
  })
})
