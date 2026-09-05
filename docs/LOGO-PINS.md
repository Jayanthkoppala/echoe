# Company logo pins on the Bengaluru map

Scope: 40 to 300 company logo pins (bangalorestartupmap.com style) plus a
verified badge on a player's Echoe marker, on top of `BengaluruMap.tsx`'s
MapLibre GL JS 6.7 setup (OpenFreeMap dark style, agents source updated up
to 30 times a second, pitch 55, city zoom 12.5).

All APIs below verified via Context7 against `/maplibre/maplibre-gl-js`.

## Decision table

| Concern | Choice | Why | Source |
|---|---|---|---|
| Render 300 logo pins | Symbol layer, one `addImage` per company logo, `icon-image` driven from a feature property | HTML `Marker`s are DOM nodes MapLibre repositions with a style transform on every map render; 300 at pitch 55, competing with the 30Hz agent `setData` loop for main-thread time, is the janky path. A symbol layer draws in the same WebGL pass as everything else, near-zero added CPU once sprites exist. | large-data guide: clustering exists specifically because point-count-in-the-hundreds is where CPU-side handling (what a Marker is) stops scaling |
| Load 300 remote logos without blocking first paint | Concurrency-capped `Promise` pool calling `map.loadImage` + `map.addImage`; on failure draw an initials chip to canvas and `addImage` that instead | Unbounded parallel fetches saturate the connection pool and delay first paint; a cap bounds it, and the fallback means a 404 never means a missing pin | `add-a-generated-icon-to-the-map.html`, `draw-geojson-points.html` |
| Circular logo with a white ring | Offscreen `<canvas>`: clip a circular path, `drawImage` the logo, stroke a white ring, `addImage` the pixel data | The style spec has no icon-mask/icon-radius property; shaping happens in pixels before `addImage`, which accepts raw `ImageData`/`{width,height,data}` | `Map.addImage` JSDoc example (`image.data` from `loadImage`, or raw `{width,height,data}`) |
| Clustering | GeoJSON source with `cluster: true`, `clusterRadius`, `clusterMaxZoom`; circle layer filtered `has point_count` for bubble + count label; unclustered symbol layer filtered `!has point_count` | Built-in supercluster-backed grouping, no extra library | large-data guide "Cluster", `create-and-style-clusters.html` |
| Cluster tap | `queryRenderedFeatures` at the click point, read `cluster_id`, `source.getClusterExpansionZoom(id)`, `map.easeTo` | Exact documented pattern | `create-and-style-clusters.html` |
| Zoom-tiered pins (top 10 at city zoom, all from 13.5) | Two symbol layers on the same source: `maxzoom: 13.5` filtered to `featured == true`, `minzoom: 13.5` with no featured filter | Layer `minzoom`/`maxzoom` hides a layer outside its range at the style-layer level, cheaper than a per-feature zoom filter; `featured` is decided in the data | `create-a-heatmap-layer.html` (paired `maxzoom`/`minzoom` layers); `style_layer.ts` `isHidden` gates by zoom before filtering |
| Verified badge on an agent | Second symbol layer on the existing `agents` source, filtered `has company`, `icon-image` reused from the company logo sprite (or a generic check icon), positioned with `icon-offset` | The agents source already gets `setData` up to 30 times a second; a symbol layer re-evaluates per-feature style on each `setData`, so the badge costs nothing extra and needs no DOM node | `icon-offset` confirmed in a live MapLibre regression fixture (`mapbox-gl-js#5599`) |
| Company card on tap | `map.on('click', [layerIds], handler)`, read `e.features[0].properties` | Multi-layer overload for `map.on` is a documented signature | `map.ts` `on<T>` overloads; `display-a-popup-on-click.html` |
| Data shape | Flat `Company[]` in `companies.json`, converted to a `FeatureCollection` once at module load, not per render | Matches how `landmarks.ts` is already consumed as a static array | repo convention, `src/data/landmarks.ts` |

## 1. Loading logos: concurrency-capped, with fallback, then circular ring

```ts
async function loadCompanyImages(map: maplibregl.Map, companies: Company[]) {
  const CONCURRENCY = 8;
  let i = 0;
  async function worker() {
    while (i < companies.length) {
      const c = companies[i++];
      const id = `logo-${c.id}`;
      if (map.hasImage(id)) continue;
      const canvas = await circularLogoCanvas(c.logo).catch(() => initialsChip(c.name));
      map.addImage(id, canvas.getContext('2d')!.getImageData(0, 0, 64, 64));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function circularLogoCanvas(url: string): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 2, 2, 60, 60);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return canvas;
}
```
`initialsChip(name)` draws the same 64x64 ring with a 2-letter chip instead of `drawImage`, so pins never go missing on a logo 404.

## 2. Clustering: source, layers, cluster tap

```ts
map.addSource('companies', {
  type: 'geojson', data: COMPANIES_GEOJSON,
  cluster: true, clusterRadius: 60, clusterMaxZoom: 13,
});
map.addLayer({
  id: 'company-clusters', type: 'circle', source: 'companies',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#00e08a',
    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
    'circle-stroke-width': 2, 'circle-stroke-color': '#0b120e',
  },
});
map.addLayer({
  id: 'company-cluster-count', type: 'symbol', source: 'companies',
  filter: ['has', 'point_count'],
  layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
  paint: { 'text-color': '#0b120e' },
});
map.on('click', 'company-clusters', async (e) => {
  const [feature] = map.queryRenderedFeatures(e.point, { layers: ['company-clusters'] });
  const clusterId = feature.properties.cluster_id;
  const source = map.getSource('companies') as maplibregl.GeoJSONSource;
  const zoom = await source.getClusterExpansionZoom(clusterId);
  map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
});
```

## 3. Zoom-tiered unclustered pins

```ts
map.addLayer({
  id: 'company-pins-featured', type: 'symbol', source: 'companies', maxzoom: 13.5,
  filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'featured'], true]],
  layout: {
    'icon-image': ['get', 'logoId'],
    'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.25, 13.5, 0.4],
    'icon-allow-overlap': true,
  },
});
map.addLayer({
  id: 'company-pins-all', type: 'symbol', source: 'companies', minzoom: 13.5,
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['get', 'logoId'],
    'icon-size': ['interpolate', ['linear'], ['zoom'], 13.5, 0.4, 16, 0.6],
    'icon-allow-overlap': true,
  },
});
```
`featured` is a boolean set on exactly 10 records in `companies.json`
(sorted by priority, sliced to 10, at data-authoring time). MapLibre only
filters on it; it does not compute the top-10 set.

## 4. Verified badge on an agent, no DOM marker

Add once, alongside the existing `agents-circle`/`agents-label` layers, on
the same source that already gets `setData` up to 30 times/sec. Reuses the
same `logo-{id}` sprite entries already loaded for pins.

```ts
map.addLayer({
  id: 'agents-badge', type: 'symbol', source: AGENTS_SOURCE_ID,
  filter: ['has', 'company'],
  layout: {
    'icon-image': ['case', ['has', 'companyLogoId'], ['get', 'companyLogoId'], 'verified-check'],
    'icon-size': 0.5, 'icon-offset': [16, -16], 'icon-allow-overlap': true,
  },
});
```
In `tick()`, add `company`/`companyLogoId` to `properties` for the player's
agent when it carries a verified employer. No per-frame JS cost beyond what
already runs; the layer re-evaluates style automatically each `setData`.

## 5. Company card on tap

```ts
map.on('click', ['company-pins-featured', 'company-pins-all'], (e) => {
  const feature = e.features?.[0];
  if (!feature) return;
  openCompanyCard(feature.properties as {
    id: string; name: string; domain: string; category: string; logoId: string;
  });
});
```
The feature needs `id`, `name`, `domain`, `category`, `logoId` in its
properties; geometry gives the tap coordinate, same pattern `flyToLandmark`
already uses.

## 6. Data shape

```ts
// src/data/companies.ts
export interface Company {
  id: string; name: string; domain: string; lng: number; lat: number;
  category: string;
  logo: string;      // absolute URL or /logos/{id}.png
  featured: boolean; // true for exactly the top 10 shown at city zoom
}

export const COMPANIES: Company[] = /* 40-300 entries, from companies.json */;

// Converted once at import, not per render.
export const COMPANIES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: COMPANIES.map((c) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    properties: {
      id: c.id, name: c.name, domain: c.domain,
      category: c.category, logoId: `logo-${c.id}`, featured: c.featured,
    },
  })),
};
```

## Build estimate (24-hour budget)

| Item | Hours |
|---|---|
| Logo pin rendering: image loader, concurrency cap, canvas ring + initials fallback | 5.5 |
| Clustering: source, cluster circle + count layers, expansion-zoom click handler | 2 |
| Zoom-tiered layers (featured vs all) + `featured` flag wiring | 1.5 |
| Verified badge layer on agents source | 1 |
| Company card tap handler + glass card UI | 3 |
| Data: schema, sourcing 40-300 real logos/coordinates, GeoJSON conversion | 5 |
| **Total** | **18** |

Six hours of slack, mostly for real-logo sourcing running long: logo APIs return inconsistent sizes and some domains 404, which is what the initials-chip fallback in item 1 is for.
