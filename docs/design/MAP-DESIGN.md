# Echoe map design

Base is the OpenFreeMap `dark` style. Everything here is a `setPaintProperty` /
`setLayoutProperty` / `setLayerZoomRange` override on that style's own layers,
plus four layers of our own, all in `src/map/BengaluruMap.tsx`. Marker CSS lives
in `src/styles.css` under `.map-pin*`. Layer ids come from fetching the style
JSON; property names were checked against the installed style spec.

## Palette

| Element | Colour | Note |
|---|---|---|
| Ground | `#070c09` | deep green-black, not flat black |
| Water | `#0b2b39` | deep teal-blue |
| Shoreline | `#2e7189` @ .7 | added `echoe-water-edge` line layer |
| Waterway | `#1a4d61` | rivers, streams |
| Park | `#1c4a2c` @ .85 | `landuse_park` + added `echoe-park` |
| Park rim | `#3a8a51` @ .45 | added `echoe-park-edge`, the texture difference |
| Tree and scrub cover | `#12301d` @ .62-.72 | flat, no rim, second green |
| Building (flat, z12+) | `#101a15`, edge `#1d2a24` | cool edge |
| Building (3D, z13+) | `#14201a` to `#26352e` by `render_height` | vertical gradient on |
| Motorway, trunk, primary | `#d9dccb` / `#cfd3c2` | step 1, light warm-white |
| Secondary, tertiary | `#6d7c70` @ .85/.62 | step 2, mid grey-green |
| Minor roads | `#39443d`, opacity .2 at z11 to .9 at z16 | step 3, dim |
| Road casing | `rgba(3,7,5,.9)` | separates road from ground |
| Railway | `#3d4d46` under a `#070c09` dash | subtle dashed |
| All labels | white at .62 to 1, halo `rgba(2,6,4,.92)` | no grey text anywhere |
| Player's Echoe | `#d7f06c` core, `circle-blur` glow, dark rim | lime name |
| Other Echoes | avatar colour, 1.2px white ring | white name |

Road widths for the major layer were narrowed (2.2px at z13 instead of 4.4px) so
the city stops reading as a white spiderweb at city zoom.

## Label zoom rules

| Layer | Range | Why |
|---|---|---|
| `place_suburb`, `place_town`, `place_city` | style default | the only names at city zoom |
| `place_city_large` | hidden | it is Bengaluru's own name; the header already says it, and at 14px it landed across the landmark cluster |
| `highway_name_other`, `highway_name_motorway` | 14 and up | street names would clutter the city view |
| `place_other`, `place_village` | 14 to 16 | neighbourhood names only once flown in |
| `water_name` | 13 and up | — |
| `railway`, `railway_dashline` | 11 and up | below zoom 12 the tiles carry no minor roads, so rail keeps the ground from reading empty |

Suburb and city labels get `text-letter-spacing` .16 to .2 on the style's own
uppercase transform, which is the small-caps look.

## What changed and why

- **Markers.** Emoji on a black box became a round glass chip with the icon, a
  white name below on a hard dark halo, a lime ring on the player's current
  place, and a staggered 3.6s bob. No `backdrop-filter` and no `filter` on any
  of them: ten blurred layers over a WebGL canvas is what drops frames on a
  mid-range phone, so the glass is a layered translucent fill instead. The bob
  animates `transform` only, and the global reduced-motion rule already stops it.
- **Agent labels.** Moved above the dot (`text-anchor: bottom`, offset -2.4em)
  while landmark names hang below their chip, so the two never share a band even
  at the same coordinate. Pulse and arrival-burst expressions are unchanged and
  `setData` is still capped at ~30/s.
- **Camera.** City view is now centre `77.6153, 12.9628`, zoom 11.95, pitch 55,
  bearing -15. Tuned by measuring every marker's screen rect against the header
  and sheet: all ten landmarks clear both, with 18px margin left and right at
  390x844. The old 77.60 / 12.5 hid Indiranagar off the right edge.
- **Vignette.** `.map-scrim` is now two gradients, a light one under the header
  and a heavier one under the sheet, with nothing across the middle.
- **Bug fixed.** `fill-extrusion-base` read a feature property called `zoom`,
  which does not exist, so every base was 0. `render_height` is now coalesced,
  which clears a MapLibre warning.

Known and left alone: the OpenFreeMap dark style asks for a `wood-pattern`
sprite it does not ship, so MapLibre logs one warning on load. Landmark names
still overlap slightly in the densest block around MG Road; HTML markers do not
take part in MapLibre's collision engine, which is the price of keeping them
crisp.

## Map pins

Symbol layers, not DOM markers. Layer and source ids the UI can rely on:

| Id | What |
|---|---|
| `pins` (source) | featured startups, every VC, featured spots. Unclustered. |
| `pins-rest` (source) | unfeatured startups only. `cluster: true`, radius 40, maxzoom 14. |
| `pin-featured` | startups and VCs from city zoom |
| `pin-spots` | spots from zoom 13 |
| `pin-rest` | unclustered leftovers from 13.5 |
| `pin-clusters` | cluster bubble; tap expands via `getClusterExpansionZoom` |
| `pin-cluster-count` | the count label |

Prop: `pinKinds?: Array<'startup' | 'vc' | 'spot' | 'place'>`, default all four,
forwarded through `MapSlot`. `'place'` is the ten landmark chips, which are DOM
markers and take a `.map-pin--off` class rather than a filter. Everything else
is `setFilter` on the layers above, never a source rebuild. Only startups
cluster, so toggling startups toggles the cluster layers exactly.

Rings are drawn into each chip: white for a startup, lime for a VC, amber
(`#e0a458`) for a spot. A VC's name carries a second line reading VC from zoom
14. A spot with no logo gets a drawn glyph, a cup for a cafe and a beer
otherwise, rather than initials. Icon size runs 0.4 at city zoom, 0.45 at 12.5,
0.8 at 15. A tap calls `onCompanyTap(slug)` and flies in with a `[0, -130]`
offset, without which the pin lands behind the sheet at pitch 60.

Three data facts shaped this:

- **Logos are vendored** by `scripts/fetch-logos.sh` into `public/logos/`, one
  file per domain across every pin source. Each source's `logo` is a Google
  favicon URL, which renders in an `<img>` but sends no CORS header, so its
  pixels can never be read back off a canvas, which is what `addImage` needs.
  Of the services that do send CORS, unavatar answered 20 of 39 with HTTP 429.
  349 domains resolve; the rest draw a chip. Re-run the script when a source
  file changes.
- **Loading is demand-driven** through `setMissingStyleImageResolver`, which
  MapLibre awaits before calling an image missing. Only pins actually on screen
  fetch anything: 82 requests at city zoom, not 800, and no missing-image
  warnings. A `styleimagemissing` listener logs one warning per pin instead.
- **companies.json and vcs.json round coordinates to two decimals**, so dozens
  of rows share a handful of points. Each group is fanned onto a ~660m ring,
  smaller than the 1.1km error the rounding already carries.
  `companies-osm.json` has real precision and is left alone.

Chips carry no `backdrop-filter`. Ten blurred layers over the WebGL canvas is
what stalls iOS Safari, so the glass is a layered translucent fill instead; the
sheet and header keep their blur. Frame cost at city zoom with every pin kind
on: 4.62ms mean per MapLibre draw, 8.0ms at p95, against a 16.7ms budget.

## Screenshots

At 390x844 under the World chrome, in `docs/design/shots/`: `map-before.png`,
`map-after.png`, `map-pins-city.png`, `map-companies-city.png` and
`map-companies-tapped.png`.
