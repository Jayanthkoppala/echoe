Retrieved: 2026-09-05 16:20 IST
Source: https://worldtour.spacetimedb.com/handbook (live check against local copy from 2026-09-04, `/Users/jay/Documents/spacetimedb-prep/handbook/handbook.md`)

# Midnight Moonshot · Builder Handbook (Echoe team copy)

**Diff since 2026-09-04:** none found. All content below matches the live site as of this retrieval. Sections 10 (Team identity), 11 (Demo), 12 (Submissions) are **still locked** — the page still reads "The last 3 sections open only at the hackathon" and shows no form fields, portal link, or demo-video spec. They open only at kickoff (team identity) or at the venue (demo, submissions). Re-check at 12:00 kickoff and again after 20:30.

## 01. What is Midnight Moonshot

A 24-hour hackathon in Bangalore, presented by SpacetimeDB. Build real-time, multiplayer software — a game, a tool, an agent, or infra. Founders, investors, and hiring managers watch the top builds demo live on Sunday morning.

| Field | Value |
|---|---|
| Date | September 5-6, 2026 |
| Format | 24 hour, in-person |
| Venue | the*spark, Pullur Center, 5th Floor, Bengaluru |
| Teams | Solo, duo, or trio |
| Website | worldtour.spacetimedb.com |
| Prize pool | $3,000 cash + ₹4L GPU hours + a launch video by Spacekayak |
| Contact | hello@neighbour.company |

Presented by SpacetimeDB. Ecosystem partner: Sanctuary. Credits partner: AI Grants India. Curation partner: Neighbour Company.

## 02. T-1 checklist

Bring: laptop and charger, tech peripherals, headphones, hoodie, water bottle, meds, comfy footwear (all optional). Sleep properly Friday night. Meals, snacks, coffee, energy drinks, and a nap space are provided.

## 03. Full schedule

### Saturday, September 5

| Time | Event | Detail |
|---|---|---|
| 11:00 | Doors open | Check-in, coffee, meet builders |
| 12:00 | Opening and kick-off | Rules, tracks, rubrics walkthrough |
| 12:30 | Problem statements & idea bank | Choose or bring an idea, lock it, fastest fingers first |
| 13:00 | Lunch and ideate | Eat, pick a direction |
| 14:00 | Building hours begin | Repos created live at 14:00 |
| 15:00 | Checkpoint 1 | Scope and direction review with mentor |
| 17:00 | Checkpoint 2 | Core loop should be alive |
| 19:00 | Mentor on demand | Every mentor bookable by anyone |
| 20:00 | Checkpoint 3 | Mentors head home after this one |
| 20:30 | Dinner | Pause, recharge |
| 21:30 | Become user-ready & launch | Product live, launch posts go out |
| 00:00 | Midnight Moonshot | All-nighter begins, mattresses for naps |
| 01:00 | Iterate, polish, prep | Full agenda continues below |

### Sunday, September 6

| Time | Event | Detail |
|---|---|---|
| 07:00 | Break the fast | Food stations |
| 08:00 | Final checkpoint | Mentors back |
| 08:30 | Code freeze | Server-side, portal closes. Demo video + zipped repo due |
| 09:00 | Submissions | Window closes 09:30 sharp |
| 09:30 | Judges evaluate | Every submission screened before demos |
| 11:00 | Top 10 demos, winners | Live demos, ends by 12:00 |

### Suggested build journey (with 3 mandatory public posts)

- **12:00 kickoff** — post 1, announcement thread: one line on what you're building.
- **13:00-14:00** — read every statement in your track, pick or bring your own idea.
- **14:00-15:00** — setup: repo up, module deployed to Maincloud, credits live, AI tools signed in. One hour max. Then strip to the one core loop; write down what you're NOT building.
- **15:00 checkpoint 1 (scope)** — show the mentor what you cut; let them cut more.
- **15:00-19:00** — build the core loop only. No login, no settings, no landing page. Post 2 (build update) somewhere in here.
- **17:00 checkpoint 2** — mentor wants the loop alive with two people inside it.
- **19:00 mentor on demand** — 30 minutes, book any mentor for your exact problem.
- **19:00-21:00** — make it enterable: join under 30 seconds, no passwords, kill dead ends, write the one-liner (who it's for, what it does).
- **20:00 checkpoint 3** — last mentor session.
- **21:30 launch** — product live, post 3 (launch): one-liner + clip + link, end of the morning thread. Then sell it, in the room and outside it.
- **21:30-00:00** — get 25 people into the product tonight; write down where they get stuck.
- **00:00 midnight moonshot** — real all-nighter begins.
- **00:30-02:00** — iterate on tonight's insights; fix what broke; ship the one most-requested thing; nap in shifts if a team.
- **02:00-04:00** — UI/UX pass: font/colors, landing state (first 3 seconds), touchpoints (buttons, empty/loading states, wrong-click behavior), one delight moment. Test on a phone. Reference: Mobbin, Refactoring UI, shadcn.
- **04:00-05:30** — make it stranger-proof: join with a name only, kill dead ends, seed content so no room looks empty, test the whole flow in an incognito tab.
- **05:30-07:00** — comms: welcome message on entry, one-liner on landing, a way to reach signed-up users (even simple email capture), human-sounding error messages, every link tested.
- **07:00-08:30** — sell it: breakfast, 08:00 final checkpoint, then demo video (problem in one line, product working with people in it, no slides), post it publicly. Prep the "first 500 users" stage answer: named channel + reason.
- **08:30 freeze** — hands off.

## 04. Four tracks

Problem statements revealed at kickoff; either pick one from the bank or bring your own idea. **Track does not affect judging** — rubric is identical across tracks; tracks only help you decide what to build.

| Track | Description |
|---|---|
| Multiplayer products | Make normally-solo software multiplayer: a planner, doc, dashboard, cart — rebuilt so everyone's inside it together |
| Agents | Put an agent in the room, doing real work in your group chat, playing against humans, or running with other agents in one world |
| Games and toys | Something fun — a party game joined from phones, or a world that keeps running after players leave |
| Infra and dev tools | Build for builders — live inspectors, shared-state debuggers, the tool you wished existed an hour into your own build |

Echoe targets the **Agents** track.

## 05. Rules

- **SpacetimeDB at the core.** Real-time logic must live in a SpacetimeDB module on Maincloud. Highest-weighted rubric criterion.
- **Fresh code only.** Repos created live Saturday 14:00. Module creation timestamp on Maincloud checked at submission. Any commit after code freeze is grounds for disqualification.
- **Teams of 1-3.** Solo, or matched at the venue if you want one. Once locked, teams can't change.
- **Open source welcome.** Public libraries/APIs/datasets fine within license. Proprietary or employer code prohibited.
- Breaking fresh-code rule, misrepresenting eligibility, or tampering with the platform = straight disqualification. Mentors see builds at every checkpoint; timestamps evaluated right after submission.

## 06. Evaluation — ten qualifiers, then three scored parameters

### Qualifiers (pass/fail gate to reach demo stage)

**The build**
- [ ] Opens and runs on a phone
- [ ] Live URL opens and runs on the judges' device
- [ ] Module live on Maincloud, created inside the window
- [ ] Repo created after 14:00 Saturday, nothing pushed after freeze

**The submission**
- [ ] Demo video in, under 3 minutes
- [ ] Links to every build in the public post
- [ ] One-liner present: who it's for, what it does

**Market ready**
- [ ] Email comms live: sign up and an email lands
- [ ] A stranger gets in within 30 seconds, no password walls
- [ ] Onboarding exists: a first-time user is shown what to do

### Scored parameters (1-5 each, weighted to 100, averaged across judges)

**1. How real-time is your build? — 35 points**
Test: judges open the product in two tabs, act in one, watch the other. Then they open the module: state in tables, logic in reducers, subscriptions driving the UI.

| Score | Description |
|---|---|
| 1 | Nothing syncs. A second user needs a refresh to see anything change |
| 2 | One live element syncs, the rest of the product is single-player |
| 3 | The core loop syncs live between 2+ users, under a second, no refresh anywhere |
| 4 | The whole product is live. Presence, concurrent actions without overwriting each other, holds with 5+ users at once |
| 5 | The product cannot exist without live shared state, and it holds with 10+ users inside. The module is doing the real work, verified in the repo |

Build towards: open two tabs every hour; if tab two ever needs a refresh, fix that first.

**2. How well did you crack the problem? — 35 points**
Test: judges score against the statement you locked, or the problem you named yourself.

| Score | Description |
|---|---|
| 1 | The build and the problem are strangers. A judge can't say what problem this solves |
| 2 | Aims at the problem, but the main task can't be completed end to end |
| 3 | A first-time user completes the core task start to finish, unaided, in under 3 minutes |
| 4 | Solved end to end with an angle other teams on the same statement missed, including the hard part most teams skip |
| 5 | Complete and sharp. Judges finish the core task unaided and say they'd use it this week |

Build towards: hand your phone to a stranger every few hours; if they can't finish the core task without you talking, that's the work.

**3. Can you take it to market? — 30 points, three parts of 10**
Test: launch posts, one-liner, and one stage question — everything checked at source.

Positioning (who is it for):
| Score | Description |
|---|---|
| 1 | No ICP anywhere. "It's for everyone" |
| 3 | A named ICP and a one-liner, on the product and in the post |
| 5 | A stranger reads the post and repeats back who it's for and what it does |

The plan (first 500 users):
| Score | Description |
|---|---|
| 1 | "We'll post on social media" |
| 3 | One named channel and a reason it fits your ICP |
| 5 | The plan is already running — show DMs, community post, or signups it produced |

Traction (posts vs. usual reach — median views of your last 10 posts; engagements = likes/comments/shares/bookmarks):
| Score | Description |
|---|---|
| 1 | Nothing posted |
| 2 | Posted, usual reach, only friends engaged |
| 3 | 2-5x usual reach, or 20+ engagements from outside the team |
| 4 | 5-10x usual reach, strangers commenting and sharing |
| 5 | 10x+ usual reach, or picked up by accounts bigger than yours |

Build towards: post at kickoff, post while building, launch at night — a warm account by 21:30 is the whole trick.

**Tie-breaker:** ties go to the SpacetimeDB team's read on parameter one (real-time).

## 07. Prizes

Over ₹10L in cash, compute, and credits.

| Place | Cash | Extras |
|---|---|---|
| Winner | $1,500 | ₹4L GPU hours (AI Grants India) + launch video (Spacekayak) + a live product with real users |
| 1st runner-up | $1,000 | + launch video by Spacekayak |
| 2nd runner-up | $500 | + launch video by Spacekayak |

Beyond the podium: access to founders, investors, and hiring managers on demo day, who use builds live and may make introductions.

## 08. Venue

the*spark, Pullur Center, 5th floor, Bengaluru. Venue held for the full 24 hours (build, ship, nap).

## 09. Mentors and panel

**Mentors** (from Microsoft, Salesforce, Amazon, BrowserStack, SpacetimeDB, and more; each team gets an assigned mentor plus structured check-ins):

| Name | Role |
|---|---|
| Additi Upadhyay | Founder, Noveum AI |
| Akash Bhargava | VP Product & Growth, Consuma |
| Mitesh Kumar | Senior Software Engineer, Red Hat |
| Ameeth Dubey | Founding Team, Growth, Atomicwork |
| Rishikesh Ranjan | Growth Lead, ngram |
| Yuvraj Adhikari | Head of Applied AI, Headout |
| Arsheen Chugh | Product Manager, Salesforce |
| Aravindh P G | Principal Product Manager, BrowserStack |

Mentor on demand (19:00, Saturday): every mentor bookable by anyone for 30 minutes.

**Panel** (who the top 10 pitch to on stage; also who the demo video reaches):

| Name | Role | Links |
|---|---|---|
| Swati Awasthi | Founder, Women in Product | linkedin.com/in/swati-awasthi, x.com/swatiawasthi08 |
| Suhas Motwani | Co-founder, The Product Folks | linkedin.com/in/suhasmotwani, x.com/MotwaniSuhas |
| Paul Finney | Founder, Spacekayak and Sanctuary | linkedin.com/in/paulfinneyx, x.com/paulfinneyx |
| Shruthi Badri | Co-founder and CTO, Zamana | linkedin.com/in/shruthi-badri |

## 10. Team identity — 🔒 LOCKED (opens at kickoff, confirmed still locked as of this retrieval)

Handbook text: "Your team name, station, track, and captain confirmation happen at kick-off. The captain is the only person who can submit." No form or content beyond this is live yet.

## 11. Demo — 🔒 LOCKED (opens at the venue, confirmed still locked as of this retrieval)

Handbook text: "The demo video spec and the stage playbook go live on event day. Structure, timing, and how the top 10 moment works." No spec content live yet — plan to the "under 3 minutes, no slides, problem in one line then product working with people in it" qualifier language from chapter 03/06 until this unlocks.

## 12. Submissions — 🔒 LOCKED (opens at the venue, confirmed still locked as of this retrieval)

Handbook text: "The portal link and the step-by-step go live on event day. Code freeze is enforced server-side at 08:30 Sunday. The portal closes itself, the window ends 09:30 sharp." No portal URL live yet.

---
p.s. from the handbook: "look out for your debug duck companion."
