# Echo — Build Plan (solo, Midnight Moonshot, Agents track)

Now: Saturday 5 Sep, ~16:00 IST. Code freeze: Sunday 08:30. Submission close: 09:30. See `/Users/jay/Documents/echo/docs/HANDBOOK.md` for the full rubric this plan is built against.

**Product:** Echo — a shared Bengaluru world on a real map. Each player creates an AI Echo persona. Echoes roam landmarks, meet, talk to each other (LLM, bounded by a credit budget), and leave inspectable receipts. The player returns, reviews the transcript, and corrects one behaviour.

**Stack:** SpacetimeDB 2.9 TypeScript module on Maincloud (real-time logic + persistence) + Vite React client + MapLibre (map rendering).

**Eight screens + Done:** Join → Create Echo → World (live) → Limits → Roaming → Return → Review → Correct → Done.

## Why solo changes the plan

No parallel tracks. Everything is sequential. The build order below is chosen so that at every checkpoint there is something alive to show a mentor, even if screens 5-8 are still stubs.

## Hour-by-hour

| Time | Block | Do | Cut if behind |
|---|---|---|---|
| 16:00-17:00 | Setup | Repo (already exists at `/Users/jay/Documents/echo`), Vite React scaffold, SpacetimeDB module init, deploy empty module to Maincloud, MapLibre key/tile source working, LLM provider key loaded. Write down what's NOT being built (multi-city, voice, video receipts, persona marketplace). | — (this hour is non-negotiable, everything depends on it) |
| 17:00-19:00 | Core loop | Reducers: `join`, `create_echo`, `tick_roam` (moves an Echo between landmarks on a timer), `meet` (two Echoes at the same landmark trigger an LLM exchange, capped by a credit counter column), `receipt` insert per meeting. Public tables: `player`, `echo`, `landmark`, `meeting_receipt`. World screen subscribes and renders Echo markers moving on the map. **Checkpoint 2 target (17:00): two browser tabs, both Echoes visible, one meeting fires.** | Skip persona customization beyond a name + one-line trait; skip landmark art, use plain MapLibre markers |
| 19:00 | Mentor slot | Bring the exact question: credit-budget design for LLM calls under concurrent Echoes, and whether procedure vs reducer is the right split for the `meet` LLM call (procedures can do HTTP, reducers can't — confirm this before building further). | — |
| 19:00-21:00 | Make it enterable | Join screen: name only, no password, under 30s. Limits screen: shows remaining credit budget per player. Kill dead ends (empty world state must show seeded Echoes, not a blank map). Write the one-liner: "Send an AI version of yourself to wander Bengaluru and meet strangers, then read what it did." | Limits screen becomes a single number in the header instead of its own screen |
| 20:00 | Checkpoint 3 (last mentor) | Show Join → World → a live receipt. Ask about anything still shaky before mentors leave. | — |
| 20:30 | Dinner | Actual break. | — |
| 21:30 | Launch | Product live on Maincloud + Vite build deployed (Vercel/Netlify/Cloudflare Pages, whichever is already set up). Launch post: one-liner + clip + link. Email capture wired at Join (see `/Users/jay/Documents/echo/docs/EMAIL.md`) — this satisfies the "email comms live" qualifier. | If email isn't done by 21:00, ship Join without it and finish it in the 00:30-02:00 block — it's a qualifier, not optional, just not launch-blocking by the clock |
| 21:30-00:00 | Get users in | Push the link into WhatsApp group, room, own network. Target: 10+ distinct users creating Echoes tonight (rubric's "5+ concurrent" and later "10+ concurrent" thresholds live here). Watch where people get stuck; write it down. | — |
| 00:00 | Midnight Moonshot | All-nighter starts. | — |
| 00:30-02:00 | Iterate on tonight's insights | Fix the top 1-2 things users got stuck on. Build Return screen (player comes back, sees their Echo's roam summary) and Review screen (full transcript of one meeting). | Correct screen (see below) can slip to the next block if Return/Review aren't solid |
| 02:00-04:00 | UI/UX pass | Font, color, landing state (first 3 seconds of Join), empty/loading states, one delight moment (e.g. the map pin pulses when an Echo starts talking). Test on a phone. | Delight moment is the first thing cut if time is short — it's not a qualifier |
| 04:00-05:30 | Stranger-proof | Correct screen: player edits one instruction/trait on their Echo based on what they read, and it visibly changes future behaviour (this is the "AI, bounded by credits... player corrects one behaviour" core mechanic — it must work, it's the whole pitch). Seed the world with 3-5 NPC-style Echoes so it's never empty. Test full flow in incognito tab. | If Correct can't change live behaviour by 05:00, make it change the NEXT meeting only (simpler data path) rather than dropping it — this is the one thing that must survive |
| 05:30-07:00 | Comms pass | Welcome message on Join. One-liner visible on World screen too. Confirm the email actually lands (curl test from `EMAIL.md`). Human-worded error states (no stack traces surfacing to the user). Click every link on the deployed site. | — |
| 07:00-08:30 | Sell it | Breakfast, 08:00 final checkpoint. Record the demo video (see shot list below). Post it publicly. Prep the "first 500 users" answer: named channel = X/LinkedIn AI-agent communities + Bengaluru tech WhatsApp groups, reason = that's where people already discuss autonomous agents and will try a live one. | — |
| 08:30 | Freeze | Hands off. No commits after this point — Maincloud module creation timestamp + repo commit timestamps are both checked. | — |

## Ten qualifiers — concrete action per item

| Qualifier | Concrete action |
|---|---|
| Opens and runs on a phone | Responsive CSS pass at 02:00-04:00; test on your own phone before 05:30 |
| Live URL opens and runs on judges' device | Deploy early (21:30), re-test from a fresh device/network, not just localhost |
| Module live on Maincloud, created inside the window | Deploy module at 16:00-17:00 setup, confirm creation timestamp is after 14:00 Saturday |
| Repo created after 14:00 Sat, nothing pushed after freeze | Repo already exists at `/Users/jay/Documents/echo` — if it predates 14:00 today, re-init or confirm with organizers what counts; stop all pushes at 08:30 sharp |
| Demo video under 3 minutes | Script and shoot at 07:00-08:30, see shot list below |
| Links to every build in public post | Launch post includes: live URL, repo URL, demo video link |
| One-liner: who it's for, what it does | Written at 19:00-21:00, placed on Join screen and in every post |
| Email comms live: sign up → email lands | Resend integration from `EMAIL.md`, wired into `join` reducer/procedure, curl-tested at 05:30-07:00 |
| Stranger gets in within 30 seconds, no password | Join screen = name field + submit, nothing else; verify with a stopwatch in the incognito test |
| Onboarding exists: first-time user shown what to do | One short instruction line on World screen first visit ("Your Echo is now wandering. Come back in a few minutes.") |

## Cut order

**If behind at 21:30 (launch):** drop in this order — delight moment → Limits as its own screen (fold into header) → landmark variety (use 5 fixed landmarks, not a full map search) → persona trait depth (name + one trait only). Never cut: the map, the live sync between two tabs, email capture.

**If behind at 03:00:** drop in this order — Correct screen's live re-generation (make it apply to next meeting only, not instantly) → Review screen's full transcript (show last 3 exchanges, not the whole history) → seeded NPC Echoes reduced from 5 to 2. Never cut: the core loop (roam → meet → receipt), the two-tab live sync, the demo video.

## Demo video shot list (under 3 min, no slides)

1. **0:00-0:15** — Problem in one line, spoken over your face or a static shot: "You can't be everywhere, so send an AI version of yourself that can."
2. **0:15-0:45** — Join screen, type a name, land in the World screen inside 30 seconds (unaided, on camera, timestamp visible).
3. **0:45-1:30** — Two Echoes (yours + a friend's, or yours + a seeded NPC) meet on the map, live, in two separate browser tabs/devices side by side, no refresh.
4. **1:30-2:00** — Return screen: read the receipt/transcript of what your Echo said and did.
5. **2:00-2:30** — Correct screen: change one instruction, show the next meeting reflects it.
6. **2:30-2:50** — Quick cut to the SpacetimeDB module: show the tables (`player`, `echo`, `meeting_receipt`) and one reducer live in the dashboard, proving the module is doing real work, not a client-side mock.
7. **2:50-3:00** — One-liner + link on screen, end.

## Pre-freeze verification checklist (run before 08:30)

- [ ] Fresh phone, mobile data (not wifi), full flow start to finish
- [ ] Two browser tabs open simultaneously, action in one shows in the other under 1 second, no refresh
- [ ] 10 distinct users have Echoes live in the world (check `player` table row count on Maincloud)
- [ ] Maincloud module creation timestamp confirmed to be after Saturday 14:00
- [ ] Email actually lands in a real inbox (not just a 200 response) — re-run the curl test from `EMAIL.md`
- [ ] Repo is public
- [ ] Live URL, repo URL, and demo video link all present and correct in the launch post
- [ ] No commits pushed after 08:30

Sources: rubric, schedule, and qualifiers taken from `/Users/jay/Documents/echo/docs/HANDBOOK.md` (chapters 03 and 06), retrieved from https://worldtour.spacetimedb.com/handbook.
