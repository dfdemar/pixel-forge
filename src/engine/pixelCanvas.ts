import type { PixelCanvas } from './types'

export function createPixelCanvas(w: number, h: number): PixelCanvas {
  const buf = new Uint32Array(w*h);
  return {
    w, h, data: buf,
    clear(argb){ buf.fill(argb>>>0) },
    set(x,y,c){ if(x>=0&&y>=0&&x<w&&y<h) buf[y*w + x] = c>>>0 },
    get(x,y){ if(x>=0&&y>=0&&x<w&&y<h) return buf[y*w + x]>>>0; return 0 },
    blit(src,dx,dy){
      for(let y=0;y<src.h;y++) for(let x=0;x<src.w;x++){
        const c = src.data[y*src.w+x]>>>0;
        const a = (c>>>24)&0xff; if(a===0) continue;
        const tx=dx+x, ty=dy+y; if(tx<0||ty<0||tx>=w||ty>=h) continue;
        buf[ty*w+tx] = c;
      }
    },
    toImageData(){
      const id = new ImageData(w,h);
      const u8 = new Uint8ClampedArray(id.data.buffer);
      for(let i=0;i<buf.length;i++){
        const c = buf[i]>>>0;
        u8[i*4+0]=(c>>>16)&255; u8[i*4+1]=(c>>>8)&255; u8[i*4+2]=c&255; u8[i*4+3]=(c>>>24)&255;
      }
      return id;
    }
  };
}
export function argb(a:number,r:number,g:number,b:number){ return ((a&255)<<24)|((r&255)<<16)|((g&255)<<8)|(b&255) }
