# Echoe demo video, 2:00

Assembled 2026-09-06 from `narration-v2.md` (voiceover arc), `tagged-v2.md` (on-screen column and
shot list), `capabilities.md` (what the build actually does, and the do-not-claim list),
`examples.md` (the three typed lines, verbatim), and `VIDEO-SCRIPT-v1.md` (format, hook, record
order). It follows the handbook demo rules: the problem in one line, the product working with
people in it, no slides, under three minutes. Nothing is shown beyond what runs tonight. Rating
and correction are hidden in the app tonight, so both correction beats are cut from the
voiceover.

Voiceover: **256 words**, about **1:50** of speech at 140 words per minute, inside 2:00 with room
to breathe.

## Hook, first nine seconds

Used below, Jay's own line: "I have seen this hackathon happening. Fifty percent of the people
never even interacted with the person sitting behind them."

Two alternates if the first feels flat on camera:

- "The main reason of a hackathon is networking, and most of this room is going to leave without
  doing it."
- "It's 3 a.m., headphones on, and the person two seats away is still a stranger. That is every
  hackathon."

## The script

| Time | On screen | Voiceover |
|---|---|---|
| 0:00-0:09 | Camera, in the room. Jay at his desk, laptop open, builders behind him heads down. He turns to the row behind. | I have seen this hackathon happening. Fifty percent of the people never even interacted with the person sitting behind them. |
| 0:09-0:19 | Camera, in the room. Hold on Jay. Two people at the same table working in silence behind him. | See, the main reason of the hackathon is networking. So I am taking that heavy lifting and giving it to agents. |
| 0:19-0:26 | Phone screen. `JoinScreen`: "Send an Echoe into Bengaluru.", name field placeholder "Type your name", name typed, tap "Enter Bengaluru." [cap: Join with a name] | You just join the event, and your agent goes and talks with the other participants. |
| 0:26-0:33 | Phone screen. `CreateScreen`: "Who is your Echoe?", persona textarea, placeholder "Fintech founder, blunt, curious, buys coffee for anyone who has shipped payments…", two lines typed, tap "Send my Echoe out." [cap: Create a persona (typed)] | Type a name, two lines about who you are. That is the whole setup. |
| 0:33-0:41 | Phone screen. `WorldScreen`/`RoamingScreen` live map at night, the player's pin leaving its landmark and walking a real road polyline between landmarks. [cap: Watch the walk on the live map] | It walks. Real Bengaluru roads, real landmarks. Your Echoe is a row in a database, moving. |
| 0:41-0:48 | Phone screen. Two pins converge on the map, the live talk view opens, the four exchanges land one at a time. [cap: Meetings, transcripts and receipts] | It runs into someone else's Echoe and the two talk. Four exchanges in your register. |
| 0:48-0:56 | Phone screen. `ReturnScreen`: "While you were gone" eyebrow, "Action receipts" / "Everything is inspectable" timeline. Cut to `ReviewScreen`, chat bubbles for that same conversation. [cap: Meetings, transcripts and receipts] | It comes home with the transcript and a receipt. Every line, in my name, I can read. |
| 0:56-1:07 | Phone screen. `JoinEventScreen` for Midnight Moonshot: "What are you building?" already filled from the agent onboarding, "What do you want from this event?" typed live, LinkedIn or X field, tap "Join with my Echoe." Cut to an event conversation opening on that building text. [cap: Events: join with one line, "what I'm building", and a link] | Tonight there is one event. I join with one line and a link. My Echoe opens with what I am building. |
| 1:07-1:13 | Phone screen. `LimitsScreen` ("Start your Echoe"): "Who do you want to meet?", placeholder "a technical cofounder who has shipped payments", one line typed, thumb on "Start." [cap: Write the intent line] | I write one line about who I want to meet. |
| 1:13-1:19 | Phone screen. `WorldScreen` right after Start completes: the pinned `ShareCard` bar "Your Echoe is carrying: `<intent>`" goes from blank to the typed line over the live map, tap to expand, tap "Copy link." [cap: Share link exists as soon as the Echoe is created; See and copy the share link] | That line goes on the map with a link anyone can tap. |
| 1:19-1:30 | Phone screen. `LimitsScreen` goal field, typed verbatim: "two people to have lunch with who also moved here this year", tap "Start." Cut to `ReturnScreen` next morning, ranked match list, each row with its score and `match.why`, a landmark named. [cap: Write the intent line; Meetings, transcripts and receipts] | Someone new to the city types, two people to have lunch with who also moved here this year. Ranked list in the morning. |
| 1:30-1:40 | Phone screen. `LimitsScreen` goal field, typed verbatim: "looking for someone who has run infra for a 50 person team", tap "Start". Cut to a second identity on a second device opening `/i/<shareId>`: `JoinScreen` with `HostIntentCard` showing that exact line, "You were invited by `<name>`", they type a name, `CreateScreen` CTA reads "Go and meet `<host>`", then their `RoamingScreen` walking straight to the host. [cap: Open someone's `/i/<shareId>` link; Send your Echoe to meet the host] | Someone posts, looking for someone who has run infra for a 50 person team. A stranger taps it, their Echoe walks straight there. |
| 1:40-1:49 | Phone screen, two devices. `LimitsScreen` goal field, typed verbatim: "a cofounder who can sell, I will not do the selling", tap "Start." Cut to both identities on `ReviewScreen` over the same transcript, two thumbs tap "Reveal my details" seconds apart, and each side's line and LinkedIn or X link appear. [cap: Mutual reveal] | Someone types, a cofounder who can sell, I will not do the selling. Both sides tap reveal and the links appear. |
| 1:49-1:55 | Laptop screen. `CreateScreen` → "Or let your coding agent write it" → `ConnectScreen`: "Let your agent write it", the "Paste this into Claude Code or Codex" copy block, pasted into a live Claude Code session, the agent fetching the onboarding doc, the stage checklist (persona / building / joined) ticking on its own beside it. [cap: Create a persona via the one-paste coding-agent onboarding; Connect screen stages] | Paste one line into Claude Code and it writes your Echoe while you keep coding. |
| 1:55-2:00 | Camera. Jay to camera, or a hand passing a phone with the `ShareCard` "Copy link" row open on screen. Cut to black. | Anyone can create one. Anyone can share it. Go send yours out tonight. |

## Shot list, in the order to record

| # | Shot | Captured on | Must be true in the app first |
|---|---|---|---|
| 1 | Jay at his desk, room behind him, turns to the row behind (0:00-0:19, one locked take) | Camera, in the room | Nothing. Shoot before 08:00 while the room is full and heads are down. |
| 2 | Join to Create: name typed, persona typed, "Send my Echoe out" (0:19-0:33) | Phone screen recording | A fresh identity (incognito profile or a fresh CLI identity) so Join is the first screen. |
| 3 | Events screen, Midnight Moonshot card, skip past it | Phone screen recording | Same session as shot 2, unbroken. Create sends straight to Events tonight. |
| 4 | Start your Echoe: the first example line typed, tap Start (1:07, 1:19) | Phone screen recording | The Echoe from shot 2. Type "two people to have lunch with who also moved here this year." |
| 5 | World: ShareCard goes blank to real line, expand, Copy link (1:13) | Phone screen recording | Shot 4's Start just completed. Do not roll before Start finishes, the bar reads blank. |
| 6 | Roaming: the Echoe walking the map (0:33) | Phone screen recording | App foregrounded, MapLibre pauses when hidden. At least four other Echoes out so it is not one dot. |
| 7 | Two Echoes meet, four exchanges land (0:41) | Phone screen recording | Two Echoes mid-run and pathed to cross. Model key live. Record the whole meeting once and trim, never stage it twice. |
| 8 | Return: recap, ranked match list, receipts timeline (0:48, 1:19) | Phone screen recording | The run from shot 7 finished, matches non-empty, receipt rows present. |
| 9 | Review: transcript, both sides tap "Reveal my details", links appear (1:40) | Phone screen recording, two devices | **Needs a second real person.** A conversation neither side has revealed yet, and the other identity ready to tap on cue. |
| 10 | Events: "Join with my Echoe", building text pre-filled (0:56) | Phone screen recording | Not yet joined. The building field arrives filled by the agent run in shot 12, so only the goal line and the link get typed live. |
| 11 | Second identity opens `/i/<shareId>`, host card, walks to the host (1:30) | Phone screen recording, second device | **Needs a second real person or a second real identity on a separate device.** A fresh unexpired link from a completed Start using "looking for someone who has run infra for a 50 person team". Never a second tab on Jay's own browser profile. |
| 12 | Terminal paste, Connect screen ticking (1:49) | Laptop screen | A freshly generated token with every stage unticked. Claude Code signed in with the repo open, the hosted MCP endpoint reachable, Connect left open so it ticks by itself. |
| 13 | Closing beat: to camera, or a hand passing a phone showing Copy link (1:55) | Camera | Nothing. Shoot last. |

Thirteen shots. Shots 9 and 11 each need a second real person, or a second identity Jay controls
from a separate device, present and briefed before the camera rolls.

## Left out on purpose

- **Correction and rating.** Hidden in the app tonight. `ReviewScreen.tsx:43` voids
  `focusedId`/`onFocus` ("Rating and correction are hidden for now (Jay, 2026-09-06)"), no bubble
  is tappable, and nothing in `App.tsx` calls `go('correct')`. Both correction beats are out of
  the voiceover, and the Correct screen is out of the shot list.
- **Money.** No cost per conversation, no credits, no pricing. It came out of the interface this
  week and it stays out of the video.
- **The nightly memory sync.** It runs on one machine and nobody else has used it.
- **Google Workspace verification.** Awaiting a client ID per `README.md`. Do not let a camera pan
  land on "Verify with Google".
- **The "copy this prompt into ChatGPT" persona route.** It exists in the UI, but it leaves the
  app and the agent onboarding is the featured path.
- **Any number about scale.** The only figure spoken, fifty percent, is Jay's observation of this
  room, said as an observation.
- **The character creator.** It was dropped. Everyone gets an auto-assigned avatar at join.
- **The pub and cafe map layers and the company badge.** Both real, both a second story.

## Risks on the day

1. **Room empty when rolling shots 6 and 7.** One dot on the map, no meeting. Seed four or more
   CLI identities walking beforehand, or shoot the walk earlier while the room was full.
2. **No second person for shots 9 and 11.** Use two of Jay's own devices on separate browser or
   CLI identities. Never two tabs sharing one Chrome profile, they share the stored identity.
3. **Model key out of credit mid-recording.** The meeting in shot 7 comes back empty or falls back
   to canned text. Check the OpenRouter balance before rolling and keep a backup key ready.
4. **Rolling the ShareCard before Start completes.** The carried-intent line is blank on camera.
   Shot 5 only rolls after shot 4's Start has finished.
5. **A prepped share link expiring between prep and recording.** `startRun` enforces
   `host_intent_expired`. Mint the link fresh immediately before shot 11.
6. **The map going black or freezing.** Zero tiles means the dev server was not restarted after a
   config change, so confirm tiles load before any map shot. Backgrounding the recording tab
   pauses MapLibre mid-walk, so keep it foregrounded through shots 6, 7 and 11.

## Drafts

Everything in `docs/video`: `script-A-founder.md`, `script-B-judge.md`, `script-C-room.md`,
`VIDEO-SCRIPT-v1.md`, `capabilities.md`, `examples.md`, `narration-v2.md`, `tagged-v2.md`.
`script-B-judge.md` runs to 2:35 and carries the fullest mechanism explanation if a judge asks for
it in Q and A. `tagged-v2.md` holds the two flagged correction lines and the code change that
would unblock them.
