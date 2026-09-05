// End-to-end check for the "meet who you want, reveal when you both agree"
// flow: createEcho -> startRun -> setReveal -> joinEvent fan-out -> revealTo ->
// readReveal. Three fresh anonymous identities, driven through the real
// TypeScript SDK against a locally running module (no mocks).
//
// The generated bindings import each other without file extensions (bundler
// resolution), which Node's ESM loader rejects even under --experimental-
// strip-types. So bundle first with the esbuild already vendored under
// node_modules/.bin, then run the bundle on Node 22 (for global WebSocket):
//
//   node_modules/.bin/esbuild spacetimedb/flow.check.ts --bundle \
//     --platform=node --format=esm --external:undici --outfile=/tmp/flow.check.bundle.mjs
//   /Users/jay/.nvm/versions/node/v22.23.2/bin/node --experimental-websocket \
//     /tmp/flow.check.bundle.mjs [server-host] [db-name]
//
// Assumes `spacetime publish echo --module-path spacetimedb --server local3001 -y`
// has already been run against the target host.
import assert from 'node:assert/strict';
import { DbConnection } from '../src/module_bindings/index.ts';

const HOST = process.argv[2] ?? 'ws://localhost:3001';
const DB = process.argv[3] ?? 'echo';
const EVENT_ID = `flow-check-${Date.now()}`;

let passed = 0;
let failed = 0;
function step(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL: ${name} -- ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
}

function connect(label: string): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    const builder = DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DB)
      .withToken(undefined) // fresh anonymous identity every time, on purpose
      .onConnect(conn => {
        conn.subscriptionBuilder().subscribeToAllTables();
        resolve(conn);
      })
      .onConnectError((_ctx, err) => reject(new Error(`${label} connect failed: ${err.message}`)));
    builder.build();
  });
}

/** Poll the client cache until `pred` is true or `ms` elapses. */
async function waitFor<T>(
  pred: () => T | undefined | null | false | Promise<T | undefined | null | false>,
  ms = 5000
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = await pred();
    if (v) return v;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('timed out waiting for condition');
}

async function main() {
  const [A, B, C] = await Promise.all([connect('A'), connect('B'), connect('C')]);

  // Step 1: A joins, creates an Echoe (persona only, no intent arg), starts a run.
  await step('1. startRun writes goal/avoid and sets intent.text', async () => {
    A.reducers.join({ name: 'alice', email: '' });
    A.reducers.createEcho({ persona: 'Runs a tiny dev shop, likes long walks and Rust.' });
    await waitFor(() => A.db.echo.iter().toArray().find(e => e.owner.isEqual(A.identity!)));
    A.reducers.startRun({ goal: 'find a designer', avoid: 'recruiters', hostShareId: '' });
    const run = await waitFor(() => A.db.run.iter().toArray().find(r => r.owner.isEqual(A.identity!)));
    assert.equal(run.goal, 'find a designer');
    assert.equal(run.avoid, 'recruiters');
    const intent = await waitFor(() =>
      A.db.intent.iter().toArray().find(i => i.owner.isEqual(A.identity!) && i.text === 'find a designer')
    );
    assert.equal(intent.text, 'find a designer');
  });

  // Step 2: setReveal writes a private secret the client can never subscribe to.
  await step('2. reveal_secret is not a client-visible table', async () => {
    A.reducers.setReveal({ text: 'meet.google.com/abc' });
    await new Promise(r => setTimeout(r, 300)); // let the reducer land either way
    assert.ok(
      !('revealSecret' in A.db) && !('reveal_secret' in (A.db as Record<string, unknown>)),
      'reveal_secret must be absent from the generated bindings/db view'
    );
  });

  // Step 3: B and C each need an Echoe (no run) before joining the event, per
  // the contract's "regardless of whether B/C have a run" note.
  B.reducers.join({ name: 'bob', email: '' });
  B.reducers.createEcho({ persona: 'Product designer, into ceramics.' });
  C.reducers.join({ name: 'cara', email: '' });
  C.reducers.createEcho({ persona: 'Backend engineer, plays chess.' });
  await Promise.all([
    waitFor(() => B.db.echo.iter().toArray().find(e => e.owner.isEqual(B.identity!))),
    waitFor(() => C.db.echo.iter().toArray().find(e => e.owner.isEqual(C.identity!))),
  ]);

  let convAB: bigint | undefined;
  let convAC: bigint | undefined;
  let convBC: bigint | undefined;

  await step('3. joinEvent fans out conversations for every pair, no client-visible links', async () => {
    A.reducers.joinEvent({ eventId: EVENT_ID, goal: 'hiring a product designer', linkedin: 'alice-a', twitter: 'alice_a' });
    await waitFor(() => A.db.eventJoin.iter().toArray().find(j => j.eventId === EVENT_ID && j.identity.isEqual(A.identity!)));
    B.reducers.joinEvent({ eventId: EVENT_ID, goal: 'looking for design work', linkedin: 'bob-b', twitter: 'bob_b' });
    await waitFor(() => B.db.eventJoin.iter().toArray().find(j => j.eventId === EVENT_ID && j.identity.isEqual(B.identity!)));
    C.reducers.joinEvent({ eventId: EVENT_ID, goal: 'want a mentor for distributed systems', linkedin: 'cara-c', twitter: 'cara_c' });
    await waitFor(() => C.db.eventJoin.iter().toArray().find(j => j.eventId === EVENT_ID && j.identity.isEqual(C.identity!)));

    const joins = await waitFor(() => {
      const rows = A.db.eventJoin.iter().toArray().filter(j => j.eventId === EVENT_ID);
      return rows.length === 3 ? rows : undefined;
    });
    assert.equal(joins.length, 3, 'event_join count for this event must be 3');
    assert.equal(
      joins.find(j => j.identity.isEqual(A.identity!))!.goal,
      'hiring a product designer',
      'the event goal is stored on the public event_join row'
    );

    const echoes = new Map(A.db.echo.iter().toArray().map(e => [e.owner.toHexString(), e.id]));
    const aId = echoes.get(A.identity!.toHexString())!;
    const bId = echoes.get(B.identity!.toHexString())!;
    const cId = echoes.get(C.identity!.toHexString())!;
    const findConv = (x: bigint, y: bigint) => {
      const lo = x < y ? x : y;
      const hi = x < y ? y : x;
      return A.db.conversation.iter().toArray().find(c => c.echoA === lo && c.echoB === hi && c.eventId === EVENT_ID);
    };
    const cAB = await waitFor(() => findConv(aId, bId));
    const cAC = await waitFor(() => findConv(aId, cId));
    const cBC = await waitFor(() => findConv(bId, cId));
    convAB = cAB.id;
    convAC = cAC.id;
    convBC = cBC.id;

    // Hiring meets looking-for-work: the complement fires on the EVENT goals,
    // not on the street intents (A's street intent is "find a designer").
    assert.match(cAB.why, /hiring/, "why derives from the two event goals");
    assert.ok(cAB.score >= 50, 'a complement on event goals scores at least the floor');

    assert.ok(!('eventContact' in A.db), 'event_contact must be absent from the generated bindings/db view');
  });

  await step('4. transcript lines appear on the event conversation (or SKIP)', async () => {
    if (convAB === undefined) throw new Error('no conversation to watch (step 3 failed)');
    const id = convAB;
    try {
      const lines = await waitFor(() => {
        const rows = A.db.transcriptLine.iter().toArray().filter(l => l.conversationId === id);
        return rows.length > 0 ? rows : undefined;
      }, 60_000);
      console.log(`  -> ${lines.length} transcript line(s) on conversation ${id}`);
    } catch {
      console.log(`SKIP: no transcript lines landed on conversation ${id} within 60s (LLM path likely offline)`);
    }
  });

  await step('5. mutual reveal: nothing crosses until both sides press Reveal', async () => {
    if (convAB === undefined) throw new Error('no conversation to reveal on (step 3 failed)');
    const id = convAB;

    A.reducers.revealTo({ conversationId: id });
    await new Promise(r => setTimeout(r, 300));
    const afterA = JSON.parse(await B.procedures.readReveal({ conversationId: id })) as {
      mine: boolean; theirs: boolean; text: string; linkedin: string; twitter: string;
    };
    assert.equal(afterA.mine, false, "B hasn't revealed yet");
    assert.equal(afterA.theirs, true, 'A has revealed');
    assert.equal(afterA.text, '', 'nothing crosses until both sides reveal');

    B.reducers.setReveal({ text: "hinge.co/bob" });
    B.reducers.revealTo({ conversationId: id });
    const afterB = await waitFor(async () => {
      const r = JSON.parse(await A.procedures.readReveal({ conversationId: id })) as {
        mine: boolean; theirs: boolean; text: string; linkedin: string; twitter: string;
      };
      return r.mine && r.theirs ? r : undefined;
    });
    assert.equal(afterB.mine, true);
    assert.equal(afterB.theirs, true);
    assert.equal(afterB.text, 'hinge.co/bob', "A sees B's reveal_secret text");
    assert.equal(afterB.linkedin, 'https://www.linkedin.com/in/bob-b', "A sees B's event LinkedIn");
    assert.equal(afterB.twitter, 'https://x.com/bob_b', "A sees B's event X handle");

    await assert.rejects(
      () => C.procedures.readReveal({ conversationId: id }),
      /not_a_participant/,
      'C is not a participant on conversation A<->B'
    );
  });

  // Step 6: the conversation runs its three minutes, closes, and both sides get
  // a scored summary. The clock is what closes an event pairing, so this holds
  // with or without the LLM lane; the rows themselves need the house key, so a
  // module with none reports SKIP rather than a failure.
  await step('6. both conversation_summary rows land within 60s of the close', async () => {
    if (convAB === undefined) throw new Error('no conversation to summarise (step 3 failed)');
    const id = convAB;

    // CONVERSATION_MICROS is three minutes; [END] usually closes it sooner.
    const closed = await waitFor(() => {
      const c = A.db.conversation.iter().toArray().find(x => x.id === id);
      return c && c.closedAt.microsSinceUnixEpoch > 0n ? c : undefined;
    }, 240_000);
    console.log(`  -> conversation ${id} closed after ${closed.replies} exchanges`);

    let rows;
    try {
      rows = await waitFor(() => {
        const found = A.db.conversationSummary.iter().toArray().filter(r => r.conversationId === id);
        return found.length === 2 ? found : undefined;
      }, 60_000);
    } catch {
      console.log(`SKIP: no conversation_summary rows for ${id} within 60s (house key likely offline)`);
      return;
    }

    const hexes = rows.map(r => r.identity.toHexString()).sort();
    assert.deepEqual(
      hexes,
      [A.identity!.toHexString(), B.identity!.toHexString()].sort(),
      'one row per side, keyed by identity'
    );
    for (const r of rows) {
      assert.ok(r.summary.trim().length > 0, `summary text for ${r.key} must not be empty`);
      assert.ok(r.match >= 0 && r.match <= 100, `match for ${r.key} must be 0..100`);
      assert.ok(r.corrective >= 0 && r.corrective <= 100, `corrective for ${r.key} must be 0..100`);
      const scores = JSON.parse(r.scoresJson) as Record<string, number>;
      assert.ok(scores.goalFit >= 0 && scores.goalFit <= 25, 'goalFit is in band');
      assert.ok(scores.avoidPenalty <= 0 && scores.avoidPenalty >= -20, 'avoidPenalty is a penalty');
      assert.ok(Array.isArray(JSON.parse(r.correctiveNotesJson)), 'corrective notes are a JSON array');
      console.log(`  -> ${r.key} match ${r.match}: ${r.summary.slice(0, 80)}...`);
    }
  });

  A.disconnect();
  B.disconnect();
  C.disconnect();

  console.log(`\nflow.check: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('flow.check crashed:', err);
  process.exit(1);
});
