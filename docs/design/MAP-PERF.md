# Map performance bisect

## Bisect table

| Step | fps (rAF/sec) | .pbf requests | Map drew tiles |
|---|---|---|---|
| Baseline, tab genuinely visible, all CSS active | 120 | 0 | No |
| Baseline, tab occluded (background/not-frontmost) | 1.25 | 0 | No |
| `.aurora{display:none}` | 1.25 (tab occluded at the time) | 0 | No |
| `*{backdrop-filter:none!important}` (all glass panels) | 1.25 (tab occluded at the time) | 0 | No |
| All of the above + `.map-scrim{display:none}` | 121.25 (tab regained visibility) | 0 | No |
| Bare MapLibre page, no app CSS at all (`public/map-test.html`) | 1 (tab occluded at the time) | **1** | Yes, once visible |

The fps column moves only with tab visibility (`document.hidden` / occlusion), never with a CSS toggle. Disabling `.aurora`, `backdrop-filter`, and `.map-scrim` together, alone, or in combination left fps unchanged versus baseline at matching visibility. That rules out the CSS suspects as the cause of the reported ~1 fps.

## Root cause

`node_modules/.vite/deps/maplibre-gl-worker.mjs` returns **404** in the browser's network log. maplibre-gl v6 spawns its tile-decode worker with `new Worker(new URL('maplibre-gl-worker.mjs', import.meta.url))`, resolved relative to wherever `maplibre-gl.js` was loaded from. Vite's dependency pre-bundler (esbuild) flattens `maplibre-gl` into a single `.vite/deps/maplibre-gl.js` chunk but never copies the separate worker file next to it, so that relative URL 404s in dev. Without the worker alive, MapLibre never dispatches its tile pipeline, so `BengaluruMap.tsx` never sees a `.pbf` fetch and the canvas never paints — independent of frame rate.

Control that proves it: `public/map-test.html` imports maplibre-gl straight from `/node_modules/maplibre-gl/dist/maplibre-gl.mjs`, bypassing Vite's rewrite. On that page the worker resolves correctly and a `.pbf` request fires. The app's own import goes through the bundled `.vite/deps/maplibre-gl.js` path and never gets a tile.

The ~1 fps reading in the original report is a separate, unrelated artifact: it reproduces on both the app and the CSS-free `map-test.html` whenever the Chrome tab is occluded or not the frontmost window (`document.hidden` true), and disappears (120 fps) the instant the tab is genuinely visible, with every suspect CSS rule still active. So the low fps was tab-visibility throttling in the measurement session, not a rendering cost problem in `.aurora`, `.phone::after`, the `backdrop-filter` glass panels, or `.map-scrim`.

## Fix

In `/Users/jay/Documents/echo/vite.config.ts`, exclude maplibre-gl from dependency pre-bundling so it's served unbundled from `node_modules`, where its relative worker URL resolves:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
```

Restart the dev server after this change (optimizeDeps changes don't hot-reload) and confirm `maplibre-gl-worker.mjs` now resolves to `/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` with a 200, and that `.pbf` requests appear on the World screen.

No CSS change is needed. The `.aurora` blur, `.phone::after` noise, and the stacked `backdrop-filter` glass panels can stay as designed — they were not shown to cost any measurable frame budget in this bisect.
