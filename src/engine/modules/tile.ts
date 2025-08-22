import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas, argb } from '../pixelCanvas'
import { makeValueNoise, worley2D } from '../noise'

export const TerrainTileModule: SpriteModule = {
  id: "tile",
  version: "0.4.0", // Enhanced with latest engine features
  archetypes(){ return [
    { id: "grass", label: "Grass", params: { roughness: 0.6, detail: 0.7, vegetation: true } },
    { id: "rock",  label: "Rock",  params: { roughness: 0.8, detail: 0.5, vegetation: false } },
    { id: "metal", label: "Metal", params: { roughness: 0.3, detail: 0.4, vegetation: false, metallic: true } },
    { id: "sand", label: "Sand", params: { roughness: 0.4, detail: 0.8, vegetation: false } },
    { id: "water", label: "Water", params: { roughness: 0.2, detail: 0.3, vegetation: false, animated: true } },
    { id: "stone", label: "Stone", params: { roughness: 0.7, detail: 0.6, vegetation: false } },
    { id: "lava", label: "Lava", params: { roughness: 0.5, detail: 0.9, vegetation: false, animated: true } },
    { id: "crystal", label: "Crystal", params: { roughness: 0.3, detail: 0.8, vegetation: false, crystalline: true } },
    { id: "tech", label: "Tech Panel", params: { roughness: 0.2, detail: 0.7, vegetation: false, tech: true } }
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:16, max:64, step:1, default:32 },
    { key:'roughness', type:'range', label:'Roughness', min:0, max:1, step:0.01, default:0.6 },
    { key:'detail', type:'range', label:'Detail', min:0, max:1, step:0.01, default:0.6 },
    { key:'vegetation', type:'bool', label:'Vegetation Details', default:false },
    { key:'metallic', type:'bool', label:'Metallic Finish', default:false },
    { key:'animated', type:'bool', label:'Animated (Water)', default:false },
    { key:'crystalline', type:'bool', label:'Crystalline Structure', default:false },
    { key:'tech', type:'bool', label:'Tech Panels', default:false },
    { key:'weathering', type:'range', label:'Weathering', min:0, max:1, step:0.01, default:0.2 }
  ]},
  capabilities(){ return {
    minSize:[16,16],
    maxSize:[64,64],
    supportsAnimation:false,
    tileable:true,
    preferredPalettes: ['NES_13', 'GB_4', 'SNES_32', 'COMMODORE_16']
  }},
  generate(ctx: EngineContext, params: Record<string,any>){
    const size = Math.max(16, Math.min(64, (params.size|0)||32));
    const pc = createPixelCanvas(size,size);

    // Enhanced RNG splitting for comprehensive sub-features
    const baseRng = ctx.rng.split('base');
    const detailRng = ctx.rng.split('detail');
    const vegetationRng = ctx.rng.split('vegetation');
    const structureRng = ctx.rng.split('structure');
    const weatherRng = ctx.rng.split('weather');
    
    // Performance adaptation based on time budget
    const qualityLevel = ctx.timeBudgetMs > 8 ? 1.0 : 0.6;
    const weathering = params.weathering ?? 0.2;

    const { fbm } = makeValueNoise(baseRng);
    const { fbm: detailFbm } = makeValueNoise(detailRng);
    const { fbm: weatherFbm } = makeValueNoise(weatherRng);

    // Generate base terrain with periodic coordinates for tileability
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      // Periodic coords for seamless tiling
      const u = (Math.cos(2*Math.PI*x/size)+1)/2;
      const v = (Math.cos(2*Math.PI*y/size)+1)/2;

      // Enhanced multi-octave noise with adaptive quality
      const baseOctaves = Math.floor((2 + Math.floor(params.detail * 6)) * qualityLevel); // Detail affects octaves (1-8)
      const baseScale = 2.0 + params.detail * 3.0; // Detail affects scaling
      const roughFactor = 0.3 + params.roughness * 0.7; // Roughness affects persistence
      
      const baseNoise = fbm(u*4, v*4, baseOctaves, baseScale, roughFactor);
      const detailNoise = detailFbm(u*8, v*8, Math.max(1, Math.floor(2 * qualityLevel)), 1.8, 0.6) * (0.1 + params.detail * 0.5);
      
      // Add weathering effects
      const weatherNoise = weathering > 0.1 ? weatherFbm(u*12, v*12, 1, 1.5, 0.8) * weathering : 0;
      
      const n = baseNoise + detailNoise + weatherNoise;

      let r, g, b;

      if(params.crystalline) {
        // Crystalline surfaces with prismatic refraction
        const crystalPhase = Math.floor((x + y + n*50) % 6);
        const crystalIntensity = 150 + n*60;
        switch(crystalPhase) {
          case 0: r = crystalIntensity*1.2; g = crystalIntensity*0.7; b = crystalIntensity*1.1; break; // Pink
          case 1: r = crystalIntensity*0.7; g = crystalIntensity*1.2; b = crystalIntensity*1.1; break; // Cyan
          case 2: r = crystalIntensity*1.1; g = crystalIntensity*1.1; b = crystalIntensity*0.7; break; // Yellow
          case 3: r = crystalIntensity*1.1; g = crystalIntensity*0.7; b = crystalIntensity*1.2; break; // Purple
          case 4: r = crystalIntensity*0.8; g = crystalIntensity*1.1; b = crystalIntensity*0.8; break; // Green
          default: r = crystalIntensity; g = crystalIntensity; b = crystalIntensity; break; // White
        }
      } else if(params.tech) {
        // Tech panels with circuit-like patterns
        const techPattern = Math.floor((x*3 + y*2) % 4);
        const techBase = 80 + n*40;
        if(techPattern === 0) {
          r = techBase*0.3; g = techBase*1.8; b = techBase*0.5; // Green circuit lines
        } else {
          r = techBase*0.8; g = techBase*0.9; b = techBase*1.1; // Metallic base
        }
      } else if(params.metallic) {
        // Metallic surfaces - use cooler tones
        const metalValue = 100 + n*80;
        r = metalValue * 0.8; g = metalValue * 0.9; b = metalValue;
      } else if(params.animated) {
        // Animated surfaces (water/lava)
        if(params.roughness > 0.4) {
          // Lava-like with high roughness
          const lavaValue = 80 + n*100;
          r = lavaValue * 1.8; // High red
          g = lavaValue * 0.6; // Medium green  
          b = 20; // Very low blue
        } else {
          // Water-like surfaces - blue-dominant
          const waterValue = 60 + n*60;
          r = 10; // Very low red
          g = 30; // Low green
          b = waterValue * 2.0; // Very high blue (120-240)
        }
      } else {
        // Standard terrain
        const terrainValue = 80 + n*120;
        r = terrainValue; g = terrainValue; b = terrainValue;
      }

      pc.set(x,y, argb(255, r, g, b));
    }

    // Enhanced feature generation with quality scaling
    const featureCount = Math.floor(qualityLevel * 10);
    
    // Add vegetation details if enabled
    if(params.vegetation) {
      const vegCount = Math.floor((3 + vegetationRng.nextInt(8)) * qualityLevel);
      for(let i = 0; i < vegCount; i++) {
        const vx = vegetationRng.nextInt(size);
        const vy = vegetationRng.nextInt(size);
        const vegSize = 1 + vegetationRng.nextInt(2);
        const vegType = vegetationRng.nextInt(3); // Different vegetation types

        // Small vegetation patches with variety
        for(let dy = -vegSize; dy <= vegSize; dy++) {
          for(let dx = -vegSize; dx <= vegSize; dx++) {
            const px = (vx + dx + size) % size;
            const py = (vy + dy + size) % size;
            if(dx*dx + dy*dy <= vegSize*vegSize && vegetationRng.nextFloat() > 0.4) {
              let r, g, b;
              switch(vegType) {
                case 0: r = 40; g = 100 + vegetationRng.nextInt(60); b = 30; break; // Grass
                case 1: r = 60; g = 120 + vegetationRng.nextInt(40); b = 20; break; // Shrubs
                default: r = 80; g = 140 + vegetationRng.nextInt(30); b = 40; break; // Trees
              }
              pc.set(px, py, argb(255, r, g, b));
            }
          }
        }
      }
    }
    
    // Add structural features for tech/crystalline
    if(params.tech) {
      // Add circuit-like lines
      const lineCount = Math.floor(3 * qualityLevel);
      for(let i = 0; i < lineCount; i++) {
        const isVertical = structureRng.nextFloat() > 0.5;
        const pos = structureRng.nextInt(size);
        const start = structureRng.nextInt(size/2);
        const length = 4 + structureRng.nextInt(size/2);
        
        for(let j = 0; j < length && start + j < size; j++) {
          const x = isVertical ? pos : start + j;
          const y = isVertical ? start + j : pos;
          if(structureRng.nextFloat() > 0.3) { // Broken lines for realism
            pc.set(x, y, argb(255, 20, 255, 100)); // Bright cyan circuit
          }
        }
      }
    } else if(params.crystalline) {
      // Add crystal formations using Worley noise
      const crystalPoints: [number,number][] = [];
      const crystalCount = Math.floor(3 * qualityLevel);
      for(let i = 0; i < crystalCount; i++) {
        crystalPoints.push([structureRng.nextFloat()*size, structureRng.nextFloat()*size]);
      }
      
      for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
          const dist = worley2D(x, y, crystalPoints);
          if(dist < 3) {
            const intensity = (3 - dist) / 3;
            const existing = pc.get(x, y);
            const er = (existing >>> 16) & 0xFF;
            const eg = (existing >>> 8) & 0xFF;
            const eb = existing & 0xFF;
            
            // Enhance existing color with crystal highlights
            const boost = intensity * 80;
            pc.set(x, y, argb(255, 
              Math.min(255, er + boost),
              Math.min(255, eg + boost), 
              Math.min(255, eb + boost)
            ));
          }
        }
      }
    }

    ctx.canvas.blit(pc,0,0);
  },

  // Enhanced finalize method for material-specific effects
  finalize(ctx: EngineContext, params: Record<string,any>) {
    // Adjust micro-jitter based on material type
    if(ctx.retro.microJitter) {
      const baseStrength = ctx.retro.microJitterStrength ?? 0.15;
      
      if(params.crystalline) {
        // Crystals get maximum jitter for prismatic light refraction
        ctx.retro.microJitterStrength = Math.min(0.4, baseStrength * 2.5);
      } else if(params.tech) {
        // Tech panels get moderate jitter for holographic effects
        ctx.retro.microJitterStrength = Math.min(0.25, baseStrength * 1.6);
      } else if(params.metallic) {
        // Metals benefit from stronger micro-jitter for more realistic reflection variation
        const weatherBoost = (params.weathering ?? 0) > 0.5 ? 1.3 : 1.0;
        ctx.retro.microJitterStrength = Math.min(0.3, baseStrength * 2.0 * weatherBoost);
      } else if(params.animated) {
        if(params.roughness > 0.4) {
          // Lava gets very strong jitter for heat shimmer
          ctx.retro.microJitterStrength = Math.min(0.35, baseStrength * 2.3);
        } else {
          // Water surfaces get moderate jitter for shimmer effect
          ctx.retro.microJitterStrength = Math.min(0.2, baseStrength * 1.3);
        }
      } else if(params.vegetation) {
        // Vegetation benefits from slight jitter for organic variation
        const weatherBoost = (params.weathering ?? 0) > 0.3 ? 1.2 : 1.0;
        ctx.retro.microJitterStrength = Math.min(0.18, baseStrength * 1.2 * weatherBoost);
      } else if(params.detail > 0.7) {
        // High detail surfaces get enhanced micro-jitter
        ctx.retro.microJitterStrength = Math.min(0.22, baseStrength * 1.4);
      }
    }
    
    // Performance monitoring
    if(ctx.timeBudgetMs < 6) {
      console.debug('Tile generation approaching time budget, consider reducing feature density');
    }
  }
}
