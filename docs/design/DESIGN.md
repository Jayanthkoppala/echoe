# Echoe design system (source of truth)

Updated 2026-09-05 18:15 IST. Direction A, obsidian glass, chosen by Jay from `glass-directions.html`. Any agent changing visuals reads this first and edits `src/styles.css` tokens, never per-screen colours.

## Non-negotiables

1. **All text is white.** `--fg` white, `--fg2` white at .7, `--fg3` white at .55. No grey text anywhere. The only dark text is `#101a0e` on a lime fill.
2. **Every screen fits one viewport.** No page scroll. Header and CTA pinned, only `.content` scrolls. Verify with `document.documentElement.scrollHeight === innerHeight` at 390x844 and 1280x900.
3. **Glass must have light behind it.** A panel over flat black is not glass. The `.aurora` layer (three drifting lights) sits behind every screen; Join has the city video; World and Roaming have the dark map. Never remove the aurora and never put a solid fill under a glass panel.
4. **Brand is Echoe** (plural Echoes) in all copy. Code identifiers stay `echo`.
5. **Lime is scarce.** `--lime #d7f06c` only on the primary CTA, the score, the credit count, focus rings and links.
6. **No new dependencies for visuals.** Plain CSS. See `GLASS-STACK.md` for why Tailwind kits were rejected.

## Tokens (`src/styles.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--page` | `#080b09` | page ground |
| `--panel` | `rgba(255,255,255,.075)` | default glass fill |
| `--panel-deep` | `rgba(255,255,255,.11)` | sheets, cards that must read heavier |
| `--panel-thin` | `rgba(255,255,255,.05)` | strips, chips |
| `--edge` | `rgba(255,255,255,.22)` | 1px outer border |
| `--hl` | `rgba(255,255,255,.38)` | inset top highlight |
| `--sheen` | `rgba(255,255,255,.14)` | diagonal gradient on `.glass::after` |
| `--blur` / `--blur-sm` | `22px` / `14px` | backdrop blur |
| `--radius` / `--radius-sm` / `--radius-btn` | `22 / 14 / 18px` | corners |
| `--lime` | `#d7f06c` | accent |
| `--coral` | `#ef7e66` | "Not me", errors |

## The glass recipe (`.glass`)

```css
border: 1px solid var(--edge);
background: var(--panel);
-webkit-backdrop-filter: blur(var(--blur)) saturate(150%);
backdrop-filter: blur(var(--blur)) saturate(150%);
box-shadow:
  inset 0 1px 0 var(--hl),                 /* top highlight */
  inset 1px 0 0 rgba(255,255,255,.12),     /* left refraction */
  inset 0 -1px 0 rgba(0,0,0,.35),          /* bottom shadow lip */
  0 18px 40px -14px rgba(0,0,0,.85),       /* drop */
  0 0 0 1px rgba(0,0,0,.35);               /* dark outer ring */
```
`.glass::after` adds the sheen. Inputs, textareas, `.secondary` buttons and chips reuse the same fill, edge and highlight. Always include the `-webkit-` prefix; iOS Safari drops blur under heavy compositing, so keep glass layers per screen under about six.

## Backdrop (`.aurora`)

Three blurred circles (leaf `#6f8f3a`, lime `#d7f06c`, amber `#b9782f`) drifting on 26 to 38 second alternating loops, plus an SVG noise overlay at .06 on `.phone::after`. Rendered once in `App.tsx` as the first child of `.phone`. Reduced motion stops the drift.

## Motion

From `MOTION.md`, zero dependencies: `screen-in` on router swap, sheet slide-up, share card fade, staggered match cards, score bar fill, agent pulse and arrival burst on the MapLibre circle layer, `flyTo` down to a landmark and back chained on `moveend`. One `prefers-reduced-motion` query disables all of it.

## Screen order and roles

Per `../UX-ORDER.md`: Join (video, name) -> Create (character, persona first, intent with "Suggest from my persona") -> World (host: share card pinned; visitor: "walking to host" strip) -> Roaming -> Return (ranked matches, share card again, receipts) -> Review -> Correct -> Done. Limits is a side door ("Adjust limits"). The run starts on "Send my Echoe out".

## Known issues to fix (as of this update)

- [x] Map verified drawing (2026-09-05 18:25 IST): streets, area labels, agents. Root cause was MapLibre 6's tile worker 404ing under Vite pre-bundling; fixed with `setWorkerUrl` and the `?worker&url` import in `src/map/BengaluruMap.tsx`. Style is OpenFreeMap `dark` with our own `building-3d` layer (shows from zoom 13, so on fly-to, not at city view).
- [ ] The dark basemap reads dim at city zoom; consider lightening road colours via `setPaintProperty` on load, or lowering `.map-scrim` further. Judge on a phone.
- [ ] Glass over the video on Join: check blur cost on a mid-range Android.
- [ ] Create screen: after the aurora landed, re-check that the persona and intent textareas read as glass, not black.

## How to verify a visual change

1. `npx tsc --noEmit -p tsconfig.json` and `npx vite build` exit 0 (use the absolute node path, node is a blocked shell function on this Mac).
2. Walk the six main screens at 390x844 and confirm page scroll height equals viewport.
3. Compute one panel's `backgroundColor` and `backdropFilter` and paste the values in the report.
4. Screenshot Join, Create and World and attach paths.
