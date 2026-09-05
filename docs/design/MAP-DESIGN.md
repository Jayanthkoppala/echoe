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

## Screenshots

Both at 390x844 under the World chrome: `docs/design/shots/map-before.png` and
`docs/design/shots/map-after.png`.
