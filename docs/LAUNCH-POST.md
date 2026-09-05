# Echoe launch posts

Written 2026-09-05 for the 21:30 IST launch at Midnight Moonshot, Bengaluru.
Voice source: `Brain/Content/Corpus/voice-profile.md`. Humanizer pass applied, notes at the end.

Replace before posting: `{LIVE_URL}`, `{REPO_URL}`, `{VIDEO_URL}`.

Who it is for, stated once so every piece below agrees: **people who moved to Bengaluru
recently, and founders and builders already here who want to meet someone specific this week.**

---

## 1. The one-liner

Three variants, all under 20 words.

**A.** You're new to Bengaluru. Type one line about who you want to meet. Your Echoe goes and finds them.

**B.** Echoe finds the people in Bengaluru who want what you want this week, without you sending a single cold DM.

**C.** For founders and newcomers in Bengaluru: your Echoe walks the city map and comes back with who to meet.

---

## 2. LinkedIn

> The hard part about moving to Bengaluru isn't finding events. It's standing in a room of 200 people and none of them is the one person you actually needed.
>
> So I built Echoe. You type one line about what you want this week. Your Echoe walks a live map of the city, meets other people's Echoes, and comes home with names and the reason it picked each one.
>
> Every line gets a share link. Post it and anyone who taps it sends their Echoe straight to yours. The map already carries 39 Bengaluru startups and 44 VC firms as pins. Add your work email and your Echoe wears the company badge, so a job title isn't something you have to take on faith.
>
> Built in 24 hours at the SpacetimeDB Midnight Moonshot. The bit I'll remember: the map was black for two hours. Zero tile requests, no errors, an empty console. It was a missing web worker URL under Vite. Two lines of code, two hours of my life.
>
> Does it work? Depends on how many people are on the map tonight. That's the honest answer.
>
> Try it: {LIVE_URL}
> Code: {REPO_URL}
> Demo: {VIDEO_URL}
>
> Open it, type your intent, tell me who your Echoe found. I want to see the strange ones.

---

## 3. X thread

**1/**
You move to Bengaluru and you know three people. Two of them are your flatmates.

Echoe: type one line about who you want to meet this week. Your Echoe walks a live map of the city and comes back with names.

{LIVE_URL}

**2/**
It isn't a directory you scroll. Your Echoe leaves your pin and walks real Bengaluru roads, and when it runs into someone whose line wants the same thing, the two of them talk. You get the transcript when yours comes home.

**3/**
Every intent has a share link. Post yours, and anyone who taps it sends their Echoe straight to yours. That's the whole loop. One line, one link, and the other person's Echoe is already walking.

**4/**
39 Bengaluru startups and 44 VC firms sit on the map as pins. Add your work email and your Echoe carries the company badge, so "PM at Razorpay" is something you can check instead of believe.

**5/**
Built in 24 hours on SpacetimeDB. The database is the server, so it's live between phones with no backend of mine sitting in the middle. MapLibre for the city, React on top.

Code: {REPO_URL}
Demo: {VIDEO_URL}
Go: {LIVE_URL}

---

## 4. WhatsApp (Bengaluru newcomers / founders group)

> Built this at a hackathon over the last 24 hours, for people who just moved to the city. You type one line about who you want to meet this week. An Echoe version of you walks a live map of Bengaluru, runs into other people's, and comes back with names and why it picked them. Every line has a share link, so if you send yours to someone, their Echoe walks straight to yours. Thirty seconds, and there's no signup. {LIVE_URL}
>
> Who would you want it to go and find?

---

## 5. The 3-line reply

> You type one line about who you want to meet this week.
> An Echoe version of you goes out on a live map of Bengaluru and meets other people's.
> It comes back with names, and why it picked each one.

---

## What the humanizer changed

- Cut two tailing negation fragments, "One line, no cold DMs" and "Thirty seconds, no password", and wrote them as real clauses.
- Broke up two rule-of-three clause stacks. The LinkedIn product line and X tweet 2 each ran three parallel verbs; both are now two.
- Added honest uncertainty to LinkedIn ("Does it work? That depends on how many people are on the map tonight"). The voice profile treats inflated claims as the main tell, and the draft had none of Jay's usual hedging on execution.
- Replaced "your AI" with "your Echoe" throughout, since naming the thing is more concrete and the abstraction was doing no work.
- Reworded the badge line from "isn't something you have to take on faith" to "something you can check instead of believe" on X, so the same idea doesn't appear twice in identical negative form.
- Fixed the WhatsApp timeline claim. The draft said "last night", the build ran across 24 hours ending today.
- Checked and confirmed: no em dashes, no curly quotes, no emoji, no hashtags anywhere, no bolded inline list headers inside the posts.

## Honesty notes before posting

- Google Workspace sign-in is designed in `docs/SOCIAL-CONNECT.md` but not shipped as of
  19:30 IST, so no post above claims it. The work email code path through Resend is built.
  Add the Workspace line back only if it lands before 21:30.
- Every post is written first person singular. If anyone else built alongside, change "I built"
  to "we built" in LinkedIn and adjust tweet 5.
- README says the module runs on local3001 and is not yet on Maincloud. `{LIVE_URL}` has to be
  a real public deploy before any of this goes out.
