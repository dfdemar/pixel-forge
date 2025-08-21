import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas } from '../pixelCanvas'

export const IconModule: SpriteModule = {
  id: "icon",
  version: "0.3.0", // Updated version
  archetypes(){ return [
    { id: "shield", label:"Shield", params:{ style: "medieval", mirror: true } },
    { id: "skull", label:"Skull", params:{ style: "spooky", mirror: true } },
    { id: "spark", label:"Spark", params:{ style: "magical", mirror: false } },
    { id: "gem", label:"Gem", params:{ style: "precious", mirror: true } },
    { id: "sword", label:"Sword", params:{ style: "weapon", mirror: false } },
    { id: "potion", label:"Potion", params:{ style: "magical", mirror: true } }
  ]},
  schema(): ModuleParam[] { return [
    { key:'size', type:'int', label:'Size (px)', min:16, max:32, step:1, default:16 },
    { key:'mirror', type:'bool', label:'Mirror X', default:true },
    { key:'style', type:'enum', label:'Style', options:['medieval', 'spooky', 'magical', 'precious', 'weapon'], default:'medieval' },
    { key:'complexity', type:'range', label:'Complexity', min:0, max:1, step:0.01, default:0.5 },
    { key:'glow', type:'bool', label:'Glowing Effect', default:false }
  ]},
  capabilities(){ return {
    minSize:[16,16],
    maxSize:[32,32],
    supportsAnimation:false,
    tileable:false,
    preferredPalettes: ['NES_13', 'GB_4']
  }},
  generate(ctx: EngineContext, params: Record<string,any>){
    const size = Math.max(16, Math.min(32, (params.size|0)||16));
    const pc = createPixelCanvas(size,size);
    const mid = (size/2)|0;

    // Use RNG splitting for consistent sub-features
    const baseRng = ctx.rng.split('base');
    const detailRng = ctx.rng.split('detail');
    const glowRng = ctx.rng.split('glow');

    const draw = (x:number,y:number,c:number)=>{ if(x>=0&&y>=0&&x<size&&y<size) pc.set(x,y,c) }

    // Style-specific color schemes
    let baseColor, accentColor, detailColor;

    switch(params.style) {
      case 'spooky':
        baseColor = (255<<24)|(80<<16)|(40<<8)|80;    // Dark purple
        accentColor = (255<<24)|(200<<16)|(50<<8)|50; // Dark red
        detailColor = (255<<24)|(160<<16)|(160<<8)|160; // Gray
        break;
      case 'magical':
        baseColor = (255<<24)|(60<<16)|(100<<8)|200;   // Blue
        accentColor = (255<<24)|(200<<16)|(150<<8)|255; // Light purple
        detailColor = (255<<24)|(255<<16)|(255<<8)|200; // Light yellow
        break;
      case 'precious':
        baseColor = (255<<24)|(200<<16)|(180<<8)|80;   // Gold
        accentColor = (255<<24)|(255<<16)|(220<<8)|120; // Bright gold
        detailColor = (255<<24)|(150<<16)|(50<<8)|50;   // Dark red
        break;
      case 'weapon':
        baseColor = (255<<24)|(120<<16)|(120<<8)|140;  // Steel gray
        accentColor = (255<<24)|(180<<16)|(180<<8)|200; // Light steel
        detailColor = (255<<24)|(80<<16)|(60<<8)|40;    // Brown handle
        break;
      default: // medieval
        baseColor = (255<<24)|(200<<16)|(200<<8)|200;  // Light gray
        accentColor = (255<<24)|(250<<16)|(250<<8)|250; // White
        detailColor = (255<<24)|(150<<16)|(100<<8)|50;  // Brown
    }

    // Generate base shape with complexity-driven detail
    const complexityFactor = params.complexity ?? 0.5;
    const detailDensity = Math.floor(2 + complexityFactor * 6);
    
    // Create a unique pattern based on the seed
    const patternSeed = baseRng.nextInt(100000);

    for(let y=2;y<size-2;y++) {
      for(let x=2;x<mid;x++) {
        // Base pattern with complexity variation
        const distFromCenter = Math.abs(x - mid/2) + Math.abs(y - size/2);
        
        // Use the baseRng to create a more varied pattern that's still seed-dependent
        const noiseVal = baseRng.nextFloat();
        const seedFactor = (Math.sin(x * y + patternSeed) + 1) * 0.5;
        const shouldDraw = (noiseVal * seedFactor > 0.4 - complexityFactor * 0.3) && 
                          (distFromCenter < size/3);

        if(shouldDraw) {
          draw(x,y, baseColor);

          // Add detail pixels based on complexity
          if(detailRng.nextFloat() < complexityFactor && ((x*y + patternSeed) & 3) === 0) {
            draw(x,y, detailColor);
          }
        }
      }
    }

    // Add central accent lines/cross
    for(let t=0;t<size;t++){
      if(t > 1 && t < size-2) {
        draw(mid, t, accentColor);
        draw(t, mid, accentColor);
      }
    }

    // Add style-specific details
    if(params.style === 'gem') {
      // Add facet lines for gems
      const facetRng = ctx.rng.split('facets');
      for(let i = 0; i < 3; i++) {
        const fx = 3 + facetRng.nextInt(mid-3);
        const fy = 3 + facetRng.nextInt(size-6);
        draw(fx, fy, accentColor);
        draw(fx+1, fy, accentColor);
      }
    } else if(params.style === 'spark') {
      // Add radiating lines for sparks
      const sparkRng = ctx.rng.split('sparks');
      for(let angle = 0; angle < 8; angle++) {
        const dx = Math.cos(angle * Math.PI / 4);
        const dy = Math.sin(angle * Math.PI / 4);
        for(let len = 1; len < 4; len++) {
          const sx = mid + Math.floor(dx * len);
          const sy = mid + Math.floor(dy * len);
          if(sparkRng.nextFloat() > 0.3) {
            draw(sx, sy, accentColor);
          }
        }
      }
    }

    // Add glowing effect if enabled
    if(params.glow) {
      const glowColor = (128<<24)|(255<<16)|(255<<8)|200; // Semi-transparent yellow
      for(let y=1;y<size-1;y++) {
        for(let x=1;x<(params.mirror ? mid : size-1);x++) {
          const current = pc.get(x,y);
          if((current>>>24) > 0) { // If pixel is not transparent
            // Add glow around existing pixels
            if(glowRng.nextFloat() > 0.7) {
              for(let dy=-1; dy<=1; dy++) {
                for(let dx=-1; dx<=1; dx++) {
                  const gx = x + dx, gy = y + dy;
                  if(gx >= 0 && gy >= 0 && gx < size && gy < size) {
                    const neighbor = pc.get(gx, gy);
                    if((neighbor>>>24) === 0) { // If neighbor is transparent
                      draw(gx, gy, glowColor);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Apply mirroring
    if(params.mirror){
      for(let y=0;y<size;y++) {
        for(let x=0;x<mid;x++){
          const c=pc.get(x,y);
          pc.set(size-1-x, y, c);
        }
      }
    }

    ctx.canvas.blit(pc,0,0);
  },

  // Enhanced finalize method for icon-specific effects
  finalize(ctx: EngineContext, params: Record<string,any>) {
    // Adjust micro-jitter based on icon style
    if(ctx.retro.microJitter) {
      if(params.style === 'precious' || params.style === 'magical') {
        // Gems and magical items benefit from stronger micro-jitter for sparkle effect
        ctx.retro.microJitterStrength = Math.min(0.25, (ctx.retro.microJitterStrength ?? 0.15) * 1.8);
      } else if(params.glow) {
        // Glowing effects get enhanced jitter
        ctx.retro.microJitterStrength = Math.min(0.2, (ctx.retro.microJitterStrength ?? 0.15) * 1.4);
      }
    }
  }
}
