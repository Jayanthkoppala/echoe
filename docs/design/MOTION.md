# Echoe motion layer

Scope: screen transitions, glass panel entrances, map fly-to-place-and-back, agent dot pulse. Zero new dependencies — everything below runs on what's already installed (React 18, MapLibre GL JS `^6.7.0`, plain CSS).

## Decision table

| Concern | Options considered | Choice | Why | Cost |
|---|---|---|---|---|
| Map fly-down/fly-back | `jumpTo` (instant) / `easeTo` (linear-ish ease, no altitude curve) / `flyTo` (Google-Earth-style zoom-out-then-in curve) | `flyTo` for both legs, `essential: true` | Only `flyTo` gives the "swoop down to a place" feel; `easeTo` looks like a flat pan-zoom. `essential: true` keeps it working under `prefers-reduced-motion` (else duration silently drops to 0) | 0 KB, ~1 hr |
| Screen transitions | View Transitions API (`document.startViewTransition`) / CSS keyframes on mount-unmount / `framer-motion` (`motion`) / React Bits | Plain CSS keyframes + a `data-screen` attribute swap | View Transitions has no Firefox support as of this writing and needs a same-DOM snapshot trick that fights the `screen === 'x' && <X/>` conditional-render router in `App.tsx`; `framer-motion` is ~50 KB gzip for a 9-screen fade/slide that CSS does in 15 lines | 0 KB, ~1.5 hr |
| Glass panel entrances (sheet, share card, ranked cards, score bar) | CSS `@keyframes` + `animation` shorthand / Web Animations API / a library | CSS keyframes, one small `useMounted` hook to add the class on mount | Same reasoning: no dependency earns its keep for slide/fade/stagger/fill, all of which are one `transform`/`opacity`/`width` keyframe each | 0 KB, ~1 hr |
| Agent dot pulse + arrival burst | DOM marker per agent with CSS animation / circle-layer paint expression + rAF-driven feature property | Paint-expression driven by a `pulse` (0..1) property written into the same per-frame `setData` call already in `interpolate`'s tick loop | A DOM marker per agent means N `Marker` instances fighting the existing single circle layer; the tick loop in `BengaluruMap.tsx` already recomputes features every frame, so writing one more number per feature is free | 0 KB, ~1 hr |

**Total: 0 KB added, roughly 4.5 hours.**

---

## 1. Map: city view to landmark and back

`flyTo` interpolates center, zoom, bearing, and pitch together along a great-circle-style curve (Google-Earth style zoom-out/pan/zoom-in), which reads as "flying" rather than "panning." Verified against `/maplibre/maplibre-gl-js` (`src/ui/camera.ts`, `EaseToOptions`/`AnimationOptions` types, and the `slowly-fly-to-a-location.html` and `customize-camera-animations.html` examples).

```ts
// City -> landmark. Call from onPlaceTap or when an agent arrives.
map.flyTo({
  center: [landmark.lng, landmark.lat],
  zoom: 16.5,
  pitch: 65,
  bearing: -35,
  duration: 2200,
  curve: 1.4,          // higher = more zoom-out before the swoop in
  essential: true,     // still runs under prefers-reduced-motion
});
map.once('moveend', () => setOpenPlace(landmark.id)); // reveal the card after landing
```

```ts
// Landmark -> city. Call when the place card closes.
map.flyTo({
  center: [77.6, 12.97],
  zoom: 12.5,
  pitch: 55,
  bearing: -15,
  duration: 1800,
  curve: 1.4,
  essential: true,
});
```

**Chaining "down, wait, back":** don't use a `setTimeout` guess for the wait — trigger the return flight from the UI action that closes the card (user taps "close", or a fixed on-screen timer tied to React state), and gate the card's *appearance* on `map.once('moveend', ...)` as above so the card never pops in mid-swoop.

**Gotchas:**
- **`setData` during `flyTo`:** the existing per-frame `tick()` in `BengaluruMap.tsx:110-143` calls `source.setData(...)` every `requestAnimationFrame` regardless of camera state — this is safe and expected, `setData` and camera easing run on independent frame callbacks (`_ease` in `camera.ts` uses its own `_requestRenderFrame`). No change needed there.
- **Mobile Safari:** `flyTo` with a large pitch/bearing delta plus a 3D fill-extrusion layer (the OpenFreeMap "liberty" building layer already in use) can drop frames on older iOS Safari when `duration` is short; keep durations at 1800ms+ for the landmark legs, which is already comfortably above the default 500ms `easeTo` uses.
- Calling a new `flyTo` while one is in-flight auto-cancels the previous one (`_stop` inside `easeTo`/`flyTo`) — safe to call again on rapid re-taps, no manual `map.stop()` needed first.

---

## 2. Screen transitions (App.tsx state router)

No dependency added. `App.tsx` renders screens as `{screen === 'x' && <X/>}` — swap that for a CSS-driven cross-fade keyed off `screen`, using a class toggle instead of View Transitions (Safari/Firefox gaps as of writing) or `framer-motion` (unneeded 50 KB for a fade+slide).

```css
/* styles.css */
.phone > * { animation: screen-in 320ms cubic-bezier(.22,.68,0,1.1) both; }
@keyframes screen-in {
  from { opacity: 0; transform: translateY(12px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .phone > * { animation: none; }
}
```

No JS change is required beyond what's already there — CSS `animation` re-triggers automatically because React mounts a fresh element each time the `screen === 'x'` branch flips, so the `<X/>` node is new and picks up the `animation` on insertion. If a future screen needs an *exit* animation (old screen fading while new one enters), that's the one case worth a tiny `useState`-driven "outgoing" flag — skip it for now, nothing in the current nine screens asks for a cross-fade.

---

## 3. Glass panel motion

One `useMounted` hook, reused everywhere:

```ts
// hooks/useMounted.ts
import { useEffect, useState } from 'react';
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
```

Usage: `className={mounted ? 'sheet sheet--in' : 'sheet'}`.

```css
/* World bottom sheet: slide up */
.sheet { transform: translateY(100%); transition: transform 360ms cubic-bezier(.22,.68,0,1.1); }
.sheet--in { transform: translateY(0); }

/* Share card: fade in */
.share-card { opacity: 0; animation: fade-in 280ms ease-out forwards; }
@keyframes fade-in { to { opacity: 1; } }

/* Return screen: ranked match cards stagger in */
.match-card { opacity: 0; animation: card-in 320ms ease-out forwards; }
.match-card:nth-child(1) { animation-delay: 0ms; }
.match-card:nth-child(2) { animation-delay: 60ms; }
.match-card:nth-child(3) { animation-delay: 120ms; }
@keyframes card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Score bar fill */
.score-fill { width: 0; transition: width 700ms cubic-bezier(.22,.68,0,1.1); }
.score-fill--in { width: var(--score-pct); }
```

`prefers-reduced-motion` guard (one rule covers all four):

```css
@media (prefers-reduced-motion: reduce) {
  .sheet, .share-card, .match-card, .score-fill { transition: none; animation: none; }
}
```

---

## 4. Agent dot: pulse + arrival burst

Driven entirely by paint-property expressions reading a per-feature property, written in the same `tick()` loop that already runs in `BengaluruMap.tsx:110`. No per-agent DOM marker, no second render path.

```ts
// Inside tick(), when building each feature's properties (BengaluruMap.tsx:132-136):
const t = now / 1000;
properties: {
  colour: agent.colour,
  label: agent.label,
  isMine: !!agent.isMine,
  pulse: agent.isMine ? (Math.sin(t * 2.4) + 1) / 2 : 0, // 0..1, only the player's own dot
  arrived: now >= leg.arriveMs && now < leg.arriveMs + 900 ? 1 : 0, // 900ms burst window
}
```

```ts
// Paint expressions on the existing 'agents-circle' layer (replace the static values):
paint: {
  'circle-radius': [
    '+',
    ['case', ['get', 'isMine'], 9, 6],
    ['*', ['get', 'pulse'], 3],           // breathing radius on my own dot
    ['*', ['get', 'arrived'], 10],        // burst pop on arrival
  ],
  'circle-opacity': ['-', 1, ['*', ['get', 'arrived'], ['get', 'arrived']]], // fades out as burst grows
  'circle-color': ['get', 'colour'],
  'circle-stroke-width': ['case', ['get', 'isMine'], 3, 1.5],
  'circle-stroke-color': '#ffffff',
}
```

No separate `requestAnimationFrame` loop — the pulse rides the rAF loop that already drives agent movement, so it costs one `Math.sin` call per frame per agent.

---

Skipped: exit-transition choreography (old screen fading while new one enters) and a dedicated camera-state machine for the fly-down/fly-back sequence — add the former if a screen pair needs a real cross-fade, the latter if more than two camera legs need chaining.
