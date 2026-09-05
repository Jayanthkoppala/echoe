# Echoe onboarding order (UX decision)

Decided 2026-09-05. Binding constraints: stranger in under 30 seconds with no password,
onboarding shows what to do, a judge finishes the core task unaided in under 3 minutes,
every screen fits one phone viewport.

Core task, stated once so the order can be judged against it: **my Echoe is out in the city
carrying my line, and I can send that link to someone.** For a visitor the core task is
**my Echoe is walking to the host's.**

## The five decisions

**1. Create screen: character, then persona, then intent with a suggest button.**
Matching is persona driven, so the persona is the primary field and comes first. The intent is
derived from it: under the intent box, "Suggest from my persona" returns two or three lines built
from what was just typed, and a tap accepts one or leaves it editable. Character stays at the top
because it is pre selected and costs zero taps, and it gives the screen a warm opening instead of
a blank textarea. Risk, stated plainly: persona first is the slowest possible first field, and a
trip to ChatGPT inside the first 30 seconds fails the entry qualifier. Mitigation: the persona box
asks for two typed lines, not 120 words, with a placeholder that models it ("I build payments
infra, I get loud about latency, I ask blunt questions"). The copy prompt collapses behind a
"Prefer to generate one?" text link, so the ChatGPT trip is opt in and never on the path. Second
mitigation: the suggest button means a user who wrote a persona never has to compose an intent,
which buys back the seconds the persona cost. If a judge types nothing in persona, the suggest
button is disabled and the intent box works as it does today, so an empty persona still gets you
into the city, just less findable.

**2. The Limits screen is redundant on the first run and comes out of the flow.**
Its goal field asks the user to retype the intent they typed one screen earlier, and it is a
required field with an empty default for hosts, which is a dead end a stranger hits at second
40. The run starts automatically when the Echoe is created: goal is the intent for a host, and
`Meet <host>` for a link arrival, with the defaults the screen already ships (3 people,
2 replies, 8 credits, travel and talk and find). Limits survives as an "Adjust limits" entry
from the World sheet and the Roaming overlay, editing a run that is already alive. Keeping the
control story visible matters for the demo, making it mandatory costs the 30 second rule.

**3. World screen: share card first for a host, map first for a visitor.**
A host arrives at World having just written their line, which is the one second they will ever
be most willing to post it, so the share card sits pinned over the top of the map with the copy
button as the loudest control on the screen, and the map runs live underneath. A visitor arrives
with an Echoe already walking to their host, so the top slot is a status strip saying
"Your Echoe is walking to <host>" and the share card drops into the sheet as a small
"Share your own line" row. Same screen, two orders, decided by whether a host share id was in
the URL.

**4. Visitor path to "my Echoe is walking to the host": two fields, two taps.**
Open link, see the host's intent card above the fold, type a name, tap "Send my Echoe to meet
<host>", type one line of intent, tap "Go and meet <host>". The run starts inside that second
tap, so World opens with the walk already in progress and nothing more is required. That removes
the World detour and the Limits screen from the current visitor path, which today costs two
fields and four taps before anything moves.

**5. The share link lives on World, first thing after Create, and returns on the Return screen.**
Right after Create is the intent moment, and World is that screen, so the card belongs there
rather than on a separate share interstitial that would be one more tap and one more viewport.
Roaming gets no share card, there is nothing to add to it while the Echoe is out. Return gets
the card back for a different reason: it is where an empty or thin match list is fixed by
sending the link to one more person or by writing a persona, and where a good result is worth
posting. Both remedies sit in the same block under the match list.

## Host order

| Screen | Top to bottom | CTA | Taps so far |
|---|---|---|---|
| Join | Hero video, "Send an Echoe into Bengaluru", name field | Enter Bengaluru | 1 |
| Create | Character row, persona box (autofocus, 2 lines, generate link), intent box with Suggest from my persona | Send my Echoe out | 2 |
| World | Share card pinned over map, live map, sheet: place, credits, six actions, adjust limits | Watch it roam | 3 (copy link) |
| Roaming | Live map, run headline, progress, stats, pause | Bring my Echoe home | 4 |
| Return | Recap, stats, ranked matches, then share card and persona prompt together, receipts | Back to the city | 5 |
| Review | Transcript, per line sounds-like-me | Correct this line | 6 |
| Correct | The line, what it should have said | Save the correction | 7 |
| Done | Loop recap | Start tomorrow's run | 8 |

## Visitor order (arrived on /i/&lt;id&gt;)

| Screen | Top to bottom | CTA | Taps so far |
|---|---|---|---|
| Join | Host intent card, "Send your Echoe to meet theirs", name field | Send my Echoe to meet &lt;host&gt; | 1 |
| Create | Host card strip, character row, persona box (autofocus), intent box with Suggest from my persona | Go and meet &lt;host&gt; | 2 |
| World | "Your Echoe is walking to &lt;host&gt;" strip, live map, sheet with actions and share-your-own row | Watch them meet | 2 |
| Roaming | Live map, "Walking towards your host", progress, stats | Bring my Echoe home | 3 |
| Return | Host pinned as first match, stats, share card and persona prompt, receipts | Back to the city | 4 |

Tap counts assume a typed intent. Taking a suggestion adds two taps and removes the typing.

Review, Correct and Done are identical to the host order from here.

## Changes to make now, by impact

1. **Start the run inside Create.** `onCreateEcho` chains `startRun` with goal = intent, or
   `Meet <host>` when a host share id is present, using the defaults from `DEFAULT_ALLOWED`
   (3 people, 2 replies, 8 credits). Removes the only dead end in the flow. `src/App.tsx`.
2. **Take Limits out of the required path.** World's handoff button goes to `roaming`, and
   Limits becomes an edit reached from the World sheet and the Roaming overlay, prefilled from
   the live run, with a back target of the screen that opened it.
   `src/screens/WorldScreen.tsx`, `src/screens/RoamingScreen.tsx`, `src/screens/LimitsScreen.tsx`,
   `src/App.tsx`.
3. **Split World by arrival.** Pass the host card into World. Host: share card on top. Visitor:
   walking-to-host status strip on top, share card demoted into the sheet.
   `src/screens/WorldScreen.tsx`, `src/components/ShareCard.tsx`, `src/App.tsx`.
4. **Make the CTAs name the host.** Join and Create both read `<host>` when a share id is in the
   URL, so a visitor is never asked a generic question.
   `src/screens/JoinScreen.tsx`, `src/screens/CreateScreen.tsx`.
5. **Reorder Create to character, persona, intent**, persona inline and autofocused with a two
   line placeholder, the copy prompt collapsed behind a text link, and the intent box gaining a
   Suggest from my persona button, disabled while the persona is empty.
   `src/screens/CreateScreen.tsx`, `src/state/copy.ts`.
6. **Wire the suggest button.** It needs a reducer that takes the draft persona and writes two or
   three candidate lines the client subscribes to, reusing the existing `llm.chat` helper. This is
   the only item here that adds server surface, so scope it after items 1 to 4 are in.
   `spacetimedb/src/index.ts`, `src/screens/CreateScreen.tsx`, `src/App.tsx`.
7. **Drop the step counter on Create.** "02 / 08" tells a stranger there are six more screens after this one, which is false under this order.
   `src/screens/CreateScreen.tsx`, and the same counters on Limits and Return.
