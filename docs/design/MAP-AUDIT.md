# Map audit: black canvas, no tiles, 1 fps

Read-only audit. No source file was changed. MapLibre claims are checked against
`/maplibre/maplibre-gl-js` via Context7 (`src/ui/map.ts`, `src/source/geojson_source.ts`,
`developer-guides/life-of-a-tile.md`). Upstream was checked live: the dark style returns 200
with 47 layers, a `building` source-layer and `Noto Sans Regular` glyphs, and its planet
TileJSON tiles (`.../{z}/{x}/{y}.pbf`) return 200. Nothing is wrong on the server.

Key fact behind everything below: tile requests are only issued from `Map._render()` when
`_sourcesDirty` is set, which calls `TileManager#update(transform)` (life-of-a-tile.md), and
`_render` is driven by `requestAnimationFrame`. **A main thread that cannot deliver frames
does not request tiles**, and no tiles means a black canvas. The 1 fps and the zero `.pbf`
are one symptom, not two.

## 1. The compositing stack over the canvas is what costs the frames  _(confidence: high)_

- `src/styles.css:84-100` `.aurora` paints three 62vmin circles with `filter: blur(70px)`,
  `will-change: transform`, and three infinite `alternate` keyframe animations. They never
  stop, on every screen, including both map screens.
- `src/styles.css:102-106` `.phone::after` lays a full viewport SVG `feTurbulence` bitmap over
  everything with `mix-blend-mode: overlay`, forcing the whole `.phone` stacking context
  (`isolation: isolate`, line 70) to flatten as one group each frame, which pulls the WebGL
  canvas off the compositor fast path.
- `src/styles.css:124-125`, plus `157`, `248`, `288`, `600`, `780`: every `.glass` panel over
  the map runs `backdrop-filter: blur(22px) saturate(150%)`. On the map screens that is the
  topbar, the share card or walk strip, the toast and the bottom sheet, each making the
  compositor snapshot and blur a live canvas every frame.

Three blurred layers animating forever, a blend-mode group, and four backdrop filters over a
live canvas is enough to take a 25 fps tab to 1 fps on its own. Confirm it first, cheaply:

```css
/* Cheap test: kill the expensive layers only where the map lives. */
.aurora { display: none; }
.screen--map .glass { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(20,26,22,.82); }
```

Diagnostic: the glyph endpoint is also `.pbf`. If the `agents-label` symbol layer never
fetched a glyph range either, the render loop is starved rather than the source being broken.

## 2. `pointAtFraction` rebuilds the whole distance table every frame

**Confidence: high** that it is real waste, **medium** that it alone reaches 1 fps.

`src/map/interpolate.ts:35` calls `cumulativeDistances(polyline)` on every call, and
`cumulativeDistances` (`interpolate.ts:22-28`) allocates a new array and runs a haversine per
vertex over the whole polyline. Routes average 209 points and reach 440 (45 routes, 9,421
points). Per agent, per frame, for data that is constant for the life of a leg. Cache it.

```ts
export interface Leg { polyline: LngLat[]; cum: number[]; departMs: number; arriveMs: number; }
// once, where the leg is built (BengaluruMap.tsx:185); pointAtFraction then takes cum.
const polyline = routeFor(agent.fromPlace, agent.toPlace, fromCoord, toCoord);
leg = { polyline, cum: cumulativeDistances(polyline), departMs: agent.departMs, arriveMs: agent.arriveMs };
```

`routeFor` itself is **not** a suspect. `routes.json` (433 KB) is a static ESM import parsed
once at module load, and `routeFor` (`interpolate.ts:89-93`) returns the shared array by
reference. Its one copy is the reversed branch (line 92), once per leg, because `legsRef`
caches the result (`BengaluruMap.tsx:190`).

## 3. The tick loop calls `setData` 60 times a second even with zero agents  _(confidence: high)_

`src/map/BengaluruMap.tsx:174-211`. The loop is unconditional: it calls `source.setData(...)`
every frame regardless of whether there are agents or whether anything moved. With an empty
world it still posts `{type:'FeatureCollection', features: []}` 60 times a second. In
MapLibre v6 `setData` always sends the data to the worker and returns a `Promise<void>`
(`geojson_source.ts`, via Context7), so that is 60 worker round trips a second on the same
worker pool that parses vector tiles.

```ts
const tick = () => {
  rafRef.current = requestAnimationFrame(tick);
  const now = Date.now();
  if (agentsRef.current.length === 0 || now - lastSetData < 33) return; // 30 Hz is plenty
  lastSetData = now;
  /* ...existing feature build + setData... */
};
```

MapLibre's own `animate-a-point` example does drive `setData` from rAF, so the pattern is
sanctioned; the bug is doing it with nothing to draw.

## 4. The tick loop can outlive its map, and StrictMode makes that likely  _(confidence: medium-high)_

`src/main.tsx:37` wraps the app in `<StrictMode>`, so in dev the effect at
`BengaluruMap.tsx:76` runs, cleans up, and runs again, while `rafRef` and `legsRef` are shared
across both passes. Cleanup (`BengaluruMap.tsx:216-221`) cancels whatever id is in
`rafRef.current` at that moment. If the first map's `load` fires after the second map is
constructed, both loops write that ref and only one is ever cancelled. The orphan calls
`map.getSource` on a removed map forever. Use a per effect flag, not the shared ref.

```ts
let cancelled = false;
const tick = () => { if (cancelled) return; /* ... */ rafRef.current = requestAnimationFrame(tick); };
return () => { cancelled = true; cancelAnimationFrame(rafRef.current); map.remove(); mapRef.current = null; };
```

## 5. Every screen change destroys and rebuilds the map  _(confidence: medium)_

`src/App.tsx:240` and `src/App.tsx:259` render two independent `MapSlot` trees behind
`screen === 'world'` and `screen === 'roaming'`. Moving between them means a full
`map.remove()` with an explicit `WEBGL_lose_context`, then a fresh style, TileJSON, sprite,
glyph and tile fetch plus 10 new `Marker` instances (`BengaluruMap.tsx:90-104`).

It also lands inside the entrance animation: `src/styles.css:110-113` applies `screen-in` to
every direct child of `.phone`, whose `from` frame is `transform: translateY(12px) scale(.98)`,
so the map is constructed while an ancestor is mid transform. Per Context7 (`map.ts`),
MapLibre **mutes the first ResizeObserver event** and falls back to 400x300 when the container
measures zero, so a container that settles after construction can keep a stale size until a
later observer entry arrives. Cheap insurance:

```ts
map.on('load', () => { map.resize(); /* ...existing layer setup... */ });
```

The durable fix is to hoist `MapSlot` above the screen switch so one map instance survives.

## 6. The `building-3d` paint expression reads a property that does not exist  _(confidence: medium)_

`src/map/BengaluruMap.tsx:125` uses `['>=', ['get', 'zoom'], 16]`. `zoom` is not a feature
property on OpenMapTiles buildings, so this evaluates `null >= 16`; line 124 feeds
`['get','render_height']` into an `interpolate` output with the same exposure. The dark style
ships zero fill-extrusion layers, so `hasExtrusion` is always false and this layer is always
added. Use the zoom expression, not a property:

```ts
'fill-extrusion-base': ['case', ['>=', ['zoom'], 16], ['coalesce', ['get', 'render_min_height'], 0], 0],
'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 0]],
```

## Ruled out

- **Layer added before the style loads.** `addLayer` is inside `map.on('load')`
  (`BengaluruMap.tsx:106`), which is correct. Marker count is 10, also not a load.
- **Canvas covered by an opaque element.** `.map-scrim` (`styles.css:391-398`) is z-index 2
  but fully transparent between 30% and 60%. `.map-sheet` is z-index 18 over the bottom strip
  only. Nothing opaque sits over the middle of the map.
- **Container with zero height or `display:none`.** `.world-wrap` is `height:100%` in a
  `minmax(0,1fr)` row under a definite `100dvh` ancestor, `#map-slot` is `absolute; inset:0`
  (`styles.css:388-389`). The chain resolves.
- **A second rAF loop.** `requestAnimationFrame` appears once in `src/`, at `BengaluruMap.tsx:209`.
- **`agentsFrom` churn.** `src/state/select.ts:98-123` is memoised at `App.tsx:183-186` and
  rebuilds only when a table changes, not per frame.
