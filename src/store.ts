import { create } from 'zustand'

export type UIState = {
  spriteType: 'planet'|'tile'|'icon';
  archetype: string;
  palette: string; // Changed to string to support custom palette IDs
  dither: 'none'|'bayer4'|'bayer8';
  quantizer: 'none'|'nearest';
  outline: 0|1|2;
  size: number;
  seed: number;
  params: Record<string, any>;
  sheet: HTMLCanvasElement[];
  microJitter: boolean;
  microJitterStrength: number;
  showPaletteEditor: boolean;
  editingPalette?: string; // ID of palette being edited, if any
  set: (p: Partial<UIState>)=>void;
}

export const useUI = create<UIState>((set)=>({
  spriteType:'planet',
  archetype:'lush',
  palette:'SNES_32',
  dither:'bayer4',
  quantizer:'nearest',
  outline:1,
  size:64,
  seed:150979693,
  params:{},
  sheet:[],
  microJitter: true,
  microJitterStrength: 0.15,
  showPaletteEditor: false,
  editingPalette: undefined,
  set: (p)=>set(p),
}))
