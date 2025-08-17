import type { PixelCanvas, SpriteSignature, SimilarityGuardConfig } from './types';

/**
 * Similarity Guard - Tracks generated sprites to reduce repetitive results
 * Uses edge histograms and palette usage to detect similar sprites
 */
export class SimilarityGuard {
  private history: SpriteSignature[] = [];
  private config: SimilarityGuardConfig;

  constructor(config: Partial<SimilarityGuardConfig> = {}) {
    this.config = {
      maxHistory: 50,
      edgeThreshold: 0.85,
      paletteThreshold: 0.9,
      maxRetries: 5,
      ...config
    };
  }

  /**
   * Generate a signature for a sprite based on edge patterns and palette usage
   */
  generateSignature(canvas: PixelCanvas, params: Record<string, any>): SpriteSignature {
    const edgeHistogram = this.computeEdgeHistogram(canvas);
    const paletteUsage = this.computePaletteUsage(canvas);

    return {
      edgeHistogram,
      paletteUsage,
      timestamp: Date.now(),
      params: { ...params }
    };
  }

  /**
   * Check if a sprite is too similar to recent generations
   */
  isSimilar(signature: SpriteSignature): boolean {
    for (const existing of this.history) {
      const edgeSimilarity = this.compareHistograms(signature.edgeHistogram, existing.edgeHistogram);
      const paletteSimilarity = this.compareHistograms(signature.paletteUsage, existing.paletteUsage);

      if (edgeSimilarity > this.config.edgeThreshold &&
          paletteSimilarity > this.config.paletteThreshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add a sprite signature to the history
   */
  addToHistory(signature: SpriteSignature): void {
    this.history.push(signature);

    // Keep history within limits
    if (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Suggest parameter nudges to increase variation
   */
  suggestParamNudges(params: Record<string, any>, rng: { nextFloat(): number }): Record<string, any> {
    const nudged = { ...params };

    // Apply small random nudges to numeric parameters
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number') {
        const nudge = (rng.nextFloat() - 0.5) * 0.2; // ±10% variation
        nudged[key] = Math.max(0, Math.min(1, value + nudge));
      }
    }

    return nudged;
  }

  /**
   * Clear the similarity history
   */
  reset(): void {
    this.history = [];
  }

  /**
   * Compute edge histogram using Sobel edge detection
   */
  private computeEdgeHistogram(canvas: PixelCanvas): number[] {
    const { w, h, data } = canvas;
    const edges = new Uint8Array(w * h);
    const histogram = new Array(8).fill(0); // 8 direction bins

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0, gy = 0;

        // Apply Sobel kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * w + (x + kx);
            const pixel = data[idx];
            const alpha = (pixel >>> 24) & 0xff;

            if (alpha === 0) continue; // Skip transparent pixels

            const intensity = this.rgbToGrayscale(pixel);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);

            gx += intensity * sobelX[kernelIdx];
            gy += intensity * sobelY[kernelIdx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude > 30) { // Edge threshold
          const angle = Math.atan2(gy, gx);
          const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8;
          histogram[bin]++;
        }
      }
    }

    // Normalize histogram
    const total = histogram.reduce((sum, val) => sum + val, 0);
    return total > 0 ? histogram.map(val => val / total) : histogram;
  }

  /**
   * Compute palette usage histogram
   */
  private computePaletteUsage(canvas: PixelCanvas): number[] {
    const { data } = canvas;
    const colorCounts = new Map<number, number>();
    let totalPixels = 0;

    for (let i = 0; i < data.length; i++) {
      const pixel = data[i];
      const alpha = (pixel >>> 24) & 0xff;

      if (alpha === 0) continue; // Skip transparent pixels

      const rgb = pixel & 0x00ffffff;
      colorCounts.set(rgb, (colorCounts.get(rgb) || 0) + 1);
      totalPixels++;
    }

    // Convert to normalized histogram (up to 32 most frequent colors)
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 32);

    const histogram = new Array(32).fill(0);
    for (let i = 0; i < sortedColors.length; i++) {
      histogram[i] = sortedColors[i][1] / totalPixels;
    }

    return histogram;
  }

  /**
   * Compare two histograms using cosine similarity
   */
  private compareHistograms(hist1: number[], hist2: number[]): number {
    const minLen = Math.min(hist1.length, hist2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += hist1[i] * hist2[i];
      norm1 += hist1[i] * hist1[i];
      norm2 += hist2[i] * hist2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Convert RGB to grayscale intensity
   */
  private rgbToGrayscale(argb: number): number {
    const r = (argb >>> 16) & 0xff;
    const g = (argb >>> 8) & 0xff;
    const b = argb & 0xff;
    return Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
  }
}

// Global similarity guard instance
export const globalSimilarityGuard = new SimilarityGuard();
