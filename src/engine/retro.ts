import type { EngineContext } from './types'
import { applyBayer, quantizeNearest, applyPaletteMicroJitter } from './palette'
import { argb } from './pixelCanvas'

export function enforceRetro(ctx: EngineContext){
  // Apply palette micro-jitter before quantization for subtle variation
  if(ctx.retro.microJitter) {
    const strength = ctx.retro.microJitterStrength ?? 0.15;
    applyPaletteMicroJitter(ctx.canvas.data, ctx.palette, ctx.rng.split('microJitter'), strength);
  }

  // Quantize to palette
  if(ctx.quantizer === 'nearest') quantizeNearest(ctx.palette, ctx.canvas.data)

  // Dither (ordered) on non-transparent pixels only
  if(ctx.dither !== 'none'){
    const size = ctx.dither==='bayer4'?4:8;
    applyBayer(ctx.canvas.data, ctx.canvas.w, ctx.canvas.h, ctx.palette, size)
  }

  // Simple 1px outer outline (around alpha edges)
  if(ctx.retro.outlineWidth>0){
    const {w,h,data} = ctx.canvas
    const copy = data.slice()
    const outline = argb(255,20,20,20)
    const solid = (x:number,y:number)=> (x>=0&&y>=0&&x<w&&y<h) && ((copy[y*w+x]>>>24)>0)
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=y*w+x
        if((copy[i]>>>24)===0){
          if(solid(x+1,y)||solid(x-1,y)||solid(x,y+1)||solid(x,y-1)){
            data[i]=outline
          }
        }
      }
    }
  }
}
