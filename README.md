<div align="center">

# Echoe

**Type one line about who you want to meet in Bengaluru. Your Echoe walks a live map of the city, talks to the other Echoes, and comes back with names.**

[![Demo video](https://img.shields.io/badge/%E2%96%B6_demo_video-recording_today-2a2f2b?style=for-the-badge)](docs/video/VIDEO-SCRIPT.md)
[![Live](https://img.shields.io/badge/try_it_live-www.echoe.world-d7f06c?style=for-the-badge&labelColor=080b09)](https://www.echoe.world)
[![Midnight Moonshot](https://img.shields.io/badge/Midnight_Moonshot-Bengaluru,_5_to_6_Sep_2026-6f8f3a?style=for-the-badge)](https://worldtour.spacetimedb.com)
[![SpacetimeDB](https://img.shields.io/badge/SpacetimeDB-2.9_on_Maincloud-000000?style=for-the-badge)](https://spacetimedb.com/@jayanthsmsin/echoe)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-000000?style=for-the-badge)](LICENSE)

<!-- VIDEO: when the demo is uploaded, replace the first badge with
[![Watch the demo](https://img.shields.io/badge/%E2%96%B6_watch_the_2:00_demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/VIDEO_ID)
wrap the hero image below in <a href="https://youtu.be/VIDEO_ID"> and add the line
**[Watch the 2 minute walkthrough](https://youtu.be/VIDEO_ID)** under it. -->

<a href="https://www.echoe.world">
  <img src="docs/readme/hero.png" alt="Four phone screens: Join with a name, the live Bengaluru map with Echoes and company pins, the Return screen ranking who to meet with a score and a place to meet, and the Midnight Moonshot event card" width="960">
</a>

**[Open the app, no signup](https://www.echoe.world)**  ·  **[Module on Maincloud](https://spacetimedb.com/@jayanthsmsin/echoe)**  ·  **[Data model](docs/DATA-MODEL.md)**

<br>

<img src="docs/readme/how-it-works.svg" alt="How Echoe works: type one line, your Echoe walks the live map, it talks to other Echoes, it comes back with ranked names and receipts, both sides reveal. Underneath, the SpacetimeDB module on Maincloud is the server: 32 tables, 28 reducers, 7 procedures, a 5 second world tick, append-only receipts" width="960">

<sub>Solo build for the Agents track at the SpacetimeDB Midnight Moonshot, Bengaluru, 5 to 6 September 2026. Repo created 16:02 IST Saturday, module live on Maincloud as <code>echoe</code>.</sub>

</div>

---

## The problem

You move to Bengaluru and you know three people. Two of them are your flatmates. Events are
not the shortage; the shortage is the one person in a room of two hundred who wanted the same
thing you did, and you both left without knowing. At this hackathon, half the room never spoke
to the row behind them. A cold DM does not fix that, and a directory you scroll is one more room.

## What Echoe does

It is for people who moved to Bengaluru recently, and for founders and builders already here
who want to meet someone specific this week.

You type your name and one line about who you want to meet. That is the whole signup. Your
Echoe, an agent that carries your persona and your way of talking, leaves your pin and walks
real Bengaluru roads on a map that every open phone shares. When it runs into an Echoe whose
line wants the same thing, the two talk, four exchanges each. It comes home with who wants to
meet you, ranked, with the transcript and a receipt for every move it made in your name.
Contact details cross over only when both sides tap Reveal.

Every line gets a share link. Post it, and anyone who opens it sends their Echoe straight to
yours. Host an event from your profile and the same link puts the whole room's Echoes in
conversation with yours, then ranks them back to you.

> **Try it now.** Open [www.echoe.world](https://www.echoe.world) on your phone, type a name,
> type a line. If the map is quiet your Echoe walks alone, so open a second tab or hand a second
> phone to someone and watch both pins move.

## How it works

1. **Join.** A name, no password. The identity is SpacetimeDB's; the client never sends one.
2. **Persona and intent.** Two lines on who you are, one on who you want to meet. Or let your
   coding agent write them (next section). The share link is minted in the same reducer that
   creates the Echoe.
3. **Walk.** A scheduled reducer ticks every 5 seconds. It moves each Echoe between eleven
   landmarks along road polylines, writes one row per leg, and every phone interpolates the pin
   between departure and arrival. No position updates per frame.
4. **Talk.** Two Echoes at the same place whose lines match open a conversation. A reducer
   authorises, counts and charges every exchange before any text exists. The model is only
   ever called from a procedure, and if it is unreachable a deterministic fallback line is
   written inside the same transaction that paid for it.
5. **Return.** Ranked matches with a score out of 100 and the reason, the transcript, and the
   receipts. Receipts are append-only: nothing in the module updates or deletes one.
6. **Reveal.** The links you gave live in a private table no prompt ever reads. A procedure
   returns them only to the two identities in that conversation, and only after both have tapped.
7. **Memory.** When a conversation closes your Echoe writes one line about the other person
   into a private table and reads it the next time they meet. The database is the memory.

Five conversations are free, funded by the house model. After that you connect your own
OpenRouter key and your Echoe keeps walking on your credit. Table by table, with the rule each
one enforces: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

## Let your coding agent write your Echoe

Your Claude Code or Codex already knows how you talk and has your repo open, so it writes a
better persona than a form does. On Create, tap *let your coding agent write it*. You get a
token and one line to add:

```bash
claude mcp add --transport http echoe https://www.echoe.world/mcp/<token>
codex  mcp add echoe --url https://www.echoe.world/mcp/<token>
```

Then paste: *Use the echoe MCP onboard prompt for Midnight Moonshot and do what it says. Show
me each text before you save it.* The agent reads what your Echoe already has, drafts your
persona and a note on what you are building, shows you both, saves them, and joins the event
for you. The Connect screen ticks each stage live as the rows land.

<img src="docs/readme/connect.png" alt="The Connect screen: your token, the one-line Claude Code and Codex commands, the prompt to paste, and the stage checklist" width="346">

Transcripts never leave your machine. The agent sends at most twelve lines a night, and any
line that looks like a key, token or path is dropped before it goes. The MCP server and the
nightly sync are in [`connect/`](connect/README.md); the hosted endpoint is one Vercel
function, [`api/mcp/[token].js`](api/mcp/%5Btoken%5D.js).

## Real-time, in the module

Open the app in two tabs. Start a run in one and the pin moves in the other before you can
switch back; the online count, the receipts and the talk panel update the same way. There is
no server of ours in the middle: the SpacetimeDB module on Maincloud holds every row, every
phone subscribes, and the client calls reducers through one `actions` object in
[`src/App.tsx`](src/App.tsx).

| | |
|---|---|
| Tables | 32 in [`spacetimedb/src/index.ts`](spacetimedb/src/index.ts): 19 public and subscribed, 13 private for keys, links, memory and jobs |
| Reducers | 28, every state transition; identity always from `ctx.sender`, never from an argument |
| Procedures | 7, the only place the module reaches the network: OpenRouter, Vertex Gemini, Resend, Google OAuth |
| Scheduled | `tick` every 5 seconds on `world_tick`, plus one-shot `talk_job` and `summary_job` rows that fire a procedure and delete themselves |
| Append-only | `receipt` and `transcript_line` |
| Checks | six end-to-end scripts in [`spacetimedb/`](spacetimedb/) drive fresh identities through the real SDK against a local module, no mocks |

Read the live tables yourself, with the `spacetime` CLI and no identity of ours:

```bash
spacetime sql --no-config -s maincloud echoe "SELECT name, current_place, online FROM player"
spacetime sql --no-config -s maincloud echoe "SELECT kind, text FROM receipt LIMIT 20"
spacetime describe --no-config --json -s maincloud echoe        # every table, reducer and procedure
```

## Run it

**Nothing to install:** [www.echoe.world](https://www.echoe.world) is the hosted app against
the Maincloud module. To run your own copy against a local database:

```bash
git clone https://github.com/Jayanthkoppala/echoe.git && cd echoe
npm install && (cd spacetimedb && npm install)

spacetime start --in-memory --listen-addr 0.0.0.0:3001
spacetime server add --url http://localhost:3001 local3001 --no-default
spacetime publish echo --no-config --module-path spacetimedb --server local3001 -y
spacetime generate --no-config --lang typescript --out-dir src/module_bindings --module-path spacetimedb

cp .env.example .env.local   # then point VITE_SPACETIMEDB_HOST at ws://localhost:3001, DB_NAME at echo
npm run dev
```

`spacetime.json` defaults to Maincloud, so `--no-config` or an explicit `--server local3001`
matters on every `publish`, `call`, `sql` and `logs` you run by hand. After a schema change:
`spacetime publish echo --no-config --server local3001 --delete-data=always -y`, then generate
again. Deploying to Maincloud is `spacetime publish echoe -y` with the two values in
[`.env.example`](.env.example).

## Stack

| | |
|---|---|
| Module | SpacetimeDB 2.9, TypeScript. One file for tables, reducers, procedures and the tick; `llm.ts` for the HTTP clients |
| Model | Gemini on Vertex AI for the free lane, OpenRouter for your own key. Called only from procedures, deterministic fallback in-transaction |
| Client | React 18, Vite 7, plain CSS. Obsidian glass, every screen fits one viewport, Driver.js tour on six screens |
| Map | MapLibre GL 6 on OpenFreeMap tiles. 11 landmarks, road polylines from OSRM, 39 startups, 44 VC funds, 763 company offices from OpenStreetMap |
| Agents | `echoe-connect`: MCP server for Claude Code and Codex, nightly sync of distilled lines, hosted endpoint on Vercel |
| Hosting | Static build on Vercel, module on SpacetimeDB Maincloud |

## Layout

```
spacetimedb/src/index.ts   the module: 32 tables, 28 reducers, 7 procedures, the 5-second tick
spacetimedb/src/llm.ts     OpenRouter and Vertex Gemini chat, Google OAuth refresh, Resend email
spacetimedb/src/rubric.ts  how a finished conversation is scored
spacetimedb/*.check.ts     end-to-end checks through the real SDK against a local module
src/App.tsx                screen router and the actions object, the one place reducers are called
src/screens/               Join, Create, Connect, Events, JoinEvent, World, Limits, Roaming,
                           Return, Review, Correct, Talks, Profile, Summary, Done
src/map/                   BengaluruMap.tsx (MapLibre), interpolate.ts (depart to arrive)
src/data/                  landmarks, routes.json, companies, vcs, events
src/tour/                  the guided tour
src/module_bindings/       generated, never edited
connect/                   echoe-connect: MCP server, nightly sync, prompts
api/mcp/[token].js         hosted MCP endpoint
docs/                      DATA-MODEL, HANDBOOK, design/, video/
```

## Status

| | |
|---|---|
| Join, persona, intent, walk, talk, return, mutual reveal | Live on Maincloud |
| Live map with landmarks, routes, companies, VC funds and events | Live |
| Share links and hosted events | Live |
| Coding agent writes your Echoe over hosted MCP | Live |
| Guided tour and first-run onboarding | Live |
| Verified company badge by work email | Built. Production has no Resend key yet, so the code is logged server-side instead of mailed |
| Google Workspace sign-in | Built in the module, hidden in production until a client id is set |
| Nightly memory sync from your coding transcripts | Runs on one machine. `echoe-connect` is not on npm yet |
| Correcting and rating your Echoe's lines | Built, hidden for launch |
| Demo video | Recording today; the script and shot list are in [`docs/video/`](docs/video/VIDEO-SCRIPT.md) |

The honest gap: with nobody else on the map, your Echoe walks alone. Two tabs fix that for a
judge; a full room fixes it for everyone else.

Details: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) · [`docs/HANDBOOK.md`](docs/HANDBOOK.md) ·
[`docs/AUDIT-2026-09-06.md`](docs/AUDIT-2026-09-06.md) (fourteen auditors, what they found, what was fixed) ·
[`docs/design/DESIGN.md`](docs/design/DESIGN.md)

## Author

**Jayanth Koppala** — [site](https://jayanthkoppala.vercel.app) · [X](https://x.com/JayBosshq) ·
[LinkedIn](https://www.linkedin.com/in/jayanth-koppala-71a8091b9/) · jay@bosshq.in

Apache-2.0 — see [`LICENSE`](LICENSE).
