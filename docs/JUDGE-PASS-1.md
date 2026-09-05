# Judge pass 1 (2026-09-05 17:55 IST, scored against HEAD 17:41)

Three judge agents, one per scored parameter, plus the ten qualifiers.

| Parameter | Score | Weight |
|---|---|---|
| Real-time | 4/5 | 35 |
| Problem cracked | 4/5 | 35 |
| Market readiness | 2/5 | 30 |

Qualifiers: PASS phone, repo timing, one-liner, 30s entry. FAIL live URL, Maincloud, demo video, public post, email comms, onboarding copy.

## Fixes, ranked (file:line against HEAD 17:41)

Done in this pass:
- [x] CreateScreen.tsx:151 submit no longer gated on a 12-char persona (UX-ORDER decision 1). Suggest button still is.
- [x] CreateScreen.tsx:52 step counter 02/08 -> 02/03 (UX-ORDER change 7).

Open, code (all touch files with uncommitted edits from another session; apply after that lands):
1. index.ts:759, :779 `setLlmConfig` / `setMission` accept any caller. Add owner/admin identity check. A hostile second tab can overwrite the shared OpenRouter key mid-demo. — **done 2026-09-05**: both now call `requireAdmin`, which checks the caller against `llm_config.owner` (set to the publishing identity in `init`).
2. App.tsx:104-106 + WorldScreen.tsx:88 after a run ends, "Watch it roam" and Done's "Start tomorrow's run" bounce straight back to Return. Make World's CTA call `startRun` when status is ended. — **done 2026-09-05, differently**: an ended run now auto-navigates World → Return (the App.tsx effect), and both Return's empty state and Done's button call a new `onRestart` action that calls `startRun`. World's own "Watch it roam" button still just re-centers the map (`setFollow`), not a restart.
3. App.tsx:214-283 Toast renders only inside World, so a rejected `startRun` on Create shows nothing. Move Toast to root. — **done 2026-09-05**: `<Toast>` is now the first child of `<main>`, before any per-screen branch.
4. App.tsx:99-101 + WorldScreen.tsx:61-67 returning player on a share link skips Create so no host run starts, but the strip says the Echoe is walking to the host. Gate strip on `run.hasHost`. — **done 2026-09-05, differently**: the strip's copy now reads `hostLive = run?.status === 'running' && !run?.hostMet` (WorldScreen.tsx), so with no run yet it falls back to the "will meet others" copy instead of claiming it's walking to the host.
5. select.ts:108 `agentsFrom` maps only over travel legs, so a new Echoe has no pin for 6-10s on other tabs. Fall back to `player.currentPlace`. — **done 2026-09-05**: `agentsFrom` now stands the Echoe at `player.currentPlace` whenever there's no live leg.
6. `player.online` is maintained (index.ts:500-508) but never rendered. Show presence; the rubric names it at score 4. — **done 2026-09-05**: WorldScreen's top bar now shows an `{onlineCount} online` chip.
7. ReturnScreen.tsx:98-100 empty state says "run it again" with no button. Add one calling `startRun`. — **done 2026-09-05**: the empty state now has a button calling `onRestart` (→ `startRun`).
8. WorldScreen first visit: one onboarding line, copy already in BUILD-PLAN.md. — **done 2026-09-05**: shown when `justArrived` (no people met, no places visited yet).
9. App.tsx:42-51 every client subscribes to every row of receipt / transcript_line / agent_travel. Scope by `runOwner`, prune `agent_travel` in tick.
10. index.ts:441-476 `pickNextPlace` is O(runs^2) via `latestLeg`; cache current place per echo once per tick. index.ts:908-912 `tryConverse` does db lookups inside the sort comparator.
11. Email: docs/EMAIL.md Resend procedure is designed, zero lines wired. Needs a RESEND_API_KEY and a hook in `join`.

Open, not code (Jay):
- `spacetime publish echo -y` to Maincloud, set VITE_SPACETIMEDB_HOST, deploy dist to a static host. — **partly done 2026-09-05**: published as `echoe` (https://spacetimedb.com/echoe). `VITE_SPACETIMEDB_HOST` and the static deploy of `dist/` are still open.
- Demo video under 3 min per BUILD-PLAN shot list.
- Three public posts; first one names the channel for the first 500 users.
