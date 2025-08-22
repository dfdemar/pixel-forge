import type { Palette, RNG } from './types'

const NES_13 = new Uint32Array([
  0xff000000, 0xff1d2b53, 0xff7e2553, 0xff008751,
  0xffab5236, 0xff5f574f, 0xffc2c3c7, 0xfffff1e8,
  0xffff004d, 0xffffa300, 0xffffec27, 0xff00e436,
  0xff29adff
])

const GB_4 = new Uint32Array([
  0xff0f380f, 0xff306230, 0xff8bac0f, 0xff9bbc0f
])

const SNES_32 = new Uint32Array([
  0xff000000,0xffffffff,0xffc0c0c0,0xff808080,0xff404040,
  0xff1b1b3a,0xff2d3a69,0xff3b5dc9,0xff6b9af5,
  0xff143d2b,0xff217e4b,0xff3dbb75,0xff9bd6b4,
  0xff51220b,0xff8b4513,0xffc0723c,0xffe0b47a,
  0xff3b0d2c,0xff7a1b45,0xffc43a5f,0xfff58aa9,
  0xff3a1f0f,0xff7a3f1f,0xffbf7f3f,0xffffaf6f,
  0xff161616,0xff2c2c2c,0xff4a4a4a,0xff6f6f6f,
  0xff94c11f,0xffd5e04a,0xfff1f58f
])

export const Palettes: Record<string, Palette> = {
  NES_13: { name: 'NES_13', colors: NES_13, maxColors: 13 },
  SNES_32: { name: 'SNES_32', colors: SNES_32, maxColors: 32 },
  GB_4: { name: 'GB_4', colors: GB_4, maxColors: 4 },
};

// Custom palette storage
let customPalettes: Record<string, Palette> = {};

/**
 * Add a custom palette to the system
 */
export function addCustomPalette(palette: Palette): void {
  const safeId = palette.name.replace(/[^a-zA-Z0-9_]/g, '_');
  customPalettes[safeId] = palette;
  Palettes[safeId] = palette;
}

/**
 * Remove a custom palette from the system
 */
export function removeCustomPalette(paletteId: string): void {
  if (customPalettes[paletteId]) {
    delete customPalettes[paletteId];
    delete Palettes[paletteId];
  }
}

/**
 * Get all available palettes (built-in + custom)
 */
export function getAllPalettes(): Record<string, Palette> {
  return { ...Palettes };
}

/**
 * Get only custom palettes
 */
export function getCustomPalettes(): Record<string, Palette> {
  return { ...customPalettes };
}

/**
 * Export custom palettes as JSON
 */
export function exportCustomPalettes(): string {
  return JSON.stringify(customPalettes, null, 2);
}

/**
 * Import custom palettes from JSON
 */
export function importCustomPalettes(jsonString: string): boolean {
  try {
    // Handle invalid JSON format
    let imported;
    try {
      imported = JSON.parse(jsonString);
    } catch (err) {
      console.error('Error importing palettes:', err);
      return false;
    }
    
    let importedCount = 0;

    for (const [id, palette] of Object.entries(imported)) {
      if (palette && typeof palette === 'object') {
        const paletteObj = palette as any;

        // Ensure required properties exist
        if (!paletteObj.name || !paletteObj.colors || typeof paletteObj.maxColors !== 'number') {
          continue;
        }

        // Convert colors back to Uint32Array - handle different formats
        let colorsArray: Uint32Array;
        if (Array.isArray(paletteObj.colors)) {
          // Direct array format
          colorsArray = new Uint32Array(paletteObj.colors);
        } else if (paletteObj.colors instanceof Uint32Array) {
          // Already a Uint32Array
          colorsArray = paletteObj.colors;
        } else if (typeof paletteObj.colors === 'object' && paletteObj.colors !== null) {
          // Object with numeric keys (JSON serialized Uint32Array)
          const keys = Object.keys(paletteObj.colors)
            .map(k => parseInt(k))
            .filter(k => !isNaN(k))
            .sort((a, b) => a - b);
          const values = keys.map(k => paletteObj.colors[k]);
          colorsArray = new Uint32Array(values);
        } else {
          continue; // Skip invalid colors format
        }

        // Create the palette object
        const validPalette: Palette = {
          name: paletteObj.name,
          colors: colorsArray,
          maxColors: paletteObj.maxColors
        };

        // Validate the reconstructed palette
        if (validPalette.colors.length > 0 && validPalette.maxColors > 0) {
          customPalettes[id] = validPalette;
          Palettes[id] = validPalette;
          importedCount++;
        }
      }
    }

    return importedCount > 0;
  } catch (error) {
    console.error('Error importing palettes:', error);
    return false;
  }
}

/**
 * Validate palette structure
 */
function isValidPalette(obj: any): obj is Palette {
  return obj &&
    typeof obj.name === 'string' &&
    obj.colors instanceof Uint32Array &&
    typeof obj.maxColors === 'number' &&
    obj.colors.length > 0 &&
    obj.maxColors > 0;
}

export function nearestColorIndex(p: Palette, argb: number): number {
  const r=(argb>>>16)&255, g=(argb>>>8)&255, b=argb&255;
  let best=0, bestD=1e9;
  for (let i=0;i<p.colors.length;i++){
    const c=p.colors[i]>>>0;
    const cr=(c>>>16)&255, cg=(c>>>8)&255, cb=c&255;
    const d=(r-cr)*(r-cr)+(g-cg)*(g-cg)+(b-cb)*(b-cb);
    if(d<bestD){ bestD=d; best=i; }
  }
  return best;
}

export function quantizeNearest(p: Palette, src: Uint32Array){
  for(let i=0;i<src.length;i++){
    const argb = src[i]>>>0;
    const a = (argb>>>24)&0xff;
    if(a===0){ continue; } // preserve transparency
    const idx = nearestColorIndex(p, argb);
    const rgb = p.colors[idx]>>>0;
    src[i] = ((a&255)<<24) | (rgb & 0x00ffffff);
  }
}

/**
 * Apply palette micro-jitter for subtle variation before quantization
 * Shifts colors slightly within the palette space to create more natural gradients
 */
export function applyPaletteMicroJitter(src: Uint32Array, p: Palette, rng: RNG, strength: number = 0.15) {
  for (let i = 0; i < src.length; i++) {
    const argb = src[i] >>> 0;
    const a = (argb >>> 24) & 0xff;
    if (a === 0) continue; // Skip transparent pixels

    const r = (argb >>> 16) & 0xff;
    const g = (argb >>> 8) & 0xff;
    const b = argb & 0xff;

    // Find the nearest palette color
    const nearestIdx = nearestColorIndex(p, argb);
    const nearestColor = p.colors[nearestIdx] >>> 0;
    const nearestR = (nearestColor >>> 16) & 0xff;
    const nearestG = (nearestColor >>> 8) & 0xff;
    const nearestB = nearestColor & 0xff;

    // Find the second nearest color for jitter direction
    let secondNearestIdx = 0;
    let secondBestDist = Infinity;
    for (let j = 0; j < p.colors.length; j++) {
      if (j === nearestIdx) continue;
      const c = p.colors[j] >>> 0;
      const cr = (c >>> 16) & 0xff;
      const cg = (c >>> 8) & 0xff;
      const cb = c & 0xff;
      const dist = (r - cr) * (r - cr) + (g - cg) * (g - cg) + (b - cb) * (b - cb);
      if (dist < secondBestDist) {
        secondBestDist = dist;
        secondNearestIdx = j;
      }
    }

    const secondColor = p.colors[secondNearestIdx] >>> 0;
    const secondR = (secondColor >>> 16) & 0xff;
    const secondG = (secondColor >>> 8) & 0xff;
    const secondB = secondColor & 0xff;

    // Apply micro-jitter towards the second nearest color
    const jitterAmount = (rng.nextFloat() - 0.5) * strength;
    const newR = Math.max(0, Math.min(255, nearestR + (secondR - nearestR) * jitterAmount));
    const newG = Math.max(0, Math.min(255, nearestG + (secondG - nearestG) * jitterAmount));
    const newB = Math.max(0, Math.min(255, nearestB + (secondB - nearestB) * jitterAmount));

    src[i] = ((a & 0xff) << 24) | ((newR & 0xff) << 16) | ((newG & 0xff) << 8) | (newB & 0xff);
  }
}

export const Bayer4 = [
  [0,8,2,10],
  [12,4,14,6],
  [3,11,1,9],
  [15,7,13,5]
] as const;

export const Bayer8 = [
  [0,32,8,40,2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44,4,36,14,46,6,38],
  [60,28,52,20,62,30,54,22],
  [3,35,11,43,1,33,9,41],
  [51,19,59,27,49,17,57,25],
  [15,47,7,39,13,45,5,37],
  [63,31,55,23,61,29,53,21]
] as const;

export function applyBayer(src: Uint32Array, w: number, h: number, p: Palette, size: 4|8){
  const m = size===4?Bayer4:Bayer8;
  const max = size===4?16:64;
  const strength = 28; // subtle
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=y*w+x;
      const c=src[i]>>>0;
      const a=(c>>>24)&0xff;
      if(a===0){ continue; } // skip transparent
      const r=(c>>>16)&0xff,g=(c>>>8)&0xff,b=c&0xff;
      const t = m[y%size][x%size];
      const n = (t/(max-1)) - 0.5; // [-0.5,0.5]
      const nr = Math.max(0, Math.min(255, (r + n*strength)|0));
      const ng = Math.max(0, Math.min(255, (g + n*strength)|0));
      const nb = Math.max(0, Math.min(255, (b + n*strength)|0));
      const idx = nearestColorIndex(p, (255<<24)|((nr&255)<<16)|((ng&255)<<8)|(nb&255));
      const rgb = p.colors[idx]>>>0;
      src[i] = ((a&255)<<24) | (rgb & 0x00ffffff);
    }
  }
}
