import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas } from '../pixelCanvas'
import { makeValueNoise } from '../noise'

export const TerrainTileModule: SpriteModule = {
  id: "tile",
  version: "0.2.0",
  archetypes(){ return [
    { id: "grass", label: "Grass", params: { roughness: 0.6 } },
    { id: "rock",  label: "Rock",  params: { roughness: 0.8 } },
    { id: "metal", label: "Metal", params: { roughness: 0.3 } },
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:16, max:64, step:1, default:32 },
    { key:'roughness', type:'range', label:'Roughness', min:0, max:1, step:0.01, default:0.6 },
    { key:'detail', type:'range', label:'Detail', min:0, max:1, step:0.01, default:0.6 },
  ]},
  capabilities(){ return { minSize:[16,16], maxSize:[64,64], supportsAnimation:false, tileable:true } },
  generate(ctx: EngineContext, params: Record<string,any>){
    const size = Math.max(16, Math.min(64, (params.size|0)||32));
    const pc = createPixelCanvas(size,size);
    const { fbm } = makeValueNoise(ctx.rng);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      // periodic coords for tileability
      const u = (Math.cos(2*Math.PI*x/size)+1)/2;
      const v = (Math.cos(2*Math.PI*y/size)+1)/2;
      const n = fbm(u*4, v*4, 4, 2.0 + params.detail*1.5, 0.5 + params.roughness*0.4);
      const g = (80 + n*120)|0;
      pc.set(x,y, (255<<24)|((g&255)<<16)|((g&255)<<8)|(g&255));
    }
    ctx.canvas.blit(pc,0,0);
  }
}
