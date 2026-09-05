# Bengaluru map layer

`BengaluruMap` renders a pitched MapLibre view (OpenFreeMap "liberty" style,
which already has 3D buildings above zoom 14) centred on Bengaluru, with the
10 landmarks from `src/data/landmarks.ts` as HTML markers.

Usage:

```tsx
<BengaluruMap
  agents={[
    { id: 'a1', label: 'You', colour: '#ff6b35', fromPlace: 'mg-road',
      toPlace: 'koramangala', departMs: Date.now(), arriveMs: Date.now() + 60000,
      isMine: true },
  ]}
  onPlaceTap={(id) => console.log('tapped', id)}
/>
```

Each agent moves along the real driving route between `fromPlace` and
`toPlace` (from `src/data/routes.json`, fetched once via
`scripts/fetch-routes.sh`), eased with `easeInOutQuad`, redrawn every
animation frame via `setData` on a single GeoJSON source (`agents-circle` +
`agents-label` layers). The player's own agent (`isMine: true`) gets a
bigger circle and thicker stroke.

Fallback behaviour: if a landmark pair has no entry in `routes.json` (OSRM
request failed at fetch time), `routeFor` falls back to a straight two-point
line between the two coordinates, so playback never breaks on a missing
route.

Route legs are cached per agent id for the component's lifetime; if an
agent's `fromPlace`/`toPlace` changes without a new `id`, the old leg is
reused (not a current requirement, note only).
