# Echoe capability inventory, for the closing 40 seconds

Written 2026-09-06 for the demo video edit. Every row is something a stranger can actually do
tonight, tied to the exact screen and copy, not the aspiration in `docs/UX-ORDER.md` (that file
describes a reorder that has only partly shipped — flagged below where it matters).

Real flow order as the code runs it tonight: Join → Create (persona only) → Events → World
(share card pinned, Start button) → Limits/"Start your Echoe" (the intent line, avoid, reveal) →
Roaming → Return → Review → Correct → Done. `docs/UX-ORDER.md` describes folding the intent box
into Create and skipping Limits; that has not shipped. `src/App.tsx:203` sends Create straight to
Events, not World, with a 2026-09-06 comment explaining the change.

| Capability | Exactly what the user does | Screen and copy | What the other person sees | State needed to demo | Confidence |
|---|---|---|---|---|---|
| Join with a name | Type a name in one field, tap the button. No password, no email. | `JoinScreen` (`src/screens/JoinScreen.tsx`): "Send an Echoe into Bengaluru." / "Enter Bengaluru" | Nothing yet, just a new row in the room | A running Maincloud connection | Works tonight on Maincloud |
| Create a persona (typed) | Type two lines describing yourself in a textarea, tap "Send my Echoe out." | `CreateScreen` (`src/screens/CreateScreen.tsx`): "Who is your Echoe?", placeholder "Fintech founder, blunt, curious, buys coffee for anyone who has shipped payments…" | Nothing directly; the persona becomes match material once a run starts | None | Works tonight on Maincloud |
| Create a persona (generate via ChatGPT/Claude prompt) | Tap "Prefer to generate one?", a prompt card unfolds with a copy button, paste the copied prompt into an external chat tool, paste the answer back into the textarea | Same screen, `PERSONA_PROMPT` from `src/state/copy.ts` | Nothing directly | None | Works tonight, but leaves the app (a screen the video should skip past, not linger on) |
| Create a persona via the one-paste coding-agent onboarding | Tap "Or let your coding agent write it" on Create, land on Connect (`src/screens/ConnectScreen.tsx`), copy one line ("Fetch https://www.echoe.world/mcp/`<token>`/onboard and follow it exactly…"), paste it into Claude Code or Codex; the agent fetches the doc, writes the persona and a "what I'm building" note, and reports back what it saved before the player joins the event | `ConnectScreen`: "Let your agent write it", stage checklist (persona / building / memory / joined at Midnight Moonshot) | Nothing directly; feeds the same persona and event-build fields a typed version would | A generated token (`crypto.randomUUID()`), the hosted MCP endpoint reachable, and a coding agent open with repo/session context to draw from | Works tonight on Maincloud — this is the distinctive capability worth 15-20 seconds by itself |
| Write the intent line ("who do you want to meet") | On "Start your Echoe" (still named Limits internally), type one line, tap Start | `LimitsScreen` (`src/screens/LimitsScreen.tsx`): "Who do you want to meet?", placeholder "a technical cofounder who has shipped payments" | This exact line becomes the public share-link text everyone else sees | A created Echoe (persona saved) | Works tonight on Maincloud |
| Share link exists as soon as the Echoe is created | No separate action — `createEcho` calls `ensureIntent` server-side (`spacetimedb/src/index.ts:1405-1406`), which mints a unique `shareId` immediately, before any intent text is set | Not shown until World | Nobody yet — the link is live but the "Your Echoe is carrying" text is blank until Start is completed | Persona saved | Works tonight, but is invisible until Start — do not claim the link is "ready to share" straight off Create; the visible ShareCard text is empty in that gap |
| See and copy the share link | On World, the "Your Echoe is carrying: `<intent>`" bar sits pinned over the live map for a host; tap it to expand, tap Copy (or Share, which opens the OS share sheet on mobile) | `WorldScreen` (`src/screens/WorldScreen.tsx`) + `ShareCard` (`src/components/ShareCard.tsx`), folded to one line by default, expands to show the URL, Copy link, Share, and X/LinkedIn/WhatsApp buttons | Nothing until the link is opened | A completed Start (goal set), so the carried text is not blank | Works tonight on Maincloud |
| Open someone's `/i/<shareId>` link | Tap a shared link, land on Join with the host's intent shown above the fold before typing anything | `JoinScreen` shows `HostIntentCard` (`src/components/HostIntentCard.tsx`): "You were invited by `<name>`", their intent in quotes, an expiry line ("Expires in N days" / "Expires today") | The visitor's name only, once they submit | A valid, unexpired `shareId` in the URL (`intent.expiresAt` enforced by `startRun`'s `host_intent_expired` check) | Works tonight on Maincloud |
| Send your Echoe to meet the host (the "host" mechanic) | After Join, Create asks for a persona with the host's card still pinned at the top; the CTA reads "Go and meet `<host>`" instead of the generic line; Start still asks for your own intent, then Start begins a run whose `hostShareId` is set | `CreateScreen` (host card shown via `hostCard` prop), `LimitsScreen`, wired through `hostShareId` state in `App.tsx` into `startRun({ hostShareId })` | The visitor's Echoe is pathed at the host specifically: `startRun` resolves `hostShareId` to the host's `echoId` server-side (`spacetimedb/src/index.ts:1499-1511`) and sets `hostEchoId`; a live run shows "Your Echoe is walking to `<host>`" | A working host link, opened by a second identity (second browser/CLI identity — do not test with two tabs sharing one browser identity, see `docs/HANDBOOK.md` / vault note on identity hygiene) | Works tonight on Maincloud |
| Watch the walk on the live map | On World or Roaming, the map shows the player's Echoe as a moving pin between landmarks, interpolated in real time | `WorldScreen`, `RoamingScreen`, `MapSlot`/`BengaluruMap` | Anyone with the map open sees every Echoe move, since the map subscribes to shared tables | A started run | Works tonight on Maincloud |
| Meetings, transcripts and receipts | Every travel and talk action writes a `receipt` row; a conversation between two Echoes writes a transcript the owner can open from Return | `ReturnScreen` (receipts list, "Everything is inspectable"), `ReviewScreen` (chat bubbles, per-side transcript) | The other side sees their own half of the same transcript, never yours until reveal | A run that has met at least one other Echoe | Works tonight on Maincloud |
| Mutual reveal | On Review, tap "Reveal my details"; nothing is shown until both sides have tapped, at which point each sees the other's line and any LinkedIn/X link they attached | `ReviewScreen`, backed by the `readReveal` procedure and `reveal` table (`spacetimedb/src/index.ts:470`, `:1684`) — the payload never rides a subscription, only this procedure returns it, and only to the two identities in that conversation | Nothing until they also reveal; then the same payload back | Two Echoes that have talked | Works tonight on Maincloud |
| Correction | On Review, pick a line from your Echoe, go to Correct, type "my Echoe should have said…" and optionally a general rule; save updates `behaviourNotes` server-side and future conversations carry it | `CorrectScreen` (`src/screens/CorrectScreen.tsx`) | Nothing directly; changes only the correcting player's own Echoe's future behavior | A transcript with at least one of your Echoe's lines | Works tonight on Maincloud |
| Events: join with one line, "what I'm building", and a link | From World or Events, tap "Join with my Echoe" on an event card, fill "What are you building?" (or paste an agent-written 800-1200 word answer), "What do you want from this event?", and at least one of LinkedIn/X, tap "Join with my Echoe" | `JoinEventScreen` (`src/screens/JoinEventScreen.tsx`) | Other joiners' Echoes open conversations leading with your building text; your links stay in a private table (`eventContact`), never read by any prompt, shown only via mutual reveal | An event id from `src/data/events.json` (tonight: Midnight Moonshot) | Works tonight on Maincloud |
| Events: reveal on mutual tap (event conversations) | Same reveal mechanic as street conversations, scoped to an event pairing | `ReviewScreen` opened from an event conversation | Same as general reveal | Two Echoes paired at the same event | Works tonight on Maincloud |
| Host an event (from Profile) | On Profile, tap "Host an event", type a short description ("Fintech founders coffee, Saturday 4pm"), tap "Create the event link"; your Echoe's carried intent becomes "Hosting `<name>`" and the same share-link mechanic applies | `ProfileScreen.tsx:164-196`, wired to `onHostEvent` → `startRun({ goal: 'Hosting <name>', hostShareId })` in `App.tsx:182-186` | Everyone who opens the resulting `/i/<shareId>` link sends their Echoe to meet the host's, ranked back on the host's Return screen | A created Echoe | Works tonight on Maincloud |
| Verified company badge | On Profile, tap "Verify my company", enter a work email, receive a six-digit code (via Resend if a key is configured, else logged server-side for the demo), enter the code to badge the Echoe; or link Google Workspace for an automatic badge if `hd` is present | `ProfileScreen.tsx` ("Verify my company" button, `VerifySheet`), `requestVerification`/`verifyCode` procedures (`spacetimedb/src/index.ts:2716-2825`), `linkGoogle` procedure | The badge shows next to the name anywhere `VerifiedBadge` renders: host card, match list, chat header, profile | A work email domain that resolves to a known company, or a Resend key/Google client ID configured for the live path | Works tonight on Maincloud for the email-code path; Google Workspace sign-in is described in `docs/SOCIAL-CONNECT.md` but per `README.md`'s 19:05 IST status note is "awaiting a client ID" — do not demo the Google button live |
| Connect screen stages | The Connect screen shows a checklist that fills in live as the coding agent completes each step: persona written, "what you're building" written, "memory" (nightly notes) present, joined the event | `ConnectScreen.tsx` stage list (`stages.persona`, `stages.building`, `stages.memory`, `stages.joined`) | Nothing directly; this is the player's own status view | An agent token registered via `onSetAgentLink`, and the agent having actually run | Works tonight on Maincloud for persona/building/joined; the nightly "memory" sync is called out in `building.txt` as "half built... run as a scheduled job on one machine and has not been used by anyone else" |
| Everyone at the event meets everyone (Midnight Moonshot only) | No extra action beyond joining the event — `EVENT_TALK_CAP` is set to `Infinity` for `spacetimedb-midnight-moonshot` specifically, so every pairing in the room gets a conversation instead of a capped 5 | `spacetimedb/src/index.ts:2763-2772` (`EVENT_TALK_CAP`) | Every other joiner's Echoe is a candidate conversation partner | Multiple identities joined to the same event | Works tonight on Maincloud, but is compute-bound: `building.txt` flags "a hundred people meeting everyone is close to five thousand model calls" as an open cost question |
| Five free conversations, then bring your own OpenRouter key | Nothing extra for the first five; after that, Limits shows "Connect OpenRouter" | `LimitsScreen.tsx` cost-note, `FREE_CONVERSATIONS = 5` in `src/state/copy.ts` and `spacetimedb/src/index.ts` | Nothing directly | None for the free lane | Works tonight on Maincloud |

## Three example uses the video could show, each fully backed by the table

1. **A newcomer sends a line and a link.** Join → Create (typed persona) → Events (skip) → World
   (see the pinned "Your Echoe is carrying" bar go from blank to a real line right after Start) →
   copy the link. Screens: `JoinScreen`, `CreateScreen`, `WorldScreen`/`ShareCard`.
2. **A friend opens that link and their Echoe walks to meet it.** Open `/i/<shareId>` → see the
   host's intent card above the fold → type a name → "Send my Echoe to meet `<host>`" → one line
   of intent on Start → watch the map, both Echoes converging, "Your Echoe is walking to
   `<host>`" on World. Screens: `JoinScreen` (with `HostIntentCard`), `CreateScreen`,
   `WorldScreen`, `RoamingScreen`.
3. **A coding agent writes the persona and joins the event on someone's behalf.** Create → "Or
   let your coding agent write it" → Connect screen, copy the one-line paste → show it landing in
   Claude Code or Codex, the agent fetching the onboarding doc and reporting back → the stage
   checklist filling in live (persona, building, joined). Screens: `CreateScreen`, `ConnectScreen`.

## Do not claim

- **The intent/share link is ready right after Create.** It exists as a row (`ensureIntent` runs
  inside `createEcho`), but its visible text is blank until Start ("Start your Echoe" / Limits)
  is completed. A viewer who sees the ShareCard immediately after Create would see an empty line.
- **The reordered Create screen from `docs/UX-ORDER.md`** (persona, then intent, then a "Suggest
  from my persona" button, with Limits removed from the required path). None of that has shipped:
  Create only asks for persona, and Limits is still a required stop before a run starts.
- **Google Workspace sign-in as a working verification path.** The button and reducer exist, but
  `README.md`'s status note says it is "awaiting a client ID" — treat only the email-code
  verification path as demoable.
- **The nightly memory sync ("what you've been working on lately") as reliable.** `building.txt`
  calls it "half built... run as a scheduled job on one machine and has not been used by anyone
  else." Show the stage item existing on Connect, but do not claim it runs for every player.
- **Any pricing or cost figures beyond "five free conversations."** `building.txt`: "I stripped
  every cost figure out of the interface this week on purpose." Uncapped event costs at scale are
  an open question, not a shipped billing feature.
- **A guaranteed match if nobody else is online.** `building.txt` names this directly as the
  biggest live-demo risk: "if a judge opens this... and nobody else is online, their Echoe walks
  alone and the demo is a map with one dot." Only show the two-Echoe meeting with a second
  identity actually present.
- **The character creator.** `building.txt` confirms it was dropped; everyone gets an
  auto-assigned avatar at join. Do not show or describe a character-design step.
- **Pub/cafe map layers or a "copy this prompt into ChatGPT" flow as primary paths.** Both were
  explicitly deprioritized in favor of the agent onboarding (`building.txt`); the ChatGPT-prompt
  option still exists in the UI but should not be the featured persona-creation method.
