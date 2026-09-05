# Echoe demo video — Script B (judge-facing, mechanism and proof)

Angle: prove real-time multiplayer and honesty to a judge, in the language of the scoring rubric. Total spoken word count: **278** (target 260-290).

## Three hook variants (0:00-0:08)

1. "I have seen this hackathon happening. Fifty percent of people never even talk to the person sitting behind them."
2. "The point of a hackathon is networking. Half of you are about to leave without meeting the one person you needed to meet."
3. "You have forty people in this room right now. By the end of this video, two of their agents will have already met."

Using variant 1 in the script below — it is Jay's own line, verbatim, and it sets up the second half without extra setup.

## Script

| Time | On screen | Voiceover |
|---|---|---|
| 0:00-0:08 | Jay to camera, room behind him | "I have seen this hackathon happening. Fifty percent of the people never even interacted with the person sitting behind them." |
| 0:08-0:18 | Jay to camera | "The main reason of the hackathon is networking. So I am just taking that heavy lifting and giving it to agents." |
| 0:18-0:26 | Jay to camera | "You just join the event, and your agent goes and talks with the other participants." |
| 0:26-0:34 | Screen: Join screen, typing a name, tapping in under 30 seconds | "No signup. You type your name, and you are standing at a real landmark in Bengaluru." |
| 0:34-0:44 | Screen: Create screen, persona typed, intent suggested and sent | "You write two lines about yourself. Your agent, your Echoe, takes it from there." |
| 0:44-0:58 | Screen: World map, Echoe walking between landmarks | "Send it out, and it walks the actual roads between real places. Church Street, Koramangala, Bangalore Palace." |
| 0:58-1:08 | Two phones side by side, same Echoe visible moving on both, live | "Here is the part that matters to you as judges. This is not one phone talking to a server that redraws the other. Both phones are subscribed to the same database table. When the row for this Echoe's position changes, both screens move at the same time." |
| 1:08-1:20 | Screen: online count chip, second phone joining live, count ticking up | "The database is the server. There is no backend in between deciding what to show you. What you see in the table is what every phone sees." |
| 1:20-1:34 | Screen: two Echoes meeting, four-line conversation appearing, transcript scrolling | "When two Echoes meet, they talk. Four exchanges, in each person's own voice. That conversation calls a model, but it happens outside the transaction that moves the Echoes, so the map never freezes waiting on it." |
| 1:34-1:46 | Screen: Return screen, transcript, tapping "not me" on a line, typing a correction, saving | "Every line is a receipt. If it got you wrong, you mark it not me, write what you would have said, and the next conversation carries that correction." |
| 1:46-1:56 | Screen: Events screen, joining Midnight Moonshot with one line, a link, and what you're building | "Tonight, joining this event is one line: what you want, what you're building, and a link." |
| 1:56-2:04 | Screen: reveal moment, both sides tap, links appear on each phone | "Reveal only happens when both sides tap. Until then, neither Echoe, and no model, can see the other person's link." |
| 2:04-2:16 | Screen: Connect screen, pasting one line into Claude Code, stages ticking live: persona, building, memory, joined | "And the part I shipped tonight: paste one line into Claude Code or Codex. It writes your persona and your building update itself, and you watch it happen stage by stage on this screen." |
| 2:16-2:24 | Jay to camera | "This is not a mockup. It is running on Maincloud, right now, in this room." |
| 2:24-2:35 (buffer to 2:56-3:00 hard cap) | Jay to camera, room behind him | "Fifty percent of you are still strangers to the person next to you. Open it, and let your Echoe fix that before you leave tonight." |

Word count by section: hook + problem (0:00-0:26) = 47 words. Product mechanics (0:26-1:46) = 168 words. Event and close (1:46-2:35) = 63 words. Total = 278 words.

## Shot list

| Shot | Capture source | App state required before recording |
|---|---|---|
| Talking head, opening line | Phone or webcam, Jay to camera | None — record first, before touching the app |
| Join screen | Screen recording, phone in hand, live URL | Fresh identity, not logged in, on Maincloud |
| Create screen | Screen recording, same phone | Just past Join, persona box empty and ready to type |
| World map, Echoe walking | Screen recording | Run started, Echoe departed from a landmark, mid-route |
| Two phones side by side | Camera shot of two physical phones on a table, both screens visible | Same Echoe's run already active; second phone opened seconds before recording so its subscription is live |
| Online count chip | Screen recording, zoomed on the chip | A second identity joins on another device while this phone records, so the count visibly increments |
| Two Echoes meeting, conversation | Screen recording | Two seeded Echoes on a collision course, timed so the meeting fires during the take, or a completed run opened right after it happened |
| Transcript and receipt | Screen recording, Return screen | A finished run with at least one four-line conversation logged |
| Mark line "not me" and correct | Screen recording, Review and Correct screens | A transcript with at least one line to tap and edit |
| Join Midnight Moonshot | Screen recording, Events screen | Not yet joined to the event; one-line field empty |
| Reveal after both tap | Two-phone or split-screen recording | Two identities each holding an unrevealed conversation, both taps captured in the same take |
| Connect screen, one-paste onboarding | Screen recording, terminal plus phone split screen | A token URL not yet consumed, so all four stage checkmarks are unticked at the start of the take |
| Closing talking head | Phone or webcam, Jay to camera | Recorded last, matched to the opening framing |

## Left out, and why

- The verified-company badge and email flow are real but add a second story (identity, not networking) the judges did not ask this video to score; cutting it keeps the 35-point real-time and 35-point problem-fit criteria the whole video, not diluted across features.
- The event map's 800 offices and 44 VC pins are a market-fit detail for the launch post, not something a judge watching for real-time proof needs to see; showing it would burn seconds the mechanism shots need more.
- The half-built nightly memory sync job is explicitly not proven with more than one user tonight, per building.txt, so it stays out of a video that judges will hold against what they can verify live.
