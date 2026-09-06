# Echoe data model

The SpacetimeDB module for Echoe. Everything lives in `spacetimedb/src/index.ts`,
with the OpenRouter client split into `spacetimedb/src/llm.ts` because that file
does network I/O and may only ever be reached from a procedure.

## The rule the whole module follows

The database owns every state transition. Reducers validate and mutate. The LLM
only ever produces text for an exchange that a reducer has already authorised,
charged and counted. If OpenRouter is unreachable, or no key is configured at
all, the simulation is unchanged: deterministic fallback lines are written
inside the same transaction that paid for them.

This matters for two reasons. It is the honest way to build the thing, and it is
what makes the module inspectable: a judge can read `run`, `receipt` and
`conversation` and see the caps being enforced without trusting a model.

## Tables

Public tables are visible to subscribed clients and appear in generated
bindings. Private tables do not, and are excluded from codegen.

| Table | Visibility | Purpose |
| --- | --- | --- |
| `player` | public | One row per human. `identity` is the primary key and always comes from `ctx.sender`, never from an argument. Holds name, avatar, online flag and `current_place`. `avatar` is not a choice: `join` sets it to the first 16 hex characters of the caller's identity, and the client renders a deterministic DiceBear face from that seed. There is no wallet: the only budget is OpenRouter spend. |
| `echo` | public | The player's agent. `owner` is unique per identity. `persona` is authored on screen 2; `behaviour_notes` accumulates from corrections and is fed into every later prompt. |
| `place` | public | The ten Bengaluru landmarks, seeded once in `init`. Read-only afterwards. Array index is the place id. |
| `agent_travel` | public | One row per leg, written only at leg boundaries. A roaming Echoe costs two rows per landmark rather than a position update per frame; the client interpolates between `depart_ts` and `arrive_ts`. |
| `run` | public | The session started from the Start page. `goal` is who the player wants to meet and is also copied into `intent.text`; `avoid` is who they do not want to meet and is `''` when they did not say. Status (running, paused, ended), counters, and `spent_usd`, the USD this run has spent on OpenRouter-funded exchanges (stays `0` for house-funded Vertex Gemini exchanges; see Credits). `owner` is unique, so a player has exactly one run row that is reused across nights. |
| `run_pause` | **private** | Open only while a run is paused: `run_id` primary key and the moment it stopped. The run clock is `now - started_at`, so `resumeRun` deletes this row and pushes `started_at` forward by the interval it recorded. Without it a player who paused to read a transcript came back to "the 24 hours ran out". |
| `receipt` | public | Append-only. Nothing in the module ever updates or deletes a receipt. This is what screen 6 renders and what makes a correction honest. |
| `conversation` | public | One row per talking pair. `echo_a` is always the numerically smaller id, which makes the pair a stable key. `replies` counts exchanges; it is a counter, not a cap. `event_id` is `''` for a street meeting and names the event for a pairing made by `joinEvent`. `closed_at` is epoch 0 while the meeting is open and stamped once it ends; `created_at` is when the pair started talking, which for an event pairing is when it was given a slot rather than when the row appeared. |
| `event_join` | public | Who has joined a city event, one row per player per event, keyed `${event_id}:${identity hex}`. `goal` is what they want out of that event, at most 160 characters and required, and is the only thing an event conversation is matched and prompted on. Public so every map can show the count live. The event ids come from the client's `events.json`; the module only stores the string. |
| `event_contact` | **private** | The LinkedIn and X links a player gave at join time. Never subscribable and never read by `echoTalk` or any prompt builder, so no Echoe can say them. The one reader is `readReveal`, and only after both sides of that conversation have revealed. |
| `reveal` | public | Who has pressed Reveal on which conversation, keyed `${conversation_id}:${identity hex}`, and nothing else. Both rows existing is the condition `readReveal` checks; the payload is not here. |
| `reveal_secret` | **private** | One row per player: what they hand over when they like someone (a meet link, an Instagram, a phone number), at most 200 characters. Written by `setReveal`, cleared by passing `''`. Never read by `echoTalk` or any prompt builder; only `readReveal` returns it, and only to the other side of a mutually revealed conversation. |
| `conversation_summary` | public | What a finished conversation was worth, **one row per side**, keyed `${conversation_id}:${identity hex}`: "did they give me what I came for" has a different answer for each person in the room, so `summary`, `scores_json`, `corrective` and `match` are always from `identity`'s point of view. Written once by the `summarize` procedure when a conversation closes, and never updated. `scores_json` is a `RubricScores` object, `corrective_notes_json` a JSON array of at most three lines for the correction loop. |
| `transcript_line` | public | The lines themselves. `is_ai` is always true so the client can label every line. `feedback` is `none`, `like` or `not_me`. |
| `correction` | public | One row per correction on screen 8. Keeps the original text alongside the replacement, so the record of what was actually said survives. |
| `mission` | public | Single row, id 0. The shared "tonight's mission" line on screen 3. |
| `llm_config` | **private** | Single row, id 0. Holds the house key, model and chat-completions endpoint (empty means OpenRouter). The house model is Gemini 2.5 Flash-Lite on Vertex AI's native generateContent route; for a `*.googleapis.com` endpoint the stored key is ignored and `echoTalk` authenticates with a Google OAuth bearer token instead (see `google_auth` below), because Vertex's OpenAI-compatible route insists on OAuth too and the native route only takes API keys in express mode. No `public: true`, so it is invisible to every client and absent from codegen. The key goes in through a reducer argument and never comes back out. |
| `player_key` | **private** | One row per player who signed in with OpenRouter. Written only by the `linkOpenRouter` procedure, read only by `echoTalk` for exchanges whose funding is `own`. The client sees just `player.openrouter_linked`. |
| `echo_memory` | **private** | One line per (echo, other echo): what this Echoe remembers about that person, written by `echoTalk` when a conversation closes from the transcript itself, read into the prompt the next time the pair meets. The database is the memory; no external service. |
| `google_auth` | **private** | Single row: Google OAuth client id, secret, refresh token and the cached access token with its expiry. Written by `setGoogleAuth`, refreshed by the procedures, never readable by clients. |
| `world_tick` | **private** | Drives the `tick` reducer on a 5 second interval. |
| `talk_job` | **private** | One-shot jobs carrying a conversation and its `payer` into the `echoTalk` procedure. Rows are deleted automatically once the procedure returns. |
| `summary_job` | **private** | One-shot jobs carrying a closed conversation into the `summarize` procedure. Queued by `closeConversation`, deleted automatically once the procedure returns. |

### Places

Seeded in `init` with the array index as the id.

| id | Name | lng | lat |
| --- | --- | --- | --- |
| 0 | Bangalore Palace | 77.5920 | 12.9987 |
| 1 | Vidhana Soudha | 77.5906 | 12.9796 |
| 2 | Ulsoor Lake | 77.6192 | 12.9815 |
| 3 | Church Street | 77.6048 | 12.9750 |
| 4 | Cubbon Park | 77.5933 | 12.9750 |
| 5 | Indiranagar | 77.6499 | 12.9699 |
| 6 | Lalbagh | 77.5900 | 12.9500 |
| 7 | MG Road | 77.6119 | 12.9738 |
| 8 | Koramangala | 77.6229 | 12.9259 |
| 9 | Commercial Street | 77.6084 | 12.9822 |

## Reducers

Every reducer name is snake_cased on the wire and camelCased in the generated
client bindings. `createEcho` in the module is `create_echo` to the CLI and
`reducers.createEcho` in TypeScript.

| Reducer | Arguments | Preconditions, all enforced with `SenderError` |
| --- | --- | --- |
| `join` | `name`, `email` | Name is non-empty after trimming and at most 40 characters. `email` is optional; when present it must look like an address and is upserted into a private `contact` row (`email`, `welcomed: false`) as a hook for a future welcome mail that nothing sends yet. Called again by an existing player, it renames and marks them online rather than failing. |
| `createEcho` | `persona` | Caller has joined. An empty persona on an Echoe that already has one is ignored rather than erasing it. Persona is at most 2000 characters and is the whole of screen 2: there is no intent argument any more. Creates the player's `intent` row with a share id and an empty `text`, which `startRun` fills. No avatar argument: the face follows the identity seed written at join. Called again, it replaces the persona and keeps the share id, the intent line and the accumulated behaviour notes. |
| `travel` | `placeId` | Caller has joined and has an Echoe. The place exists. The player is not already there. The caller's run, if any, is not paused (`run_paused`). Writes a leg and a receipt. |
| `startRun` | `goal`, `avoid`, `hostShareId` | Caller has joined and has an Echoe. Goal non-empty, at most 280 characters; its first 120 characters are also written to `intent.text`, which is the line a share link carries. `avoid` is optional and may be `''`. `hostShareId` is empty or names a live intent that is not the caller's own. Called again over a run that is still running or paused, it only re-aims that run: `goal`, `avoid` and, when it was unset, `host_echo_id`. The counters, `started_at` and every open conversation survive. Only over an ended run does it start a fresh one. No caps: the run is bounded by the clock and by the free-conversation allowance, then whatever the player's own linked OpenRouter key allows. |
| `pauseRun` | none | A run exists and is running. Opens the private `run_pause` row that stops the clock. |
| `resumeRun` | none | A run exists and is paused. Closes the `run_pause` row and pushes `started_at` forward by the paused interval, so the pause costs the run nothing. |
| `endRun` | none | A run exists and is not already ended. Writes a `run_end` receipt. |
| `rateLine` | `lineId`, `soundsLikeMe` | Caller has an Echoe. The line exists and was spoken by the caller's own Echoe. Sets feedback to `like` or `not_me`. |
| `correct` | `lineId`, `shouldHaveSaid`, `behaviourChange` | Caller has an Echoe. The line exists and is the caller's own. Both texts non-empty, at most 500 characters. Appends a correction row, appends a note to `behaviour_notes`, and marks the line `not_me`. Touches no receipt. |
| `setGoogleAuth` | `clientId`, `clientSecret`, `refreshToken` | Admin only. Google OAuth for the house lane, from `gcloud auth application-default login`; Vertex AI refuses API keys, so the procedures trade the refresh token for a cached one-hour access token. |
| `setLlmConfig` | `apiKey`, `model`, `endpoint` | Key and model non-empty; endpoint empty or `https://`. Admin only: `init` makes the publishing identity the owner of `llm_config`, and only that identity may call this afterwards, so a later caller cannot take over the house key. Writes the single private config row. |
| `unlinkOpenRouter` | none | Caller has joined. Deletes the caller's private `player_key` row and clears `player.openrouter_linked`. |
| `setMission` | `text` | Admin only (same owner as `llm_config`). Non-empty, at most 200 characters. |
| `joinEvent` | `eventId`, `goal`, `linkedin`, `twitter`, `building` | Caller has joined. `goal` is non-empty and at most 160 characters: what they want out of this event. `building` is what they are building, and a blank one keeps whatever their coding agent already wrote. Writes the public `event_join` row, the private `event_contact` links whatever shape the handles were pasted in, and the `event_build` row. Joining again replaces the goal and the links and keeps the first timestamp. On a first join it also introduces the caller to the room: see the event fan-out below. |
| `leaveEvent` | `eventId` | Caller has joined. Drops the public row and the private links together. Conversations already created are left alone. |
| `setReveal` | `text` | Caller has joined. Upserts the caller's private `reveal_secret`, at most 200 characters; `''` deletes the row. |
| `revealTo` | `conversationId` | Caller has an Echoe and is `echo_a` or `echo_b` of that conversation. Inserts the caller's `reveal` row; calling again is a no-op. Marks only the caller's side, and shows the other side nothing on its own. |
| `tick` | scheduled | Not callable by clients. See below. |

Presence is handled by `clientConnected` and `clientDisconnected`, which flip
`player.online`. A player who has not joined yet is ignored by both.

## The tick

`world_tick` fires the `tick` reducer every 5 seconds. A "24 hour" roam is
compressed to 3 minutes so a judge can watch one end to end. Travel takes 4
seconds, and an Echoe dwells at a landmark for 6 seconds before departing.

The tick iterates a snapshot of `run` but re-reads each row before acting on it.
This is not incidental: one Echoe's turn writes to another Echoe's run when a
conversation bumps `people_met` on both sides, and acting on the stale snapshot
silently rolled that write back. The first version of this had exactly that bug.

For every run whose status is `running`:

1. **Stop condition first.** If the compressed day has elapsed, finish the run
   and write a `run_end` receipt. Running out of budget ends it too, checked
   directly rather than waited for: once every `FREE_CONVERSATIONS` house
   conversation is used, no linked OpenRouter key covers the gap, and no
   in-progress conversation is still funded, the run finishes with `all N free
   conversations used`, before any LLM call is attempted.
2. **In transit?** If the latest leg has not reached its `arrive_ts`, do nothing
   this tick.
3. **Arrived but unbanked?** Move `current_place` to the leg destination,
   increment `places_visited`, write an `arrive` receipt, then fall through to
   step 4 in the same tick. Stopping here used to mean a chaser always landed
   one tick after its target had already left, so two Echoes that started at
   different times never actually met; this is the fix.
4. **Standing at a landmark.** Try to converse with a co-located Echoe. That is
   the only thing an Echoe does at a landmark. Before the first departure there is no
   leg at all, so the run's own `started_at` anchors the dwell and every Echoe
   gets one chance to talk where it began.
5. **Dwell elapsed, and nobody to talk to this tick?** Depart for another
   landmark. Adding an exchange counts as acting, so a run stays put for every
   tick a conversation is actually moving and only leaves once there is nobody
   left to talk to at that landmark.

### Who talks to whom

A conversation is created only when all of these hold: both are at the same
place, the non-host side has a running run, and the pair has no conversation
belonging to the current pair of runs. A host is the one exception to
"running": their Echoe stays reachable at its last place even after their own
run has ended, so a run that arrived through a share link can still meet its
host. A conversation older than either run is treated as a memory of a
previous night and a new one is started, otherwise `people_met` would stay at
zero while a transcript kept growing.

Once a conversation exists, each side may add one more exchange per tick until
it closes, on the timed rule described under How a conversation ends. Then the
find step stops chasing that Echoe for the rest of the run.
Each exchange is billed to its initiator; see Credits below for how and how
much.

### Where they walk

An Echoe allowed to `find` first checks whether it arrived through a shared
link and hasn't reached its host yet: if so it heads straight for the host,
before anything else. Otherwise it heads for a landmark holding another
running Echoe, aiming at where that Echoe will be rather than where it was.
Only the lower-numbered Echoe of any pair gives chase. If both chased, two Echoes would
swap landmarks every tick and never actually arrive together, which is what the
first version did. Otherwise the destination is a uniformly random other
landmark.

### How a conversation ends

A meeting is timed, not counted. It runs until `CONVERSATION_MICROS` (three
minutes) after `conversation.created_at`, or until the model closes it, whichever
comes first. `MAX_EXCHANGES` (40) is a safety net rather than the rule: one
exchange per 5 second tick makes three minutes about 36 exchanges.

`MIN_EXCHANGES` (12) is a floor under the model's own judgement. Left alone it
wraps up in two or three lines, which is an introduction rather than a
conversation, so below the floor `[END]` is stripped from the line and ignored
and only the clock or the ceiling can close. The prompt also forbids proposing
coffee, a call or any next step before that exchange.

The model closes a conversation by ending a line with `[END]`, which the system
prompt asks for once the pair has clearly wrapped up and forbids while anything
is still unsettled. `echoTalk` strips the token before storing the line, so it
never reaches a player, and stamps `closed_at`. In practice this is what ends
almost every conversation, well inside the three minutes.

Every close goes through one function, `closeConversation`. It stamps
`closed_at` if it is still open, counts the meeting on both sides when the
conversation carries an `event_id`, and queues a `summary_job`. Two callers
reach it: the `[END]` path in `echoTalk`, and the clock in the tick's
conversation scan, which now closes street meetings as well as event pairings.
The meet loop never stamps the clock itself — the pair simply walks away — so
without that scan a street talk stayed open forever and would never be
summarised. `spacetimedb/reveal.check.ts` asserts that `closed_at` is stamped in
exactly one place, so a third close site cannot appear without a summary.

`closed_at` is the record; `isClosed` in `spacetimedb/src/conversation.ts` is the
live test, because a street conversation nobody is ticking still has to read as
closed once its clock runs out. It is the one test `doneTalking`, the meet loop,
the `closing` flag handed to the LLM and the memory-writing step all go through,
kept pure so `spacetimedb/reveal.check.ts` can run it. An event pairing
still waiting for a slot has `replies` 0 and therefore no clock yet, which is
what stops it expiring before it ever speaks.

### The event fan-out

Joining an event introduces you to the people already in the room rather than
waiting for the tick to walk you into them. On a first `joinEvent`, the module
takes the most recent other joiners of that event up to that event's cap, skips
anyone with no Echoe and any pair that already has a conversation tagged with
this event, and creates a `conversation` for each at place 10 (the*spark,
Whitefield) with `event_id` set and scored by `matchIntents` over the two
`event_join.goal` values rather than the players' street intents. Neither side
needs a run, and no Echoe moves: the point of an event is that you meet whoever
is there.

The event goal follows through to the prompt: for a conversation with an
`event_id`, `echoTalk` states each side's goal as `At <event title>, A wants:
...` above the persona, and leaves the street intent out entirely.

When an event conversation closes, both sides get `run.people_met + 1` (any run
status, so a finished run's recap still names who it met) and a `talk` receipt
at place 10 reading `Talked with <name> at <event title>`. The sticky
`closed_at` stamp is what stops that counting twice, and it is done in the two
places that stamp it: `tickEvents` for the clock, `echoTalk` for `[END]`.

The cap is `DEFAULT_EVENT_TALK_CAP` (5) by default, overridden per event by
`EVENT_TALK_CAP`. `spacetimedb-midnight-moonshot` is `Infinity`: everyone in the
room meets everyone. **A 100-person moonshot is therefore 4,950 house-paid
conversations at up to 40 exchanges each, so the organiser's key needs the
budget before the doors open.**

Two things follow from an uncapped event and are load-bearing:

- Event conversations are `'house'` on both sides and do **not** count against
  `FREE_CONVERSATIONS`. Without this, one join would spend a player's whole
  allowance before their first night out.
- Every pairing is created at join time, so the count and the list are right
  immediately, but each Echoe holds at most `EVENT_PARALLEL` (3) of them open at
  once. `tickEvents`, inside the existing 5 second tick, closes what has run out
  of time, adds one exchange to each open conversation, then fills each Echoe's
  free slots from its oldest unstarted pairings, stamping `created_at` as it
  starts one. No second scheduled reducer: the tick already runs at the right
  interval and already holds a write transaction.

### Mutual reveal

`setReveal` stores a payload once, on the Start page, in a private table. On a
conversation, `revealTo` records that the caller pressed Reveal. Neither side
learns anything until both rows exist.

`readReveal({ conversationId }) -> string` is a procedure, not a table, because
the payload must never be subscribable. It returns JSON:

```json
{ "mine": true, "theirs": true, "text": "...", "linkedin": "...", "twitter": "..." }
```

The caller must be one of the two Echoes, or it fails `not_a_participant`.
`text` is the other party's `reveal_secret`, and `linkedin` / `twitter` their
`event_contact` links for that event when `conversation.event_id` is set. All
three stay `''` until both `reveal` rows exist. `echoTalk` reads none of these
tables, so no Echoe can say any of it out loud; `spacetimedb/reveal.check.ts`
asserts that and fails if a future prompt builder reaches for them.

## The scored summary

When a conversation closes, `closeConversation` queues a `summary_job` and the
`summarize` procedure scores the finished transcript **twice**, once from each
side. The scoring rules are pure and live in `spacetimedb/src/rubric.ts`
(`buildSummaryPrompt`, `parseSummary`, `combine`), covered by
`spacetimedb/rubric.check.ts`.

Each side's `RubricInput` carries that side's name and persona, the other's,
what each came for (`event_join.goal` when the conversation has an `event_id`,
otherwise `intent.text`), that side's `run.avoid` when they have a run row, the
full transcript with `mine` flipped to their own echo, and
`conversation.score` as the deterministic baseline. The reply comes back as
`summary`, six rubric numbers, a `corrective` score with up to three notes, and
`match`, which `combine` computes rather than trusts: the rubric total mapped
onto 0..100 and blended 70/30 with `conversation.score`.

Both calls are always on the house key, whatever funded the conversation: the
summary is the product, not a metered exchange, and a player who never linked
OpenRouter still gets one. The procedure is idempotent by row — a side that
already has a `conversation_summary` row is skipped — so a re-queued job costs
nothing. On any failure it logs a warning and writes no row; there is no client
retry, the Summary button simply reads "Summarising…" until a row exists.

The scoring prompt sees the transcript, the personas and the goals. It never
reads `reveal_secret` or `event_contact`, and `spacetimedb/reveal.check.ts`
asserts that on `summarize` exactly as it does on `echoTalk`.

## Credits

Each Echoe gets `FREE_CONVERSATIONS` (5) conversations on the house key, for
life, counted the first time it speaks in one and then fixed for that
conversation (`fundingA`/`fundingB` on `conversation`, `'house'` or `'own'`,
one flag per side). After that its lines are billed to the player's own key
from `player_key`, obtained through OpenRouter's PKCE sign-in: the browser
sends the player to `openrouter.ai/auth` with a code challenge, gets a
one-time code back, and the `linkOpenRouter` procedure exchanges it at
`/api/v1/auth/keys` and stores the key server-side. With no free conversations
left and no linked key, the tick brings the run home. There are no app credits
otherwise.

An OpenRouter-funded exchange is billed in real OpenRouter dollars: `echoTalk`
reads `usage.cost` from the response, adds it to the paying run's `spent_usd`,
and writes an `llm` receipt carrying the exact amount. The house Vertex Gemini
path reports token counts, not dollars, so it always records `costUsd: 0` and
leaves `spent_usd` untouched even while doing real work. The fallback exchange
(deterministic, or intent-flavoured when the model reply was unusable; see The
LLM path) costs nothing and writes no `llm` receipt either. Travel, find and
the rest are free and always were.

## The LLM path

A reducer cannot do network I/O, so the tick queues a `talk_job` row instead.
The `echoTalk` procedure picks it up and:

1. Opens a transaction to read the private config, the conversation, both
   personas, both sets of behaviour notes, both goals, and the lines so far.
2. Closes it, then calls OpenRouter chat completions through `ctx.http.fetch`
   with a 12 second timeout. No transaction is open across the network call.
3. Opens a second transaction and writes the two lines.

The system prompt carries both personas and, critically, both sets of behaviour
notes, described as the strongest instruction present. That is what makes a
correction on screen 8 visibly change what the Echoe says afterwards. It also
carries each side's `run.avoid` as "Do not pursue people who ...". It carries
neither `reveal_secret` nor `event_contact`, and never will: see Mutual reveal.

On any failure at all, transport, non-2xx, an unparseable body, or a reply that
does not split into two speaker lines, the procedure writes a fallback exchange
instead and logs the reason. The fallback is not a single canned line: it picks
randomly from a short list of openers and replies built from each side's own
`intent`, so a "malformed reply" fallback still reads as if these two people
were talking. The reducer has already paid for and counted the exchange, so a
conversation always ends up with words in it. When no key is configured the
tick never queues a job and writes the fallback lines directly, which means
the demo runs with no network and no key at all.

## What the client subscribes to

Everything public. In practice:

- `place` and `mission` once, at connect. Both are effectively static.
- `player` for presence and the map markers.
- `echo` for personas and avatars.
- `agent_travel` filtered to the Echoes on screen. Interpolate position from
  `depart_ts` and `arrive_ts` rather than expecting per-frame updates.
- `run` for the roaming counters and the pause state.
- `receipt` filtered to `run_owner` for screen 6.
- `conversation` and `transcript_line` for screens 7 and 8.
- `correction` if the correction history needs to be shown.

Private tables cannot be subscribed to and are absent from
`src/module_bindings`. `apiKey` appears in the generated bindings only as an
argument to `set_llm_config`, which is the point: the key goes in and never
comes back out.

## Build, publish, smoke test

The local server runs on **port 3001**, not 3000. An unrelated Node process has
held port 3000 since 1 September and was left alone. It also uses an isolated
data directory, because the CLI's login token rotated during the session and
left the shared local data directory holding an `echo` database owned by an
identity the CLI no longer had.

```bash
cd /Users/jay/Documents/echo

# Build
~/.local/bin/spacetime build --module-path spacetimedb

# Server, left running in the background
~/.local/bin/spacetime start --in-memory \
  --data-dir <scratch>/stdb-data2 \
  --listen-addr 127.0.0.1:3001 --non-interactive

~/.local/bin/spacetime server add local3001 --url http://127.0.0.1:3001 --no-fingerprint

# Publish and generate bindings
~/.local/bin/spacetime publish echo --module-path spacetimedb --server local3001 -y
~/.local/bin/spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb -y
```

`--no-config` is required on every `call`, `sql` and `logs` command against
local3001, because this repo's `spacetime.json` now defaults `server` to
`maincloud` (the module is really published there, see below), and a bare
command with no `--no-config` and no explicit `--server` resolves against
Maincloud instead of the local database this section is about.

A second identity comes from a separate `HOME`, since `--anonymous` mints a
fresh identity on every call and cannot hold state across two of them.

### Observed output

Plain reads against whatever tonight's local database already holds; no
reducers were called to produce this data. `place` is seeded once in `init`
and never changes, so it is the one query guaranteed to reproduce identically
on any machine:

```
$ spacetime sql --no-config -s local3001 echo "SELECT id, name, lng, lat FROM place"
 id | name                | lng     | lat
----+---------------------+---------+---------
 0  | "Bangalore Palace"  | 77.592  | 12.9987
 1  | "Vidhana Soudha"    | 77.5906 | 12.9796
 2  | "Ulsoor Lake"       | 77.6192 | 12.9815
 3  | "Church Street"     | 77.6048 | 12.975
 4  | "Cubbon Park"       | 77.5933 | 12.975
 5  | "Indiranagar"       | 77.6409 | 12.9716
 6  | "Lalbagh"           | 77.59   | 12.95
 7  | "MG Road"           | 77.6119 | 12.9738
 8  | "Koramangala"       | 77.6112 | 12.9346
 9  | "Commercial Street" | 77.6084 | 12.9822
```

A run and the conversation it produced, from a live session tonight:

```
$ spacetime sql --no-config -s local3001 echo "SELECT id, goal, status, people_met, places_visited FROM run WHERE id = 1"
 id | goal                | status  | people_met | places_visited
----+---------------------+---------+------------+----------------
 1  | "meet two builders" | "ended" | 1          | 13

$ spacetime sql --no-config -s local3001 echo "SELECT id, echo_a, echo_b, place_id, replies FROM conversation WHERE id = 1"
 id | echo_a | echo_b | place_id | replies
----+--------+--------+----------+---------
 1  | 1      | 2      | 0        | 4

$ spacetime sql --no-config -s local3001 echo "SELECT id, speaker_echo_id, text FROM transcript_line WHERE conversation_id = 1"
 id | speaker_echo_id | text
----+-----------------+---------------------------------------------------------------
 1  | 1               | "What are you building that ships payments?"
 2  | 2               | "Close rooms, not deals. Who wants my fintech?"
 3  | 1               | "Pre-seed investing. Bengaluru. You shipping anything now?"
 4  | 2               | "Looking for technical co-founder. Razorpay background. You?"
 5  | 1               | "I've shipped payments. What's your technical problem?"
 6  | 2               | "Payments infrastructure. You're investing pre-seed?"
 7  | 1               | "Yes, fintech pre-seed. What infra problem?"
 8  | 2               | "Let's talk Thursday, coffee by the lake."
```

Four exchanges, captured when `MAX_EXCHANGES` was still 4 and a fixed cap,
closing on the concrete next step the final-exchange instruction asks for. A
conversation recorded today runs on the timed rule instead and is usually
longer. The `llm` receipts for the same run name the path that produced it:

```
$ spacetime sql --no-config -s local3001 echo "SELECT kind, place_id, text FROM receipt WHERE run_owner = 0xc2002d8614b6bfd9088222e54089f1ad30fa7e3864f5cb0417c4392c2f85853c AND kind = 'llm' AND place_id = 0"
 kind  | place_id | text
-------+----------+-------------------------------------------
 "llm" | 0        | "Gemini via Google Cloud, on us: 2 lines"
 "llm" | 0        | "Gemini via Google Cloud, on us: 2 lines"
```

This Echoe was still inside its `FREE_CONVERSATIONS` allowance ("on us"), and
the house Vertex path never reports a dollar cost, so `run.spent_usd` stayed
`0` for this run even though the exchanges above are real model output, not
the fallback.

### The LLM path, proven

Configured with a deliberately invalid key so the fallback is exercised:

```
$ spacetime call --no-config -s local3001 echo set_llm_config '"<key>"' '"google/gemini-2.5-flash-lite"' '"https://aiplatform.googleapis.com/v1/projects/<project>/locations/global/publishers/google/models"'

$ spacetime logs --no-config -s local3001 echo -n 15
2026-09-05T10:50:50Z WARN: echo_talk: echoTalk falling back: http 401: {"error":{"message":"User not found.","code":401}}
2026-09-05T10:50:51Z WARN: echo_talk: echoTalk falling back: http 401: {"error":{"message":"User not found.","code":401}}
```

The scheduled procedure ran, reached OpenRouter through `ctx.http.fetch`, got a
real HTTP 401, and wrote the deterministic exchange instead. Transcript lines
appeared for all three conversations. With a valid key the same path writes
model output instead, and nothing else about the simulation changes.

## Verified company Echoe

A work address earns a public badge and nothing else crosses the wire. The
email lives in a private table; other clients only ever see `player.companyId`
and `player.verifiedDomain`.

### Tables

`company` (public, seeded in `init` from `spacetimedb/src/companies.ts`, which
is generated from `src/data/companies.json`):

| Column | Type | Note |
| --- | --- | --- |
| `id` | `u32` primary key | the row's position in the JSON, `0` means "no company" on a player |
| `slug` | `string` unique | lower-cased name, every non-alphanumeric run replaced by `-` |
| `name` | `string` | |
| `domain` | `string` unique | the lookup key for verification |
| `hqArea` | `string` | |
| `lng`, `lat` | `f64` | |
| `category` | `string` | |
| `logo` | `string` | `https://www.google.com/s2/favicons?domain=<domain>&sz=128` |
| `featured` | `bool` | the first twelve rows |

39 rows. `seedCompanies` upserts the same list into an already-published
database, behind the same admin gate as `setSecret`, so a new company does not
need a data wipe.

`player` gains two public columns: `companyId: u32` (`0` until a code is
verified, and still `0` for a domain outside the seed list) and
`verifiedDomain: string` (`''` until verified). The email is never on `player`.

`verification` (PRIVATE, confirmed skipped by codegen):

| Column | Type | Note |
| --- | --- | --- |
| `identity` | `Identity` primary key | |
| `email` | `string` unique | the only thing stopping one inbox badging two identities |
| `domain` | `string` | after the alias table, so `razorpay.in` is stored as `razorpay.com` |
| `code` | `string` | six digits, blanked on success so it cannot be replayed |
| `expiresAt` | `Timestamp` | ten minutes |
| `attempts` | `u8` | locks at 5 |
| `sendsThisHour` | `u8` | caps at 3 |
| `windowStart` | `Timestamp` | start of the current send hour |

The row survives a successful verification with `code` blanked. A second
identity typing the same address gets `email_taken`; an unverified row is taken
over and its code dies.

### The two procedures

Both are procedures, not reducers, and neither choice is cosmetic.

`requestVerification({ email }) -> string`. Lower-cases and validates the
address, refuses free and personal mail with `free_mail_domain`, applies the
alias table (`razorpay.in`, `cure.fit`, `yulu.com`, `slice.com`), then in one
transaction rate-limits the send, generates a six-digit code with `ctx.random`
and upserts the row with a ten-minute expiry. The Resend POST runs after that
transaction commits, so a slow or dead Resend never holds a lock while the world
ticks. The code is drawn before `withTx` because a transaction body may be
replayed and a code that changes on replay is a code nobody can type. Returns
`sent` or `logged`. Raises `not_joined`, `email_invalid`, `email_too_long:120`,
`free_mail_domain`, `email_taken`, `too_many_sends`.

`verifyCode({ code }) -> string`. Returns one of `ok`, `wrong_code`, `expired`,
`too_many_attempts`, `no_request`. A reducer that throws rolls its own
transaction back, so a reducer could never count a failed attempt; this commits
the increment inside `withTx` and reports the outcome as a return value. On a
match it sets `companyId` and `verifiedDomain`, writes a receipt of kind
`verified` reading `Verified as <company name or domain>`, and blanks the code.

### Fallback behaviour

With no `resend_api_key` in the private `secret` table, or when Resend refuses
the send, the row is already committed and the code goes to the module log
prefixed `DEV ONLY verification code for <email>: <code>`, and the procedure
returns `logged`. The whole flow is therefore testable with no key and no
network, the way the LLM path already falls back. The sender is the `email_from`
secret, or `resend_from`, or `Echoe <onboarding@resend.dev>`. The timeout is 8s.

### Matching bonus

`matchPair` adds 10 to the score, capped at 100, and appends `both verified` to
the reason, but only when both players carry a `verifiedDomain` and the base
score already reached the complement floor of 50. The badge rides on a
complement and never on its own: two verified people with nothing in common
still score nothing. `matchIntents` stays a pure function of two strings.

### Regenerating the seed file

```bash
cd /Users/jay/Documents/echo
/usr/bin/python3 - <<'PY'
import json, re
rows = json.load(open('src/data/companies.json'))
# id = index, slug = re.sub(r'[^a-z0-9]', '-', name.lower()), featured = id < 12
PY
```

The generator that produced `spacetimedb/src/companies.ts` is that rule applied
to every row, in JSON order. Edit the JSON, never the generated file.

### Smoke test, verbatim

Published with `--delete-data=always` because two new columns on `player` is not
an automatic migration. Every call carries `--no-config -s local3001`, and the
script is bash because zsh does not word-split the CLI path variable. The
`WARNING: This command is UNSTABLE` line the CLI prints before every call is
stripped below.

```
$ spacetime publish echo --module-path spacetimedb --server local3001 --delete-data=always -y
Build finished successfully.
Uploading to local3001 => http://127.0.0.1:3001
This will DESTROY the current echo module, and ALL corresponding data.
Skipping confirmation due to --yes
Publishing module...
Updated database with name: echo, identity: c200f6728b1b94e21450a06fcabbf5ff0fe47c5d3acf6df950ad41ac2fc0f69f

$ spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb -y
Skipping private tables during codegen: contact, llm_config, player_key, secret, talk_job, verification, world_tick.
Writing file src/module_bindings/company_table.ts
Writing file src/module_bindings/player_table.ts
Writing file src/module_bindings/seed_companies_reducer.ts
Writing file src/module_bindings/request_verification_procedure.ts
Writing file src/module_bindings/verify_code_procedure.ts
Generate finished successfully.

### 1. join
### 2. request_verification with a free-mail address (expect free_mail_domain)
Error: Response text: The module instance encountered a fatal error: free_mail_domain

### 3. request_verification with someone@razorpay.com (expect logged)
"logged"

### 4. the DEV ONLY code from the module log
code=385485

### 5. five wrong codes, then a sixth (expect wrong_code x5 then too_many_attempts)
attempt 1 (999991): "wrong_code"
attempt 2 (999992): "wrong_code"
attempt 3 (999993): "wrong_code"
attempt 4 (999994): "wrong_code"
attempt 5 (999995): "wrong_code"
attempt 6 (999996): "too_many_attempts"

### 6. verification row after the lock (attempts should be 5)
 domain         | attempts | sends_this_hour
----------------+----------+-----------------
 "razorpay.com" | 5        | 1

### 7. request_verification again (new code, attempts reset)
"logged"
code2=213501

### 8. verify_code with the right code (expect ok)
"ok"

### 9. player row: company_id and verified_domain
 name           | company_id | verified_domain
----------------+------------+-----------------
 "Smoke Tester" | 4          | "razorpay.com"

### 10. the verified receipt
 kind       | text
------------+------------------------
 "verified" | "Verified as Razorpay"

### 11. the verification row is spent (code blank)
 domain         | code | attempts
----------------+------+----------
 "razorpay.com" | ""   | 0

### 13. company row count and featured count
 companies
-----------
 39

 featured
----------
 12

### 14. seed_companies is idempotent (still 39 rows after a re-seed)
 companies
-----------
 39

### 15. alias table: razorpay.in is stored as razorpay.com
"logged"
 email                 | domain         | sends_this_hour
-----------------------+----------------+-----------------
 "founder@razorpay.in" | "razorpay.com" | 3

### 16. fourth send in the hour (expect too_many_sends)
Error: Response text: The module instance encountered a fatal error: too_many_sends

### 17. verify the alias code (expect ok, company_id still 4)
code=377421
"ok"
 name           | company_id | verified_domain
----------------+------------+-----------------
 "Smoke Tester" | 4          | "razorpay.com"

### 20. verify an unseeded work domain, on a throwaway database
"logged"
code=719498
"ok"
 name              | company_id | verified_domain
-------------------+------------+-----------------
 "Unseeded Tester" | 0          | "bosshq.in"

 kind       | text
------------+-------------------------
 "verified" | "Verified as bosshq.in"
```

Step 12 is missing on purpose: `SELECT COUNT(*) FROM company` is rejected with
`Aggregate expressions must have column aliases`, so step 13 re-runs it as
`SELECT COUNT(*) AS companies`. Steps 19 to 21 published a throwaway database
`echosmoke`, ran the unseeded-domain case there and deleted it, because the send
cap is per identity per hour and the CLI's `--anonymous` flag mints a fresh
identity on every call, so a multi-step flow cannot run under it.

## Google connect

Turns on the `Connect Google` button that `ProfileScreen` renders disabled. The
Google Identity Services button hands the page an ID token, the module checks it
with Google, and a Workspace domain becomes a company badge with no code typed.
Design and console setup: `docs/SOCIAL-CONNECT.md`.

### Table

`linked_account` (public), one row per player:

| Column | Type | Note |
| --- | --- | --- |
| `identity` | `Identity` primary key | |
| `provider` | `string` | `google` today |
| `providerId` | `string` unique | Google's `sub`. Unique is what stops one Google account badging two Echoes |
| `handle` | `string` | the email local part, or the name when there is no email |
| `displayName` | `string` | |
| `avatarUrl` | `string` | provider CDN, render with `referrerPolicy="no-referrer"` |
| `hostedDomain` | `string` | Google Workspace `hd`, `''` on a consumer account |
| `linkedAt` | `Timestamp` | |

The raw email is never stored. `handle` is its local part and nothing else, so
there is no private `linked_contact` table: nothing in the product reads a full
address after the token is checked.

`player` gains `verifiedVia: string`, one of `''`, `email`, `google`. It answers
the only question the two paths cannot answer for each other: whether unlinking
Google should take the badge with it.

### `linkGoogle({ idToken }) -> string`

A procedure because the token is checked against Google over HTTP, and the check
runs with no transaction open. `spacetimedb/src/social.ts` holds the network half
under the same never-throw contract as `llm.ts`.

`GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>`, 8s timeout, then
five checks, all of which must pass:

| Check | Failure reason |
| --- | --- |
| HTTP 200 | `http <status>: <body>` |
| `aud` equals the `google_client_id` secret | `aud_mismatch` |
| `email_verified` is `"true"` | `email_not_verified` |
| `iss` is `accounts.google.com` or `https://accounts.google.com` | `bad_issuer:<iss>` |
| `exp` is in the future | `token_expired` |

`tokeninfo` validates the signature and the expiry but not that the token was
minted for us, so the `aud` comparison is the security boundary and `hd` is only
trustworthy because of it. A missing secret raises `google_client_id_not_set`
before any HTTP call. Every rejection arrives as `google_link_failed:<reason>`
and is also logged.

On success the row is upserted and a receipt of kind `linked` reads
`Connected Google as <name>`. When `hd` is present, is not free mail, and the
player is either unverified or already verified by Google, `applyVerifiedDomain`
sets `companyId`, `verifiedDomain` and `verifiedVia: 'google'` and writes the
same `Verified as <company or domain>` receipt `verifyCode` writes. Google never
overwrites a badge the emailed code earned: that domain was proved by a code the
player typed, and `unlinkGoogle` would then strip it. Returns `linked_verified`
when the player carries a badge afterwards, `linked` when not. Other errors:
`not_joined`, `account_taken`.

`unlinkGoogle()` deletes the row, and clears the badge only when
`verifiedVia` is `google`. Raises `not_linked`.

`applyVerifiedDomain` is now the one place a badge is awarded, so the emailed
code and Google produce identical rows. `unverify` and `adminUnverify` clear
`verifiedVia` with the rest.

### Self-check

The claim rules are the security boundary, so they have a runnable check that
needs no Google and no database. Eleven assertions over a stubbed HTTP client,
including `aud_mismatch`, an unverified email, a forged issuer, an expired
token, a non-JSON body and a consumer account with no `hd`:

```
$ node --experimental-strip-types spacetimedb/social.check.ts
social.check: all claim rules hold
```

`spacetimedb/tsconfig.json` excludes `*.check.ts`, which is why the file sits
beside `src/` rather than in it: it imports node builtins that the module build
type-checks and rejects.

### Smoke test, verbatim

Published with `--delete-data=always` because `player` gained `verifiedVia`.
The `WARNING: This command is UNSTABLE` line is stripped. A real token test
waits for Jay's client id from the Google console.

```
### 1. join

### 2. link_google with no google_client_id secret (expect google_client_id_not_set)
Error: Response text: The module instance encountered a fatal error: google_client_id_not_set

### 3. set the client id, then link_google with a garbage token
Error: Response text: The module instance encountered a fatal error: google_link_failed:http 400: {
  "error": "invalid_token",
  "error_description": "Invalid Value"
}

### 4. the module log for that rejection
2026-09-05T14:00:14.769102Z  WARN: link_google spacetimedb_module:14617: linkGoogle rejected a token: http 400: {

### 5. link_google with an empty token (expect empty_token, no HTTP call)
Error: Response text: The module instance encountered a fatal error: google_link_failed:empty_token

### 6. unlink_google with nothing linked (expect not_linked)
Error: Response text: not_linked

### 7. tables are empty and the player is untouched
 linked
--------
 0

 name            | company_id | verified_domain | verified_via
-----------------+------------+-----------------+--------------
 "Google Tester" | 0          | ""              | ""

### 8. the email path still works end to end after the schema change
"logged"
code=381903
"ok"
 name            | company_id | verified_domain | verified_via
-----------------+------------+-----------------+--------------
 "Google Tester" | 4          | "razorpay.com"  | "email"

### 9. unverify clears the source too
 name            | company_id | verified_domain | verified_via
-----------------+------------+-----------------+--------------
 "Google Tester" | 0          | ""              | ""
```

The real token reached Google and came back `invalid_token`, so the HTTP path,
the timeout and the rejection branch are all proven live. What is unproven
without a client id is the `aud` match and the `hd` badge, which the self-check
covers against stubbed claims.
