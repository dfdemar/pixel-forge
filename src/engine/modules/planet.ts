import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas } from '../pixelCanvas'
import { makeValueNoise, worley2D } from '../noise'
import { argb } from '../pixelCanvas'

function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }

export const PlanetModule: SpriteModule = {
  id: "planet",
  version: "0.4.0", // Enhanced with latest engine features
  archetypes(){ return [
    { id: "lush", label: "Lush", params: { featureDensity: 0.6, clouds: true, atmosphere: true, ringChance: 0.1 } },
    { id: "arid", label: "Arid", params: { featureDensity: 0.35, clouds: false, atmosphere: false, ringChance: 0.2 } },
    { id: "ice",  label: "Ice",  params: { featureDensity: 0.4, clouds: true, atmosphere: true, ringChance: 0.15 } },
    { id: "gas",  label: "Gas Giant", params: { bands: true, clouds: false, featureDensity: 0.7, atmosphere: true, ringChance: 0.4 } },
    { id: "volcanic", label: "Volcanic", params: { featureDensity: 0.8, clouds: false, atmosphere: false, volcanic: true, ringChance: 0.05 } },
    { id: "barren", label: "Barren", params: { featureDensity: 0.2, clouds: false, atmosphere: false, ringChance: 0.25 } },
    { id: "crystalline", label: "Crystalline", params: { featureDensity: 0.9, clouds: false, atmosphere: true, crystalline: true, ringChance: 0.3 } }
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:32, max:96, step:1, default:64 },
    { key:'featureDensity', type:'range', label:'Feature Density', min:0, max:1, step:0.01, default:0.6 },
    { key:'clouds', type:'bool', label:'Clouds', default:true },
    { key:'bands', type:'bool', label:'Bands (Gas)', default:false },
    { key:'ringChance', type:'range', label:'Ring Chance', min:0, max:1, step:0.01, default:0.15 },
    { key:'atmosphere', type:'bool', label:'Atmospheric Glow', default:true },
    { key:'volcanic', type:'bool', label:'Volcanic Activity', default:false },
    { key:'crystalline', type:'bool', label:'Crystalline Surface', default:false },
    { key:'stormIntensity', type:'range', label:'Storm Intensity', min:0, max:1, step:0.01, default:0.3 }
  ]},
  capabilities(){ return {
    minSize:[32,32],
    maxSize:[96,96],
    supportsAnimation:false,
    tileable:false,
    preferredPalettes: ['SNES_32', 'NES_13', 'GB_4'] // Suggest palettes that work well
  }},
  generate(ctx: EngineContext, params: Record<string,any>) {
    const size = Math.max(32, Math.min(96, (params.size|0)||64));
    const r = (size/2)|0;
    const cx = r, cy = r;
    const pc = createPixelCanvas(size,size);

    // Use RNG splitting for consistent sub-features with enhanced splitting
    const terrainRng = ctx.rng.split('terrain');
    const cloudsRng = ctx.rng.split('clouds');
    const ringsRng = ctx.rng.split('rings');
    const weatherRng = ctx.rng.split('weather');
    const crystallineRng = ctx.rng.split('crystalline');
    const { fbm } = makeValueNoise(terrainRng);
    const { fbm: weatherFbm } = makeValueNoise(weatherRng);
    
    // Time budget awareness for adaptive quality
    const qualityLevel = ctx.timeBudgetMs > 8 ? 1.0 : 0.7;
    const maxOctaves = Math.floor(4 * qualityLevel);
    const stormIntensity = params.stormIntensity ?? 0.3;

    // Base disc with limb darkening and optional atmospheric glow
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const dx=x-cx, dy=y-cy, d = Math.sqrt(dx*dx+dy*dy);
      if(d<=r){
        const light = clamp01(1.0 - (d/r)*0.9);
        const g = (light*200)|0;
        pc.set(x,y, (255<<24)|(g<<16)|(g<<8)|g);
      } else if(params.atmosphere && d <= r * 1.2) {
        // Atmospheric glow
        const glowIntensity = Math.max(0, 1.0 - (d - r) / (r * 0.2));
        const glowColor = (glowIntensity * 60)|0;
        pc.set(x,y, (100<<24)|(glowColor<<16)|(glowColor<<8)|glowColor);
      }
    }

    // Features
    if(params.bands){
      const bands = 6 + (terrainRng.nextInt(5));
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

        if(params.volcanic && n > 0.6) {
          // Volcanic regions - lower threshold for more volcanic pixels
          const heat = (n - 0.6) / 0.4;
          // Enhanced volcanic with lava flows using Worley noise
          const lavaFlow = worley2D(x*0.3, y*0.3, [[cx+terrainRng.nextFloat()*20-10, cy+terrainRng.nextFloat()*20-10]]);
          const flowEffect = Math.max(0, 1 - lavaFlow/8);
          const r0 = 220 + heat*35 + flowEffect*30, g0 = 80 + heat*120 + flowEffect*40, b0 = 20 + flowEffect*10;
          pc.set(x,y, argb(255, r0, g0, b0));
        } else if(params.crystalline && n > 0.4) {
          // Crystalline regions with prismatic colors
          const crystalPhase = (x + y + n*100) % 6;
          let r0, g0, b0;
          switch(Math.floor(crystalPhase)) {
            case 0: r0 = 200; g0 = 100; b0 = 255; break; // Purple
            case 1: r0 = 100; g0 = 200; b0 = 255; break; // Cyan  
            case 2: r0 = 255; g0 = 200; b0 = 100; break; // Orange
            case 3: r0 = 200; g0 = 255; b0 = 100; break; // Green
            case 4: r0 = 255; g0 = 100; b0 = 200; break; // Magenta
            default: r0 = 255; g0 = 255; b0 = 200; break; // Yellow
          }
          // Add crystal noise for texture
          const crystalNoise = fbm(x*0.1, y*0.1, 2, 2.0, 0.6);
          const intensity = 0.8 + crystalNoise*0.4;
          pc.set(x,y, argb(255, r0*intensity, g0*intensity, b0*intensity));
        } else if(n>seaLevel){
          const t = Math.min(1, (n-seaLevel)/(1-seaLevel));
          const r0 = 120 + t*70, g0 = 150 + t*70, b0 = 90 + t*40;
          pc.set(x,y, argb(255, r0, g0, b0));
        } else {
          const t = Math.max(0, (n+0.8)/1.2);
          const r0 = 30 + t*30, g0 = 60 + t*70, b0 = 120 + t*90;
          pc.set(x,y, argb(255, r0, g0, b0));
        }
      }
    }

    // Enhanced clouds with storm systems
    if(params.clouds){
      const pts: [number,number][] = [];
      const num = Math.floor((18 + cloudsRng.nextInt(24)) * qualityLevel);
      for(let i=0;i<num;i++) pts.push([cloudsRng.nextFloat()*size, cloudsRng.nextFloat()*size]);
      
      // Add storm centers if high storm intensity
      const stormPts: [number,number][] = [];
      if(stormIntensity > 0.5) {
        const stormCount = Math.floor(stormIntensity * 3);
        for(let i=0;i<stormCount;i++) {
          stormPts.push([weatherRng.nextFloat()*size, weatherRng.nextFloat()*size]);
        }
      }
      
      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy>r*r) continue;
        const cloudDist = worley2D(x, y, pts);
        const weatherNoise = weatherFbm(x*0.02, y*0.02, Math.max(2, maxOctaves-1), 2.0, 0.6);
        
        // Check for storm influence
        let stormInfluence = 0;
        if(stormPts.length > 0) {
          const stormDist = worley2D(x, y, stormPts);
          stormInfluence = Math.max(0, 1 - stormDist/15) * stormIntensity;
        }
        
        const effectiveThreshold = 6.0 - stormInfluence*2;
        if(cloudDist < effectiveThreshold && ((x+y)&3)!==0){
          const level = cloudDist<3.0 ? 240 : 210;
          const stormDarkening = stormInfluence * 40;
          const finalLevel = Math.max(level - stormDarkening, 120);
          const alpha = stormInfluence > 0.3 ? 255 : 240;
          pc.set(x,y, argb(alpha, finalLevel, finalLevel, finalLevel));
        }
      }
    }

    // Rings (rare)
    if(ringsRng.nextFloat()<(params.ringChance??0.15)){
      const tilt = (ringsRng.nextFloat()*0.8 - 0.4);
      const inner = r*1.05, outer = r*1.45;
      const ringSegments = 2 + ringsRng.nextInt(3); // Multiple ring segments

      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        const dx = (x-cx); const dy = (y-cy)*(1+tilt);
        const d = Math.sqrt(dx*dx+dy*dy);
        if(d>inner && d<outer){
          const ringIdx = Math.floor((d - inner) / (outer - inner) * ringSegments);
          if(ringIdx % 2 === 0 && ((x+y)&1)===0){
            // Enhanced ring system with particle density variation
            const particleDensity = fbm((x-cx)*0.1, (y-cy)*0.1, 2, 1.8, 0.7);
            const alpha = Math.floor(180 + ringsRng.nextInt(60) + particleDensity*20);
            const baseColor = 170 + particleDensity*30;
            pc.set(x,y, argb(alpha, 200, 190, baseColor));
          }
        }
      }
    }

    ctx.canvas.blit(pc, 0, 0);
  },

  // Enhanced finalize method for post-processing effects
  finalize(ctx: EngineContext, params: Record<string,any>) {
    // Add subtle lighting variation using micro-jitter if enabled
    if(ctx.retro.microJitter) {
      const baseStrength = ctx.retro.microJitterStrength ?? 0.15;
      
      if(params.crystalline) {
        // Crystalline planets get maximum jitter for prismatic effects
        ctx.retro.microJitterStrength = Math.min(0.35, baseStrength * 2.3);
      } else if(params.volcanic) {
        // Volcanic planets benefit more from color variation
        const stormBoost = (params.stormIntensity ?? 0) > 0.5 ? 1.2 : 1.0;
        ctx.retro.microJitterStrength = Math.min(0.25, baseStrength * 1.5 * stormBoost);
      } else if(params.bands) {
        // Gas giants benefit from moderate jitter for band variation
        ctx.retro.microJitterStrength = Math.min(0.2, baseStrength * 1.3);
      } else if(params.atmosphere) {
        // Atmospheric planets get slight color variation
        const atmosphereBoost = (params.stormIntensity ?? 0) > 0.3 ? 1.3 : 1.2;
        ctx.retro.microJitterStrength = Math.min(0.18, baseStrength * atmosphereBoost);
      } else if((params.stormIntensity ?? 0) > 0.6) {
        // High storm intensity enhances atmospheric effects
        ctx.retro.microJitterStrength = Math.min(0.22, baseStrength * 1.4);
      }
    }
    
    // Performance feedback: If we exceeded time budget, suggest lower quality
    if(ctx.timeBudgetMs < 8) {
      // This feedback could be used by the engine to adjust future generations
      console.debug('Planet generation approaching time budget, consider reducing quality');
    }
  }
}
