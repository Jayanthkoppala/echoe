# SpacetimeDB 2.9 Field Manual — Echoe

Written for the Midnight Moonshot hackathon build (SpacetimeDB 2.9.0, TypeScript server module + React/Vite client, official `react-ts` template). Every API claim below was checked against Context7's `/websites/spacetimedb` index (current for 2.9) with `mcp__context7__query-docs`. Source URL is cited under each block. Cross-referenced against the local prep file `/Users/jay/Documents/spacetimedb-prep/RESEARCH.md` (CLI-verified locally at 2.9.0); disagreements are in the final section.

Product shape: players join a shared Bengaluru world, each spins up an AI "Echoe" persona that roams landmarks, talks to other Echoes via an LLM procedure, and leaves inspectable action receipts for the player to review and correct.

---

## 1. Tables

### `table(options, columns)` — two arguments, always

```typescript
import { table, t } from 'spacetimedb/server';

const player = table(
  { name: 'player', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    username: t.string().unique(),
    score: t.i32().index('btree'),
  }
);
```
Source: https://spacetimedb.com/docs/databases/cheat-sheet

Options: `name` (snake_case, the SQL table name), `public: true` (omit = private = invisible to clients, does not appear in codegen), `event: true` (event table, no client cache, only `onInsert` fires), `scheduled: (): any => reducerRef` (timer table, see §3), `indexes: [...]`.

### Column types

```typescript
const Coordinates = t.object('Coordinates', { x: t.f64(), y: t.f64(), z: t.f64() });
const Status = t.enum('Status', {
  Active: t.unit(),
  Inactive: t.unit(),
  Suspended: t.object('SuspendedInfo', { reason: t.string() }),
});

const player = table({ name: 'player', public: true }, {
  id: t.u64().primaryKey().autoInc(),
  name: t.string(),
  level: t.u8(),
  experience: t.u32(),
  health: t.f32(),
  score: t.i64(),
  is_online: t.bool(),
  position: Coordinates,
  status: Status,
  inventory: t.array(t.u32()),
  guild_id: t.option(t.u64()),          // nullable, form 1
  owner: t.identity(),
  connection: t.option(t.connectionId()),
  created_at: t.timestamp(),
  play_time: t.timeDuration(),
});
```
Source: https://spacetimedb.com/docs/tables/column-types

Modifiers: `.primaryKey()`, `.autoInc()`, `.unique()`, `.index('btree')`, `.optional()` (nullable, form 2, equivalent to `t.option(...)`). `t.u64()`/`t.i64()`/`t.u128()`/`t.i128()`/`t.u256()`/`t.i256()` are `bigint` in TS — write `0n`. `scheduleAt` is `t.scheduleAt()`, scheduled tables only.

### Indexes — watch the key name

Single-column inline index:
```typescript
score: t.u32().index('btree'),   // → ctx.db.player.score.filter(100)
```

Multi-column named index — **two different key names appear in Context7's own docs**:
```typescript
// cheat-sheet page uses `name`
indexes: [{ name: 'idx', algorithm: 'btree', columns: ['player_id', 'level'] }]

// constraints page uses `accessor`
indexes: [{ accessor: 'by_user_item', algorithm: 'btree', columns: ['userId', 'itemId'] }]
```
Sources: https://spacetimedb.com/docs/databases/cheat-sheet and https://spacetimedb.com/docs/tables/constraints

`accessor` is what determines `ctx.db.<table>.<accessor>.filter(...)` — use `accessor`, not `name`, in the options object. See conflicts section.

### Relationships

No foreign keys. Model a relation as a column holding the other table's PK, indexed. For many-to-many use a join table with a multi-column index — subscription joins require an index on **both** join columns (§6).

---

## 2. Reducers

```typescript
export const create_player = spacetimedb.reducer({ username: t.string() }, (ctx, { username }) => {
  ctx.db.player.insert({ id: 0n, username, score: 0 });
});

export const update_score = spacetimedb.reducer({ id: t.u64(), points: t.i32() }, (ctx, { id, points }) => {
  const player = ctx.db.player.id.find(id);
  if (!player) throw new Error('Player not found');
  player.score += points;
  ctx.db.player.id.update(player);      // mutate the found row, pass it back in
});
```
Source: https://spacetimedb.com/docs/databases/cheat-sheet

Row ops, exact method names:
```typescript
ctx.db.player.insert({ ... });                        // insert only exists on the table accessor
ctx.db.player.id.find(123n);                          // by primary key → row | null
ctx.db.player.username.find('Alice');                 // by unique column → row | null
ctx.db.player.score.filter(100);                      // by btree index → iterator
ctx.db.player.iter();                                 // all rows → iterator
ctx.db.player.id.update(row);                          // by PK, pass full row
ctx.db.player.id.delete(123n);                        // by PK
```
Source: https://spacetimedb.com/docs/tables/access-permissions

`iter()` and `filter()` return iterators — spread with `[...x]` before `.sort()`/`.map()`.

### `ctx` contents

| Member | Notes |
|---|---|
| `ctx.db` | typed table accessors |
| `ctx.sender` | the authenticated caller's `Identity`. Never trust an identity passed as an argument |
| `ctx.connectionId` | see disconnect note below |
| `ctx.timestamp` | deterministic per call |
| `ctx.random` | seeded RNG, not `Math.random()` |

```typescript
export const send_message = spacetimedb.reducer({ text: t.string() }, (ctx, { text }) => {
  if (!text) throw new SenderError('Messages must not be empty');
  ctx.db.message.insert({ sender: ctx.sender, text, sent: ctx.timestamp });
});
```
Source: https://spacetimedb.com/docs/tutorials/chat-app

`throw new SenderError('msg')` rolls back the transaction and sends the message text to the calling client. A plain `throw new Error(...)` also aborts.

### Lifecycle reducers

```typescript
export const init = spacetimedb.init((ctx) => {
  ctx.db.config.insert({ ownerIdentity: ctx.sender });   // ctx.sender in init = module owner
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  console.log(`Client disconnected: ${ctx.sender}`);
  const connId = ctx.connectionId!;                      // "guaranteed to be defined" here
  ctx.db.sessions.connection_id.delete(connId);
});
```
Source: https://spacetimedb.com/docs/functions/reducers/lifecycle

Must be `export const` — a bare call compiles and silently does nothing.

---

## 3. Scheduled reducers (and scheduled procedures)

```typescript
import { ScheduleAt } from 'spacetimedb';

const reminder_schedule = table(
  { name: 'reminder_schedule', scheduled: (): any => send_reminder },
  { id: t.u64().primaryKey().autoInc(), scheduled_at: t.scheduleAt() }
);

export const send_reminder = spacetimedb.reducer(
  { arg: reminder_schedule.rowType },
  (ctx, { arg }) => { /* tick body */ }
);

export const init = spacetimedb.init(ctx => {
  ctx.db.reminder_schedule.insert({ id: 0n, scheduled_at: ScheduleAt.interval(50_000n) }); // µs
});
```
Source: https://spacetimedb.com/docs/tables/schedule-tables

`ScheduleAt.interval(microsBigInt)` repeats until the row is deleted. `ScheduleAt.time(...)` fires once and auto-deletes its row. The `scheduled` table option and the target must be exported.

**A schedule table can also target a procedure, not just a reducer** — useful for a scheduled outbound-HTTP job (e.g. periodic world-state sync to an LLM):
```typescript
const fetchSchedule = table(
  { name: 'fetch_schedule', scheduled: (): any => fetch_external_data },
  { scheduled_id: t.u64().primaryKey().autoInc(), scheduled_at: t.scheduleAt(), url: t.string() }
);
export const fetch_external_data = spacetimedb.procedure(
  { arg: fetchSchedule.rowType }, t.unit(),
  (ctx, { arg }) => { const r = ctx.http.fetch(arg.url); return {}; }
);
```
Source: https://spacetimedb.com/docs/functions/reducers (marked `STDB_UNSTABLE` in the C# equivalent — treat as unstable in TS too, don't put on the critical path).

No documented minimum interval; RESEARCH.md's local source read found no `MIN_INTERVAL` constant either. Don't go below ~16ms for a demo.

---

## 4. Procedures

```typescript
export const inspect = spacetimedb.procedure(
  { input: t.string() },     // args schema
  Result,                    // declared return type
  (_ctx, { input }) => ({ value: input })
);
```
Source: https://spacetimedb.com/docs/functions/procedures

Signature is `spacetimedb.procedure(argsSchema, returnSchema, callback)`. A single-type-arg overload also appears in the docs (`spacetimedb.procedure(t.unit(), ctx => {...})`, return type implicit) — prefer the explicit 3-arg form for clarity. Callbacks are synchronous — never `async`/`await`. Return value goes only to the caller, never broadcast.

### Outbound HTTP — this is Echoe's LLM call path

```typescript
export const ask_ai = spacetimedb.procedure(
  { prompt: t.string(), apiKey: t.string() },
  t.string(),
  (ctx, { prompt, apiKey }) => {
    const response = ctx.http.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: prompt }] }),
      timeout: TimeDuration.fromMillis(3000),
    });
    if (response.status !== 200) throw new SenderError(`API returned status ${response.status}`);
    const data = response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) throw new SenderError('Failed to parse AI response');
    ctx.withTx(txCtx => {
      txCtx.db.aiMessage.insert({ user: txCtx.sender, prompt, response: aiResponse, createdAt: txCtx.timestamp });
    });
    return aiResponse;
  }
);
```
Source: https://spacetimedb.com/docs/functions/procedures

`ctx.http.fetch` is synchronous, has `.status`, `.headers.get(name)`, `.text()`, `.json()`. Do network I/O **before** opening `ctx.withTx`. In Rust, unset timeout defaults to 30s, capped at 180s (same doc page) — treat that as the working assumption for the JS host until proven otherwise. `t.unit()` return type → return `{}`.

### Calling a procedure from the client

```typescript
conn.procedures.fetchExternalData(url)
  .then(result => console.log(`Got result: ${result}`))
  .catch(error => console.error(`Error: ${error}`));
```
Source: https://spacetimedb.com/docs/clients/codegen

---

## 5. Row-level security and per-user views

Client visibility filter (row-level, TypeScript form confirmed same shape RESEARCH.md documented):
```typescript
export const privateNoteFilter = spacetimedb.clientVisibilityFilter.sql(
  'SELECT * FROM owned_row WHERE owner = :sender'
);
```
Source: https://spacetimedb.com/docs/how-to/rls (TS form cross-checked against Rust/C# equivalents on the same page, all use `:sender`)

Per-user view (own Echoe's private reasoning/receipts, for example) — shape confirmed via the Rust example, same idea applies to the TS `spacetimedb.view(options, returnSchema, callback)` form:
```rust
#[spacetimedb::view(accessor = my_colleagues, public)]
fn my_colleagues(ctx: &ViewContext) -> Vec<Colleague> {
    let Some(me) = ctx.db.employee().identity().find(&ctx.sender()) else { return vec![]; };
    ctx.db.employee().department().filter(&me.department)
        .map(|emp| Colleague { id: emp.id, name: emp.name.clone(), department: emp.department.clone() })
        .collect()
}
```
Source: https://spacetimedb.com/docs/tables/access-permissions

Use this pattern for "each player only sees their own Echoe's raw reasoning trace, everyone sees the public action receipts."

---

## 6. Filtered subscriptions

```typescript
// Query builder, type-safe, recommended
const [onlineUsers, isReady] = useTable(
  tables.user.where(r => r.online.eq(true)),
  {
    onInsert: (user) => console.log('connected:', user.name),
    onDelete: (user) => console.log('disconnected:', user.name),
    onUpdate: (oldUser, newUser) => console.log('changed:', newUser.name),
  }
);

// Raw SQL also accepted, on the connection directly
conn.subscriptionBuilder().subscribe(tables.user);
conn.subscriptionBuilder().subscribe([tables.user, tables.message]);
```
Source: https://spacetimedb.com/docs/clients/typescript

Subscription SQL subset: single table only, whole row only (`SELECT *`), joins capped at 2 tables with both join columns indexed, no `ORDER BY`/`GROUP BY`/`LIMIT`/aggregates, no arithmetic in `WHERE`. Scope every subscription (e.g. `WHERE zone = 'mg-road'`) — fanout is per-client per-transaction, an unscoped `SELECT * FROM echo` pushes every Echoe's move to every player.

---

## 7. React client

```typescript
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';

const connectionBuilder = DbConnection.builder()
  .withUri('wss://maincloud.spacetimedb.com')
  .withDatabaseName('my_module')
  .withToken(localStorage.getItem(TOKEN_KEY) || undefined)
  .onConnect((conn, identity, token) => {
    console.log('Connected:', identity.toHexString());
    localStorage.setItem(TOKEN_KEY, token);
  })
  .onDisconnect(() => console.log('Disconnected'));

function Root() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  );
}
```
Source: https://spacetimedb.com/docs/clients/typescript

Pass the **builder**, unbuilt — the provider calls `.build()` itself.

```typescript
const { identity, isActive: connected } = useSpacetimeDB();
const [messages, isReady] = useTable(tables.message);
const sendMessage = useReducer(reducers.sendMessage);
sendMessage({ text: 'hi' }).then(() => {}).catch(err => {});
```
Source: https://spacetimedb.com/docs/tutorials/chat-app

`useTable` returns `[rows, isReady]`. `useSpacetimeDB` returns `{ isActive, identity, token, getConnection }`. `useReducer(reducers.x)` returns a function returning a Promise. **Every official example that shows the `onConnect` signature uses `(conn, identity, token)`, three positional args** — this confirms RESEARCH.md's open question #1 in favor of the 3-arg form.

Identity/token persistence pattern (key by host **and** db name to survive a local→maincloud switch):
```typescript
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;
```
Source: pattern cross-checked against `templates/chat-react-ts` in RESEARCH.md; Context7's Deno quickstart shows the equivalent `loadToken()`/`saveToken()` pair. Source: https://spacetimedb.com/docs/quickstarts/deno

---

## 8. CLI

```bash
spacetime start                          # local server
spacetime dev                            # interactive: server + publish + generate + client dev server, watches for changes
spacetime login                          # auth

spacetime build                          # compile only, no publish
spacetime publish <NAME>                 # publish, auto-migrates if compatible
spacetime publish --delete-data <NAME>   # wipe and republish (dev default)
spacetime publish --break-clients <NAME> # allow client-breaking, non-data-destroying changes through
spacetime delete <NAME>                  # delete a database

spacetime logs <NAME>                    # view logs
spacetime logs --follow <NAME>           # stream
spacetime sql <NAME> "SELECT * FROM t"   # ad-hoc query
spacetime describe <NAME>                # dump schema
spacetime call <NAME> reducer arg1 arg2  # invoke a reducer, one JSON-encoded positional arg each

spacetime generate --lang rust <NAME>
spacetime generate --lang csharp <NAME>
spacetime generate --lang ts <NAME>      # ⚠️ see conflicts — RESEARCH.md's verified flag is `typescript`, not `ts`
```
Source: https://spacetimedb.com/docs/databases/cheat-sheet

`--delete-data` accepts `always` / `on-conflict` / `never` as a value (`--delete-data=always`), confirmed separately: https://spacetimedb.com/docs/cli-reference

Maincloud: omit `--server` (it's the default) or pass `--server maincloud`; requires `spacetime login` first. Local: `--server local`, no login needed. Client connects at `wss://maincloud.spacetimedb.com` vs `ws://localhost:3000`.

---

## 9. Schema migration rules

```bash
spacetime publish --delete-data <DATABASE_NAME>   # dev/test reset, destructive, never in prod
spacetime publish --break-clients <DATABASE_NAME> # breaking but non-destructive change, allowed through
```
Source: https://spacetimedb.com/docs/databases/building-publishing, https://spacetimedb.com/docs/databases/automatic-migrations, https://spacetimedb.com/docs/intro/faq

Automatic migration handles: adding tables, adding columns **with a default value**. Forbidden — publish fails outright: removing columns, reordering, retyping; these need an "incremental migration" pattern (new table + backfill), not a plain publish. This matches RESEARCH.md's more granular allowed/breaks-clients/forbidden table in its §6.1 — no conflict, RESEARCH.md is simply more detailed (it also covers unique/primaryKey/index churn, which Context7's pages don't enumerate).

---

## 10. Known limits

| Thing | Value | Source |
|---|---|---|
| HTTP request timeout (procedures, Rust) | Default 30s if unset, capped at 180s | https://spacetimedb.com/docs/functions/procedures |
| Reducer determinism | No `Date.now()`/`Math.random()` — use `ctx.timestamp`/`ctx.random` | https://spacetimedb.com/docs/tutorials/chat-app (pattern), consistent with RESEARCH.md §2.3 |
| `bigint` columns | `t.u64()`/`t.i64()` etc. are `bigint` client-side; write `0n` for autoInc | https://spacetimedb.com/docs/tables/column-types |
| Subscription join limit | 2 tables max, both join columns indexed | https://spacetimedb.com/docs/clients/typescript (implied by query-builder examples); RESEARCH.md §6.6 states this explicitly with the compiler-enforced detail |
| Batch inserts | Loop `insert()` calls inside one reducer call, not one per network round trip | https://spacetimedb.com/docs/tables/performance |

RESEARCH.md's local source read (energy budget numbers, WebSocket 32 MiB cap, the "V8 timeout enforcement is currently a no-op" finding, free-tier TeV numbers) was not independently re-derivable from Context7's indexed pages — no page in this index covers energy accounting or the V8 host internals. Treat that section of RESEARCH.md as the source of record; nothing here contradicts it.

---

## Where prep RESEARCH.md disagrees with Context7

1. **Index option key: `accessor` vs `name`.** RESEARCH.md's §1.4 says every `indexes` entry needs `accessor`. Context7's own `databases/cheat-sheet` page uses `name` in one multi-column index example, while its `tables/constraints` page uses `accessor` in another. This is Context7 disagreeing with itself, not with RESEARCH.md — but it means the cheat-sheet example is likely stale or wrong. **Use `accessor`**, matching RESEARCH.md and the constraints page.

2. **`ctx.connectionId` nullability in `clientDisconnected`.** RESEARCH.md's §6.10 states `ctx.connectionId` is "nullable everywhere, including in `clientConnected`" and tells you to guard it. Context7's `functions/reducers/lifecycle` page states the opposite for `clientDisconnected` specifically: "the `ctx.connectionId` is guaranteed to be defined" and uses `ctx.connectionId!` without a null check. These directly conflict for the disconnect hook. **Practical resolution: guard it anyway.** A non-null assertion that turns out wrong throws at runtime inside a reducer, which is worse than an unnecessary `if (ctx.connectionId)` check. Cheap insurance, no downside.

3. **CLI flag: `generate --lang ts` vs `--lang typescript`.** Context7's cheat-sheet page shows `spacetime generate --lang ts <NAME>`. RESEARCH.md verified locally against the actual 2.9.0 CLI (`--help` output) that the flag value is `typescript`, not `ts`, and includes `--out-dir`/`--module-path`. **Trust RESEARCH.md here** — it's checked against the running binary, Context7's example is very likely an abbreviated/aspirational doc snippet.

4. **`onConnect` builder signature — resolved, not a conflict.** RESEARCH.md flagged this as an open question (§9.1): four templates use `(conn, identity, token)`, one skill doc showed a single-`ctx` form. Every Context7 example that shows the callback (`clients/typescript`, `quickstarts/deno`, `quickstarts/nextjs`) uses the 3-arg `(conn, identity, token)` form with no exception. Treat RESEARCH.md's open question as closed in favor of the 3-arg form.

No other conflicts found across the 9 concepts queried (tables/columns, reducers, scheduled reducers, procedures, RLS/views, filtered subscriptions, React client, CLI, migrations, limits).
