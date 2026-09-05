# Glassmorphism stack for Echoe

Stack constraints checked against: Vite + React 18 + TypeScript, plain CSS with variables, no Tailwind, no UI library, nine single-viewport screens (video-backed Join, map-backed World/Roaming, form/list screens).

## Source survey

| Source | Licence | Needs Tailwind | Needs motion runtime | Weight | Best fit here |
|---|---|---|---|---|---|
| React Bits (reactbits.dev) | MIT + Commons Clause v1.0. Verified on GitHub LICENSE.md: "Permission is hereby granted... to use, copy, modify, merge, publish, and distribute the Software as part of an application, website, or product" but "you may not sell, sublicense, or redistribute the components themselves." Fine for shipping Echoe, not for reselling as a kit. | No, has a plain-CSS/CSS-modules variant per component alongside the Tailwind one | Some components use GSAP or Framer Motion, others are CSS-only; pick the CSS variant | Per-component, since it is copy-paste | Card/tilt/spotlight micro-interactions on Create and Return |
| Magic UI (magicui.design) | MIT (component source, shadcn-style distribution) | Yes, built for Tailwind + shadcn/ui CLI | Framer Motion (`motion` package) for most animated components | Adds Tailwind + Framer Motion to a project that has neither | Skip, wrong fit for a Tailwind-less app |
| Aceternity UI | Free tier is copy-paste source; could not confirm a clean commercial-use clause from the public terms/licence pages (they cover the paid "Pro" bundle explicitly, not the free tier's commercial terms). Treat as unverified, re-check before shipping any component from it. | Yes, Tailwind + Motion by design | Framer Motion / Motion | Heavy for what we need | Skip given the licence gap and Tailwind requirement |
| shadcn/ui glass themes | MIT (shadcn/ui core is MIT) | Yes, Tailwind is the whole model | No animation runtime required | N/A, it is a CLI that writes Tailwind + Radix source into your repo | Skip, the entire distribution model assumes Tailwind |
| 21st.dev community components | Per-component, platform convention is MIT-style "source lands in your repo" but each submission can set its own licence; check the component page before copying | Yes, React + Tailwind + shadcn/ui conventions | Varies by component | Varies | Skip, same Tailwind dependency problem |
| Uiverse.io | CC0 for community submissions (public domain, no attribution required); confirm per-snippet since some authors mark alternate licences on their profile | No | No | Single snippet, a few hundred bytes to ~2KB per card/button | Best raw material: glass cards and buttons in plain CSS, copy the snippet and rename the classes |
| glassmorphism.com generator (Hype4 Academy) | Free tool, output CSS has no licence restriction (you own the generated snippet) | No | No | A few lines of CSS | Fast way to dial in background rgba + blur + border values before hand-tuning |
| CSS-only glass panel (hand-rolled) | N/A, your own code | No | No | ~15 lines | Everything: Join overlay, World mission bar/share card, Return tiles, Review bubbles |

## Recommended stack for a 24h build

Prefer copy-paste CSS over new dependencies. Nothing here needs a package install.

1. Write one set of CSS custom properties for glass tokens (below) and one `.glass-panel` / `.glass-btn` base class. Reuse across all nine screens.
2. Pull 2-3 Uiverse.io glass card/button snippets for visual reference, then hand-adapt into the token system rather than pasting their class names verbatim, since Uiverse snippets hardcode their own values.
3. Optional, only if Create/Return screens want tilt or spotlight hover: copy one React Bits CSS-variant component (not the Tailwind one, not the GSAP one) for a single card effect. This is the only case worth a dependency-shaped decision, and even then it is copy-paste source, not an npm install.
4. Do not add Framer Motion, Tailwind, or shadcn/ui. CSS transitions and `@keyframes` cover every hover/press/fade this app needs, and adding a motion runtime for nine screens is the kind of dependency you would be pulled into every future screen.

## Glass tokens (CSS variables)

Two contexts: dark glass over video (Join) and over map (World, Roaming), versus lighter glass over solid dark backgrounds (Create, Limits, Return, Review, Correct, Done).

```css
:root {
  /* dark-on-video / dark-on-map: frosted panel floating over motion imagery */
  --glass-bg-video: rgba(18, 18, 24, 0.45);
  --glass-blur-video: 20px;
  --glass-border-video: 1px solid rgba(255, 255, 255, 0.18);
  --glass-highlight-video: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  --glass-shadow-video: 0 8px 32px rgba(0, 0, 0, 0.45);

  /* panel-on-dark-solid: denser, less blur needed since the backdrop is flat */
  --glass-bg-solid: rgba(255, 255, 255, 0.06);
  --glass-blur-solid: 12px;
  --glass-border-solid: 1px solid rgba(255, 255, 255, 0.10);
  --glass-highlight-solid: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --glass-shadow-solid: 0 4px 20px rgba(0, 0, 0, 0.30);

  --glass-radius: 16px;
  --glass-radius-btn: 12px;
}
```

iOS Safari caveats: `backdrop-filter` needs the `-webkit-` prefix or it silently no-ops (no error, panel just renders opaque or fully transparent depending on fallback background). Safari on iOS also drops the blur under heavy compositing (many stacked glass layers, or blur applied to a `position: fixed` element inside a scrolling container), so keep one blur layer per view where possible and test the Join and Roaming screens specifically since those stack a glass panel over a video/map that itself repaints every frame. Always set a solid-ish fallback background color before the `rgba` background so unsupported browsers get a readable, non-transparent panel instead of a video showing straight through white text.

## Copy-paste: glass panel

```css
.glass-panel {
  background: var(--glass-bg-video);
  -webkit-backdrop-filter: blur(var(--glass-blur-video));
  backdrop-filter: blur(var(--glass-blur-video));
  border: var(--glass-border-video);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow-video), var(--glass-highlight-video);
}

.glass-panel--solid {
  background: var(--glass-bg-solid);
  -webkit-backdrop-filter: blur(var(--glass-blur-solid));
  backdrop-filter: blur(var(--glass-blur-solid));
  border: var(--glass-border-solid);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow-solid), var(--glass-highlight-solid);
}
```

## Copy-paste: glass button

```css
.glass-btn {
  background: rgba(255, 255, 255, 0.10);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--glass-radius-btn);
  color: #fff;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  transition: background 0.15s ease, transform 0.1s ease;
}

.glass-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.glass-btn:active {
  transform: scale(0.97);
  background: rgba(255, 255, 255, 0.14);
}
```
