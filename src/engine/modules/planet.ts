import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas } from '../pixelCanvas'
import { makeValueNoise, worley2D } from '../noise'

function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }

export const PlanetModule: SpriteModule = {
  id: "planet",
  version: "0.2.0",
  archetypes(){ return [
    { id: "lush", label: "Lush", params: { featureDensity: 0.6, clouds: true } },
    { id: "arid", label: "Arid", params: { featureDensity: 0.35, clouds: false } },
    { id: "ice",  label: "Ice",  params: { featureDensity: 0.4, clouds: true } },
    { id: "gas",  label: "Gas Giant", params: { bands: true, clouds: false, featureDensity: 0.7 } }
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:32, max:96, step:1, default:64 },
    { key:'featureDensity', type:'range', label:'Feature Density', min:0, max:1, step:0.01, default:0.6 },
    { key:'clouds', type:'bool', label:'Clouds', default:true },
    { key:'bands', type:'bool', label:'Bands (Gas)', default:false },
    { key:'ringChance', type:'range', label:'Ring Chance', min:0, max:1, step:0.01, default:0.15 }
  ]},
  capabilities(){ return { minSize:[32,32], maxSize:[96,96], supportsAnimation:false, tileable:false } },
  generate(ctx: EngineContext, params: Record<string,any>) {
    const size = Math.max(32, Math.min(96, (params.size|0)||64));
    const r = (size/2)|0;
    const cx = r, cy = r;
    const pc = createPixelCanvas(size,size);
    const { fbm } = makeValueNoise(ctx.rng);

    // Base disc with limb darkening
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const dx=x-cx, dy=y-cy, d = Math.sqrt(dx*dx+dy*dy);
      if(d<=r){
        const light = clamp01(1.0 - (d/r)*0.9);
        const g = (light*200)|0;
        pc.set(x,y, (255<<24)|(g<<16)|(g<<8)|g);
      }
    }

    // Features
    if(params.bands){
      const bands = 6 + (ctx.rng.nextInt(5));
      for(let y=0;y<size;y++){
        const bandIdx = Math.floor((y/size)*bands);
        for(let x=0;x<size;x++){
          const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy>r*r) continue;
          const n = fbm(x*0.03 + fbm(y*0.08,0,3), y*0.06, 3, 2.1, 0.55);
          const v = (bandIdx%2===0) ? 180 + n*40 : 140 + n*30;
          const c = (255<<24)|((v&255)<<16)|(((v*0.95)|0)<<8)|((v*0.9)|0);
          pc.set(x,y,c);
        }
      }
    } else {
      const seaLevel = 0.05;
      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy>r*r) continue;
        const wx = x + fbm(x*0.06, y*0.06, 2, 2.2, 0.5)*(2.0 + params.featureDensity*2.0);
        const wy = y + fbm(y*0.06, x*0.06, 2, 2.2, 0.5)*(2.0 + params.featureDensity*2.0);
        const n = fbm(wx*0.035, wy*0.035, 4, 2.0, 0.55)*(2.3 + params.featureDensity*3.0) - 0.8;
        if(n>seaLevel){
          const t = Math.min(1, (n-seaLevel)/(1-seaLevel));
          const r0 = 120 + t*70, g0 = 150 + t*70, b0 = 90 + t*40;
          pc.set(x,y, (255<<24)|((r0&255)<<16)|((g0&255)<<8)|(b0&255));
        } else {
          const t = Math.max(0, (n+0.8)/1.2);
          const r0 = 30 + t*30, g0 = 60 + t*70, b0 = 120 + t*90;
          pc.set(x,y, (255<<24)|((r0&255)<<16)|((g0&255)<<8)|(b0&255));
        }
      }
    }

    // Clouds as two-level blobby mask
    if(params.clouds){
      const pts: [number,number][] = [];
      const num = 18 + ctx.rng.nextInt(24);
      for(let i=0;i<num;i++) pts.push([ctx.rng.nextFloat()*size, ctx.rng.nextFloat()*size]);
      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy>r*r) continue;
        const d = worley2D(x, y, pts);
        if(d<6.0 && ((x+y)&3)!==0){
          const level = d<3.0 ? 240 : 210;
          pc.set(x,y, (240<<24)|((level&255)<<16)|((level&255)<<8)|(level&255));
        }
      }
    }

    // Rings (rare)
    if(ctx.rng.nextFloat()<(params.ringChance??0.15)){
      const tilt = (ctx.rng.nextFloat()*0.8 - 0.4);
      const inner = r*1.05, outer = r*1.45;
      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        const dx = (x-cx); const dy = (y-cy)*(1+tilt);
        const d = Math.sqrt(dx*dx+dy*dy);
        if(d>inner && d<outer && ((x+y)&1)===0){
          pc.set(x,y, (220<<24)|(200<<16)|(190<<8)|170);
        }
      }
    }

    ctx.canvas.blit(pc, 0, 0);
  },
}
