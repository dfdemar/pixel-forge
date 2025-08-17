import { create } from 'zustand'

export type UIState = {
  spriteType: 'planet'|'tile'|'icon';
  archetype: string;
  palette: 'NES_13'|'SNES_32'|'GB_4';
  dither: 'none'|'bayer4'|'bayer8';
  quantizer: 'none'|'nearest';
  outline: 0|1|2;
  size: number;
  seed: number;
  params: Record<string, any>;
  sheet: HTMLCanvasElement[];
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
  set: (p)=>set(p),
}))
