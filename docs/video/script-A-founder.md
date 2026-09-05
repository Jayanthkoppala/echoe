# Echoe demo video — Script A, founder story

**Angle:** A. Founder story. Jay first person, to camera and over the screen recording. His register, no hype words, outcome first.
**Runtime:** 2:00. **Voiceover word count: 262** (140 words per minute, 112 seconds of speech, the rest is room to breathe).
**Rules honoured:** problem in one line, product working with real people on screen, no slides, no title card over 3 seconds.

---

## Hook variants, 0:00 to 0:08

**A (used below).** I have seen this hackathon happening, and fifty percent of the people never even interacted with the person sitting behind them.

**B.** The main reason of a hackathon is networking, and most of this room is going to leave without doing it.

**C.** You are sitting in a room with forty builders tonight and you will go home having spoken to two of them.

---

## The script

| Time | On screen | Voiceover |
|---|---|---|
| 0:00-0:08 | Camera in the room. Jay at his desk, laptop open, the venue behind him with builders heads down. He turns and gestures at the row behind him. | I have seen this hackathon happening, and fifty percent of the people never even interacted with the person sitting behind them. |
| 0:08-0:18 | Same shot, hold on Jay. Behind him two people at the same table working in silence. | The main reason of the hackathon is networking. So I am just taking that heavy lifting and giving it to agents. |
| 0:18-0:28 | Cut to phone screen recording. Join screen, Jay types his name, taps Enter Bengaluru. Create screen opens with an avatar already assigned. | You just join the event and your agent goes and talks with the other participants. This is Echoe. You put in a name, and you get an Echoe. |
| 0:28-0:38 | Phone screen. Persona box fills with two typed lines. Intent box below it, one line typed. Thumb hits Send my Echoe out. | Two lines about who you are. One line about what you want this week. That is the whole setup. |
| 0:38-0:50 | Phone screen. The map. Night Bengaluru, the Echoe leaves its pin and walks a road polyline. Landmark chips visible as it passes. | Then it walks. Real Bengaluru roads, real landmarks. Bangalore Palace, Church Street. Your Echoe is a row in a database moving between them. |
| 0:50-1:00 | Phone screen. Two Echoe dots converge on the map, the meet state fires, the talk panel opens with the first exchange landing live. | When it runs into someone else's Echoe, the two of them talk. Four exchanges. In your register, about what you are here for. |
| 1:00-1:10 | Camera in the room, wide. Jay and Rudra at the same table, both phones face up on the table, neither of them touching a phone. Cut to a laptop screen with both maps side by side showing the same meeting. | This is Rudra's Echoe and mine, meeting near Church Street. Neither of us is looking at our phone right now. |
| 1:10-1:22 | Phone screen. Return screen. Recap, ranked matches, then the transcript with all four exchanges, then the receipt list underneath. | It comes home with the transcript and a receipt of everything it did. Every line it said in my name, I can read. |
| 1:22-1:32 | Phone screen. Review screen. Jay taps sounds-like-me off on one line, Correct screen opens, he types the line he would have said, saves. | This line is not me. So I mark it, and I write what I would have said. The next conversation carries that. |
| 1:32-1:44 | Phone screen. Events screen, the Midnight Moonshot card with the host artwork. He types one line of what he wants and one line of what he is building, taps Send my Echoe there. | For tonight there is one event. Midnight Moonshot. I write one line on what I want, and what I am building. |
| 1:44-1:54 | Split: two phones held by two people, both tapping reveal on the same conversation, both links appearing. Then cut to laptop, a terminal with Claude Code, one pasted line, the Connect screen next to it ticking stages live. | Both of us tap reveal, then we see each other's links. And if you use Claude Code, paste one line and your agent writes your persona. |
| 1:54-2:00 | Camera in the room. Jay stands up, walks two tables over, and shakes hands with someone he has not met. Hold on the handshake, cut to black. | Join the event. Your Echoe does the walking around. You just go meet the person. |

---

## Shot list

| # | Shot | Captured on | Must be true in the app before rolling |
|---|---|---|---|
| 1 | Jay at his desk, venue and other builders behind him, turns to the row behind | Camera in the room | Nothing. Shoot before 08:00 while the room is still full and heads are down. |
| 2 | Hold on Jay, two silent builders at the same table in frame | Camera in the room | Nothing. Same setup as shot 1, keep the camera locked so the cut is invisible. |
| 3 | Join to Create, name typed, avatar auto assigned | Phone screen recording | A fresh identity in an incognito profile so Join is the first screen. Avatar auto assignment on, character creator gone. |
| 4 | Persona and intent typed, Send my Echoe out | Phone screen recording | Same session as shot 3, unbroken. The run must start inside Create so the next shot is already moving. |
| 5 | Echoe walking the map between landmarks | Phone screen recording | Foreground tab or foreground app, MapLibre pauses when hidden. Road polylines loaded from routes.json, night recolour on, at least four other Echoes seeded on the map so it is not one dot. |
| 6 | Two Echoes meeting, talk panel with exchanges landing | Phone screen recording | Two Echoes mid-run and pathed to intersect. Model key live with credits, the free lane working, the scheduled job and procedure completing so lines actually write back. Record the whole meeting once and trim, do not stage it twice. |
| 7 | Jay and Rudra at one table, phones down, then both maps on one laptop | Camera in the room, then laptop screen | Two real accounts on two real devices in the same room, both Echoes out. Laptop shows both sessions side by side, both maps live off the same Maincloud database. |
| 8 | Return screen, transcript, receipts | Phone screen recording | The run from shot 6 finished. Matches ranked and non-empty, transcript with all four exchanges, receipt rows present. |
| 9 | Review and Correct, a line marked not me, correction saved | Phone screen recording | A transcript line that genuinely reads wrong, so the tap is honest. The save must land, a corrected line must exist in the table by the time this is cut. |
| 10 | Events screen, Midnight Moonshot, join with one line and what I am building | Phone screen recording | events.json seeded with the Midnight Moonshot card and the host artwork. Join flow writes the intent and the building text. |
| 11 | Two phones, both taps on reveal, both links appear | Camera in the room, two hands in frame | A conversation between the two devices from shot 7 that neither side has revealed yet. Reveal must be mutual, so shoot both taps in one take. |
| 12 | Terminal, one pasted line, Connect screen ticking stages | Laptop screen | A live token URL. Claude Code or Codex signed in, the repo open so it has something to write the building text from. Connect screen subscribed and ticking, not refreshed by hand. |
| 13 | Jay crosses the room and shakes hands with someone | Camera in the room | Nothing. Shoot last, real person, real handshake, no second take. |

---

## Deliberately left out

- **Money.** No cost per conversation, no credits, no pricing. Jay stripped cost out of the interface on purpose this week, so putting a number back in the video would contradict the product a judge is about to open.
- **The nightly memory sync.** It runs as a scheduled job on one machine and nobody else has used it, so it stays out of a video that only shows what a stranger can reproduce tonight.
- **Any number about people or scale.** No user count, no partner, no room size beyond what the camera actually shows. The one figure in the script, fifty percent, is Jay's own observation of this room and is spoken as his observation, not as a statistic.
