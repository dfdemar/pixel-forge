import type { SpriteModule, EngineContext, ModuleParam } from '../types'
import { createPixelCanvas, argb } from '../pixelCanvas'
import { makeValueNoise, worley2D } from '../noise'

export const IconModule: SpriteModule = {
  id: "icon",
  version: "0.4.0", // Enhanced with latest engine features
  archetypes(){ return [
    { id: "shield", label:"Shield", params:{ style: "medieval", mirror: true, complexity: 0.6 } },
    { id: "skull", label:"Skull", params:{ style: "spooky", mirror: true, complexity: 0.7 } },
    { id: "spark", label:"Spark", params:{ style: "magical", mirror: false, complexity: 0.4, glow: true } },
    { id: "gem", label:"Gem", params:{ style: "precious", mirror: true, complexity: 0.5, glow: true } },
    { id: "sword", label:"Sword", params:{ style: "weapon", mirror: false, complexity: 0.8 } },
    { id: "potion", label:"Potion", params:{ style: "magical", mirror: true, complexity: 0.6, glow: true } },
    { id: "crown", label:"Crown", params:{ style: "precious", mirror: true, complexity: 0.9 } },
    { id: "scroll", label:"Scroll", params:{ style: "medieval", mirror: false, complexity: 0.5 } },
    { id: "orb", label:"Energy Orb", params:{ style: "magical", mirror: true, complexity: 0.7, glow: true, animated: true } },
    { id: "rune", label:"Ancient Rune", params:{ style: "magical", mirror: true, complexity: 0.8, glow: true } }
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
    if(params.style === 'gem' || params.style === 'precious') {
      // Add facet lines for gems
      const facetRng = ctx.rng.split('facets');
      const facetCount = Math.floor(2 + complexityFactor * 4);
      for(let i = 0; i < facetCount; i++) {
        const fx = 3 + facetRng.nextInt(mid-3);
        const fy = 3 + facetRng.nextInt(size-6);
        draw(fx, fy, accentColor);
        if(complexityFactor > 0.5) {
          draw(fx+1, fy, accentColor);
        }
      }
    } else if(params.style === 'spark' || params.style === 'magical') {
      // Add radiating lines for sparks and magical items
      const sparkRng = ctx.rng.split('sparks');
      const rayCount = Math.floor(4 + complexityFactor * 8);
      for(let angle = 0; angle < rayCount; angle++) {
        const dx = Math.cos(angle * 2 * Math.PI / rayCount);
        const dy = Math.sin(angle * 2 * Math.PI / rayCount);
        const maxLen = Math.floor(2 + complexityFactor * 3);
        for(let len = 1; len < maxLen; len++) {
          const sx = mid + Math.floor(dx * len);
          const sy = mid + Math.floor(dy * len);
          if(sparkRng.nextFloat() > 0.3) {
            // Enhanced spark effects with energy animation
            let sparkColor = accentColor;
            if(params.animated) {
              const sparkIntensity = 1.0 + Math.sin(angle + len*0.5) * 0.3;
              const sr = ((accentColor >>> 16) & 0xFF) * sparkIntensity;
              const sg = ((accentColor >>> 8) & 0xFF) * sparkIntensity;
              const sb = (accentColor & 0xFF) * sparkIntensity;
              sparkColor = argb(255, 
                Math.min(255, sr), Math.min(255, sg), Math.min(255, sb));
            }
            draw(sx, sy, sparkColor);
          }
        }
      }
    } else if(params.style === 'weapon') {
      // Add edge details for weapons
      const weaponRng = ctx.rng.split('weapon');
      const edgeCount = Math.floor(1 + complexityFactor * 3);
      for(let i = 0; i < edgeCount; i++) {
        const ex = 2 + weaponRng.nextInt(mid-2);
        const ey = 2 + weaponRng.nextInt(size-4);
        draw(ex, ey, detailColor);
        if(complexityFactor > 0.7) {
          draw(ex, ey+1, detailColor);
        }
      }
    }

    // Enhanced glowing effect with style-specific colors
    if(params.glow) {
      let glowColor = argb(128, 255, 255, 200); // Default semi-transparent yellow
      
      // Style-specific glow colors
      switch(params.style) {
        case 'magical':
          glowColor = argb(120, 150, 200, 255); // Blue-purple glow
          break;
        case 'precious':
          glowColor = argb(140, 255, 220, 120); // Golden glow
          break;
        case 'spooky':
          glowColor = argb(100, 200, 50, 100); // Eerie green glow
          break;
      }
      
      const glowRadius = params.animated ? 2 : 1;
      
      for(let y=glowRadius;y<size-glowRadius;y++) {
        for(let x=glowRadius;x<(params.mirror ? mid : size-glowRadius);x++) {
          const current = pc.get(x,y);
          if((current>>>24) > 0) { // If pixel is not transparent
            // Add glow around existing pixels with variable radius
            const glowChance = params.animated ? 0.5 : 0.7;
            if(glowRng.nextFloat() > glowChance) {
              for(let dy=-glowRadius; dy<=glowRadius; dy++) {
                for(let dx=-glowRadius; dx<=glowRadius; dx++) {
                  if(dx*dx + dy*dy <= glowRadius*glowRadius) {
                    const gx = x + dx, gy = y + dy;
                    if(gx >= 0 && gy >= 0 && gx < size && gy < size) {
                      const neighbor = pc.get(gx, gy);
                      if((neighbor>>>24) === 0) { // If neighbor is transparent
                        // Distance-based glow intensity
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        const intensity = (glowRadius - dist) / glowRadius;
                        const alpha = Math.floor(((glowColor >>> 24) & 0xFF) * intensity);
                        const r = (glowColor >>> 16) & 0xFF;
                        const g = (glowColor >>> 8) & 0xFF;
                        const b = glowColor & 0xFF;
                        draw(gx, gy, argb(alpha, r, g, b));
                      }
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
    // Adjust micro-jitter based on icon style and features
    if(ctx.retro.microJitter) {
      const baseStrength = ctx.retro.microJitterStrength ?? 0.15;
      
      if(params.animated) {
        // Animated icons get maximum jitter for energy effects
        const animationMultiplier = params.glow ? 3.0 : 2.5;
        ctx.retro.microJitterStrength = Math.min(0.4, baseStrength * animationMultiplier);
      } else if(params.style === 'precious' || params.style === 'magical') {
        // Gems and magical items benefit from stronger micro-jitter for sparkle effect
        const multiplier = params.glow ? 2.2 : 1.8;
        const textureBoost = (params.texture ?? 0) > 0.5 ? 1.2 : 1.0;
        ctx.retro.microJitterStrength = Math.min(0.25, baseStrength * multiplier * textureBoost);
      } else if(params.style === 'weapon') {
        // Weapons get moderate jitter for metal reflection
        const textureBoost = (params.texture ?? 0) > 0.4 ? 1.4 : 1.3;
        ctx.retro.microJitterStrength = Math.min(0.2, baseStrength * textureBoost);
      } else if(params.glow) {
        // Any glowing effects get enhanced jitter
        ctx.retro.microJitterStrength = Math.min(0.2, baseStrength * 1.4);
      } else if(params.complexity > 0.7) {
        // High complexity icons get slight enhancement
        const textureBoost = (params.texture ?? 0) > 0.6 ? 1.3 : 1.2;
        ctx.retro.microJitterStrength = Math.min(0.18, baseStrength * textureBoost);
      } else if((params.texture ?? 0) > 0.7) {
        // High texture levels enhance micro-jitter
        ctx.retro.microJitterStrength = Math.min(0.2, baseStrength * 1.3);
      }
    }
    
    // Performance monitoring for complex icons
    if(ctx.timeBudgetMs < 4) {
      console.debug('Icon generation approaching time budget, consider reducing animation/texture complexity');
    }
  }
}
