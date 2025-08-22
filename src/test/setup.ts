// Test setup file for vitest
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock ImageData for the test environment
(globalThis as any).ImageData = class ImageData {
  data: Uint8ClampedArray
  width: number
  height: number

  constructor(width: number, height: number)
  constructor(data: Uint8ClampedArray, width: number, height?: number)
  constructor(dataOrWidth: Uint8ClampedArray | number, width: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = width // This is correct for ImageData(width, height) constructor
      this.data = new Uint8ClampedArray(dataOrWidth * width * 4)
    } else {
      this.data = dataOrWidth
      this.width = width
      this.height = height || dataOrWidth.length / (width * 4)
    }
  }
}

// Mock canvas methods that aren't available in jsdom
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      strokeRect: vi.fn(),
      getImageData: vi.fn(() => new (globalThis as any).ImageData(1, 1)),
      putImageData: vi.fn(),
      createImageData: vi.fn((width: number, height: number) => new (globalThis as any).ImageData(width, height)),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
      resetTransform: vi.fn(),
      reset: vi.fn(),
      roundRect: vi.fn(),
      isContextLost: vi.fn(() => false),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt' as CanvasLineCap,
      lineJoin: 'miter' as CanvasLineJoin,
      miterLimit: 10,
      font: '10px sans-serif',
      textAlign: 'start' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      canvas: null as any,
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      isPointInPath: vi.fn(),
      isPointInStroke: vi.fn(),
      drawFocusIfNeeded: vi.fn(),
      scrollPathIntoView: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 } as TextMetrics)),
      getTransform: vi.fn(),
      setLineDash: vi.fn(),
      getLineDash: vi.fn(() => []),
      lineDashOffset: 0,
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      filter: 'none',
      createLinearGradient: vi.fn(),
      createRadialGradient: vi.fn(),
      createConicGradient: vi.fn(),
      createPattern: vi.fn(),
      clearHitRegions: vi.fn(),
      addHitRegion: vi.fn(),
      removeHitRegion: vi.fn(),
      getContextAttributes: vi.fn(),
      direction: 'inherit' as CanvasDirection,
      fontKerning: 'auto' as CanvasFontKerning,
      fontStretch: 'normal' as CanvasFontStretch,
      fontVariantCaps: 'normal' as CanvasFontVariantCaps,
      textRendering: 'auto' as CanvasTextRendering,
      wordSpacing: '0px',
      letterSpacing: '0px'
    } as unknown as CanvasRenderingContext2D
  }
  return null
}) as any

HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  const blob = new Blob(['fake'], { type: 'image/png' })
  callback(blob)
})

// Mock URL.createObjectURL
;(globalThis as any).URL = {
  ...((globalThis as any).URL || {}),
  createObjectURL: vi.fn(() => 'mocked-url'),
  revokeObjectURL: vi.fn()
}

// Mock FileReader
;(globalThis as any).FileReader = class {
  readAsText = vi.fn()
  result = ''
  onload = vi.fn()
}
