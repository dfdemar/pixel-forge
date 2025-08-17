function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), 1 | x);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    nextFloat: () => next(),
    nextInt: (n: number) => Math.floor(next() * n),
    split: (label?: string) => mulberry32(((t ^ 0x9e3779b9) + (label ? hashStr(label) : 0)) >>> 0)
  };
}

export type RNG = ReturnType<typeof mulberry32>;
