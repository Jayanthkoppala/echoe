# Echoe voice script, one story, four modules

One narrator (Eric-style, male, calm, quick). ~210 words, ~1:30. Every line has a screen; no line
waits for a screen. Ticks on taps, a whoosh on every screen change, nothing else. The phone is the
only thing in frame except the opener and the two title beats. "Echoe" is spelled "Echo" in TTS text.

## Module 1, 0:00-0:18, DONE (block1/renders/block1.mp4)

| # | Voice | Screen |
|---|---|---|
| 1 | I have seen this hackathon happening. Fifty percent of the people never even interacted with the person sitting behind them. | Room of seats, half go dark, 50% |
| 2 | So I built Echoe. Your Echoe is an agent that adapts your persona, how you talk, how you behave, and goes and does the talking for you. | Persona typed, Connect stages tick |
| 3 | For this hackathon I made a networking event. | Midnight Moonshot banner, join form |

## Module 2, 0:18-0:46, the room (the foundation)

| # | Voice | Screen |
|---|---|---|
| 4 | Everyone opens it, drops in their persona, and their Echoe walks in with what they are building, what they want, and their socials. | Join form: building, goal, link typed fast; "You're in" |
| 5 | This is the base of the whole thing. One agent talks to another agent, and understands it. | Map: dots converge at the event, talk panel opens |
| 6 | Every Echoe in the room talks to every other Echoe. Four exchanges each, in your voice, while you keep coding. | Exchanges landing one by one, punch in on the bubbles |
| 7 | Then it comes back with who you match, why, and what you can get from that person. | Talks / Return: ranked people, the why line, the summary |
| 8 | Socials show only when both of you say yes. | Two phones, both tap Reveal, both links appear |

## Module 3, 0:46-1:12, one room is one vertical

| # | Voice | Screen |
|---|---|---|
| 9 | See, the hackathon is one vertical. At the end of the day this is an intent-based connections platform. | Title beat on black, lime |
| 10 | Imagine an investor who wants ten founders shipping realtime this month, not a hundred cold pitches. She types that once, posts the link on X, and her Echoe meets every founder who taps it. | Start screen: the line typed, carrying bar, Copy link, a second phone opens the link |
| 11 | Someone new to the city wants two people to have lunch with. Someone wants a cofounder who can sell. Someone, honestly, wants a date. | Three quick cuts of the goal field, each line typed |
| 12 | Type what you want. Your Echoe goes and gets it, and comes back with names. | Map walk, Return ranked list |

## Module 4, 1:12-1:30, what is next, close

| # | Voice | Screen |
|---|---|---|
| 13 | Next: many events at once. Virtual networking rooms. Virtual parties. Your Echoe in all of them while you sleep. | Title beat: three lines land one by one, lime |
| 14 | Anyone can create one. Anyone can share it. Send yours out tonight. | Carrying bar, Copy link, echoe.world wordmark, black |

## Rules for every module
- 1920x1080, 30 fps, the block1 composition is the template (ground, vignette, phone at 520 px, stamps left, SFX).
- Recordings: Playwright, viewport 960x1864 with the page zoomed 2x and tours off, cropped to the 860 px card (crop=860:1864:50:0).
- Map moments only after tiles have loaded (4.5 s after load). No tour popovers.
- Punch-ins 1.16 to 1.22, one per action, settle and hold, never bounce.
- Audit before delivery: freezedetect (no stretch over 0.8 s), blackdetect (none), a 2 fps tile sheet reviewed by eye, both phone edges visible.
