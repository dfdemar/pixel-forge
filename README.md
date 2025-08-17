# pixel-forge

**Version:** v0.2.2 (Micro-Jitter Complete)

A modular, procedurally-driven generator for **NES/SNES-style** 2D sprites (planets, tiles, icons, characters, etc.) with a modern, responsive UI. The engine is **extensible** via pluggable sprite modules, and enforces a retro aesthetic (limited palettes, ordered dithering, crisp 1px outlines).

---

## Table of Contents
- [High-Level Overview](#high-level-overview)
- [Art Style Spec (NES/SNES)](#art-style-spec-nessnes)
- [Features](#features)
- [UI & UX](#ui--ux)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Engine Concepts](#engine-concepts)
- [Interfaces](#interfaces)
- [Palettes, Quantization & Dithering](#palettes-quantization--dithering)
- [Module Examples](#module-examples)
- [Data Formats](#data-formats)
- [Implementation Status](#implementation-status)
- [Implementation Plan & Roadmap](#implementation-plan--roadmap)
- [Quality, Testing, and Performance](#quality-testing-and-performance)
- [Extending the Engine (For Devs & AIs)](#extending-the-engine-for-devs--ais)
- [Known Gaps & Next Steps](#known-gaps--next-steps)
- [Run Locally](#run-locally)
- [License](#license)

---

## High-Level Overview

This project generates **retro pixel-art sprites** using **procedural algorithms** packaged as **modules** (e.g., `planet`, `tile`, `icon`). The **engine** provides a stable, typed interface and a common **retro enforcement** pipeline (palette quantization, ordered dithering, and outlines). The **UI** exposes parameter controls, batch generation, and export/import of presets and sprite sheets.

**Design principles**
- **Look first**: Output must *read* like late-80s/early-90s console/arcade art.
- **Modular**: Adding new sprite types should not require changing the engine.
- **Deterministic**: Same seed + same params → same output.
- **Not samey**: Variation systems and RNG sub-streams reduce repetition.
- **Fast feedback**: Real-time preview, batch thumbnails, snappy UI.

---

## Art Style Spec (NES/SNES)

- **Low resolution** sprites (typical sizes: 16×16, 32×32, 48×48, 64×64).
- **Limited palettes**:
- **NES_13**: curated 13-color set to mimic NES constraints.
- **SNES_32**: 32-color selection (demo set; can expand to 256 at once).
- **GB_4**: 4-tone green palette.
- **Dithering**: ordered Bayer 4×4 or 8×8; optional blue-noise planned.
- **Hard pixels**: nearest-neighbor scaling; no sub-pixel drawing.
- **Outlines**: crisp 1-pixel outline (shadow-side selective outlines planned).
- **Animation** (future): limited 2–4 frame cycles; pixel-consistent motion.

---

## Features

- Live preview with pixel-grid rendering.
- Batch generation (e.g., Generate 9).
- **Export PNG** (sprite or sheet) and **Export/Import JSON presets**.
- Style controls: palette, dithering mode, outline, quantizer.
- Module controls: archetype and module-specific params.
- Deterministic seeds, with **Shuffle** for exploration.
- Transparency-aware pipeline (no more full-canvas checkerboards).

---

## UI & UX

**Layout:**
- **Top bar:** Generate 1 / Generate 9 / Export PNG / Export JSON / Import JSON.
- **Left panel:** Sprite Type, core params (size, seed), style controls (palette, dither, quantizer, outline).
- **Main stage:** Pixel-perfect **Preview** and **Sprite Sheet** grid of generated canvases.
- **Right panel (Inspector):** Quick facts and tips.

**Interaction highlights:**
- *Shuffle* randomizes the seed, then regenerates deterministically thereafter.
- Batch generation populates a sheet; Export PNG packs displayed canvases into a single sheet.
- Import/Export settings restore the exact engine state and parameters.

---

## Architecture

### Tech Stack
- **Runtime/UI:** React 18 + TypeScript + Vite
- **State:** Zustand (minimal, serializable)
- **Rendering:** Canvas 2D via a custom **PixelCanvas** buffer (ARGB) for pixel-level control
- **Build:** Vite with an alias for `@engine/*` → `src/engine/*`
- **Determinism:** Mulberry32 PRNG with `.split(label)` for sub-streams

> Note: The MVP renders directly to an ARGB buffer; a future iteration can introduce a higher-level op graph and off-thread generation (Web Workers + OffscreenCanvas) for heavy modules.

### Engine Concepts

- **Sprite Module**: Encapsulates generation logic for a sprite family (planet, tile, etc.).
- **Engine Context**: The engine “gives” modules a canvas, palette, RNG, and retro policies.
- **Retro Enforcement**: After a module draws, the engine quantizes to the palette, dithers ordered, then applies outlines.
- **Palettes & Quantization**: Curated palettes; nearest-color quantization (Wu/median-cut planned).
- **Dithering**: Bayer 4×4 / 8×8 with **subtle strength**; transparency-aware.

### Interfaces

> These are the **current MVP interfaces** (kept small but intentionally future-proof).

```ts
// src/engine/types.ts
export type RNG = {
 nextFloat(): number;
 nextInt(n: number): number;
 split(label?: string): RNG;
};

export type Palette = {
 name: string;
 colors: Uint32Array; // ARGB
 maxColors: number;
};

export type DitherMode = 'none' | 'bayer4' | 'bayer8';
export type Quantizer = 'none' | 'nearest';

export type RetroPolicy = {
 outlineWidth: 0 | 1 | 2;
};

export type PixelCanvas = {
 w: number; h: number;
 data: Uint32Array; // ARGB
 clear(argb: number): void;
 set(x:number,y:number,argb:number): void;
 get(x:number,y:number): number;
 blit(src: PixelCanvas, dx:number, dy:number): void;
 toImageData(): ImageData;
};

export type EngineContext = {
 canvas: PixelCanvas;
 rng: RNG;
 palette: Palette;
 dither: DitherMode;
 quantizer: Quantizer;
 retro: RetroPolicy;
 timeBudgetMs: number;
};

export type ModuleParam = {
 key: string;
 type: 'range'|'enum'|'int'|'bool'|'seed';
 label: string;
 min?: number; max?: number; step?: number;
 options?: string[];
 default: any;
};

export type SpriteModule = {
 id: string;
 version: string;
 archetypes(): { id: string; label: string; params: Partial<Record<string, any>> }[];
 schema(): ModuleParam[];
 capabilities(): {
 minSize: [number, number];
 maxSize: [number, number];
 supportsAnimation: boolean;
 tileable: boolean;
 preferredPalettes?: string[];
 };
 generate(ctx: EngineContext, params: Record<string,any>): void; // draw directly (MVP)
 finalize?(ctx: EngineContext, params: Record<string,any>): void;
};
```

### Palettes, Quantization & Dithering

**Palettes** (MVP):
- `NES_13` (13 colors), `SNES_32` (32 colors), `GB_4` (4 tones).

**Quantization**: Nearest palette color, **preserving alpha**: transparent pixels are kept transparent (avoids background pollution).

**Dithering**: Ordered Bayer 4×4 or 8×8
- Each pixel’s RGB is nudged by a small normalized threshold, then mapped back to nearest palette color.
- **Strength:** ~±28 (subtle), configurable later.
- **Transparency-aware:** Transparent pixels are skipped.

**Outline**: Simple 1px “outer” outline around alpha edges. Future: selective, inner outlines per layer.

### Module Examples

#### Planet
- **Archetypes:** `lush`, `arid`, `ice`, `gas`
- **Params:** size, featureDensity, clouds, bands (gas), ringChance
- **Algorithm:**
- Draw a disc with limb darkening.
- If gas: horizontal bands with FBM perturbation.
- Else: continents via warped FBM; hard thresholds create pixel-read edges.
- Clouds: pseudo-Worley (hard-edged blobby masks), not fog.
- Occasional rings with tilt.
- Engine then quantizes, dithers, outlines.

#### Terrain Tile
- **Archetypes:** `grass`, `rock`, `metal`
- **Params:** size, roughness, detail
- **Algorithm:** periodic FBM (cosine-warped coords) for seamlessness, plus small speckle accents.

#### Icon
- **Archetypes:** `shield`, `skull`, `spark`
- **Params:** size, mirror
- **Algorithm:** draw minimal geometric motifs and mirror for symmetry. Great for 16×16 HUD elements.

---

## Data Formats

**Preset JSON** (export/import):
```jsonc
{
 "engineVersion": "0.2.0",
 "spriteType": "planet",
 "archetype": "lush",
 "seed": 150979693,
 "size": 64,
 "palette": "SNES_32",
 "dither": "bayer4",
 "quantizer": "nearest",
 "outline": 1,
 "params": {
 "featureDensity": 0.6,
 "clouds": true,
 "bands": false,
 "ringChance": 0.15
 }
}
```
- **Forward-compatibility:** future migrations can bump `engineVersion` and adapt old presets.

**PNG Sheet Export**:
- Grid of N sprites (square-ish layout) composed into one canvas → PNG.
- (Planned) Embed preset JSON in a PNG text chunk for provenance.

---

## Implementation Status

**Implemented** (v0.2.3):
- ✅ React + TS + Vite app with alias `@engine/*`
- ✅ Zustand store for UI state
- ✅ Three modules: **planet**, **tile**, **icon**
- ✅ Deterministic PRNG with `.split(label)`
- ✅ Palettes: **NES_13**, **SNES_32**, **GB_4**
- ✅ Ordered dithering (Bayer 4×4 / 8×8) with *transparency-aware* quantize/dither
- ✅ 1px outline
- ✅ Live preview & batch sheet, **Export PNG**, **Export/Import JSON**
- ✅ **Similarity guard**: Edge histogram + palette usage analysis to reduce repetitive results in batch generation
- ✅ **Palette micro-jitter**: Pre-quantization color variation for more natural gradients

**In progress / next**:
- **Palette micro-jitter** (pre-quantization) for subtle variety while staying on-palette
- **Palette editor**: user-defined palettes with max colors cap
- Modular op-graph executor (`RenderPlan`) in addition to direct draw mode

**Planned** (roadmap below):
- Character module with socketed equipment
- Space station / greeble grammar
- WFC tile motifs & connectivity constraints
- Animation frame support & onion skin preview
- Web Worker off-thread generation
- Blue-noise dithering, Wu/median-cut quantization
- Plugin registry & module marketplace

---

## Implementation Plan & Roadmap

### Milestone 1 — MVP polish (done / immediate)
- ✅ Transparency-safe quantize/dither & outline
- ✅ Vite alias and seed controls
- ✅ Checkerboard preview background toggle
- ✅ Explicit “Generate N” count field (9/36/81 presets)

### Milestone 2 — Variation & Quality (in progress)
- ✅ **Similarity guard**: collect edge histograms & palette signatures; auto-nudge params when too similar to recent outputs.
- ✅ **Palette micro-jitter** (pre-quantization) for subtle variety while staying on-palette.
- **Palette editor**: user-defined palettes with max colors cap.

### Milestone 3 — Engine Op Graph
- Introduce a `RenderPlan` with **ops** (fill, poly, circle, stamp, noiseFill, outline, dither) executed by the engine.
- Keep “direct draw” for rapid modules; recommend `RenderPlan` for complex sprites.
- Enable **layering**, **blend modes**, and module-scoped post-passes.

### Milestone 4 — Content Expansion
- **HumanoidCharacter**: proportion grammar; parts library; 2–4 frame idle.
- **SpaceStation**: core→spokes→rings grammar; greeble scatter with Poisson sampling.
- **TerrainWFC**: micro-motifs + adjacency rules for seamless edge matching.

### Milestone 5 — Performance & Tooling
- **Web Workers + OffscreenCanvas** for background generation.
- **Golden image tests** & param fuzzing.
- **Module Preview Harness**: grid exploration, auto-screenshots, metrics dump.

---

## Quality, Testing, and Performance

- **Determinism:** seeds & sub-streams guarantee reproducible sprites.
- **Fuzz testing:** bounds & invariants (no invisible sprites, no palette overflow).
- **Golden images:** per-module snapshots to catch regressions.
- **Performance notes:**
- Pixel operations in a pre-allocated ARGB buffer.
- Dithering is linear-time, cache-friendly.
- Future: time-sliced generation and off-thread workers.

---

## Extending the Engine (For Devs & AIs)

**Adding a module**
1. Create `src/engine/modules/myModule.ts` exporting a `SpriteModule`:
- Implement `archetypes()`, `schema()`, `capabilities()`, and `generate()`.
- Use `ctx.rng.split('feature')` to create stable sub-streams.
2. Register it in `src/engine/registry.ts`.
3. UI: add controls only if you need custom widgets; otherwise the standard panel suffices.

**Design tips (retro look)**
- Work at **canonical sizes** (16, 32, 48, 64).
- Prefer **hard edges** and **flat fills**; use dithering sparingly.
- Quantize-aware shading: design ramps that collapse nicely to NES_13 and GB_4.
- For animation: move features by whole pixels; avoid sub-pixel motion.

**AI hand-off cues**
- Keep `generate()` pure w.r.t. the provided `ctx` (no global state).
- Use `params.archetype` to branch behaviors; store param presets in `archetypes()`.
- For “not samey”: vary silhouettes first, then features, then palette micro-jitter.
- When in doubt, put post-treatment in the engine (quantize/dither/outline), not modules.

---

## Known Gaps & Next Steps

- Dithering strength is fixed; expose per-module overrides.
- Quantizer is **nearest** only (add Wu/median-cut/k-means).
- No **tile connectivity** controls yet (N/E/S/W edges for WFC tiles).
- No **animation** frames or export pipeline.
- No **embedded preset JSON** in PNG metadata.

---

## Run Locally

```bash
npm install
npm run dev
# open http://localhost:5173
```

Vite alias for `@engine/*` is configured in `vite.config.ts` and `tsconfig.json`.

---

## License

MIT © 2025 – This project contains curated palettes approximating retro console look & feel for demonstration purposes.

---

### Appendix A — Files of Interest

- `src/engine/index.ts` – orchestrates a run (creates context, enforces retro policy).
- `src/engine/palette.ts` – palettes, nearest quantizer, transparency-aware Bayer dithering.
- `src/engine/retro.ts` – quantize → dither → outline.
- `src/engine/modules/*` – example modules (planet, tile, icon).
- `src/App.tsx` – application UI and export/import logic.