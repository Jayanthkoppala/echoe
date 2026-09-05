# Echo data model

The SpacetimeDB module for Echo. Everything lives in `spacetimedb/src/index.ts`,
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
| `player` | public | One row per human. `identity` is the primary key and always comes from `ctx.sender`, never from an argument. Holds name, avatar, online flag, `current_place`, and the credit wallet. |
| `echo` | public | The player's agent. `owner` is unique per identity. `persona` is authored on screen 2; `behaviour_notes` accumulates from corrections and is fed into every later prompt. |
| `place` | public | The ten Bengaluru landmarks, seeded once in `init`. Read-only afterwards. Array index is the place id. |
| `agent_travel` | public | One row per leg, written only at leg boundaries. A roaming Echo costs two rows per landmark rather than a position update per frame; the client interpolates between `depart_ts` and `arrive_ts`. |
| `run` | public | The limits set on screen 4 plus live counters. `owner` is unique, so a player has exactly one run row that is reused across nights. |
| `receipt` | public | Append-only. Nothing in the module ever updates or deletes a receipt. This is what screen 6 renders and what makes a correction honest. |
| `conversation` | public | One row per talking pair. `echo_a` is always the numerically smaller id, which makes the pair a stable key. `replies` counts exchanges against the run's `replies_per_person`. |
| `transcript_line` | public | The lines themselves. `is_ai` is always true so the client can label every line. `feedback` is `none`, `like` or `not_me`. |
| `correction` | public | One row per correction on screen 8. Keeps the original text alongside the replacement, so the record of what was actually said survives. |
| `mission` | public | Single row, id 0. The shared "tonight's mission" line on screen 3. |
| `llm_config` | **private** | Single row, id 0. Holds the OpenRouter key and model. No `public: true`, so it is invisible to every client and absent from codegen. The key goes in through a reducer argument and never comes back out. |
| `world_tick` | **private** | Drives the `tick` reducer on a 5 second interval. |
| `talk_job` | **private** | One-shot jobs carrying a conversation into the `echoTalk` procedure. Rows are deleted automatically once the procedure returns. |

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
| `join` | `name` | Name is non-empty after trimming and at most 40 characters. Called again by an existing player, it renames and marks them online rather than failing. |
| `createEcho` | `avatar`, `persona` | Caller has joined. Avatar is one of circle, square, triangle, diamond, hex. Persona is non-empty and at most 2000 characters. Called again, it replaces the persona and keeps the accumulated behaviour notes. |
| `travel` | `placeId` | Caller has joined and has an Echo. The place exists. The player is not already there. Writes a leg and a zero-cost receipt. |
| `act` | `kind` | Caller has joined and has an Echo. `kind` is one of travel, find, talk, dance, build, bluff. If a run is live, the action must be in its allowed set and the run's cap must have room. Talk and bluff cost one credit; the rest cost nothing. |
| `startRun` | `goal`, `maxPeople`, `repliesPerPerson`, `creditCap`, `allowedActions` | Caller has joined and has an Echo. Goal non-empty, at most 280 characters. `maxPeople` is 1, 3 or 5. `repliesPerPerson` is 1, 2 or 3. `creditCap` is between 1 and 8. Every entry in the comma-separated `allowedActions` is a known action and the list is non-empty. Refills the wallet to 8 so a second night is possible. |
| `pauseRun` | none | A run exists and is running. |
| `resumeRun` | none | A run exists and is paused. |
| `endRun` | none | A run exists and is not already ended. Writes a `run_end` receipt. |
| `rateLine` | `lineId`, `soundsLikeMe` | Caller has an Echo. The line exists and was spoken by the caller's own Echo. Sets feedback to `like` or `not_me`. |
| `correct` | `lineId`, `shouldHaveSaid`, `behaviourChange` | Caller has an Echo. The line exists and is the caller's own. Both texts non-empty, at most 500 characters. Appends a correction row, appends a note to `behaviour_notes`, and marks the line `not_me`. Touches no receipt. |
| `setLlmConfig` | `apiKey`, `model` | Both non-empty. Writes the single private config row. |
| `setMission` | `text` | Non-empty, at most 200 characters. |
| `tick` | scheduled | Not callable by clients. See below. |

Presence is handled by `clientConnected` and `clientDisconnected`, which flip
`player.online`. A player who has not joined yet is ignored by both.

## The tick

`world_tick` fires the `tick` reducer every 5 seconds. A "24 hour" roam is
compressed to 3 minutes so a judge can watch one end to end. Travel takes 4
seconds, and an Echo dwells at a landmark for 6 seconds before departing.

The tick iterates a snapshot of `run` but re-reads each row before acting on it.
This is not incidental: one Echo's turn writes to another Echo's run when a
conversation bumps `people_met` on both sides, and acting on the stale snapshot
silently rolled that write back. The first version of this had exactly that bug.

For every run whose status is `running`:

1. **Stop conditions first.** If the compressed day has elapsed, or
   `credits_spent` has reached `credit_cap`, finish the run and write a
   `run_end` receipt.
2. **In transit?** If the latest leg has not reached its `arrive_ts`, do nothing
   this tick.
3. **Arrived but unbanked?** Move `current_place` to the leg destination,
   increment `places_visited`, write an `arrive` receipt, and stop for this tick.
4. **Standing at a landmark.** Try to converse with a co-located Echo. If no
   conversation happened, maybe build. Before the first departure there is no
   leg at all, so the run's own `started_at` anchors the dwell and every Echo
   gets one chance to talk where it began.
5. **Dwell elapsed?** Depart for another landmark.

### Who talks to whom

A conversation is created only when all of these hold: both runs allow `talk`,
both are running, both are at the same place, neither has reached `max_people`,
and the pair has no conversation belonging to the current pair of runs. A
conversation older than either run is treated as a memory of a previous night
and a new one is started, otherwise `people_met` would stay at zero while a
transcript kept growing.

Once a conversation exists, each side may add one more exchange per tick until
`replies` reaches that run's `replies_per_person`. Each exchange costs its
initiator one credit.

### Where they walk

An Echo allowed to `find` heads for a landmark holding another running Echo,
aiming at where that Echo will be rather than where it was. Only the
lower-numbered Echo of any pair gives chase. If both chased, two Echoes would
swap landmarks every tick and never actually arrive together, which is what the
first version did. Otherwise the destination is a uniformly random other
landmark.

## Credits

The default wallet is 8 credits, refilled at the start of each run.

| Action | Cost |
| --- | --- |
| travel, find, dance, build | 0 |
| talk, bluff | 1 |

Every charge passes through one function that checks both budgets before writing
anything: the player's wallet must hold the cost, and the run's `credits_spent`
plus the cost must not exceed its `credit_cap`. If either refuses, nothing is
mutated and no line is ever generated.

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
correction on screen 8 visibly change what the Echo says afterwards.

On any failure at all, transport, non-2xx, or unparseable body, the procedure
writes the deterministic exchange instead and logs the reason. The reducer has
already paid for and counted the exchange, so a conversation always ends up with
words in it. When no key is configured the tick never queues a job and writes
the fallback lines directly, which means the demo runs with no network and no
key at all.

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

The three private tables cannot be subscribed to and are absent from
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

`--no-config` is required on every `call`, `sql` and `logs` command, because the
scaffold's `spacetime.local.json` names a database (`echo-t94lc`) that was never
published and otherwise overrides the positional name.

A second identity comes from a separate `HOME`, since `--anonymous` mints a
fresh identity on every call and cannot hold state across two of them.

### Observed output

```
$ spacetime call --no-config -s local3001 echo join '"Jay"'
$ spacetime call --no-config -s local3001 echo create_echo '"circle"' '"Blunt Bengaluru builder..."'
$ spacetime call --no-config -s local3001 echo start_run '"Find someone who changed their mind"' '3' '2' '6' '"travel,talk,build,find"'

$ spacetime sql --no-config -s local3001 echo "SELECT name, avatar, current_place, credits FROM player"
 name    | avatar   | current_place | credits
---------+----------+---------------+---------
 "Jay"   | "circle" | 0             | 8
 "Rudra" | "hex"    | 0             | 8
```

After 25 seconds of ticks, with two Echoes that began at Bangalore Palace:

```
$ spacetime sql --no-config -s local3001 echo "SELECT echo_id, from_place, to_place FROM agent_travel"
 echo_id | from_place | to_place
---------+------------+----------
 2       | 0          | 1
 1       | 0          | 1
 2       | 1          | 6
 1       | 1          | 6

$ spacetime sql --no-config -s local3001 echo "SELECT id, echo_a, echo_b, place_id, replies FROM conversation"
 id | echo_a | echo_b | place_id | replies
----+--------+--------+----------+---------
 1  | 1      | 2      | 0        | 2

$ spacetime sql --no-config -s local3001 echo "SELECT id, speaker_echo_id, text FROM transcript_line"
 id | speaker_echo_id | text
----+-----------------+-------------------------------------------------------------------------
 1  | 1               | "You look like you have been walking all night too. (Bangalore Palace)"
 2  | 2               | "Not lost. Just slow about it."
 3  | 1               | "Everyone keeps moving. You stopped. Why? (Bangalore Palace)"
 4  | 2               | "Not lost. Just slow about it."

$ spacetime sql --no-config -s local3001 echo "SELECT id, status, people_met, places_visited, built, credits_spent FROM run"
 id | status    | people_met | places_visited | built | credits_spent
----+-----------+------------+----------------+-------+---------------
 1  | "running" | 1          | 2              | 1     | 1
 2  | "running" | 1          | 2              | 2     | 1
```

Two exchanges, which is exactly `replies_per_person`, and one credit charged to
each side. The Echoes then travel together because the find bias is working.

Review and correct:

```
$ spacetime call --no-config -s local3001 echo rate_line '1' 'true'
$ spacetime call --no-config -s local3001 echo correct '3' '"Ask what they build, not where they walk."' '"Open with a question about their work, never small talk."'

$ spacetime sql --no-config -s local3001 echo "SELECT id, feedback FROM transcript_line"
 id | feedback
----+----------
 1  | "like"
 2  | "none"
 3  | "not_me"
 4  | "none"

$ spacetime sql --no-config -s local3001 echo "SELECT id, behaviour_notes FROM echo"
 id | behaviour_notes
----+--------------------------------------------------------------------------------
 1  | "- Open with a question about their work, never small talk. (instead of ..."
 2  | ""
```

The receipt count is unchanged by the correction.

Every one of these is refused:

```
-- rate a line spoken by the other Echo:   not_your_line
-- unknown action:                         unknown_action:teleport
-- max_people outside 1/3/5:               bad_max_people:4
-- credit cap above the default wallet:    bad_credit_cap:99
-- empty persona:                          persona_required
-- unknown avatar:                         unknown_avatar:blob
```

And they show up in the module log, which is how you confirm the module is
doing real work:

```
$ spacetime logs --no-config -s local3001 echo -n 10
2026-09-05T10:49:55Z  INFO: Invoking `init` reducer
2026-09-05T10:49:55Z  INFO: Database initialized
2026-09-05T10:50:26Z ERROR: rate_line: not_your_line
2026-09-05T10:50:26Z ERROR: act: unknown_action:teleport
2026-09-05T10:50:26Z ERROR: start_run: bad_max_people:4
2026-09-05T10:50:26Z ERROR: start_run: bad_credit_cap:99
2026-09-05T10:50:26Z ERROR: create_echo: persona_required
2026-09-05T10:50:26Z ERROR: create_echo: unknown_avatar:blob
```

### The LLM path, proven

Configured with a deliberately invalid key so the fallback is exercised:

```
$ spacetime call --no-config -s local3001 echo set_llm_config '"sk-or-v1-INVALID..."' '"google/gemini-2.0-flash-001"'

$ spacetime logs --no-config -s local3001 echo -n 15
2026-09-05T10:50:50Z WARN: echo_talk: echoTalk falling back: http 401: {"error":{"message":"User not found.","code":401}}
2026-09-05T10:50:51Z WARN: echo_talk: echoTalk falling back: http 401: {"error":{"message":"User not found.","code":401}}
```

The scheduled procedure ran, reached OpenRouter through `ctx.http.fetch`, got a
real HTTP 401, and wrote the deterministic exchange instead. Transcript lines
appeared for all three conversations. With a valid key the same path writes
model output instead, and nothing else about the simulation changes.
