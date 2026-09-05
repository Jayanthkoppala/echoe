# Echoe visual review 1

Walked 2026-09-05 at 390x844 in Chrome against `http://localhost:5173`, judged against
`DESIGN.md` and column A of `glass-directions.html`. Shots in `shots/before/`.

Caveats, stated first:

- The map renders **black** in every World and Roaming shot. `document.hidden` was `true`
  for the whole walk, so MapLibre paused and never requested a vector tile. This is the
  automation artefact `DESIGN.md` already lists, not a proven defect. **Nothing about the
  map, the vignette or glass-over-map is verified.** Judge those on a foreground browser.
- I cleared `localStorage` once, on the visitor path, because a stored identity skipped
  Join and dropped straight into the finished run.
- Three screens were crashing on entry with `usd is not defined`. I added the missing
  import in `src/screens/WorldScreen.tsx` and `src/screens/ReturnScreen.tsx` to unblock
  the walk. That is the only code I changed.
- Another agent edited World mid-review. The share card went from a pinned card with a
  Copy link button to a collapsed one-line strip behind a disclosure caret. Both states
  are captured; item 4 below is about the newer one.

## Screens

| Screen | Page scroll ok | Panel background | Backdrop filter | Min text | Verdict |
|---|---|---|---|---|---|
| Join, host | yes 844/844 | `.input` `rgba(255,255,255,.075)` | `blur(22px)` | 10px | Weak. No glass groups the content, video too bright behind the title |
| Join, visitor | yes | `.host-card` `rgba(255,255,255,.075)` | `blur(22px) saturate(1.5)` | 10px | Better. The host card anchors the top |
| Create | yes | textarea `rgba(255,255,255,.075)` | `blur(22px)` | 10px | 222px of dead space, lime focus ring outshouts the CTA |
| World | yes, sheet 694 to 834 | `.map-sheet` `rgba(255,255,255,.075)` | `blur(22px) saturate(1.5)` | 10px | Unjudgeable over a black map. Share card now demoted |
| Roaming | yes | same | `blur(22px) saturate(1.5)` | 9px | Goal line printed twice, no progress, stats barely move |
| Return | yes, `.content` 2412/690 | `.match` `rgba(255,255,255,.075)` | `blur(22px) saturate(1.5)` | 9px | Best screen in the app. Score bar reads empty |
| Review | yes, `.content` 1401/690 | `.bubble` `rgba(255,255,255,.05)` | `blur(14px)` | 10px | Six solid lime blocks own the screen |
| Correct | yes | textarea `rgba(255,255,255,.075)` | `blur(22px)` | 10px | 218px of dead space |
| Done | yes | `.loop-row` `rgba(255,255,255,.075)` | `blur(22px) saturate(1.5)` | 10px | Clean, but the copy describes a screen that left the flow |

No grey `color` values were found. Every non-white text colour is either `--lime`,
`--coral`, the ink on lime, or MapLibre's own attribution, which is black on black and
invisible. Rule 1 holds.

## Fixes, highest impact first

**1. Lime chat bubbles break the scarcity rule and invert Review's hierarchy.**
`.bubble.mine` is a solid `--lime` fill. Six of them fill the screen while the only real
CTA, "Back to the recap", is a dark secondary. Make mine a heavier glass instead:
`background: var(--panel-deep)`, `border: 1px solid var(--edge)`, keep the 18px 18px 6px
18px corner, and mark ownership with alignment plus `box-shadow: inset 0 1px 0 var(--hl),
inset -2px 0 0 var(--lime)`. `src/styles.css`.

**2. The Join hero fights the whole direction.** The video is a bright daylight isometric
render; column A is night. "Send an Echoe into Bengaluru" sits white on pale buildings.
Deepen the scrim to `linear-gradient(180deg, rgba(6,10,8,.55) 0%, rgba(6,10,8,.25) 35%,
rgba(6,10,8,.92) 100%)` and add `filter: saturate(.75) brightness(.62)` on `.hero-video`.
`src/styles.css`.

**3. Join gives a stranger nothing to read in five seconds.** Title, label, field and CTA
float naked over video with about 500px of empty video above them. Wrap the title, label,
field and a one-line "It walks the city, talks to other Echoes, comes back with names"
in one `.glass` card pinned to the lower third. That is also the missing answer to what
the app does. `src/screens/JoinScreen.tsx`, `src/styles.css`.

**4. The Copy link button, the whole point of World, is behind a caret.** UX-ORDER
decision 5 makes the share card the loudest control on a host's World. It is now a
collapsed strip with a `▾`. Restore the expanded card as the default for a host, and keep
the collapsed strip only for a visitor. `src/screens/WorldScreen.tsx`,
`src/components/ShareCard.tsx`.

**5. The score bar renders as an empty track.** Score 25 shows a flat dark rail with no
visible fill. Give the fill a floor and a glow: `min-width: 6px`, `background:
linear-gradient(90deg, rgba(215,240,108,.55), var(--lime))`, `box-shadow: 0 0 12px -2px
var(--lime)`, and put the denominator in the label as `25 / 100`. `src/styles.css`,
`src/screens/ReturnScreen.tsx`.

**6. Roaming prints the goal twice.** The headline and the subtitle under it carry the
same string. Drop the subtitle and put the run's progress there instead, a thin
`--panel-thin` track with a lime fill for places visited against the limit. Twenty-five
seconds of watching currently moves one number. `src/screens/RoamingScreen.tsx`.

**7. Dead space at the bottom of three screens.** Create leaves 222px between the last
field and the CTA, Correct 218px, Done about 130px. Give `.content` `justify-content:
space-between` with the first block hugging the top, or lift the CTA to sit
`margin-top: auto` inside the scroller so the composition closes. `src/styles.css`.

**8. The autofocused persona textarea wears a full lime border.** It is the loudest thing
on Create while the CTA is disabled. Use a ring, not a fill-edge: `border-color:
var(--edge)`, `box-shadow: inset 0 1px 0 var(--hl), 0 0 0 2px rgba(215,240,108,.35)`.
`src/styles.css`.

**9. Disabled primary buttons read as muddy khaki.** `--lime` at reduced opacity over a
dark ground gives olive, and the dark ink on it fails contrast, worst over the bright
video on Join. Use `background: var(--panel-deep); color: rgba(255,255,255,.45);
border-color: var(--edge)` for `button.primary:disabled`. `src/styles.css`.

**10. 9px and 10px text is below a shippable floor.** `.cost`, the stat labels on Roaming
and Return, and every `.eyebrow` and `.sheet-head small`. Raise the eyebrow class to 11px
with `letter-spacing: .1em` and stat labels to 11px. Nothing on a phone should be under
11px. `src/styles.css`.

**11. Character picker colours are off-palette.** The five glyphs are orange, lilac,
coral, ice blue and lime. The lime one is a fifth lime on a screen that should have one,
and the pastels belong to no system here. Render all five in `--fg` at .8 and let the
selected chip carry the accent. `src/state/copy.ts`, `src/styles.css`.

**12. Chips are not glass.** `[role=list] button` computes `backdrop-filter: none` while
every neighbour blurs at 22px. Add `-webkit-backdrop-filter: blur(var(--blur-sm))` and
the same `inset 0 1px 0 var(--hl)` highlight so the material is consistent.
`src/styles.css`.

**13. Radii are inconsistent within one viewport.** Create alone shows 14, 18, 20, 26,
999 and 50%. Collapse to the three tokens: 22 for cards and sheets, 14 for chips, inputs
and rows, 18 for buttons. The topbar's 20 and the sheet's 26 are both off-token.
`src/styles.css`.

**14. Review's main interaction is invisible.** Every "mine" bubble is a button but
nothing says so, and the Sounds like me / Not me panel only exists at the bottom of a
1401px scroller. Add a one-line hint under the header, "Tap any line your Echoe said",
and move the judgement panel to a pinned footer that follows the selected line.
`src/screens/ReviewScreen.tsx`.

**15. Done still teaches the removed Limits step.** Loop row 2 reads "Set limits and hand
over control", which UX-ORDER decision 2 took out of the first run. Change it to "Your
Echoe walks with the limits you set". `src/state/copy.ts`.

## Not fixed here, needs a foreground browser

Map tiles, 3D buildings, the `.map-scrim` weight, glass legibility over the live map, the
landmark markers, and the aurora behind the map screens. The emoji landmark pins with
10px black-boxed labels look like a debug layer in every capture, but that judgement is
worth nothing until the basemap is actually drawing behind them.
