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
| `run` | public | The session started by "Send my Echoe out". Goal, status (running, paused, ended), counters, and `spent_usd`, the OpenRouter credits this run has burned. `owner` is unique, so a player has exactly one run row that is reused across nights. |
| `receipt` | public | Append-only. Nothing in the module ever updates or deletes a receipt. This is what screen 6 renders and what makes a correction honest. |
| `conversation` | public | One row per talking pair. `echo_a` is always the numerically smaller id, which makes the pair a stable key. `replies` counts exchanges; it is a counter, not a cap. |
| `transcript_line` | public | The lines themselves. `is_ai` is always true so the client can label every line. `feedback` is `none`, `like` or `not_me`. |
| `correction` | public | One row per correction on screen 8. Keeps the original text alongside the replacement, so the record of what was actually said survives. |
| `mission` | public | Single row, id 0. The shared "tonight's mission" line on screen 3. |
| `llm_config` | **private** | Single row, id 0. Holds the house key, model and chat-completions endpoint (empty means OpenRouter; the demo uses Vertex AI's native generateContent route on the boss-media project, key as a query parameter, because Vertex's OpenAI-compatible route refuses API keys). No `public: true`, so it is invisible to every client and absent from codegen. The key goes in through a reducer argument and never comes back out. |
| `player_key` | **private** | One row per player who signed in with OpenRouter. Written only by the `linkOpenRouter` procedure, read only by `echoTalk` for exchanges whose funding is `own`. The client sees just `player.openrouter_linked`. |
| `echo_memory` | **private** | One line per (echo, other echo): what this Echoe remembers about that person, written by `echoTalk` when a conversation closes from the transcript itself, read into the prompt the next time the pair meets. The database is the memory; no external service. |
| `google_auth` | **private** | Single row: Google OAuth client id, secret, refresh token and the cached access token with its expiry. Written by `setGoogleAuth`, refreshed by the procedures, never readable by clients. |
| `world_tick` | **private** | Drives the `tick` reducer on a 5 second interval. |
| `talk_job` | **private** | One-shot jobs carrying a conversation and its `payer` into the `echoTalk` procedure. Rows are deleted automatically once the procedure returns. |

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
| `createEcho` | `persona`, `intent` | Caller has joined. Persona is non-empty and at most 2000 characters. No avatar argument: the face follows the identity seed written at join. Called again, it replaces the persona and keeps the accumulated behaviour notes. |
| `travel` | `placeId` | Caller has joined and has an Echoe. The place exists. The player is not already there. Writes a leg and a receipt. |
| `startRun` | `goal`, `hostShareId` | Caller has joined and has an Echoe. Goal non-empty, at most 280 characters. `hostShareId` is empty or names a live intent that is not the caller's own. No caps: the run is bounded by the clock and by OpenRouter credits. |
| `pauseRun` | none | A run exists and is running. |
| `resumeRun` | none | A run exists and is paused. |
| `endRun` | none | A run exists and is not already ended. Writes a `run_end` receipt. |
| `rateLine` | `lineId`, `soundsLikeMe` | Caller has an Echoe. The line exists and was spoken by the caller's own Echoe. Sets feedback to `like` or `not_me`. |
| `correct` | `lineId`, `shouldHaveSaid`, `behaviourChange` | Caller has an Echoe. The line exists and is the caller's own. Both texts non-empty, at most 500 characters. Appends a correction row, appends a note to `behaviour_notes`, and marks the line `not_me`. Touches no receipt. |
| `setGoogleAuth` | `clientId`, `clientSecret`, `refreshToken` | Admin only. Google OAuth for the house lane, from `gcloud auth application-default login`; Vertex AI refuses API keys, so the procedures trade the refresh token for a cached one-hour access token. |
| `setLlmConfig` | `apiKey`, `model`, `endpoint` | Key and model non-empty; endpoint empty or `https://`. First caller becomes admin. Writes the single private config row. |
| `unlinkOpenRouter` | none | Caller has joined. Deletes the caller's private `player_key` row and clears `player.openrouter_linked`. |
| `setMission` | `text` | Non-empty, at most 200 characters. |
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
   and write a `run_end` receipt. Running out of OpenRouter credit ends it too:
   the procedure gets a non-2xx and falls back, and the receipts show $0 lines.
2. **In transit?** If the latest leg has not reached its `arrive_ts`, do nothing
   this tick.
3. **Arrived but unbanked?** Move `current_place` to the leg destination,
   increment `places_visited`, write an `arrive` receipt, and stop for this tick.
4. **Standing at a landmark.** Try to converse with a co-located Echoe. That is
   the only thing an Echoe does at a landmark. Before the first departure there is no
   leg at all, so the run's own `started_at` anchors the dwell and every Echoe
   gets one chance to talk where it began.
5. **Dwell elapsed?** Depart for another landmark.

### Who talks to whom

A conversation is created only when all of these hold: both runs are running,
both are at the same place, and the pair has no conversation belonging to the
current pair of runs. A
conversation older than either run is treated as a memory of a previous night
and a new one is started, otherwise `people_met` would stay at zero while a
transcript kept growing.

Once a conversation exists, each side may add one more exchange per tick until
it reaches `MAX_EXCHANGES` (4, a module constant, not a setting). Then it is
closed, and the find step stops chasing that Echoe for the rest of the run. Each exchange is billed to its initiator in real
OpenRouter credits, taken from `usage.cost` on the response.

### Where they walk

An Echoe allowed to `find` heads for a landmark holding another running Echoe,
aiming at where that Echoe will be rather than where it was. Only the
lower-numbered Echoe of any pair gives chase. If both chased, two Echoes would
swap landmarks every tick and never actually arrive together, which is what the
first version did. Otherwise the destination is a uniformly random other
landmark.

## Credits

Each Echoe gets `FREE_CONVERSATIONS` (5) conversations on the house key, for
life, counted the first time it speaks in one and then fixed for that
conversation. After that its lines are billed to the player's own key from
`player_key`, obtained through OpenRouter's PKCE sign-in: the browser sends the
player to `openrouter.ai/auth` with a code challenge, gets a one-time code back,
and the `linkOpenRouter` procedure exchanges it at `/api/v1/auth/keys` and
stores the key server-side. With no key the tick brings the run home. There are no app
credits otherwise. Every LLM exchange is billed in OpenRouter credits
(USD). `echoTalk` reads `usage.cost` from the response, adds it to the paying
run's `spent_usd`, and writes an `llm` receipt carrying the exact amount. The
deterministic fallback costs nothing and writes no `llm` receipt. Travel, find
and the rest are free and always were.

Per-player OpenRouter keys (minted through the management API on join, one
spend limit each) are the next step; today a single key in `llm_config` pays
for everyone.

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
correction on screen 8 visibly change what the Echoe says afterwards.

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
$ spacetime call --no-config -s local3001 echo create_echo '"Blunt Bengaluru builder..."' '"looking for two people to build with"'
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
-- rate a line spoken by the other Echoe:   not_your_line
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
