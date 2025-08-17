import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas } from '../pixelCanvas'

export const IconModule: SpriteModule = {
  id: "icon",
  version: "0.2.0",
  archetypes(){ return [
    { id: "shield", label:"Shield", params:{} },
    { id: "skull", label:"Skull", params:{} },
    { id: "spark", label:"Spark", params:{} }
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:16, max:32, step:1, default:16 },
    { key:'mirror', type:'bool', label:'Mirror X', default:true }
  ]},
  capabilities(){ return { minSize:[16,16], maxSize:[32,32], supportsAnimation:false, tileable:false } },
  generate(ctx: EngineContext, params: Record<string,any>){
    const size = Math.max(16, Math.min(32, (params.size|0)||16));
    const pc = createPixelCanvas(size,size);
    const mid = (size/2)|0;
    const draw = (x:number,y:number,c:number)=>{ if(x>=0&&y>=0&&x<size&&y<size) pc.set(x,y,c) }
    const base = (255<<24)|(200<<16)|(200<<8)|200;
    const acc  = (255<<24)|(250<<16)|(250<<8)|250;
    for(let y=2;y<size-2;y++) for(let x=2;x<mid;x++){ if(((x*y)&7)===0) draw(x,y, base) }
    for(let t=0;t<size;t++){ draw(mid, t, acc); draw(t, mid, acc); }
    if(params.mirror){
      for(let y=0;y<size;y++) for(let x=0;x<mid;x++){ const c=pc.get(x,y); pc.set(size-1-x, y, c); }
    }
    ctx.canvas.blit(pc,0,0);
  }
}
