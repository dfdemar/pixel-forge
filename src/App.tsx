import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useUI } from './store'
import { getModules, getModuleById } from '@engine/registry'
import { runModule } from '@engine/index'

function downloadBlob(name: string, blob: Blob){
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise(res=>canvas.toBlob(b=>res(b!), 'image/png'))
}

export default function App(){
  const ui = useUI()
  const [modules] = useState(()=>getModules())
  const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement|null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const mod = useMemo(()=>getModuleById(ui.spriteType)!, [ui.spriteType])

  useEffect(()=>{ generateOne() }, [])

  async function generateOne(){
    const canvas = document.createElement('canvas')
    canvas.width = ui.size; canvas.height = ui.size
    const res = runModule(mod, {
      spriteType: ui.spriteType,
      archetype: ui.archetype,
      seed: ui.seed|0,
      size: ui.size|0,
      paletteName: ui.palette,
      dither: ui.dither,
      quantizer: ui.quantizer,
      outline: ui.outline,
      params: ui.params,
    })
    const ctx2d = canvas.getContext('2d')!
    ctx2d.imageSmoothingEnabled = false
    ctx2d.putImageData(res.toImageData(), 0, 0)
    setCurrentCanvas(canvas)
    const pv = previewRef.current!
    const scale = Math.max(1, Math.floor(240/ui.size))
    pv.width = ui.size*scale; pv.height = ui.size*scale
    const pctx = pv.getContext('2d')!
    pctx.imageSmoothingEnabled = false
    pctx.clearRect(0,0,pv.width,pv.height)
    pctx.drawImage(canvas, 0,0, pv.width, pv.height)
  }

  async function generateGrid(count:number){
    const out: HTMLCanvasElement[] = []
    const startSeed = ui.seed|0
    for(let i=0;i<count;i++){
      const canvas = document.createElement('canvas')
      canvas.width = ui.size; canvas.height = ui.size
      const res = runModule(mod, {
        spriteType: ui.spriteType,
        archetype: ui.archetype,
        seed: (startSeed+i)|0,
        size: ui.size|0,
        paletteName: ui.palette,
        dither: ui.dither,
        quantizer: ui.quantizer,
        outline: ui.outline,
        params: ui.params,
        useSimilarityGuard: true, // Enable similarity guard for batch generation
      })
      const ctx2d = canvas.getContext('2d')!
      ctx2d.imageSmoothingEnabled = false
      ctx2d.putImageData(res.toImageData(), 0, 0)
      out.push(canvas)
    }
    useUI.setState({ sheet: out })
  }

  async function exportSheet(){
    const sheet = ui.sheet.length ? ui.sheet : (currentCanvas?[currentCanvas]:[])
    if(!sheet.length) return
    const cols = Math.ceil(Math.sqrt(sheet.length))
    const rows = Math.ceil(sheet.length/cols)
    const size = sheet[0].width
    const board = document.createElement('canvas')
    board.width = cols*size; board.height = rows*size
    const bctx = board.getContext('2d')!
    bctx.imageSmoothingEnabled = false
    sheet.forEach((c, i)=>{
      const x = (i%cols)*size; const y = Math.floor(i/cols)*size
      bctx.drawImage(c, x, y)
    })
    const blob = await canvasToBlob(board)
    downloadBlob('sprite-sheet.png', blob)
  }

  function exportSettings(){
    const json = JSON.stringify({
      engineVersion: '0.2.0',
      spriteType: ui.spriteType,
      archetype: ui.archetype,
      seed: ui.seed,
      size: ui.size,
      palette: ui.palette,
      dither: ui.dither,
      quantizer: ui.quantizer,
      outline: ui.outline,
      params: ui.params,
    }, null, 2)
    downloadBlob('settings.json', new Blob([json], { type:'application/json' }))
  }

  function importSettings(ev: React.ChangeEvent<HTMLInputElement>){
    const f = ev.target.files?.[0]
    if(!f) return
    const reader = new FileReader()
    reader.onload = ()=>{
      try {
        const cfg = JSON.parse(String(reader.result))
        useUI.setState({
          spriteType: cfg.spriteType,
          archetype: cfg.archetype,
          seed: cfg.seed,
          size: cfg.size,
          palette: cfg.palette,
          dither: cfg.dither,
          quantizer: cfg.quantizer,
          outline: cfg.outline,
          params: cfg.params||{},
        })
        setTimeout(generateOne, 0)
      } catch{ alert('Invalid settings JSON') }
    }
    reader.readAsText(f)
  }

  return (
    <div className="app">
      <div className="top">
        <div className="badge">Retro Sprite Generator</div>
        <button className="button small" onClick={()=>generateOne()}>Generate 1</button>
        <button className="button small" onClick={()=>generateGrid(9)}>Generate 9</button>
        <button className="button small" onClick={exportSheet}>Export PNG</button>
        <button className="button small" onClick={exportSettings}>Export JSON</button>
        <label className="button small">
          Import JSON
          <input type="file" accept="application/json" style={{ display:'none' }} onChange={importSettings}/>
        </label>
      </div>

      <div className="left">
        <div className="h1">Sprite</div>
        <label className="label">Type</label>
        <select value={ui.spriteType} onChange={e=>useUI.setState({ spriteType: e.target.value as any })}>
          <option value="planet">Planet</option>
          <option value="tile">Terrain Tile</option>
          <option value="icon">Icon</option>
        </select>

        <div className="h1" style={{marginTop:12}}>Params</div>
        <label className="label">Size</label>
        <input className="input" type="number" value={ui.size} min={16} max={96} onChange={e=>useUI.setState({ size: parseInt(e.target.value||'64',10) })} />
        <label className="label">Seed</label>
        <input className="input" type="number" value={ui.seed} onChange={e=>useUI.setState({ seed: parseInt(e.target.value||'0',10) })} />
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="button small" onClick={()=>{ useUI.setState({ seed: (Math.random()*1e9)|0 }); setTimeout(generateOne,0) }}>Shuffle</button>
          <button className="button small" onClick={generateOne}>Apply</button>
        </div>

        <div className="h1" style={{marginTop:12}}>Style</div>
        <label className="label">Palette</label>
        <select value={ui.palette} onChange={e=>useUI.setState({ palette: e.target.value as any })}>
          <option value="NES_13">NES (13)</option>
          <option value="SNES_32">SNES (32)</option>
          <option value="GB_4">GB (4)</option>
        </select>
        <label className="label">Dither</label>
        <select value={ui.dither} onChange={e=>useUI.setState({ dither: e.target.value as any })}>
          <option value="none">None</option>
          <option value="bayer4">Bayer 4×4</option>
          <option value="bayer8">Bayer 8×8</option>
        </select>
        <label className="label">Quantizer</label>
        <select value={ui.quantizer} onChange={e=>useUI.setState({ quantizer: e.target.value as any })}>
          <option value="nearest">Nearest</option>
          <option value="none">None</option>
        </select>
        <label className="label">Outline</label>
        <select value={ui.outline} onChange={e=>useUI.setState({ outline: parseInt(e.target.value,10) as any })}>
          <option value={0}>None</option>
          <option value={1}>Thin (1px)</option>
          <option value={2} disabled>Thick (2px)</option>
        </select>
      </div>

      <div className="main">
        <div className="h1">Preview</div>
        <canvas ref={previewRef} width={256} height={256} style={{ border:'1px solid var(--border)', background:'#0a0c11' }} />
        <div className="h1" style={{marginTop:16}}>Sprite Sheet</div>
        <div className="grid">
          { (ui.sheet.length ? ui.sheet : (currentCanvas?[currentCanvas]:[])).map((c,i)=>{
            const scale = Math.max(1, Math.floor(80/c.width)); const w=c.width*scale, h=c.height*scale;
            const ref = (el: HTMLCanvasElement|null)=>{ if(!el) return; const g=el.getContext('2d')!; g.imageSmoothingEnabled=false; g.clearRect(0,0,w,h); g.drawImage(c,0,0,w,h) }
            return <canvas key={i} width={w} height={h} ref={ref}></canvas>
          })}
        </div>
      </div>

      <div className="right">
        <div className="h1">Inspector</div>
        <div className="label">Sprite Type</div>
        <div className="badge">{ui.spriteType}</div>
        <div className="label" style={{marginTop:8}}>Palette</div>
        <div className="badge">{ui.palette}</div>
        <div className="label" style={{marginTop:8}}>Tip</div>
        <div style={{fontSize:12, color:'var(--subtext)'}}>If you saw a full-canvas checkerboard before, this build fixes transparency-aware dithering and outline.</div>
      </div>
    </div>
  )
}
