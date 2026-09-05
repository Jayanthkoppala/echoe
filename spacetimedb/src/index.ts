// Echo — autonomous Echoes roaming a Bengaluru map.
//
// Design rule that everything below follows: the database owns every state
// transition. Reducers validate and mutate; the LLM only ever produces text
// that a reducer has already paid for, counted and authorised. If the LLM is
// unreachable the simulation is unaffected, because the deterministic fallback
// lines live in the tick reducer's transaction, not in the network path.

import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
} from 'spacetimedb/server';
import { ScheduleAt, Timestamp } from 'spacetimedb';
import { chat, splitLines, type ChatMessage } from './llm';

// ─── Tuning ──────────────────────────────────────────────────────────────────
// A "24 hour" roam is compressed to RUN_DURATION so a judge can watch one end
// to end. Every duration is microseconds, which is what SpacetimeDB speaks.

const TICK_MICROS = 5_000_000n; //  5s world tick
const TRAVEL_MICROS = 4_000_000n; //  4s in transit between two landmarks
const DWELL_MICROS = 6_000_000n; //  6s standing at a landmark before departing
const RUN_DURATION_MICROS = 180_000_000n; //  3min stands in for 24 hours

const DEFAULT_CREDITS = 8;
const MAX_PERSONA_LENGTH = 2_000;
const MAX_GOAL_LENGTH = 280;

/** Actions a player or an Echo may take, and what each costs in AI credits. */
const ACTION_COST: Record<string, number> = {
  travel: 0,
  find: 0,
  talk: 1,
  dance: 0,
  build: 0,
  bluff: 1,
};

const ALL_ACTIONS = Object.keys(ACTION_COST);

const AVATARS = ['circle', 'square', 'triangle', 'diamond', 'hex'];

const RUN_RUNNING = 'running';
const RUN_PAUSED = 'paused';
const RUN_ENDED = 'ended';

const FEEDBACK_NONE = 'none';
const FEEDBACK_LIKE = 'like';
const FEEDBACK_NOT_ME = 'not_me';

const LLM_CONFIG_ID = 0;
const MISSION_ID = 0;

const DEFAULT_MISSION =
  "Tonight's mission: find someone who has changed their mind about Bengaluru.";

/** The ten seeded landmarks. Index in this array is the place id. */
const LANDMARKS: [string, number, number][] = [
  ['Bangalore Palace', 77.592, 12.9987],
  ['Vidhana Soudha', 77.5906, 12.9796],
  ['Ulsoor Lake', 77.6192, 12.9815],
  ['Church Street', 77.6048, 12.975],
  ['Cubbon Park', 77.5933, 12.975],
  ['Indiranagar', 77.6499, 12.9699],
  ['Lalbagh', 77.59, 12.95],
  ['MG Road', 77.6119, 12.9738],
  ['Koramangala', 77.6229, 12.9259],
  ['Commercial Street', 77.6084, 12.9822],
];

// ─── Tables ──────────────────────────────────────────────────────────────────

/** One row per human. `identity` is the authenticated caller, never an argument. */
const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    avatar: t.string(),
    online: t.bool(),
    currentPlace: t.u8().index('btree'),
    credits: t.u32(),
    joinedAt: t.timestamp(),
  }
);

/** The player's agent. Persona is authored once; behaviourNotes accrue from corrections. */
const echo = table(
  { name: 'echo', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().unique(),
    persona: t.string(),
    behaviourNotes: t.string(),
    updatedAt: t.timestamp(),
  }
);

/** Seeded once in `init`. Read-only for the lifetime of the database. */
const place = table(
  { name: 'place', public: true },
  {
    id: t.u8().primaryKey(),
    name: t.string(),
    lng: t.f64(),
    lat: t.f64(),
  }
);

/**
 * One row per completed or in-flight leg. Written only at leg boundaries, so a
 * roaming Echo costs the network two rows per landmark rather than a position
 * update per frame. Clients interpolate between departTs and arriveTs.
 */
const agentTravel = table(
  { name: 'agent_travel', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    echoId: t.u64().index('btree'),
    fromPlace: t.u8(),
    toPlace: t.u8(),
    departTs: t.timestamp(),
    arriveTs: t.timestamp(),
  }
);

/** The limits a player set before letting their Echo roam, plus live counters. */
const run = table(
  { name: 'run', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().unique(),
    echoId: t.u64().index('btree'),
    goal: t.string(),
    maxPeople: t.u8(),
    repliesPerPerson: t.u8(),
    creditCap: t.u32(),
    allowedActions: t.string(), // comma-separated subset of ALL_ACTIONS
    status: t.string(), // running | paused | ended
    startedAt: t.timestamp(),
    peopleMet: t.u32(),
    placesVisited: t.u32(),
    built: t.u32(),
    creditsSpent: t.u32(),
  }
);

/**
 * Append-only. Nothing in this module ever updates or deletes a receipt: that is
 * the whole point of the Return screen. Corrections change future behaviour and
 * leave the record of what actually happened intact.
 */
const receipt = table(
  { name: 'receipt', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    runOwner: t.identity().index('btree'),
    kind: t.string(),
    placeId: t.u8(),
    text: t.string(),
    creditCost: t.u32(),
    createdAt: t.timestamp(),
  }
);

/** echoA is always the numerically smaller id, which makes the pair a unique key. */
const conversation = table(
  { name: 'conversation', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    echoA: t.u64().index('btree'),
    echoB: t.u64(),
    placeId: t.u8(),
    replies: t.u8(),
    createdAt: t.timestamp(),
  }
);

const transcriptLine = table(
  { name: 'transcript_line', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    conversationId: t.u64().index('btree'),
    speakerEchoId: t.u64(),
    text: t.string(),
    isAi: t.bool(), // always true; the client labels every line as AI
    feedback: t.string(), // none | like | not_me
    createdAt: t.timestamp(),
  }
);

/** One correction folded into the Echo's behaviourNotes and into future prompts. */
const correction = table(
  { name: 'correction', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    lineId: t.u64().index('btree'),
    owner: t.identity().index('btree'),
    originalText: t.string(),
    shouldHaveSaid: t.string(),
    behaviourChange: t.string(),
    appliedAt: t.timestamp(),
  }
);

/** The shared line every player sees on the World screen. Single row, id 0. */
const mission = table(
  { name: 'mission', public: true },
  {
    id: t.u8().primaryKey(),
    text: t.string(),
    updatedAt: t.timestamp(),
  }
);

/**
 * PRIVATE. No `public: true`, so this table is invisible to every client and is
 * excluded from generated bindings. The key never crosses the wire outbound.
 */
const llmConfig = table(
  { name: 'llm_config' },
  {
    id: t.u8().primaryKey(),
    apiKey: t.string(),
    model: t.string(),
    updatedAt: t.timestamp(),
  }
);

/** Drives the `tick` reducer. Private: clients observe its effects, not its schedule. */
const worldTickTimer = table(
  { name: 'world_tick' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
  }
);

/**
 * One-shot jobs that carry a conversation into the `echoTalk` procedure. A
 * reducer cannot do network I/O, so it queues a row here instead; the row is
 * deleted automatically once the procedure returns.
 */
const talkJob = table(
  { name: 'talk_job' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    conversationId: t.u64(),
  }
);

const spacetimedb = schema({
  player,
  echo,
  place,
  agentTravel,
  run,
  receipt,
  conversation,
  transcriptLine,
  correction,
  mission,
  llmConfig,
  worldTickTimer,
  talkJob,
});
export default spacetimedb;

type Ctx = ReducerCtx<typeof spacetimedb.schemaType>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(message: string): never {
  throw new SenderError(message);
}

function trimmed(value: string, max: number, field: string): string {
  const out = value.trim();
  if (out.length === 0) fail(`${field}_required`);
  if (out.length > max) fail(`${field}_too_long:${max}`);
  return out;
}

function requirePlayer(ctx: Ctx) {
  const row = ctx.db.player.identity.find(ctx.sender);
  if (!row) fail('not_joined');
  return row;
}

function requireEcho(ctx: Ctx) {
  const row = ctx.db.echo.owner.find(ctx.sender);
  if (!row) fail('no_echo');
  return row;
}

function placeName(ctx: Ctx, id: number): string {
  return ctx.db.place.id.find(id)?.name ?? `place ${id}`;
}

function micros(ts: Timestamp): bigint {
  return ts.microsSinceUnixEpoch;
}

function plus(ts: Timestamp, delta: bigint): Timestamp {
  return new Timestamp(micros(ts) + delta);
}

function isAllowed(allowedActions: string, kind: string): boolean {
  return allowedActions.split(',').includes(kind);
}

/** Every receipt in the system is written here, so the append-only rule has one home. */
function writeReceipt(
  ctx: Ctx,
  owner: ReturnType<typeof requirePlayer>['identity'],
  kind: string,
  placeId: number,
  text: string,
  creditCost: number
): void {
  ctx.db.receipt.insert({
    id: 0n,
    runOwner: owner,
    kind,
    placeId,
    text,
    creditCost,
    createdAt: ctx.timestamp,
  });
}

/**
 * Charge one action against both budgets: the player's wallet and the run's cap.
 * Returns false when either budget refuses, and mutates nothing in that case.
 */
function spendCredits(
  ctx: Ctx,
  playerRow: ReturnType<typeof requirePlayer>,
  runRow: ReturnType<typeof requireRun> | null,
  cost: number
): boolean {
  if (cost === 0) return true;
  if (playerRow.credits < cost) return false;
  if (runRow && runRow.creditsSpent + cost > runRow.creditCap) return false;

  ctx.db.player.identity.update({
    ...playerRow,
    credits: playerRow.credits - cost,
  });
  if (runRow) {
    ctx.db.run.id.update({
      ...runRow,
      creditsSpent: runRow.creditsSpent + cost,
    });
  }
  return true;
}

function requireRun(ctx: Ctx) {
  const row = ctx.db.run.owner.find(ctx.sender);
  if (!row) fail('no_run');
  return row;
}

/** The most recent leg for an Echo, or null before its first departure. */
function latestLeg(ctx: Ctx, echoId: bigint) {
  let newest: { id: bigint; toPlace: number; arriveTs: Timestamp } | null = null;
  for (const leg of ctx.db.agentTravel.echoId.filter(echoId)) {
    if (!newest || leg.id > newest.id) newest = leg;
  }
  return newest;
}

/**
 * Where to walk next. An Echo allowed to `find` heads for a landmark that
 * already holds another running Echo about half the time. Without that bias ten
 * landmarks scatter a handful of agents and they effectively never meet again
 * after their first parting, which is the wrong simulation and a dead demo.
 */
function pickNextPlace(ctx: Ctx, runRow: ReturnType<typeof requireRun>, current: number): number {
  if (isAllowed(runRow.allowedActions, 'find')) {
    // Only the lower-numbered Echo of any pair gives chase. If both chased,
    // two Echoes would swap landmarks every tick and never actually arrive
    // together, which is exactly what the first version of this did.
    const targets: number[] = [];
    for (const other of ctx.db.run.iter()) {
      if (other.status !== RUN_RUNNING) continue;
      if (other.echoId <= runRow.echoId) continue;
      const otherPlayer = ctx.db.player.identity.find(other.owner);
      if (!otherPlayer) continue;
      // Aim where they will be, not where they were.
      const otherLeg = latestLeg(ctx, other.echoId);
      const going =
        otherLeg && micros(otherLeg.arriveTs) > micros(ctx.timestamp)
          ? otherLeg.toPlace
          : otherPlayer.currentPlace;
      if (going !== current) targets.push(going);
    }
    if (targets.length > 0) {
      return targets[ctx.random.integerInRange(0, targets.length - 1)];
    }
  }
  const step = ctx.random.integerInRange(1, LANDMARKS.length - 1);
  return (current + step) % LANDMARKS.length;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export const init = spacetimedb.init(ctx => {
  LANDMARKS.forEach(([name, lng, lat], id) => {
    ctx.db.place.insert({ id, name, lng, lat });
  });

  ctx.db.mission.insert({
    id: MISSION_ID,
    text: DEFAULT_MISSION,
    updatedAt: ctx.timestamp,
  });

  ctx.db.worldTickTimer.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(TICK_MICROS),
  });
});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const row = ctx.db.player.identity.find(ctx.sender);
  if (row) ctx.db.player.identity.update({ ...row, online: true });
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const row = ctx.db.player.identity.find(ctx.sender);
  if (row) ctx.db.player.identity.update({ ...row, online: false });
});

// ─── Screens 1 and 2: join, create Echo ──────────────────────────────────────

export const join = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  const clean = trimmed(name, 40, 'name');
  const existing = ctx.db.player.identity.find(ctx.sender);

  if (existing) {
    ctx.db.player.identity.update({ ...existing, name: clean, online: true });
    return;
  }

  ctx.db.player.insert({
    identity: ctx.sender,
    name: clean,
    avatar: AVATARS[0],
    online: true,
    currentPlace: 0,
    credits: DEFAULT_CREDITS,
    joinedAt: ctx.timestamp,
  });
});

export const createEcho = spacetimedb.reducer(
  { avatar: t.string(), persona: t.string() },
  (ctx, { avatar, persona }) => {
    const playerRow = requirePlayer(ctx);
    if (!AVATARS.includes(avatar)) fail(`unknown_avatar:${avatar}`);
    const cleanPersona = trimmed(persona, MAX_PERSONA_LENGTH, 'persona');

    ctx.db.player.identity.update({ ...playerRow, avatar });

    const existing = ctx.db.echo.owner.find(ctx.sender);
    if (existing) {
      ctx.db.echo.id.update({
        ...existing,
        persona: cleanPersona,
        updatedAt: ctx.timestamp,
      });
      return;
    }

    ctx.db.echo.insert({
      id: 0n,
      owner: ctx.sender,
      persona: cleanPersona,
      behaviourNotes: '',
      updatedAt: ctx.timestamp,
    });
  }
);

// ─── Screen 3: the live world ────────────────────────────────────────────────

export const travel = spacetimedb.reducer(
  { placeId: t.u8() },
  (ctx, { placeId }) => {
    const playerRow = requirePlayer(ctx);
    const echoRow = requireEcho(ctx);
    if (!ctx.db.place.id.find(placeId)) fail(`unknown_place:${placeId}`);
    if (placeId === playerRow.currentPlace) fail('already_there');

    ctx.db.agentTravel.insert({
      id: 0n,
      echoId: echoRow.id,
      fromPlace: playerRow.currentPlace,
      toPlace: placeId,
      departTs: ctx.timestamp,
      arriveTs: plus(ctx.timestamp, TRAVEL_MICROS),
    });

    ctx.db.player.identity.update({ ...playerRow, currentPlace: placeId });
    writeReceipt(
      ctx,
      ctx.sender,
      'travel',
      placeId,
      `Walked to ${placeName(ctx, placeId)}`,
      0
    );
  }
);

/**
 * A manual action taken by the player while watching the map. Talk and bluff
 * cost one credit; the rest are free. A live run's cap applies here too, so a
 * player cannot spend past their own limit by acting by hand.
 */
export const act = spacetimedb.reducer({ kind: t.string() }, (ctx, { kind }) => {
  const playerRow = requirePlayer(ctx);
  requireEcho(ctx);

  const cost = ACTION_COST[kind];
  if (cost === undefined) fail(`unknown_action:${kind}`);

  const runRow = ctx.db.run.owner.find(ctx.sender);
  const liveRun = runRow && runRow.status === RUN_RUNNING ? runRow : null;
  if (liveRun && !isAllowed(liveRun.allowedActions, kind)) {
    fail(`action_not_allowed:${kind}`);
  }
  if (!spendCredits(ctx, playerRow, liveRun, cost)) fail('out_of_credits');

  writeReceipt(
    ctx,
    ctx.sender,
    kind,
    playerRow.currentPlace,
    `${kind} at ${placeName(ctx, playerRow.currentPlace)}`,
    cost
  );
});

// ─── Screens 4 and 5: limits, roaming ────────────────────────────────────────

export const startRun = spacetimedb.reducer(
  {
    goal: t.string(),
    maxPeople: t.u8(),
    repliesPerPerson: t.u8(),
    creditCap: t.u32(),
    allowedActions: t.string(),
  },
  (ctx, { goal, maxPeople, repliesPerPerson, creditCap, allowedActions }) => {
    const playerRow = requirePlayer(ctx);
    const echoRow = requireEcho(ctx);

    const cleanGoal = trimmed(goal, MAX_GOAL_LENGTH, 'goal');
    if (![1, 3, 5].includes(maxPeople)) fail(`bad_max_people:${maxPeople}`);
    if (![1, 2, 3].includes(repliesPerPerson)) {
      fail(`bad_replies_per_person:${repliesPerPerson}`);
    }
    if (creditCap < 1 || creditCap > DEFAULT_CREDITS) {
      fail(`bad_credit_cap:${creditCap}`);
    }

    const actions = allowedActions
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (actions.length === 0) fail('no_actions_allowed');
    for (const a of actions) {
      if (!ALL_ACTIONS.includes(a)) fail(`unknown_action:${a}`);
    }

    const row = {
      owner: ctx.sender,
      echoId: echoRow.id,
      goal: cleanGoal,
      maxPeople,
      repliesPerPerson,
      creditCap,
      allowedActions: actions.join(','),
      status: RUN_RUNNING,
      startedAt: ctx.timestamp,
      peopleMet: 0,
      placesVisited: 0,
      built: 0,
      creditsSpent: 0,
    };

    // A new night starts with a full wallet. Without this the wallet is a
    // one-way ratchet and a second run can never be started, which makes the
    // whole flow a single-use demo.
    ctx.db.player.identity.update({ ...playerRow, credits: DEFAULT_CREDITS });

    const existing = ctx.db.run.owner.find(ctx.sender);
    if (existing) {
      ctx.db.run.id.update({ ...row, id: existing.id });
    } else {
      ctx.db.run.insert({ ...row, id: 0n });
    }

    writeReceipt(ctx, ctx.sender, 'run_start', playerRow.currentPlace, cleanGoal, 0);
  }
);

export const pauseRun = spacetimedb.reducer(ctx => {
  const runRow = requireRun(ctx);
  if (runRow.status !== RUN_RUNNING) fail(`not_running:${runRow.status}`);
  ctx.db.run.id.update({ ...runRow, status: RUN_PAUSED });
});

export const resumeRun = spacetimedb.reducer(ctx => {
  const runRow = requireRun(ctx);
  if (runRow.status !== RUN_PAUSED) fail(`not_paused:${runRow.status}`);
  ctx.db.run.id.update({ ...runRow, status: RUN_RUNNING });
});

export const endRun = spacetimedb.reducer(ctx => {
  const runRow = requireRun(ctx);
  if (runRow.status === RUN_ENDED) fail('already_ended');
  finishRun(ctx, runRow, 'stopped by you');
});

function finishRun(ctx: Ctx, runRow: ReturnType<typeof requireRun>, why: string): void {
  ctx.db.run.id.update({ ...runRow, status: RUN_ENDED });
  const playerRow = ctx.db.player.identity.find(runRow.owner);
  writeReceipt(
    ctx,
    runRow.owner,
    'run_end',
    playerRow?.currentPlace ?? 0,
    `Came home: ${why}`,
    0
  );
}

// ─── Screens 7 and 8: review, correct ────────────────────────────────────────

export const rateLine = spacetimedb.reducer(
  { lineId: t.u64(), soundsLikeMe: t.bool() },
  (ctx, { lineId, soundsLikeMe }) => {
    const echoRow = requireEcho(ctx);
    const line = ctx.db.transcriptLine.id.find(lineId);
    if (!line) fail(`unknown_line:${lineId}`);
    if (line.speakerEchoId !== echoRow.id) fail('not_your_line');

    ctx.db.transcriptLine.id.update({
      ...line,
      feedback: soundsLikeMe ? FEEDBACK_LIKE : FEEDBACK_NOT_ME,
    });
  }
);

/**
 * A correction never rewrites the receipt or the transcript. It appends a note
 * to the Echo's behaviourNotes, which the next prompt carries, so the change is
 * visible in what the Echo says from here on and nowhere in the record of what
 * it already said.
 */
export const correct = spacetimedb.reducer(
  {
    lineId: t.u64(),
    shouldHaveSaid: t.string(),
    behaviourChange: t.string(),
  },
  (ctx, { lineId, shouldHaveSaid, behaviourChange }) => {
    const echoRow = requireEcho(ctx);
    const line = ctx.db.transcriptLine.id.find(lineId);
    if (!line) fail(`unknown_line:${lineId}`);
    if (line.speakerEchoId !== echoRow.id) fail('not_your_line');

    const said = trimmed(shouldHaveSaid, 500, 'should_have_said');
    const change = trimmed(behaviourChange, 500, 'behaviour_change');

    ctx.db.correction.insert({
      id: 0n,
      lineId,
      owner: ctx.sender,
      originalText: line.text,
      shouldHaveSaid: said,
      behaviourChange: change,
      appliedAt: ctx.timestamp,
    });

    const note = `- ${change} (instead of "${line.text}", say something closer to "${said}")`;
    ctx.db.echo.id.update({
      ...echoRow,
      behaviourNotes:
        echoRow.behaviourNotes.length > 0
          ? `${echoRow.behaviourNotes}\n${note}`
          : note,
      updatedAt: ctx.timestamp,
    });

    ctx.db.transcriptLine.id.update({ ...line, feedback: FEEDBACK_NOT_ME });
  }
);

// ─── LLM configuration (private) ─────────────────────────────────────────────

export const setLlmConfig = spacetimedb.reducer(
  { apiKey: t.string(), model: t.string() },
  (ctx, { apiKey, model }) => {
    const key = trimmed(apiKey, 400, 'api_key');
    const cleanModel = trimmed(model, 120, 'model');

    const row = {
      id: LLM_CONFIG_ID,
      apiKey: key,
      model: cleanModel,
      updatedAt: ctx.timestamp,
    };
    if (ctx.db.llmConfig.id.find(LLM_CONFIG_ID)) {
      ctx.db.llmConfig.id.update(row);
    } else {
      ctx.db.llmConfig.insert(row);
    }
  }
);

export const setMission = spacetimedb.reducer({ text: t.string() }, (ctx, { text }) => {
  const clean = trimmed(text, 200, 'mission');
  const row = ctx.db.mission.id.find(MISSION_ID);
  if (row) {
    ctx.db.mission.id.update({ ...row, text: clean, updatedAt: ctx.timestamp });
  } else {
    ctx.db.mission.insert({ id: MISSION_ID, text: clean, updatedAt: ctx.timestamp });
  }
});

// ─── The world tick ──────────────────────────────────────────────────────────

/**
 * Every 5 seconds, advance each running Echo by at most one state change:
 *
 *   in transit                     -> nothing
 *   arrived but not recorded       -> land it, bank a receipt, count the place
 *   standing inside its dwell      -> try to meet a co-located Echo, else build
 *   dwell elapsed                  -> depart for a random other landmark
 *
 * Conversations are created, paid for and counted here. Only the *words* are
 * deferred to the procedure, and only when a key is configured.
 */
export const tick = spacetimedb.reducer(
  { onSchedule: worldTickTimer },
  { timer: worldTickTimer.rowType },
  (ctx, { timer }) => {
    void timer;
    const now = micros(ctx.timestamp);
    const hasKey = ctx.db.llmConfig.id.find(LLM_CONFIG_ID) !== null;

    // Iterate over a snapshot, but re-read each row before acting on it. One
    // Echo's turn can write to another Echo's run (a conversation bumps
    // peopleMet on both sides), and acting on the snapshot would silently
    // roll that write back.
    for (const stale of [...ctx.db.run.iter()]) {
      const runRow = ctx.db.run.id.find(stale.id);
      if (!runRow || runRow.status !== RUN_RUNNING) continue;

      if (now - micros(runRow.startedAt) >= RUN_DURATION_MICROS) {
        finishRun(ctx, runRow, 'the 24 hours ran out');
        continue;
      }
      if (runRow.creditsSpent >= runRow.creditCap) {
        finishRun(ctx, runRow, 'credit cap reached');
        continue;
      }

      const playerRow = ctx.db.player.identity.find(runRow.owner);
      if (!playerRow) continue;

      const leg = latestLeg(ctx, runRow.echoId);

      // Still walking.
      if (leg && now < micros(leg.arriveTs)) continue;

      // Arrived, but the arrival has not been banked yet.
      if (leg && playerRow.currentPlace !== leg.toPlace) {
        ctx.db.player.identity.update({
          ...playerRow,
          currentPlace: leg.toPlace,
        });
        ctx.db.run.id.update({
          ...runRow,
          placesVisited: runRow.placesVisited + 1,
        });
        writeReceipt(
          ctx,
          runRow.owner,
          'arrive',
          leg.toPlace,
          `Arrived at ${placeName(ctx, leg.toPlace)}`,
          0
        );
        continue;
      }

      // Standing at a landmark: socialise, or build, or leave. Before the first
      // departure there is no leg, so the run's own start time anchors the dwell
      // and every Echo gets one chance to talk where it began.
      const here = leg ? leg.toPlace : playerRow.currentPlace;
      const standingSince = leg ? micros(leg.arriveTs) : micros(runRow.startedAt);

      const acted = tryConverse(ctx, runRow, here, hasKey);
      if (!acted) tryBuild(ctx, runRow, here);

      if (now >= standingSince + DWELL_MICROS) depart(ctx, runRow, here);
    }
  }
);

function depart(ctx: Ctx, runRow: ReturnType<typeof requireRun>, from: number): void {
  if (!isAllowed(runRow.allowedActions, 'travel')) return;
  const to = pickNextPlace(ctx, runRow, from);
  ctx.db.agentTravel.insert({
    id: 0n,
    echoId: runRow.echoId,
    fromPlace: from,
    toPlace: to,
    departTs: ctx.timestamp,
    arriveTs: plus(ctx.timestamp, TRAVEL_MICROS),
  });
  writeReceipt(
    ctx,
    runRow.owner,
    'depart',
    from,
    `Left ${placeName(ctx, from)} for ${placeName(ctx, to)}`,
    0
  );
}

/**
 * Returns true when a credit was spent on conversation this tick.
 *
 * Both budgets, both caps and both consent rules are checked before a single
 * line exists. `repliesPerPerson` is enforced by refusing to add an exchange to
 * a conversation that has already reached it.
 */
function tryConverse(
  ctx: Ctx,
  runRow: ReturnType<typeof requireRun>,
  placeId: number,
  hasKey: boolean
): boolean {
  if (!isAllowed(runRow.allowedActions, 'talk')) return false;

  const playerRow = ctx.db.player.identity.find(runRow.owner);
  if (!playerRow) return false;

  for (const otherPlayer of ctx.db.player.currentPlace.filter(placeId)) {
    if (otherPlayer.identity.isEqual(runRow.owner)) continue;

    const otherRun = ctx.db.run.owner.find(otherPlayer.identity);
    if (!otherRun || otherRun.status !== RUN_RUNNING) continue;
    if (!isAllowed(otherRun.allowedActions, 'talk')) continue;

    const a = runRow.echoId < otherRun.echoId ? runRow.echoId : otherRun.echoId;
    const b = runRow.echoId < otherRun.echoId ? otherRun.echoId : runRow.echoId;

    // Reuse a conversation only if it belongs to the current pair of runs. A
    // conversation older than either run is a memory of a previous night, and
    // continuing it would leave peopleMet at zero while a transcript grew.
    let existing: { id: bigint; replies: number } | null = null;
    for (const c of ctx.db.conversation.echoA.filter(a)) {
      if (c.echoB !== b) continue;
      const started = micros(c.createdAt);
      if (started < micros(runRow.startedAt)) continue;
      if (started < micros(otherRun.startedAt)) continue;
      existing = c;
    }

    // New pair: both runs must still have room for another person.
    if (!existing) {
      if (runRow.peopleMet >= runRow.maxPeople) continue;
      if (otherRun.peopleMet >= otherRun.maxPeople) continue;
    } else if (existing.replies >= runRow.repliesPerPerson) {
      continue;
    }

    if (!spendCredits(ctx, playerRow, runRow, ACTION_COST.talk)) return false;

    let conversationId: bigint;
    if (existing) {
      conversationId = existing.id;
      ctx.db.conversation.id.update({
        ...ctx.db.conversation.id.find(existing.id)!,
        replies: existing.replies + 1,
      });
    } else {
      const created = ctx.db.conversation.insert({
        id: 0n,
        echoA: a,
        echoB: b,
        placeId,
        replies: 1,
        createdAt: ctx.timestamp,
      });
      conversationId = created.id;

      // Re-read: spendCredits already wrote to this row.
      const freshRun = ctx.db.run.id.find(runRow.id)!;
      ctx.db.run.id.update({ ...freshRun, peopleMet: freshRun.peopleMet + 1 });
      const freshOther = ctx.db.run.id.find(otherRun.id)!;
      ctx.db.run.id.update({ ...freshOther, peopleMet: freshOther.peopleMet + 1 });
    }

    writeReceipt(
      ctx,
      runRow.owner,
      'talk',
      placeId,
      `Talked with ${otherPlayer.name} at ${placeName(ctx, placeId)}`,
      ACTION_COST.talk
    );

    if (hasKey) {
      // The reducer has already paid for and counted this exchange. The
      // procedure only fills in the words.
      ctx.db.talkJob.insert({
        scheduledId: 0n,
        scheduledAt: ScheduleAt.time(micros(ctx.timestamp)),
        conversationId,
      });
    } else {
      writeFallbackExchange(ctx, conversationId, a, b, placeId);
    }
    return true;
  }
  return false;
}

function tryBuild(ctx: Ctx, runRow: ReturnType<typeof requireRun>, placeId: number): void {
  if (!isAllowed(runRow.allowedActions, 'build')) return;
  if (ctx.random() > 0.35) return;

  const fresh = ctx.db.run.id.find(runRow.id)!;
  ctx.db.run.id.update({ ...fresh, built: fresh.built + 1 });
  writeReceipt(
    ctx,
    runRow.owner,
    'build',
    placeId,
    `Left something behind at ${placeName(ctx, placeId)}`,
    0
  );
}

// ─── Deterministic dialogue ──────────────────────────────────────────────────

const OPENERS = [
  'You look like you have been walking all night too.',
  'Is this your usual spot, or are you lost as well?',
  'I was told to find someone here. You will do.',
  'Everyone keeps moving. You stopped. Why?',
];

const REPLIES = [
  'Not lost. Just slow about it.',
  'I stopped because standing still is the only way to notice anything.',
  'I keep ending up here. I have stopped calling that a coincidence.',
  'Ask me again in an hour and I will have a better answer.',
];

/**
 * Persona-flavoured lines that need no network. These are what the demo runs on
 * when no API key is configured, and what the procedure falls back to when the
 * call fails, so the simulation never depends on OpenRouter being reachable.
 */
function writeFallbackExchange(
  ctx: Ctx,
  conversationId: bigint,
  echoA: bigint,
  echoB: bigint,
  placeId: number
): void {
  const where = placeName(ctx, placeId);
  const opener = OPENERS[ctx.random.integerInRange(0, OPENERS.length - 1)];
  const reply = REPLIES[ctx.random.integerInRange(0, REPLIES.length - 1)];

  insertLine(ctx, conversationId, echoA, `${opener} (${where})`);
  insertLine(ctx, conversationId, echoB, reply);
}

function insertLine(ctx: Ctx, conversationId: bigint, speakerEchoId: bigint, text: string): void {
  ctx.db.transcriptLine.insert({
    id: 0n,
    conversationId,
    speakerEchoId,
    text,
    isAi: true,
    feedback: FEEDBACK_NONE,
    createdAt: ctx.timestamp,
  });
}

// ─── The LLM procedure ───────────────────────────────────────────────────────

/**
 * Scheduled by the `tick` reducer, one job per paid exchange. Reads the private config
 * and both personas in a transaction, does the HTTP call outside any
 * transaction, then writes the lines in a second transaction. On any failure it
 * writes the deterministic exchange instead, so a conversation that a reducer
 * has already paid for always ends up with words in it.
 */
export const echoTalk = spacetimedb.procedure(
  { onSchedule: talkJob },
  { job: talkJob.rowType },
  t.unit(),
  (ctx, { job }) => {
    const setup = ctx.withTx(tx => {
      const config = tx.db.llmConfig.id.find(LLM_CONFIG_ID);
      const convo = tx.db.conversation.id.find(job.conversationId);
      if (!config || !convo) return null;

      const echoA = tx.db.echo.id.find(convo.echoA);
      const echoB = tx.db.echo.id.find(convo.echoB);
      if (!echoA || !echoB) return null;

      const history = [...tx.db.transcriptLine.conversationId.filter(convo.id)]
        .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
        .map(l => `${l.speakerEchoId === convo.echoA ? 'A' : 'B'}: ${l.text}`);

      const goalA = tx.db.run.echoId.filter(echoA.id);
      const goalB = tx.db.run.echoId.filter(echoB.id);

      return {
        apiKey: config.apiKey,
        model: config.model,
        echoAId: echoA.id,
        echoBId: echoB.id,
        placeId: convo.placeId,
        placeName: tx.db.place.id.find(convo.placeId)?.name ?? 'Bengaluru',
        personaA: echoA.persona,
        notesA: echoA.behaviourNotes,
        goalA: firstGoal(goalA),
        personaB: echoB.persona,
        notesB: echoB.behaviourNotes,
        goalB: firstGoal(goalB),
        history,
      };
    });

    if (!setup) return {};

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          `Two people meet at ${setup.placeName} in Bengaluru, late at night.`,
          '',
          `A is: ${setup.personaA}`,
          setup.goalA ? `A wants: ${setup.goalA}` : '',
          setup.notesA ? `A has been corrected before:\n${setup.notesA}` : '',
          '',
          `B is: ${setup.personaB}`,
          setup.goalB ? `B wants: ${setup.goalB}` : '',
          setup.notesB ? `B has been corrected before:\n${setup.notesB}` : '',
          '',
          'Write exactly two lines of dialogue, one from A then one from B.',
          'Format each line as "A: ..." and "B: ...". No narration, under 25 words each.',
          'Obey every correction listed above; those are the strongest instruction here.',
        ]
          .filter(l => l.length > 0)
          .join('\n'),
      },
      {
        role: 'user',
        content:
          setup.history.length > 0
            ? `So far:\n${setup.history.join('\n')}\n\nContinue with the next two lines.`
            : 'Begin the conversation.',
      },
    ];

    const result = chat(ctx.http, setup.apiKey, setup.model, messages);

    ctx.withTx(tx => {
      const now = tx.timestamp;
      const write = (speakerEchoId: bigint, text: string) => {
        tx.db.transcriptLine.insert({
          id: 0n,
          conversationId: job.conversationId,
          speakerEchoId,
          text,
          isAi: true,
          feedback: FEEDBACK_NONE,
          createdAt: now,
        });
      };

      if (!result.ok) {
        console.warn(`echoTalk falling back: ${result.reason}`);
        const o = ctx.random.integerInRange(0, OPENERS.length - 1);
        const r = ctx.random.integerInRange(0, REPLIES.length - 1);
        write(setup.echoAId, `${OPENERS[o]} (${setup.placeName})`);
        write(setup.echoBId, REPLIES[r]);
        return;
      }

      const lines = splitLines(result.text, 2);
      write(setup.echoAId, lines[0]);
      if (lines[1]) write(setup.echoBId, lines[1]);
    });

    return {};
  }
);

function firstGoal(rows: Iterable<{ goal: string }>): string {
  for (const r of rows) return r.goal;
  return '';
}
