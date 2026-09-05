// Self-check for the one rule the reveal feature exists to keep: the Echoe
// never sees what a player reveals. `reveal_secret` and `event_contact` are
// readable only by `readReveal`, never by the prompt builder. No framework:
//   node --experimental-strip-types spacetimedb/reveal.check.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { takeEndMarker } from './src/llm.ts';
import { CONVERSATION_MICROS, MAX_EXCHANGES, MIN_EXCHANGES, OPEN, isClosed } from './src/conversation.ts';

const src = readFileSync(new URL('./src/index.ts', import.meta.url), 'utf8');

/** The body of one `export const <name> = spacetimedb.<kind>(` block, by brace depth. */
function bodyOf(name: string): string {
  const start = src.indexOf(`export const ${name} = spacetimedb.`);
  assert.notEqual(start, -1, `${name} not found`);
  let depth = 0;
  for (let i = src.indexOf('(', start); i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i);
    }
  }
  throw new Error(`unbalanced parens in ${name}`);
}

const talk = bodyOf('echoTalk');
// The security boundary. If a future prompt builder reaches for either table,
// this is what fails before the Echoe says someone's phone number out loud.
assert.ok(!talk.includes('revealSecret'), 'echoTalk must not read reveal_secret');
assert.ok(!talk.includes('eventContact'), 'echoTalk must not read event_contact');
assert.ok(!talk.includes('db.reveal'), 'echoTalk must not read the reveal tables');
// What it must read: each side's avoid line, straight into the system prompt.
assert.ok(talk.includes('avoidA:') && talk.includes('avoidB:'), 'echoTalk must load run.avoid');
assert.ok(talk.includes('Do not pursue people who ${setup.avoidA}'), 'avoidA must reach the prompt');
assert.ok(talk.includes('Do not pursue people who ${setup.avoidB}'), 'avoidB must reach the prompt');

// The payload crosses in exactly one place, and only behind both flags.
const read = bodyOf('readReveal');
assert.ok(read.includes('not_a_participant'), 'readReveal must check membership');
assert.ok(
  read.includes('if (mine && theirs && otherEcho) {'),
  'readReveal must gate the payload on both sides having revealed'
);

// When a conversation is over. Born at 0, "now" is how long it has been talking.
const convo = (patch: Partial<Parameters<typeof isClosed>[1]> = {}) =>
  ({ closedAt: OPEN, replies: 4, createdAt: 0n, ...patch });
assert.equal(isClosed(0n, convo()), false);
assert.equal(isClosed(CONVERSATION_MICROS - 1n, convo()), false, 'a second short still talks');
assert.equal(isClosed(CONVERSATION_MICROS, convo()), true, 'three minutes ends it');
// [END] does not get to cut a conversation short: below the floor it is ignored.
assert.equal(
  isClosed(0n, convo({ closedAt: 1n, replies: 3 })),
  false,
  '[END] at reply 3 must not close the conversation'
);
assert.equal(
  isClosed(0n, convo({ closedAt: 1n, replies: MIN_EXCHANGES + 1 })),
  true,
  '[END] at reply 13 closes it'
);
assert.equal(isClosed(0n, convo({ replies: MAX_EXCHANGES })), true, 'the ceiling holds');
// The one that matters for an uncapped event: a pairing waiting for a slot has
// not started its clock, so it must not be born expired however long it waits.
assert.equal(
  isClosed(CONVERSATION_MICROS * 100n, convo({ replies: 0 })),
  false,
  'an unstarted event pairing must survive any wait'
);

// How a conversation ends early: the marker is stripped, the line survives.
const closed = ['A: See you Thursday at Third Wave.', 'B: Done. I will message you. [END]'];
assert.equal(takeEndMarker(closed), true);
assert.equal(closed[1], 'B: Done. I will message you.', 'the marker must not reach a player');
assert.equal(takeEndMarker(['A: still talking', 'B: go on']), false);
assert.equal(takeEndMarker([]), false);

// An uncapped event must not eat anyone's free five, or one join ends their night.
const fanOut = src.slice(src.indexOf('function fanOutEvent'), src.indexOf('function tickEvents'));
assert.ok(!fanOut.includes('freeUsed'), 'event pairings must not spend free conversations');
assert.ok(fanOut.includes("fundingA: 'house'"), 'event pairings are house funded');
assert.ok(!fanOut.includes('talkJob.insert'), 'the fan-out creates rows; the tick starts them');
assert.match(src, /'spacetimedb-midnight-moonshot': Infinity/, 'the moonshot is uncapped');

// The tick drives event conversations with no reference to a run row.
const events = src.slice(src.indexOf('function tickEvents'), src.indexOf('function startEventExchange'));
assert.ok(!events.includes('db.run'), 'an event pairing must not require a run');
assert.ok(events.includes('closeConversation'), 'a closing event conversation must be counted');

// Talks and the run recap have to agree: both sides of a closed event
// conversation get peopleMet and a receipt, and the sticky stamp is the guard.
const count = src.slice(src.indexOf('function countEventMeeting'), src.indexOf('function eventGoal'));
assert.ok(count.includes('peopleMet: runRow.peopleMet + 1'), 'both sides count the meeting');
assert.ok(count.includes("'talk'") && count.includes('EVENT_PLACE'), 'both sides get a talk receipt');
assert.match(src, /closeConversation\(tx, convo\)/, '[END] closing must count too, not just the clock');

// One close site, so a summary cannot be missed from a second one. Every
// closedAt stamp in the module has to come from closeConversation.
const stamps = [...src.matchAll(/closedAt: (?:ctx|tx)\.timestamp|closedAt: now/g)];
assert.equal(stamps.length, 1, 'closedAt may only be stamped inside closeConversation');
const closer = src.slice(src.indexOf('function closeConversation'), src.indexOf('/** What someone said they came'));
assert.ok(closer.includes('closedAt: ctx.timestamp'), 'closeConversation is the one place a talk ends');
assert.ok(closer.includes('countEventMeeting'), 'closing counts an event meeting on both sides');
assert.ok(closer.includes('summaryJob.insert'), 'closing queues the summary');

// The same security boundary as echoTalk, on the other prompt builder. The
// scoring prompt sees the transcript and the goals, never what someone revealed.
const sum = bodyOf('summarize');
assert.ok(!sum.includes('revealSecret'), 'summarize must not read reveal_secret');
assert.ok(!sum.includes('eventContact'), 'summarize must not read event_contact');
assert.ok(!sum.includes('db.reveal'), 'summarize must not read the reveal tables');
assert.ok(sum.includes('conversationSummary.key.find'), 'summarize skips a side it already scored');

// An event conversation is matched and prompted on the event goal, not the street intent.
assert.ok(fanOut.includes('matchIntents(myGoal, other.goal)'), 'event pairs score on event goals');
assert.ok(talk.includes('At ${setup.eventTitle}, A wants: ${setup.eventGoalA}'), 'event goal anchors the prompt');
assert.ok(talk.includes("convo.eventId ? '' :"), 'the street intent stays out of an event prompt');

console.log('reveal.check: reveal stays private, avoid reaches the prompt, one close site queues the summary');
