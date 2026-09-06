# Echoe demo video, narration v2 — product tagging

Built from `narration-v2.md` (267 words, voiceover locked), `capabilities.md` (19 rows), and
`VIDEO-SCRIPT.md` v1 (shot list, record order). Screen names and copy verified against
`src/screens/*.tsx` and `src/components/ShareCard.tsx` on 2026-09-06. Real flow order tonight:
Join → Create (persona only) → Events → World (share pinned, Start button) → Limits ("Start your
Echoe": intent, avoid, reveal) → Roaming → Return → Review → Correct → Done. Not one word of the
voiceover below is changed from `narration-v2.md`.

## Narration table

| Time | On screen | Voiceover |
|---|---|---|
| 0:00-0:09 | Camera, in the room. Jay at his desk, laptop open, builders behind him heads down. | I have seen this hackathon happening. Fifty percent of the people never even interacted with the person sitting behind them. |
| 0:09-0:18 | Camera, in the room. Hold on Jay. | See, the main reason of the hackathon is networking. So I am taking that heavy lifting and giving it to agents. |
| 0:18-0:26 | Phone screen. `JoinScreen`: "Send an Echoe into Bengaluru.", name field placeholder "Type your name", typed, tap "Enter Bengaluru." [cap 1] | You just join the event, and your agent goes and talks with the other participants. |
| 0:26-0:35 | Phone screen. `CreateScreen`: persona textarea, placeholder "Fintech founder, blunt, curious, buys coffee for anyone who has shipped payments…", two lines typed, tap "Send my Echoe out." [cap 2] | Type a name, two lines about who you are. That is the whole setup. |
| 0:35-0:43 | Phone screen. `RoamingScreen`/`WorldScreen` live map, the player's pin moving between landmarks along a real road polyline. [cap: Watch the walk on the live map] | It walks. Real Bengaluru roads, real landmarks. Your Echoe is a row in a database, moving. |
| 0:43-0:50 | Phone screen. Two pins converge on the map, the live talk view opens, exchange lines land one at a time. [cap: Meetings, transcripts and receipts] | It runs into someone else's Echoe and the two talk. Four exchanges in your register. |
| 0:50-0:58 | Phone screen. `ReturnScreen`: "Action receipts" / "Everything is inspectable" timeline, then `ReviewScreen` chat bubbles for the same conversation. [cap: Meetings, transcripts and receipts] | It comes home with the transcript and a receipt. Every line, in my name, I can read. |
| 0:58-1:06 | **Cannot be shown tonight — see flag 1.** Intended: `ReviewScreen`, tap a bubble, land on `CorrectScreen`, blockquote of the line, textarea placeholder "I would like to verify your side first.", tap "Update Echoe and close the loop." | This line is not me. I write what I would have said, and the next run carries it. |
| 1:06-1:11 | Phone screen. `JoinEventScreen` for Midnight Moonshot: "What are you building?" field already filled from the agent onboarding, "What do you want from this event?" field, one line typed, LinkedIn/X field, tap "Join with my Echoe." [cap: Events: join with one line] | Tonight there is one event. I join with one line and a link. |
| 1:11-1:15 | Phone screen. Second identity's conversation opens leading with the first identity's building text; both `ReviewScreen`s tap "Reveal my details." [cap: Events reveal on mutual tap] | My Echoe opens with what I am building. Both tap reveal. |
| 1:15-1:22 | Phone screen. `WorldScreen`/`ShareCard` right after "Start your Echoe" completes: "Your Echoe is carrying: `<intent>`" bar goes from blank to the typed line, tap to expand, tap "Copy link." [cap: Share link exists as soon as created; See and copy the share link] | After Start, the line goes on the map with a link. |
| 1:22-1:31 | Phone screen. `LimitsScreen` ("Start your Echoe"), goal field, typed: "two people to have lunch with who also moved here this year", tap "Start." Cut to `ReturnScreen`: "While you were gone" eyebrow, ranked match list with score and `match.why`. [cap: Write the intent line; Return recap] | Someone new to the city types, two people to have lunch with who also moved here this year. A ranked list in the morning. |
| 1:31-1:40 | Phone screen. `LimitsScreen` goal field, typed: "looking for someone who has run infra for a 50 person team", tap "Start" — this becomes the share-link text. Cut to a second identity's `JoinScreen` with `HostIntentCard` showing that exact line, tap the link, their `RoamingScreen` walking straight to the host's landmark. [cap: Send your Echoe to meet the host; Open someone's `/i/<shareId>` link] | Someone posts, looking for someone who has run infra for a 50 person team. A stranger taps it and their Echoe walks straight there. |
| 1:40-1:48 | Phone screen. `LimitsScreen` goal field, typed: "a cofounder who can sell, I will not do the selling", tap "Start." **Second half cannot be shown tonight — see flag 2.** | Someone types, a cofounder who can sell, I will not do the selling. Then marks a line as not me. |
| 1:48-1:54 | Laptop screen. `CreateScreen` → "Or let your coding agent write it" → `ConnectScreen`: "Paste this into Claude Code or Codex" copy block, pasted into a live Claude Code session, the agent fetching the onboarding doc, `ConnectScreen` stage checklist (persona / building / joined) ticking live. [cap: Create a persona via the one-paste coding-agent onboarding; Connect screen stages] | Paste one line into Claude Code and it writes your Echoe while you keep coding. |
| 1:54-2:00 | Camera or laptop. Jay to camera, or a hand passing a phone with the `ShareCard` "Copy link" row visible. | Anyone can create one. Anyone can share it. Go send yours out tonight. |

## Lines that cannot be shown as written

1. **0:58-1:06, "This line is not me. I write what I would have said, and the next run carries it."**
   `ReviewScreen.tsx:43` explicitly voids `focusedId`/`onFocus` ("Rating and correction are hidden
   for now (Jay, 2026-09-06)"), no bubble is tappable, and nothing in `App.tsx` ever calls
   `go('correct')` — the Correct screen exists but is unreachable from the running app tonight.
   Fix: re-enable the tap-to-focus in `ReviewScreen.tsx` and wire a button to `go('correct')` in
   `App.tsx` before recording — this is a revert of a same-day hide, not new work. If that can't
   land in time, the smallest wording fix is to cut the sentence to "This line is not me. I would
   have said it differently." (same word count, drops the false claim that the fix carries forward
   on screen) and cut the shot at 1:06.
2. **1:40-1:48, "...Then marks a line as not me."** Same root cause as flag 1. Fix: same
   re-enable. If not fixed, the smallest wording change is dropping the clause entirely — cut to
   "Someone types, a cofounder who can sell, I will not do the selling." (removes 5 words, over
   the 2-word budget, but there is no shorter true substitute once the tap does not exist).

Two lines flagged, both from the same unreachable Correct screen, both fixable with one code
change rather than a wording change.

## Shot list, in record order

| # | Shot | Capture | Must be true in the app before rolling |
|---|---|---|---|
| 1 | Jay at his desk, room behind him, turns to the row behind | Camera, in the room | Nothing. Shoot before 08:00 while the room is full and heads are down. |
| 2 | Join to Create: name typed, persona typed, Send my Echoe out | Phone screen recording | A fresh identity (incognito or a fresh CLI identity) so Join is the first screen. |
| 3 | Events screen, Midnight Moonshot card visible, skip past it | Phone screen recording | Same session as shot 2, unbroken. |
| 4 | Start your Echoe: type the first example intent, tap Start | Phone screen recording | A created Echoe from shot 2; use "two people to have lunch with who also moved here this year." |
| 5 | World: ShareCard goes from blank to the real line, expand, Copy link | Phone screen recording | Start from shot 4 just completed — do not roll on this screen before Start finishes, the bar reads blank. |
| 6 | Roaming: Echoe walking the map | Phone screen recording | App foregrounded (MapLibre pauses when hidden); at least four other Echoes already out so it is not one dot. |
| 7 | Two Echoes meet, exchanges land | Phone screen recording | Two Echoes mid-run pathed to cross. Model key live. Record the full meeting once, trim after. |
| 8 | Return: recap, ranked match list, receipts timeline | Phone screen recording | The run from shot 7 finished; matches non-empty, receipt rows present. |
| 9 | Review: transcript, both sides tap Reveal | Phone screen recording, two devices | A conversation neither side has revealed yet; needs a second real identity present and ready to tap on cue. |
| 10 | Correct: mark a line, save | Phone screen recording | **Blocked — see flag 1/2.** Only attempt if the Review tap and Correct route are re-enabled beforehand. |
| 11 | Events: Join with my Echoe, building text pre-filled | Phone screen recording | Not yet joined to the event; the "what I'm building" field arrives filled by an agent run beforehand (shot 13), so only the goal line and link get typed live. |
| 12 | Second identity opens a shared `/i/<shareId>` link, host card, walks to host | Phone screen recording, second device/identity | A fresh unexpired share link from a completed Start (shot 4's line, or a second one: "looking for someone who has run infra for a 50 person team"); opened by a second real identity, not a second tab on Jay's own browser. |
| 13 | Terminal paste, Connect screen ticking | Laptop screen | A freshly generated token with every stage unticked; Claude Code signed in with the repo open; the hosted MCP endpoint reachable; leave the Connect screen open so it ticks on its own. |
| 14 | Closing beat: to camera, or a hand passing a phone showing Copy link | Camera | Nothing. Shoot last. |

Fourteen shots. Shot 9 and shot 12 each need a second real person (or a second real identity
Jay controls from a separate device) present and briefed before the camera rolls; shot 10 is
blocked until the code fix in flag 1 lands.

## Risks on the day

1. Room empty when rolling shot 6/7 → one dot on the map, no meeting. Fallback: seed 4+ CLI
   identities walking beforehand, or shoot the walk earlier while the room was full.
2. No second person available for shots 9 and 12 → use two of Jay's own devices on separate
   browser/CLI identities, never two tabs sharing one Chrome profile (shared identity risk).
3. Correction flow has no live UI path tonight (flags 1-2) → re-enable before recording or drop
   shot 10 and reword those two lines.
4. Model key out of credit mid-recording → the meeting in shot 7 returns empty or fallback text.
   Check the OpenRouter/Vertex balance before rolling; keep a backup key ready.
5. Filming the ShareCard right after Create instead of after Start → the carried-intent text is
   blank on camera. Always roll shot 5 after Start completes.
6. A prepped share link expires between prep and recording → mint the link fresh immediately
   before rolling shot 12, don't reuse one from an earlier rehearsal.
7. MapLibre shows a black map with zero tiles if the dev server wasn't restarted after a config
   change → confirm tiles are loading before any map shot.
8. Backgrounding the recording tab pauses MapLibre mid-walk → keep it foregrounded through shots
   6, 7, and 12.
9. Reusing Jay's everyday Chrome for a "second person" mutates his own identity in the shared
   localStorage → use a separate CLI identity or a dedicated browser profile.
10. Camera pans across Profile and lands on "Verify with Google" → don't demo it live; it's
    awaiting a client ID per `README.md`.

**Report:** `/Users/jay/Documents/echo/docs/video/tagged-v2.md`. Two flagged lines, both fixed by
the same cause: 0:58-1:06 needs the Review tap-to-Correct path re-enabled (revert `ReviewScreen.tsx:43`
and wire a button to `go('correct')` in `App.tsx`) or reword to "I would have said it differently";
1:40-1:48 needs the same fix or drop the "marks a line as not me" clause. Fourteen shots in
record order.
