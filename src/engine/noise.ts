import type { RNG } from './rng'

export function makeValueNoise(seedRng: RNG) {
  const perm = new Uint8Array(512);
  for (let i=0;i<256;i++) perm[i]=i;
  for (let i=255;i>0;i--) { const j = seedRng.nextInt(i+1); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
  for(let i=0;i<256;i++) perm[256+i]=perm[i];

  function fade(t:number){ return t*t*(3-2*t); }
  function lerp(a:number,b:number,t:number){ return a + (b-a)*t; }

  function grad(hash:number, x:number, y:number){
    switch(hash&3){ case 0: return  x + y; case 1: return  x - y; case 2: return -x + y; default:return -x - y; }
  }

  function noise2D(x:number,y:number){
    const X = Math.floor(x)&255, Y = Math.floor(y)&255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X]+Y], ab = perm[perm[X]+Y+1];
    const ba = perm[perm[X+1]+Y], bb = perm[perm[X+1]+Y+1];
    const n0 = grad(aa, x, y), n1 = grad(ba, x-1, y);
    const n2 = grad(ab, x, y-1), n3 = grad(bb, x-1, y-1);
    const nx0 = lerp(n0, n1, u), nx1 = lerp(n2, n3, u);
    return lerp(nx0, nx1, v) * 0.7071;
  }

  function fbm(x:number,y:number, octaves=4, lac=2.0, gain=0.5){
    let amp=1, freq=1, sum=0, norm=0;
    for(let i=0;i<octaves;i++){ sum += amp * noise2D(x*freq, y*freq); norm += amp; amp*=gain; freq*=lac; }
    return sum / norm;
  }

  return { noise2D, fbm }
}

export function worley2D(x:number, y:number, points:[number,number][]) {
  let d1=1e9;
  for(const [px,py] of points){ const dx=x-px, dy=y-py; const d = dx*dx+dy*dy; if(d<d1) d1=d; }
  return Math.sqrt(d1);
}
