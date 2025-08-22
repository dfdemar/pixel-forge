import { describe, it, expect, beforeEach } from 'vitest'
import { useUI } from '../store'

describe('UI Store (Zustand)', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUI.setState({
      spriteType: 'planet',
      archetype: 'lush',
      palette: 'SNES_32',
      dither: 'bayer4',
      quantizer: 'nearest',
      outline: 1,
      size: 64,
      seed: 150979693,
      params: {},
      sheet: [],
      microJitter: true,
      microJitterStrength: 0.15,
      showPaletteEditor: false,
      editingPalette: undefined
    })
  })

  it('should have correct initial state', () => {
    const state = useUI.getState()

    expect(state.spriteType).toBe('planet')
    expect(state.archetype).toBe('lush')
    expect(state.palette).toBe('SNES_32')
    expect(state.dither).toBe('bayer4')
    expect(state.quantizer).toBe('nearest')
    expect(state.outline).toBe(1)
    expect(state.size).toBe(64)
    expect(state.seed).toBe(150979693)
    expect(state.params).toEqual({})
    expect(state.sheet).toEqual([])
    expect(state.microJitter).toBe(true)
    expect(state.microJitterStrength).toBe(0.15)
    expect(state.showPaletteEditor).toBe(false)
    expect(state.editingPalette).toBeUndefined()
  })

  it('should update sprite type', () => {
    useUI.getState().set({ spriteType: 'tile' })
    expect(useUI.getState().spriteType).toBe('tile')
  })

  it('should update multiple properties at once', () => {
    useUI.getState().set({
      size: 32,
      seed: 12345,
      palette: 'NES_13',
      dither: 'bayer8'
    })

    const state = useUI.getState()
    expect(state.size).toBe(32)
    expect(state.seed).toBe(12345)
    expect(state.palette).toBe('NES_13')
    expect(state.dither).toBe('bayer8')
  })

  it('should update micro-jitter settings', () => {
    useUI.getState().set({
      microJitter: false,
      microJitterStrength: 0.25
    })

    const state = useUI.getState()
    expect(state.microJitter).toBe(false)
    expect(state.microJitterStrength).toBe(0.25)
  })

  it('should update palette editor state', () => {
    useUI.getState().set({
      showPaletteEditor: true,
      editingPalette: 'custom_palette_id'
    })

    const state = useUI.getState()
    expect(state.showPaletteEditor).toBe(true)
    expect(state.editingPalette).toBe('custom_palette_id')
  })

  it('should update sprite sheet', () => {
    const mockCanvas = document.createElement('canvas')
    const mockCanvases = [mockCanvas]

    useUI.getState().set({ sheet: mockCanvases })
    expect(useUI.getState().sheet).toEqual(mockCanvases)
  })

  it('should update module parameters', () => {
    const testParams = {
      featureDensity: 0.8,
      clouds: false,
      bands: true,
      ringChance: 0.3
    }

    useUI.getState().set({ params: testParams })
    expect(useUI.getState().params).toEqual(testParams)
  })

  it('should handle partial parameter updates', () => {
    // Set initial params
    useUI.getState().set({
      params: {
        featureDensity: 0.5,
        clouds: true,
        bands: false
      }
    })

    // Update with new params object (should replace, not merge)
    useUI.getState().set({
      params: {
        featureDensity: 0.8,
        ringChance: 0.2
      }
    })

    const state = useUI.getState()
    expect(state.params).toEqual({
      featureDensity: 0.8,
      ringChance: 0.2
    })
  })

  it('should handle edge cases for numeric values', () => {
    useUI.getState().set({
      size: 16,
      outline: 0,
      microJitterStrength: 0.05
    })

    const state = useUI.getState()
    expect(state.size).toBe(16)
    expect(state.outline).toBe(0)
    expect(state.microJitterStrength).toBe(0.05)
  })
})
