// Echoe — autonomous Echoes roaming a Bengaluru map.
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
import { ScheduleAt, TimeDuration, Timestamp } from 'spacetimedb';
import {
  OPENROUTER_ENDPOINT,
  chat,
  exchangeCode,
  isGoogleEndpoint,
  refreshGoogleToken,
  sendEmail,
  splitLines,
  type ChatMessage,
  type ChatResult,
  type HttpLike,
} from './llm';
import { COMPANIES } from './companies';
import { verifyGoogleToken } from './social';

// ─── Tuning ──────────────────────────────────────────────────────────────────
// A "24 hour" roam is compressed to RUN_DURATION so a judge can watch one end
// to end. Every duration is microseconds, which is what SpacetimeDB speaks.

const TICK_MICROS = 5_000_000n; //  5s world tick
const TRAVEL_MICROS = 4_000_000n; //  4s in transit between two landmarks
const DWELL_MICROS = 6_000_000n; //  6s standing at a landmark before departing
const RUN_DURATION_MICROS = 180_000_000n; //  3min stands in for 24 hours

const MAX_PERSONA_LENGTH = 2_000;
const MAX_GOAL_LENGTH = 280;
const MAX_INTENT_LENGTH = 120;
const INTENT_TTL_MICROS = 7n * 24n * 3_600_000_000n; // intents expire after 7 days
const SHARE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const NO_HOST = 0n;

// ─── Work-email verification ─────────────────────────────────────────────────

const CODE_TTL_MICROS = 600_000_000n; // 10 minutes to type six digits
const SEND_WINDOW_MICROS = 3_600_000_000n; // 1 hour
const MAX_SENDS_PER_WINDOW = 3;
const MAX_CODE_ATTEMPTS = 5;
const NO_COMPANY = 0; // player.companyId when the domain is verified but unseeded
const VERIFIED_BONUS = 10; // added to a complement match when both sides are verified
const COMPLEMENT_FLOOR = 50; // matchIntents adds 50 the moment a complement fires
const SECRET_ADMIN = 'admin_identity';
const SECRET_RESEND_KEY = 'resend_api_key';
const SECRET_GOOGLE_CLIENT_ID = 'google_client_id';
const PROVIDER_GOOGLE = 'google';
const VIA_EMAIL = 'email';
const VIA_GOOGLE = 'google';

/**
 * A badge is only worth something if it means a workplace. Free and personal
 * mail hosts are rejected before a code is ever generated, which also keeps the
 * send quota away from throwaway inboxes. Union of docs/VERIFIED-ECHOE.md and
 * docs/STARTUP-MAP-RESEARCH.md section 5; `zoho.com` counts as personal mail
 * because a Zoho-hosted company address sits on the company's own domain.
 */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'yandex.com', 'yandex.ru',
  'rediffmail.com', 'aol.com', 'mail.com',
  'gmx.com', 'gmx.net',
  'zoho.com', 'zohomail.com',
  'tutanota.com', 'fastmail.com', 'hey.com',
]);

/**
 * Historical and product domains that belong to a seeded company. Kept small on
 * purpose: an unlisted domain still verifies, it just shows the domain instead
 * of the company. Add a row only when a real signup hits the mismatch.
 */
const DOMAIN_ALIASES = new Map([
  ['razorpay.in', 'razorpay.com'],
  ['cure.fit', 'cult.fit'],
  ['yulu.com', 'yulu.bike'],
  ['slice.com', 'sliceit.com'],
]);



const RUN_RUNNING = 'running';
const RUN_PAUSED = 'paused';
const RUN_ENDED = 'ended';

const FEEDBACK_NONE = 'none';
const FEEDBACK_LIKE = 'like';
const FEEDBACK_NOT_ME = 'not_me';

const LLM_CONFIG_ID = 0;
const GOOGLE_AUTH_ID = 0;
const MISSION_ID = 0;

/**
 * Exchanges per meeting. Not a user setting: after this many, the conversation
 * is closed, neither side adds to it, and the find step stops chasing that
 * Echoe so the night is spent meeting people rather than one person.
 */
const MAX_EXCHANGES = 4;

/**
 * Conversations the house pays for, per Echoe, for life. Counted when the Echoe
 * first speaks in one, not per line. After that its lines are billed to the
 * player's own OpenRouter key, and with no key the Echoe comes home.
 */
const FREE_CONVERSATIONS = 5;

/** Model for a player's own key when the house has not configured one. */
const DEFAULT_MODEL = 'openrouter/auto';

const DEFAULT_MISSION =
  "Tonight's mission: find someone who has changed their mind about Bengaluru.";

/** The ten seeded landmarks. Index in this array is the place id. */
const LANDMARKS: [string, number, number][] = [
  ['Bangalore Palace', 77.592, 12.9987],
  ['Vidhana Soudha', 77.5906, 12.9796],
  ['Ulsoor Lake', 77.6192, 12.9815],
  ['Church Street', 77.6048, 12.975],
  ['Cubbon Park', 77.5933, 12.975],
  ['Indiranagar', 77.6409, 12.9716],
  ['Lalbagh', 77.59, 12.95],
  ['MG Road', 77.6119, 12.9738],
  ['Koramangala', 77.6112, 12.9346],
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
    openrouterLinked: t.bool(), // true once linkOpenRouter stored a key for them
    // Public proof of a work address, never the address itself. companyId is 0
    // until a code is verified and stays 0 for a domain outside the seed list,
    // where verifiedDomain is what the badge falls back to.
    companyId: t.u32(),
    verifiedDomain: t.string(),
    verifiedVia: t.string(), // '' | 'email' | 'google': who earned the badge
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
    freeUsed: t.u32(), // house-funded conversations spent, out of FREE_CONVERSATIONS
    updatedAt: t.timestamp(),
  }
);

/**
 * What the player is here for right now, one line. `shareId` is the public
 * handle in a link (echo.app/i/<shareId>). Rows expire: the tick deletes any
 * intent past `expiresAt`, so the city never carries a stale profile.
 */
const intent = table(
  { name: 'intent', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().unique(),
    echoId: t.u64(),
    text: t.string(),
    shareId: t.string().unique(),
    createdAt: t.timestamp(),
    expiresAt: t.timestamp(),
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
 * Public. One row per player, one provider today. Nothing secret is written
 * here: the raw email never leaves the token, only its local part as `handle`.
 * `providerId` is unique, which is what stops one Google account badging two
 * Echoes, the same trick `verification.email` uses.
 */
const linkedAccount = table(
  { name: 'linked_account', public: true },
  {
    identity: t.identity().primaryKey(),
    provider: t.string(), // 'google'
    providerId: t.string().unique(),
    handle: t.string(),
    displayName: t.string(),
    avatarUrl: t.string(), // provider CDN, render with referrerPolicy="no-referrer"
    hostedDomain: t.string(), // Google Workspace `hd`, '' on a consumer account
    linkedAt: t.timestamp(),
  }
);

/**
 * The Bengaluru companies a work address can be verified against. Public and
 * seeded in `init` from `companies.ts`, exactly like `place`, so the client
 * renders a badge from a join instead of shipping its own copy of the list.
 * `seedCompanies` refreshes an already-published database.
 */
const company = table(
  { name: 'company', public: true },
  {
    id: t.u32().primaryKey(),
    slug: t.string().unique(),
    name: t.string(),
    domain: t.string().unique(),
    hqArea: t.string(),
    lng: t.f64(),
    lat: t.f64(),
    category: t.string(),
    logo: t.string(),
    featured: t.bool(),
  }
);

/**
 * One row per completed or in-flight leg. Written only at leg boundaries, so a
 * roaming Echoe costs the network two rows per landmark rather than a position
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

/** The limits a player set before letting their Echoe roam, plus live counters. */
const run = table(
  { name: 'run', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().unique(),
    echoId: t.u64().index('btree'),
    goal: t.string(),
    status: t.string(), // running | paused | ended
    startedAt: t.timestamp(),
    peopleMet: t.u32(),
    placesVisited: t.u32(),
    spentUsd: t.f64(), // OpenRouter credits burned by this run, from usage.cost
    hostEchoId: t.u64(), // 0 when the run was not started from a shared intent
    hostMet: t.bool(),
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
    costUsd: t.f64(),
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
    score: t.u8(), // 0..100 deterministic intent match, set once at creation
    why: t.string(), // one line a human can read: why these two should meet
    fundingA: t.string(), // '' | 'house' | 'own': who pays for A's exchanges
    fundingB: t.string(),
    lastExchangeAt: t.timestamp(), // one exchange per tick, sides alternate
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

/** One correction folded into the Echoe's behaviourNotes and into future prompts. */
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
    owner: t.identity(), // whoever configured it first; the only admin
    apiKey: t.string(),
    model: t.string(),
    endpoint: t.string(), // chat-completions URL; empty means OpenRouter
    updatedAt: t.timestamp(),
  }
);

/** Private. Third-party keys other than OpenRouter (today: resend_api_key, public_origin). */
const secret = table(
  { name: 'secret' },
  {
    key: t.string().primaryKey(),
    value: t.string(),
  }
);

/** Private. A player's own OpenRouter key, used once their free conversations are spent. */
const playerKey = table(
  { name: 'player_key' },
  {
    identity: t.identity().primaryKey(),
    apiKey: t.string(),
    model: t.string(),
    updatedAt: t.timestamp(),
  }
);

/** Private. Email a player left at join, never broadcast to other clients. */
const contact = table(
  { name: 'contact' },
  {
    identity: t.identity().primaryKey(),
    email: t.string(),
    welcomed: t.bool(),
  }
);

/**
 * PRIVATE. Work email, live code and both counters. The email address never
 * reaches a client: only `player.companyId` and `player.verifiedDomain` do. The
 * row outlives a successful verification with `code` blanked, because
 * `email` being unique is the only thing stopping one inbox from badging two
 * identities.
 */
const verification = table(
  { name: 'verification' },
  {
    identity: t.identity().primaryKey(),
    email: t.string().unique(),
    domain: t.string(),
    code: t.string(), // '' once verified, so a used code cannot be replayed
    expiresAt: t.timestamp(),
    attempts: t.u8(),
    sendsThisHour: t.u8(),
    windowStart: t.timestamp(),
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
    payer: t.identity(), // whose run is charged for this exchange
  }
);

/**
 * What one Echoe remembers about another: one line, private. Written by
 * `echoTalk` when a conversation closes, from the transcript that already
 * exists, and read back into the prompt the next time the same two meet. No
 * external memory service: the database is the memory.
 */
const echoMemory = table(
  { name: 'echo_memory' },
  {
    id: t.u64().primaryKey().autoInc(),
    echoId: t.u64().index('btree'),
    otherEchoId: t.u64(),
    note: t.string(),
    updatedAt: t.timestamp(),
  }
);

/**
 * Private. OAuth credentials for Google endpoints (Vertex AI refuses API keys),
 * plus the cached access token. Filled by `setGoogleAuth` from the file that
 * `gcloud auth application-default login` writes. Refreshed by the procedures
 * when within a minute of expiry; the refresh token itself never leaves here.
 */
const googleAuth = table(
  { name: 'google_auth' },
  {
    id: t.u8().primaryKey(),
    clientId: t.string(),
    clientSecret: t.string(),
    refreshToken: t.string(),
    accessToken: t.string(),
    expiresAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }
);

/**
 * PRIVATE. The link between a player's Echoe and the coding agent on their own
 * machine. `token` is generated client-side (crypto.randomUUID) and is the only
 * credential the nightly cron carries, so the row never leaves the server.
 */
const agentLink = table(
  { name: 'agent_link' },
  {
    owner: t.identity().primaryKey(),
    echoId: t.u64(),
    token: t.string().unique(),
    connectedAt: t.timestamp(),
    lastSyncAt: t.timestamp(),
    syncs: t.u32(),
  }
);

/**
 * Public. What the player has actually been working on, distilled by their own
 * local agent from that day's Claude Code / Codex transcripts and POSTed here.
 * Append-only from the module's point of view: the persona is never rewritten,
 * memory only accrues, and the oldest rows fall off past AGENT_MEMORY_KEEP.
 */
const agentMemory = table(
  { name: 'agent_memory', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    echoId: t.u64().index('btree'),
    day: t.string(), // YYYY-MM-DD, as the sending machine saw it
    source: t.string(), // 'claude-code' | 'codex' | 'mixed'
    note: t.string(),
    createdAt: t.timestamp(),
  }
);

const spacetimedb = schema({
  player,
  echo,
  intent,
  place,
  company,
  linkedAccount,
  agentTravel,
  run,
  receipt,
  conversation,
  transcriptLine,
  echoMemory,
  googleAuth,
  correction,
  mission,
  llmConfig,
  playerKey,
  secret,
  contact,
  verification,
  worldTickTimer,
  talkJob,
  agentLink,
  agentMemory,
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

/** Reducers and `withTx` bodies both hand out one of these. */
type Db = Ctx['db'];

/**
 * The work domain behind an address, or a `SenderError` naming what is wrong
 * with it. Free and personal mail is refused here, before a code exists.
 */
function workDomain(email: string): string {
  const clean = email.trim().toLowerCase();
  if (clean.length > 120) fail('email_too_long:120');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) fail('email_invalid');
  const domain = clean.slice(clean.indexOf('@') + 1);
  if (FREE_MAIL.has(domain)) fail('free_mail_domain');
  return DOMAIN_ALIASES.get(domain) ?? domain;
}

/** The seeded company for a domain, or null: an unseeded domain still verifies. */
function companyByDomain(db: Db, domain: string) {
  return db.company.domain.find(domain) ?? null;
}

/**
 * Award the badge. The emailed code and Google's hosted domain both land here,
 * so the row a client reads looks the same either way and `verifiedVia` is the
 * only thing that says which one earned it. Returns the label for the receipt.
 */
function applyVerifiedDomain(
  ctx: Ctx,
  me: ReturnType<typeof requirePlayer>,
  domain: string,
  via: string
): string {
  const named = companyByDomain(ctx.db, domain);
  ctx.db.player.identity.update({
    ...me,
    companyId: named?.id ?? NO_COMPANY,
    verifiedDomain: domain,
    verifiedVia: via,
  });
  const label = named?.name ?? domain;
  writeReceipt(ctx, ctx.sender, 'verified', me.currentPlace, `Verified as ${label}`, 0);
  return label;
}


/** Every receipt in the system is written here, so the append-only rule has one home. */
function writeReceipt(
  ctx: Ctx,
  owner: ReturnType<typeof requirePlayer>['identity'],
  kind: string,
  placeId: number,
  text: string,
  costUsd: number
): void {
  ctx.db.receipt.insert({
    id: 0n,
    runOwner: owner,
    kind,
    placeId,
    text,
    costUsd,
    createdAt: ctx.timestamp,
  });
}

const STOPWORDS = new Set(
  (
    'a an the in on at for to of and or with my me i am is are want looking need new this week someone who bengaluru bangalore india anyone people ' +
    'what you your yours that this these those not but like just really very about from into out have has had would could should will can its it they them their ' +
    'was were been being get got some any more most much also than then there here when where why how all one two probably actual actually thing things'
  ).split(' ')
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#-]+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/** Pairs of intents that fit together even with no shared words. */
const COMPLEMENTS: [string[], string[], string][] = [
  [['hiring', 'hire', 'recruiting'], ['job', 'role', 'work', 'freelance', 'available'], 'one is hiring, the other is looking for work'],
  [['raising', 'raise', 'fundraising', 'pre-seed', 'preseed', 'seed'], ['investing', 'investor', 'invest', 'angel', 'fund'], 'one is raising, the other invests'],
  [['cofounder', 'co-founder'], ['cofounder', 'co-founder'], 'both want a cofounder'],
  [['mentor'], ['mentee', 'learning', 'learn'], 'one mentors, the other wants to learn'],
];

/**
 * Deterministic 0..100 match between two intents, plus a one-line reason. This
 * runs inside the tick's transaction so it must be cheap and network-free. The
 * LLM never decides who should meet; it only writes the words once this says so.
 */
function matchIntents(a: string, b: string): { score: number; why: string } {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const shared = [...ta].filter(w => tb.has(w));
  let score = Math.min(70, shared.length * 25);
  let why = shared.length > 0 ? `both mention ${shared.slice(0, 3).join(', ')}` : '';
  for (const [left, right, reason] of COMPLEMENTS) {
    const lr = left.some(w => ta.has(w)) && right.some(w => tb.has(w));
    const rl = left.some(w => tb.has(w)) && right.some(w => ta.has(w));
    if (lr || rl) {
      score = Math.min(100, score + 50);
      why = why ? `${reason}; ${why}` : reason;
      break;
    }
  }
  if (score === 0) why = 'no overlap yet';
  return { score, why };
}

function newShareId(ctx: Ctx): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += SHARE_ALPHABET[ctx.random.integerInRange(0, SHARE_ALPHABET.length - 1)];
  }
  return out;
}

function intentOf(ctx: Ctx, owner: ReturnType<typeof requirePlayer>['identity']): string {
  return ctx.db.intent.owner.find(owner)?.text ?? '';
}

/** Who someone is: their persona, with their intent as a fallback when no persona was given. */
function profileOf(ctx: Ctx, owner: ReturnType<typeof requirePlayer>['identity']): string {
  const persona = ctx.db.echo.owner.find(owner)?.persona ?? '';
  const line = intentOf(ctx, owner);
  return persona ? `${persona} ${line}` : line;
}

/**
 * Direction matters: my intent is matched against who THEY are (their persona),
 * and their intent against who I am. The better of the two directions wins.
 */
function matchPair(
  ctx: Ctx,
  me: ReturnType<typeof requirePlayer>['identity'],
  them: ReturnType<typeof requirePlayer>['identity']
): { score: number; why: string } {
  // Persona-driven: who I am and what I want, against who they are and what
  // they want. Whole profiles on both sides, so a rich persona is what makes
  // two Echoes find each other.
  const base = matchIntents(profileOf(ctx, me), profileOf(ctx, them));
  // The badge rides on a complement, never on its own: two verified people
  // with nothing in common still score nothing. A complement is what pushes
  // matchIntents to COMPLEMENT_FLOOR, so the score is the test.
  const bothVerified =
    !!ctx.db.player.identity.find(me)?.verifiedDomain &&
    !!ctx.db.player.identity.find(them)?.verifiedDomain;
  if (!bothVerified || base.score < COMPLEMENT_FLOOR) return base;
  return {
    score: Math.min(100, base.score + VERIFIED_BONUS),
    why: `${base.why}; both verified`,
  };
}

function requireRun(ctx: Ctx) {
  const row = ctx.db.run.owner.find(ctx.sender);
  if (!row) fail('no_run');
  return row;
}

/** The most recent leg for an Echoe, or null before its first departure. */
function latestLeg(ctx: Ctx, echoId: bigint) {
  let newest: { id: bigint; toPlace: number; arriveTs: Timestamp } | null = null;
  for (const leg of ctx.db.agentTravel.echoId.filter(echoId)) {
    if (!newest || leg.id > newest.id) newest = leg;
  }
  return newest;
}

/**
 * How this side's next exchange gets paid: 'house' while free conversations
 * remain, 'own' once the player has added a key, '' when neither.
 */
function fundingFor(
  ctx: Ctx,
  echoRow: { freeUsed: number; owner: ReturnType<typeof requirePlayer>['identity'] }
): string {
  if (echoRow.freeUsed < FREE_CONVERSATIONS) return 'house';
  if (ctx.db.playerKey.identity.find(echoRow.owner)) return 'own';
  return '';
}

/** True when the Echoe can neither start nor continue a conversation on any budget. */
function outOfBudget(ctx: Ctx, runRow: ReturnType<typeof requireRun>): boolean {
  const echoRow = ctx.db.echo.id.find(runRow.echoId);
  if (!echoRow || fundingFor(ctx, echoRow)) return false;
  // A conversation this side already funded may still have exchanges left.
  // ponytail: full scan per broke run per tick; index conversation by echoB if it shows up.
  for (const c of ctx.db.conversation.iter()) {
    if (c.echoA !== runRow.echoId && c.echoB !== runRow.echoId) continue;
    if (micros(c.createdAt) < micros(runRow.startedAt)) continue;
    if (c.replies >= MAX_EXCHANGES) continue;
    if (c.echoA === runRow.echoId ? c.fundingA : c.fundingB) return false;
  }
  return true;
}

/** True when this run already finished a conversation with `otherEchoId`. */
function doneTalking(ctx: Ctx, runRow: ReturnType<typeof requireRun>, otherEchoId: bigint): boolean {
  const a = runRow.echoId < otherEchoId ? runRow.echoId : otherEchoId;
  const b = runRow.echoId < otherEchoId ? otherEchoId : runRow.echoId;
  for (const c of ctx.db.conversation.echoA.filter(a)) {
    if (c.echoB !== b) continue;
    if (micros(c.createdAt) < micros(runRow.startedAt)) continue;
    if (c.replies >= MAX_EXCHANGES) return true;
  }
  return false;
}

/**
 * Where to walk next. An Echoe allowed to `find` heads for a landmark that
 * already holds another running Echoe about half the time. Without that bias ten
 * landmarks scatter a handful of agents and they effectively never meet again
 * after their first parting, which is the wrong simulation and a dead demo.
 */
function pickNextPlace(ctx: Ctx, runRow: ReturnType<typeof requireRun>, current: number): number {
  // A run started from a shared link walks to its host before anything else.
  if (runRow.hostEchoId !== NO_HOST && !runRow.hostMet) {
    const hostEcho = ctx.db.echo.id.find(runRow.hostEchoId);
    const hostPlayer = hostEcho ? ctx.db.player.identity.find(hostEcho.owner) : null;
    if (hostPlayer) {
      const hostLeg = latestLeg(ctx, runRow.hostEchoId);
      const going =
        hostLeg && micros(hostLeg.arriveTs) > micros(ctx.timestamp)
          ? hostLeg.toPlace
          : hostPlayer.currentPlace;
      if (going !== current) return going;
    }
  }
  {
    // Only the lower-numbered Echoe of any pair gives chase. If both chased,
    // two Echoes would swap landmarks every tick and never actually arrive
    // together, which is exactly what the first version of this did.
    const targets: number[] = [];
    for (const other of ctx.db.run.iter()) {
      if (other.status !== RUN_RUNNING) continue;
      if (other.echoId <= runRow.echoId) continue;
      if (doneTalking(ctx, runRow, other.echoId)) continue;
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

  for (const c of COMPANIES) ctx.db.company.insert(c);

  ctx.db.mission.insert({
    id: MISSION_ID,
    text: DEFAULT_MISSION,
    updatedAt: ctx.timestamp,
  });

  // The publisher is the admin from the first second. Without this row anyone
  // who called setLlmConfig first on a fresh database would own the house key.
  ctx.db.llmConfig.insert({
    id: LLM_CONFIG_ID,
    owner: ctx.sender,
    apiKey: '',
    model: '',
    endpoint: '',
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

// ─── Screens 1 and 2: join, create Echoe ──────────────────────────────────────

export const join = spacetimedb.reducer(
  { name: t.string(), email: t.string() }, // email optional: empty string skips it
  (ctx, { name, email }) => {
    const clean = trimmed(name, 40, 'name');
    const cleanEmail = email.trim().toLowerCase().slice(0, 120);
    if (cleanEmail.length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) fail('email_invalid');
      const prior = ctx.db.contact.identity.find(ctx.sender);
      if (!prior) {
        ctx.db.contact.insert({ identity: ctx.sender, email: cleanEmail, welcomed: false });
      } else if (prior.email !== cleanEmail) {
        ctx.db.contact.identity.update({ ...prior, email: cleanEmail, welcomed: false });
      }
    }

    const existing = ctx.db.player.identity.find(ctx.sender);
    if (existing) {
      // Also backfills the avatar seed for players who joined before avatars
      // were derived from the identity.
      ctx.db.player.identity.update({ ...existing, name: clean, avatar: avatarSeed(ctx.sender), online: true });
      return;
    }

    ctx.db.player.insert({
      identity: ctx.sender,
      name: clean,
      // Seed for the client's deterministic avatar. Never chosen, never edited.
      avatar: avatarSeed(ctx.sender),
      online: true,
      currentPlace: 0,
      openrouterLinked: false,
      companyId: NO_COMPANY,
      verifiedDomain: '',
      verifiedVia: '',
      joinedAt: ctx.timestamp,
    });
  }
);

export const createEcho = spacetimedb.reducer(
  { persona: t.string(), intent: t.string() },
  (ctx, { persona, intent: intentLine }) => {
    requirePlayer(ctx);
    // Persona is optional flavour; the intent is the product.
    const cleanPersona = persona.trim().slice(0, MAX_PERSONA_LENGTH);
    const cleanIntent = trimmed(intentLine, MAX_INTENT_LENGTH, 'intent');

    const existing = ctx.db.echo.owner.find(ctx.sender);
    let echoId: bigint;
    if (existing) {
      ctx.db.echo.id.update({
        ...existing,
        persona: cleanPersona,
        updatedAt: ctx.timestamp,
      });
      echoId = existing.id;
    } else {
      echoId = ctx.db.echo.insert({
        id: 0n,
        owner: ctx.sender,
        persona: cleanPersona,
        behaviourNotes: '',
        freeUsed: 0,
        updatedAt: ctx.timestamp,
      }).id;
    }

    // One live intent per player. Re-creating refreshes the clock and keeps the
    // share id, so a link already posted keeps working.
    const existingIntent = ctx.db.intent.owner.find(ctx.sender);
    if (existingIntent) {
      ctx.db.intent.id.update({
        ...existingIntent,
        text: cleanIntent,
        expiresAt: plus(ctx.timestamp, INTENT_TTL_MICROS),
      });
    } else {
      let shareId = newShareId(ctx);
      while (ctx.db.intent.shareId.find(shareId)) shareId = newShareId(ctx);
      ctx.db.intent.insert({
        id: 0n,
        owner: ctx.sender,
        echoId,
        text: cleanIntent,
        shareId,
        createdAt: ctx.timestamp,
        expiresAt: plus(ctx.timestamp, INTENT_TTL_MICROS),
      });
    }
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

// ─── Screens 4 and 5: limits, roaming ────────────────────────────────────────

export const startRun = spacetimedb.reducer(
  {
    goal: t.string(),
    hostShareId: t.string(), // empty unless the player arrived through a shared link
  },
  (ctx, { goal, hostShareId }) => {
    const playerRow = requirePlayer(ctx);
    const echoRow = requireEcho(ctx);

    let hostEchoId = NO_HOST;
    if (hostShareId.trim().length > 0) {
      const host = ctx.db.intent.shareId.find(hostShareId.trim());
      if (!host) fail('host_not_found');
      if (micros(host.expiresAt) <= micros(ctx.timestamp)) fail('host_intent_expired');
      if (host.owner.isEqual(ctx.sender)) fail('cannot_host_yourself');
      hostEchoId = host.echoId;
    }

    const cleanGoal = trimmed(goal, MAX_GOAL_LENGTH, 'goal');


    const row = {
      owner: ctx.sender,
      echoId: echoRow.id,
      goal: cleanGoal,
      status: RUN_RUNNING,
      startedAt: ctx.timestamp,
      peopleMet: 0,
      placesVisited: 0,
      spentUsd: 0,
      hostEchoId,
      hostMet: false,
    };

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
 * to the Echoe's behaviourNotes, which the next prompt carries, so the change is
 * visible in what the Echoe says from here on and nowhere in the record of what
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

/**
 * The first identity to call setLlmConfig becomes the admin (the CLI, on
 * publish night). After that, shared rows change only for that identity, so a
 * hostile second tab cannot swap the key or the mission mid-demo.
 */
function requireAdmin(ctx: Ctx) {
  const config = ctx.db.llmConfig.id.find(LLM_CONFIG_ID);
  if (config && !config.owner.isEqual(ctx.sender)) fail('not_admin');
}

export const setLlmConfig = spacetimedb.reducer(
  { apiKey: t.string(), model: t.string(), endpoint: t.string() },
  (ctx, { apiKey, model, endpoint }) => {
    requireAdmin(ctx);
    const key = trimmed(apiKey, 400, 'api_key');
    const cleanModel = trimmed(model, 120, 'model');
    const cleanEndpoint = endpoint.trim().slice(0, 400);
    if (cleanEndpoint && !cleanEndpoint.startsWith('https://')) fail('endpoint_not_https');

    const row = {
      id: LLM_CONFIG_ID,
      owner: ctx.sender,
      apiKey: key,
      model: cleanModel,
      endpoint: cleanEndpoint,
      updatedAt: ctx.timestamp,
    };
    if (ctx.db.llmConfig.id.find(LLM_CONFIG_ID)) {
      ctx.db.llmConfig.id.update(row);
    } else {
      ctx.db.llmConfig.insert(row);
    }
  }
);

/**
 * The `secret` table's own admin, separate from the llmConfig owner: the first
 * identity to write a secret claims `admin_identity`, and only that identity
 * writes afterwards. `seedCompanies` shares the gate.
 */
function requireSecretAdmin(ctx: Ctx): void {
  const admin = ctx.db.secret.key.find(SECRET_ADMIN);
  const me = ctx.sender.toHexString();
  if (admin && admin.value !== me) fail('not_admin');
  if (!admin) ctx.db.secret.insert({ key: SECRET_ADMIN, value: me });
}

/**
 * Store a third-party secret (resend_api_key, public_origin, ...) in the
 * private `secret` table. The first caller becomes admin; after that only the
 * admin identity may write, so a hostile second tab cannot swap keys mid-demo.
 */
export const setSecret = spacetimedb.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    const cleanKey = trimmed(key, 64, 'key');
    const cleanValue = trimmed(value, 512, 'value');
    requireSecretAdmin(ctx);
    const existing = ctx.db.secret.key.find(cleanKey);
    if (existing) ctx.db.secret.key.update({ ...existing, value: cleanValue });
    else ctx.db.secret.insert({ key: cleanKey, value: cleanValue });
  }
);

/** Admin only. Stores the Google OAuth client and refresh token for the house lane. */
export const setGoogleAuth = spacetimedb.reducer(
  { clientId: t.string(), clientSecret: t.string(), refreshToken: t.string() },
  (ctx, { clientId, clientSecret, refreshToken }) => {
    requireAdmin(ctx);
    const row = {
      id: GOOGLE_AUTH_ID,
      clientId: trimmed(clientId, 200, 'client_id'),
      clientSecret: trimmed(clientSecret, 200, 'client_secret'),
      refreshToken: trimmed(refreshToken, 400, 'refresh_token'),
      accessToken: '',
      expiresAt: ctx.timestamp, // already stale: first use refreshes
      updatedAt: ctx.timestamp,
    };
    if (ctx.db.googleAuth.id.find(GOOGLE_AUTH_ID)) ctx.db.googleAuth.id.update(row);
    else ctx.db.googleAuth.insert(row);
  }
);

/**
 * Access token for a Google endpoint, or '' when none is configured or the
 * refresh failed. Cached in google_auth; refreshed when within a minute of
 * expiry, which costs one extra HTTPS call per hour, not per exchange.
 */
function googleBearer(ctx: { http: HttpLike; withTx: <T>(fn: (tx: any) => T) => T }): string {
  const auth = ctx.withTx((tx: any) => {
    const a = tx.db.googleAuth.id.find(GOOGLE_AUTH_ID);
    if (!a) return null;
    return { ...a, stale: micros(a.expiresAt) - 60_000_000n <= micros(tx.timestamp) };
  });
  if (!auth) return '';
  if (!auth.stale) return auth.accessToken;
  const tok = refreshGoogleToken(ctx.http, auth.clientId, auth.clientSecret, auth.refreshToken);
  if (!tok.ok) {
    console.warn(`google token refresh failed: ${tok.reason}`);
    return '';
  }
  ctx.withTx((tx: any) => {
    const a = tx.db.googleAuth.id.find(GOOGLE_AUTH_ID);
    if (a) {
      tx.db.googleAuth.id.update({
        ...a,
        accessToken: tok.accessToken,
        expiresAt: plus(tx.timestamp, BigInt(tok.expiresInSec) * 1_000_000n),
        updatedAt: tx.timestamp,
      });
    }
  });
  return tok.accessToken;
}

/**
 * Adjust limits: forget the player's own OpenRouter key. The key row is private
 * and the flag on `player` is what the client renders.
 */
export const unlinkOpenRouter = spacetimedb.reducer(ctx => {
  const playerRow = requirePlayer(ctx);
  if (ctx.db.playerKey.identity.find(ctx.sender)) ctx.db.playerKey.identity.delete(ctx.sender);
  ctx.db.player.identity.update({ ...playerRow, openrouterLinked: false });
});

/** Remove your own company badge. Keeps the used email row so it cannot be reused elsewhere. */
export const unverify = spacetimedb.reducer(ctx => {
  const playerRow = requirePlayer(ctx);
  if (playerRow.companyId === 0 && playerRow.verifiedDomain === '') fail('not_verified');
  ctx.db.player.identity.update({ ...playerRow, companyId: 0, verifiedDomain: '', verifiedVia: '' });
});

/** Admin only: clear a badge that was set by mistake, e.g. during a test run. */
export const adminUnverify = spacetimedb.reducer(
  { identityHex: t.string() },
  (ctx, { identityHex }) => {
    const admin = ctx.db.secret.key.find('admin_identity');
    if (!admin || admin.value !== ctx.sender.toHexString()) fail('not_admin');
    for (const row of [...ctx.db.player.iter()]) {
      if (row.identity.toHexString() !== identityHex.trim().toLowerCase()) continue;
      ctx.db.player.identity.update({ ...row, companyId: 0, verifiedDomain: '', verifiedVia: '' });
      return;
    }
    fail('player_not_found');
  }
);

export const setMission = spacetimedb.reducer({ text: t.string() }, (ctx, { text }) => {
  requireAdmin(ctx);
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
 * Every 5 seconds, advance each running Echoe by at most one state change:
 *
 *   in transit                     -> nothing
 *   arrived but not recorded       -> land it, bank a receipt, count the place
 *   standing inside its dwell      -> try to meet a co-located Echoe, else build
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
    const cfg = ctx.db.llmConfig.id.find(LLM_CONFIG_ID);
    const hasKey = !!cfg && cfg.apiKey.length > 0 && cfg.model.length > 0;

    // Intents expire. Deleting the row is the whole mechanism: a link to an
    // expired intent fails in startRun, and the map stops matching on it.
    for (const stale of [...ctx.db.intent.iter()]) {
      if (micros(stale.expiresAt) <= now) ctx.db.intent.id.delete(stale.id);
    }

    // Iterate over a snapshot, but re-read each row before acting on it. One
    // Echoe's turn can write to another Echoe's run (a conversation bumps
    // peopleMet on both sides), and acting on the snapshot would silently
    // roll that write back.
    for (const stale of [...ctx.db.run.iter()]) {
      const runRow = ctx.db.run.id.find(stale.id);
      if (!runRow || runRow.status !== RUN_RUNNING) continue;

      if (now - micros(runRow.startedAt) >= RUN_DURATION_MICROS) {
        finishRun(ctx, runRow, 'the 24 hours ran out');
        continue;
      }
      if (outOfBudget(ctx, runRow)) {
        finishRun(ctx, runRow, `all ${FREE_CONVERSATIONS} free conversations used`);
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
        // Fall through: an Echoe may talk on the tick it arrives. Skipping this
        // tick meant a chaser always reached a landmark one tick after its
        // target had left it, so Echoes that started at different times never met.
      }

      // Standing at a landmark: socialise, or build, or leave. Before the first
      // departure there is no leg, so the run's own start time anchors the dwell
      // and every Echoe gets one chance to talk where it began.
      const here = leg ? leg.toPlace : playerRow.currentPlace;
      const standingSince = leg ? micros(leg.arriveTs) : micros(runRow.startedAt);

      const acted = tryConverse(ctx, runRow, here, hasKey);

      // Stay put while a conversation is live; leave once the dwell has passed
      // and there is nobody left to talk to here.
      if (!acted && now >= standingSince + DWELL_MICROS) depart(ctx, runRow, here);
    }
  }
);

function depart(ctx: Ctx, runRow: ReturnType<typeof requireRun>, from: number): void {
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
 * Returns true when an exchange was added to a conversation this tick.
 *
 * There is no per-person or per-reply cap: the only brakes are the run clock and
 * the OpenRouter balance. Consent (both sides allow `talk`) is checked before a
 * single line exists. `peopleMet` and `replies` are counters, not limits.
 */
function tryConverse(
  ctx: Ctx,
  runRow: ReturnType<typeof requireRun>,
  placeId: number,
  hasKey: boolean
): boolean {
  const playerRow = ctx.db.player.identity.find(runRow.owner);
  if (!playerRow) return false;
  const myEcho = ctx.db.echo.id.find(runRow.echoId);
  if (!myEcho) return false;

  // The host of a shared link is talked to first; everyone else in arrival order.
  const here = [...ctx.db.player.currentPlace.filter(placeId)].sort((x, y) => {
    const hx = ctx.db.echo.owner.find(x.identity)?.id === runRow.hostEchoId ? 0 : 1;
    const hy = ctx.db.echo.owner.find(y.identity)?.id === runRow.hostEchoId ? 0 : 1;
    return hx - hy;
  });

  for (const otherPlayer of here) {
    if (otherPlayer.identity.isEqual(runRow.owner)) continue;

    const otherEcho = ctx.db.echo.owner.find(otherPlayer.identity);
    if (!otherEcho) continue;
    const isHost = runRow.hostEchoId !== NO_HOST && otherEcho.id === runRow.hostEchoId;

    // A host is reachable even when their own run is over: their Echoe stands
    // at its last place and receives visitors. Anyone else needs a live run.
    const otherRunRow = ctx.db.run.owner.find(otherPlayer.identity);
    const otherRun = otherRunRow && otherRunRow.status === RUN_RUNNING ? otherRunRow : null;
    if (!isHost) {
      if (!otherRun) continue;
    }
    const otherEchoId = otherEcho.id;

    const a = runRow.echoId < otherEchoId ? runRow.echoId : otherEchoId;
    const b = runRow.echoId < otherEchoId ? otherEchoId : runRow.echoId;

    // Reuse a conversation only if it belongs to the current pair of runs. A
    // conversation older than either run is a memory of a previous night, and
    // continuing it would leave peopleMet at zero while a transcript grew.
    let existing: {
      id: bigint;
      replies: number;
      fundingA: string;
      fundingB: string;
      lastExchangeAt: Timestamp;
    } | null = null;
    for (const c of ctx.db.conversation.echoA.filter(a)) {
      if (c.echoB !== b) continue;
      const started = micros(c.createdAt);
      if (started < micros(runRow.startedAt)) continue;
      if (otherRun && started < micros(otherRun.startedAt)) continue;
      existing = c;
    }
    // Said enough to each other tonight. Move on to the next person.
    if (existing && existing.replies >= MAX_EXCHANGES) continue;

    // One exchange per tick, and the sides take turns: A opens, B answers.
    // Two jobs in one tick both read the same history and both write openers.
    // Engaged but not my turn still counts as acting, so nobody walks off mid-chat.
    if (existing) {
      const myTurn = existing.replies % 2 === 0 ? runRow.echoId === a : runRow.echoId === b;
      if (!myTurn || micros(existing.lastExchangeAt) === micros(ctx.timestamp)) return true;
    } else if (runRow.echoId !== a) {
      continue; // only the lower id opens, so a pair never opens twice in one tick
    }

    // Who pays for my side. Settled the first time I speak in this conversation
    // and then fixed, so a free conversation stays free to its end.
    const mySide = runRow.echoId === a ? 'A' : 'B';
    const settled = existing ? (mySide === 'A' ? existing.fundingA : existing.fundingB) : '';
    const funding = settled || fundingFor(ctx, myEcho);
    if (!funding) return false; // nothing to pay with; the tick brings the run home
    const myFunding = mySide === 'A' ? { fundingA: funding } : { fundingB: funding };

    let conversationId: bigint;
    if (existing) {
      conversationId = existing.id;
      ctx.db.conversation.id.update({
        ...ctx.db.conversation.id.find(existing.id)!,
        replies: existing.replies + 1,
        lastExchangeAt: ctx.timestamp,
        ...myFunding,
      });
    } else {
      const match = matchPair(ctx, runRow.owner, otherPlayer.identity);
      const created = ctx.db.conversation.insert({
        id: 0n,
        echoA: a,
        echoB: b,
        placeId,
        replies: 1,
        score: match.score,
        why: match.why,
        fundingA: '',
        fundingB: '',
        ...myFunding,
        lastExchangeAt: ctx.timestamp,
        createdAt: ctx.timestamp,
      });
      conversationId = created.id;

      const freshRun = ctx.db.run.id.find(runRow.id)!;
      ctx.db.run.id.update({
        ...freshRun,
        peopleMet: freshRun.peopleMet + 1,
        hostMet: freshRun.hostMet || isHost,
      });
      if (otherRun) {
        const freshOther = ctx.db.run.id.find(otherRun.id)!;
        ctx.db.run.id.update({ ...freshOther, peopleMet: freshOther.peopleMet + 1 });
      }
    }

    if (!settled && funding === 'house') {
      const fresh = ctx.db.echo.id.find(runRow.echoId)!;
      ctx.db.echo.id.update({ ...fresh, freeUsed: fresh.freeUsed + 1 });
      if (fresh.freeUsed + 1 === FREE_CONVERSATIONS) {
        writeReceipt(
          ctx,
          runRow.owner,
          'free_used',
          placeId,
          `That was your last free conversation. Add your OpenRouter key under Adjust limits to keep talking.`,
          0
        );
      }
    }

    writeReceipt(
      ctx,
      runRow.owner,
      'talk',
      placeId,
      `Talked with ${otherPlayer.name} at ${placeName(ctx, placeId)}`,
      0
    );

    if (hasKey || funding === 'own') {
      // The reducer has already paid for and counted this exchange. The
      // procedure only fills in the words.
      ctx.db.talkJob.insert({
        scheduledId: 0n,
        scheduledAt: ScheduleAt.time(micros(ctx.timestamp)),
        conversationId,
        payer: runRow.owner,
      });
    } else {
      writeFallbackExchange(ctx, conversationId, a, b, placeId);
    }
    return true;
  }
  return false;
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
      if (!convo) return null;

      const echoA = tx.db.echo.id.find(convo.echoA);
      const echoB = tx.db.echo.id.find(convo.echoB);
      if (!echoA || !echoB) return null;

      // The payer's side decides whose key pays: the house while free
      // conversations last, the player's own afterwards.
      const funding = echoA.owner.isEqual(job.payer) ? convo.fundingA : convo.fundingB;
      const own = funding === 'own' ? tx.db.playerKey.identity.find(job.payer) : undefined;

      const nameA = tx.db.player.identity.find(echoA.owner)?.name ?? 'A';
      const nameB = tx.db.player.identity.find(echoB.owner)?.name ?? 'B';
      const memoryOf = (me: bigint, them: bigint): string => {
        for (const m of tx.db.echoMemory.echoId.filter(me)) if (m.otherEchoId === them) return m.note;
        return '';
      };
      // What their coding agent reported, newest first, capped so a long
      // history cannot crowd out the persona.
      const agentWorkOf = (me: bigint): string[] =>
        [...tx.db.agentMemory.echoId.filter(me)]
          .sort((x, y) => (x.id < y.id ? 1 : x.id > y.id ? -1 : 0))
          .slice(0, AGENT_MEMORY_IN_PROMPT)
          .map(m => m.note);

      const history = [...tx.db.transcriptLine.conversationId.filter(convo.id)]
        .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
        .map(l => `${l.speakerEchoId === convo.echoA ? 'A' : 'B'}: ${l.text}`);

      const goalA = tx.db.run.echoId.filter(echoA.id);
      const goalB = tx.db.run.echoId.filter(echoB.id);

      return {
        // An exchange funded by the player's own key never falls back to the house key.
        apiKey: funding === 'own' ? own?.apiKey ?? '' : config?.apiKey ?? '',
        model: own?.model || config?.model || '',
        // A player's own key is always an OpenRouter key; the house picks its endpoint.
        endpoint: own ? OPENROUTER_ENDPOINT : config?.endpoint || OPENROUTER_ENDPOINT,
        funding,
        echoAId: echoA.id,
        echoBId: echoB.id,
        placeId: convo.placeId,
        placeName: tx.db.place.id.find(convo.placeId)?.name ?? 'Bengaluru',
        personaA: echoA.persona,
        notesA: echoA.behaviourNotes,
        goalA: firstGoal(goalA),
        intentA: tx.db.intent.owner.find(echoA.owner)?.text ?? '',
        intentB: tx.db.intent.owner.find(echoB.owner)?.text ?? '',
        nameA,
        nameB,
        // The reducer counted this exchange before queuing the job, so replies is final.
        closing: convo.replies >= MAX_EXCHANGES,
        exchange: convo.replies,
        why: convo.why,
        memoryA: memoryOf(echoA.id, echoB.id),
        memoryB: memoryOf(echoB.id, echoA.id),
        agentWorkA: agentWorkOf(echoA.id),
        agentWorkB: agentWorkOf(echoB.id),
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
          `Two strangers meet at ${setup.placeName} in Bengaluru at night. Exchange ${setup.exchange} of ${MAX_EXCHANGES}.`,
          '',
          setup.personaA ? `A is: ${setup.personaA}` : '',
          setup.intentA ? `A wants: ${setup.intentA}` : '',
          setup.notesA ? `A's corrections (obey these over everything):
${setup.notesA}` : '',
          setup.memoryA ? `A remembers B from a previous night: ${setup.memoryA}` : '',
          setup.agentWorkA.length > 0
            ? `What A has actually been working on lately (from their coding sessions, use naturally, do not recite):
${setup.agentWorkA.map(n => `- ${n}`).join('\n')}`
            : '',
          '',
          setup.personaB ? `B is: ${setup.personaB}` : '',
          setup.intentB ? `B wants: ${setup.intentB}` : '',
          setup.notesB ? `B's corrections (obey these over everything):
${setup.notesB}` : '',
          setup.memoryB ? `B remembers A from a previous night: ${setup.memoryB}` : '',
          setup.agentWorkB.length > 0
            ? `What B has actually been working on lately (from their coding sessions, use naturally, do not recite):
${setup.agentWorkB.map(n => `- ${n}`).join('\n')}`
            : '',
          '',
          setup.why ? `They were matched because: ${setup.why}.` : '',
          setup.memoryA || setup.memoryB
            ? 'They have met before. Pick up where they left off; no introductions.'
            : '',
          'Both are deciding whether to meet in person this week. Every line should probe the',
          "other's want, react to what was just said, or push toward the match. No small talk.",
          `Mention ${setup.placeName} or something physical there at most once.`,
          'One line each, A then B, under 25 words, no narration, no names, no letters as names.',
          'Format exactly: "A: ..." on the first line, then "B: ..." on the second.',
          setup.exchange >= MAX_EXCHANGES
            ? 'This is the final exchange: B must land on one concrete next step, a day, a place, or how to reach them.'
            : '',
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

    // Google endpoints authenticate with an OAuth token instead of the stored key.
    const bearer = isGoogleEndpoint(setup.endpoint) ? googleBearer(ctx) : setup.apiKey;
    const result: ChatResult =
      bearer && setup.model
        ? chat(ctx.http, bearer, setup.model, messages, setup.endpoint)
        : { ok: false, reason: 'no key available for this exchange' };

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

      // On the closing exchange, each side keeps one line about the other, built
      // from what was actually said. Next time these two meet it is in the prompt.
      const remember = () => {
        if (!setup.closing) return;
        const said = [...tx.db.transcriptLine.conversationId.filter(job.conversationId)].sort((x, y) =>
          x.id < y.id ? -1 : x.id > y.id ? 1 : 0
        );
        const lastOf = (speaker: bigint): string => {
          let out = '';
          for (const l of said) if (l.speakerEchoId === speaker) out = l.text;
          return out;
        };
        const upsert = (me: bigint, them: bigint, note: string) => {
          for (const m of tx.db.echoMemory.echoId.filter(me)) {
            if (m.otherEchoId === them) {
              tx.db.echoMemory.id.update({ ...m, note, updatedAt: now });
              return;
            }
          }
          tx.db.echoMemory.insert({ id: 0n, echoId: me, otherEchoId: them, note, updatedAt: now });
        };
        const about = (name: string, intent: string, last: string) =>
          `Met ${name} at ${setup.placeName}. Here for: ${intent || 'they did not say'}. Last thing they said: "${last}"`;
        upsert(setup.echoAId, setup.echoBId, about(setup.nameB, setup.intentB, lastOf(setup.echoBId)));
        upsert(setup.echoBId, setup.echoAId, about(setup.nameA, setup.intentA, lastOf(setup.echoAId)));
      };
      if (setup.memoryA || setup.memoryB) console.log(`echoTalk: memory in prompt for conversation ${job.conversationId}`);

      // Only a reply with both speakers ships. Anything else, including a
      // one-line or preamble-laden answer, falls back rather than guessing.
      const lines = result.ok ? splitLines(result.text, 2) : [];
      if (!result.ok || lines.length < 2) {
        console.warn(`echoTalk falling back: ${result.ok ? 'malformed reply' : result.reason}`);
        const mine = setup.intentA || 'something I cannot name yet';
        const theirs = setup.intentB || 'something they would not say';
        const openers = [
          `I am out tonight for one reason: ${mine}. What is yours?`,
          `Most people here are just walking. I am here because I am ${mine}.`,
          `Long shot, but I came to ${setup.placeName} for ${mine}.`,
          `You look like you are here for a reason too. Mine is ${mine}.`,
        ];
        const replies = [
          `Funny. I am ${theirs}. Maybe this was not a wasted walk.`,
          `I am ${theirs}, actually. Tell me more before I decide.`,
          `Same instinct, different reason. I am ${theirs} tonight.`,
          `I am ${theirs}. Did not expect to say that to a stranger.`,
        ];
        write(setup.echoAId, openers[ctx.random.integerInRange(0, openers.length - 1)]);
        write(setup.echoBId, replies[ctx.random.integerInRange(0, replies.length - 1)]);
        remember();
        return;
      }

      write(setup.echoAId, lines[0]);
      write(setup.echoBId, lines[1]);
      remember();

      // Real money, straight from OpenRouter's usage.cost. Charged to the run
      // that queued the job; the receipt is what the Return screen totals.
      const payerRun = tx.db.run.owner.find(job.payer);
      if (payerRun) {
        tx.db.run.id.update({ ...payerRun, spentUsd: payerRun.spentUsd + result.costUsd });
      }
      tx.db.receipt.insert({
        id: 0n,
        runOwner: job.payer,
        kind: 'llm',
        placeId: setup.placeId,
        text: `${isGoogleEndpoint(setup.endpoint) ? 'Gemini via Google Cloud' : 'OpenRouter'}, ${setup.funding === 'own' ? 'your key' : 'on us'}: ${lines.length} lines`,
        costUsd: result.costUsd,
        createdAt: now,
      });
    });

    return {};
  }
);

// ─── OpenRouter sign-in (client-callable) ─────────────────────────────────────

/**
 * Second half of OpenRouter's PKCE flow. The browser sent the player to
 * openrouter.ai/auth with a code challenge and got a one-time `code` back; it
 * hands the code and its verifier here. The exchange happens on the server, so
 * the resulting key is written straight into the private table and never
 * reaches the browser. The flag on `player` is all a client ever sees.
 */
export const linkOpenRouter = spacetimedb.procedure(
  { code: t.string(), codeVerifier: t.string() },
  t.unit(),
  (ctx, { code, codeVerifier }) => {
    if (code.trim().length === 0 || codeVerifier.trim().length === 0) {
      throw new SenderError('code_required');
    }
    const sender = ctx.withTx(tx => (tx.db.player.identity.find(tx.sender) ? tx.sender : null));
    if (!sender) throw new SenderError('join_first');

    const got = exchangeCode(ctx.http, code.trim(), codeVerifier.trim());
    if (!got.ok) throw new SenderError(`openrouter_auth_failed: ${got.reason}`);

    ctx.withTx(tx => {
      const row = {
        identity: sender,
        apiKey: got.key,
        model: tx.db.llmConfig.id.find(LLM_CONFIG_ID)?.model || DEFAULT_MODEL,
        updatedAt: tx.timestamp,
      };
      if (tx.db.playerKey.identity.find(sender)) tx.db.playerKey.identity.update(row);
      else tx.db.playerKey.insert(row);
      const playerRow = tx.db.player.identity.find(sender);
      if (playerRow) tx.db.player.identity.update({ ...playerRow, openrouterLinked: true });
    });
    return {};
  }
);

// ─── Intent suggestions from a persona (client-callable) ─────────────────────

/**
 * Turns a persona into two or three one-line intents the player can tap. Uses
 * the LLM when a key is configured; otherwise builds lines from the persona's
 * own keywords so the button always returns something. Returns one line per
 * row of text, newline separated.
 */
export const suggestIntents = spacetimedb.procedure(
  { persona: t.string() },
  t.string(),
  (ctx, { persona }) => {
    const clean = persona.trim().slice(0, MAX_PERSONA_LENGTH);
    if (clean.length === 0) throw new SenderError('persona_required');

    // Joined players only: this spends the house key on every tap.
    const state = ctx.withTx(tx => ({
      joined: tx.db.player.identity.find(tx.sender) !== undefined,
      config: tx.db.llmConfig.id.find(LLM_CONFIG_ID),
    }));
    if (!state.joined) throw new SenderError('join_first');
    const config = state.config;
    // No heuristic stand-in: without a model there are no suggestions.
    if (!config || !config.apiKey || !config.model) throw new SenderError('suggestions_unavailable');
    {
      const endpoint = config.endpoint || OPENROUTER_ENDPOINT;
      const bearer = isGoogleEndpoint(endpoint) ? googleBearer(ctx) : config.apiKey;
      if (!bearer) throw new SenderError('suggestions_unavailable');
      const result = chat(ctx.http, bearer, config.model, [
        {
          role: 'system',
          content: [
            'You write one-line intents for a city networking app in Bengaluru.',
            'Given a persona, write exactly three intents, one per line, each under 12 words,',
            'each starting with a verb or a role, concrete enough that a stranger could act on it.',
            'Examples: "hiring a Rust dev in Bengaluru", "raising pre-seed for a fintech",',
            '"looking for a design cofounder", "want a gym partner in Indiranagar". No numbering.',
          ].join(' '),
        },
        { role: 'user', content: clean },
      ], endpoint);
      if (result.ok) return splitLines(result.text, 3).join('\n');
      console.warn(`suggestIntents failed: ${result.reason}`);
      throw new SenderError('suggestions_failed');
    }
  }
);

/** The client renders a deterministic face from this. Never chosen, never edited. */
function avatarSeed(identity: { toHexString(): string }): string {
  return identity.toHexString().slice(0, 16);
}

function firstGoal(rows: Iterable<{ goal: string }>): string {
  for (const r of rows) return r.goal;
  return '';
}

// ─── Verified company Echoe ──────────────────────────────────────────────────

/**
 * Refresh the seeded company list on a database that was published before a
 * company was added. `init` runs once per database, so without this a new row
 * in `companies.ts` would need a data wipe. Same admin gate as `setSecret`.
 */
export const seedCompanies = spacetimedb.reducer(ctx => {
  requireSecretAdmin(ctx);
  for (const c of COMPANIES) {
    const existing = ctx.db.company.id.find(c.id);
    if (existing) ctx.db.company.id.update(c);
    else ctx.db.company.insert(c);
  }
});

/** Plain text, so it reads the same in every client. 47 words and a code. */
function verifyEmailText(name: string, company: string, code: string, link: string): string {
  return [
    `${name},`,
    '',
    `Your code is ${code}. It works for the next ten minutes.`,
    `Type it in and your Echoe walks Bengaluru wearing ${company}.`,
    link ? `Your line is still live at ${link}. Send it to one more person.` : '',
    '',
    'Echoe',
  ]
    .filter(l => l.length > 0)
    .join('\n');
}

/**
 * Send a six-digit code to a work address. A procedure because Resend is an
 * HTTP call: everything the send depends on is read and written in one
 * transaction, then the network runs with no transaction open, so a slow or
 * dead Resend cannot hold a lock while the world ticks.
 *
 * Returns 'sent' when Resend accepted it and 'logged' when the code only
 * reached the module log, which is the demo path when no key is configured.
 */
export const requestVerification = spacetimedb.procedure(
  { email: t.string() },
  t.string(),
  (ctx, { email }) => {
    const clean = email.trim().toLowerCase();
    const domain = workDomain(clean);

    // Drawn before withTx on purpose. A transaction body may be replayed, and a
    // code that changes on replay is a code nobody can type.
    let code = '';
    for (let i = 0; i < 6; i++) code += String(ctx.random.integerInRange(0, 9));

    const ready = ctx.withTx(tx => {
      const now = tx.timestamp;
      const me = tx.db.player.identity.find(tx.sender);
      if (!me) fail('not_joined');

      // `email` is unique. A verified row keeps the address for good; an
      // unverified one is fair game and the old code dies with it.
      const holder = tx.db.verification.email.find(clean);
      if (holder && !holder.identity.isEqual(tx.sender)) {
        if (holder.code.length === 0) fail('email_taken');
        tx.db.verification.identity.delete(holder.identity);
      }

      const prior = tx.db.verification.identity.find(tx.sender);
      const freshWindow =
        !prior || micros(now) - micros(prior.windowStart) >= SEND_WINDOW_MICROS;
      const sendsThisHour = freshWindow ? 1 : prior.sendsThisHour + 1;
      if (sendsThisHour > MAX_SENDS_PER_WINDOW) fail('too_many_sends');

      const row = {
        identity: tx.sender,
        email: clean,
        domain,
        code,
        expiresAt: plus(now, CODE_TTL_MICROS),
        attempts: 0,
        sendsThisHour,
        windowStart: freshWindow ? now : prior!.windowStart,
      };
      if (prior) tx.db.verification.identity.update(row);
      else tx.db.verification.insert(row);

      return {
        apiKey: tx.db.secret.key.find(SECRET_RESEND_KEY)?.value ?? '',
        // 'email_from' is the documented key; 'resend_from' is what an earlier
        // draft of the runbook used, so both are honoured.
        from:
          tx.db.secret.key.find('email_from')?.value ??
          tx.db.secret.key.find('resend_from')?.value ??
          'Echoe <onboarding@resend.dev>',
        origin: tx.db.secret.key.find('public_origin')?.value ?? '',
        name: me.name,
        company: companyByDomain(tx.db, domain)?.name ?? domain,
        shareId: tx.db.intent.owner.find(tx.sender)?.shareId ?? '',
      };
    });

    const link = ready.shareId && ready.origin ? `${ready.origin}/i/${ready.shareId}` : '';
    const body = verifyEmailText(ready.name, ready.company, code, link);
    const sent = ready.apiKey
      ? sendEmail(ctx.http, ready.apiKey, ready.from, clean, `${code} is your Echoe code`, body)
      : { ok: false as const, reason: `no ${SECRET_RESEND_KEY} configured` };

    if (!sent.ok) {
      // DEV ONLY. The row is already committed, so the flow still completes with
      // the code read out of `spacetime logs`. Unreachable once Resend works.
      console.warn(`requestVerification: ${sent.reason}`);
      console.warn(`DEV ONLY verification code for ${clean}: ${code}`);
      return 'logged';
    }
    return 'sent';
  }
);

/**
 * Check a code and badge the player. A procedure rather than a reducer because
 * a reducer that throws rolls its own transaction back, so a reducer could
 * never count a failed attempt. This commits the increment inside `withTx` and
 * reports the outcome as a return value instead.
 *
 * Returns one of: ok | wrong_code | expired | too_many_attempts | no_request.
 */
export const verifyCode = spacetimedb.procedure(
  { code: t.string() },
  t.string(),
  (ctx, { code }) =>
    ctx.withTx(tx => {
      const row = tx.db.verification.identity.find(tx.sender);
      const me = tx.db.player.identity.find(tx.sender);
      if (!row || !me || row.code.length === 0) return 'no_request';
      if (micros(tx.timestamp) > micros(row.expiresAt)) return 'expired';
      if (row.attempts >= MAX_CODE_ATTEMPTS) return 'too_many_attempts';

      if (code.trim() !== row.code) {
        tx.db.verification.identity.update({ ...row, attempts: row.attempts + 1 });
        return 'wrong_code';
      }

      // The row stays, with the code blanked: `email` being unique is what stops
      // one inbox badging a second identity, and a blank code cannot be replayed.
      tx.db.verification.identity.update({ ...row, code: '', attempts: 0 });
      applyVerifiedDomain(tx, me, row.domain, VIA_EMAIL);
      return 'ok';
    })
);

// ─── Google connect ──────────────────────────────────────────────────────────

/**
 * Link a Google account from the ID token the Google Identity Services button
 * hands the page. A procedure because the token is checked against Google over
 * HTTP; the check runs with no transaction open, and only its verdict is
 * written. Returns 'linked', or 'linked_verified' when the player carries a
 * company badge afterwards.
 *
 * A Workspace `hd` is asserted by Google rather than typed by the player, so it
 * stands in for the emailed code. A consumer account has no `hd`, gets the
 * linked row and stays unverified.
 */
export const linkGoogle = spacetimedb.procedure(
  { idToken: t.string() },
  t.string(),
  (ctx, { idToken }) => {
    const clientId = ctx.withTx(tx => {
      if (!tx.db.player.identity.find(tx.sender)) fail('not_joined');
      return tx.db.secret.key.find(SECRET_GOOGLE_CLIENT_ID)?.value ?? '';
    });
    if (!clientId) fail('google_client_id_not_set');

    const nowSecs = Number(micros(ctx.timestamp) / 1_000_000n);
    const got = verifyGoogleToken(ctx.http, idToken.trim(), clientId, nowSecs);
    if (!got.ok) {
      console.warn(`linkGoogle rejected a token: ${got.reason}`);
      fail(`google_link_failed:${got.reason}`);
    }
    const c = got.claims;

    return ctx.withTx(tx => {
      const me = tx.db.player.identity.find(tx.sender);
      if (!me) fail('not_joined');

      const held = tx.db.linkedAccount.providerId.find(c.sub);
      if (held && !held.identity.isEqual(tx.sender)) fail('account_taken');

      const row = {
        identity: tx.sender,
        provider: PROVIDER_GOOGLE,
        providerId: c.sub,
        handle: c.email.split('@')[0] || c.name,
        displayName: c.name || c.email,
        avatarUrl: c.picture,
        hostedDomain: c.hostedDomain,
        linkedAt: tx.timestamp,
      };
      if (tx.db.linkedAccount.identity.find(tx.sender)) {
        tx.db.linkedAccount.identity.update(row);
      } else {
        tx.db.linkedAccount.insert(row);
      }
      writeReceipt(
        tx,
        tx.sender,
        'linked',
        me.currentPlace,
        `Connected Google as ${row.displayName}`,
        0
      );

      // Google fills an empty badge or refreshes one it set itself. It never
      // overwrites a badge the emailed code earned: that domain was proved by a
      // code this player typed, and unlinkGoogle would then strip it.
      const hd = c.hostedDomain;
      const mine = me.verifiedDomain === '' || me.verifiedVia === VIA_GOOGLE;
      if (hd && !FREE_MAIL.has(hd) && mine) applyVerifiedDomain(tx, me, hd, VIA_GOOGLE);

      const after = tx.db.player.identity.find(tx.sender);
      return after && after.verifiedDomain ? 'linked_verified' : 'linked';
    });
  }
);

/**
 * Forget the Google link. The badge goes with it only if Google is what set it:
 * a domain proved by the emailed code survives, which is what `verifiedVia`
 * exists to answer.
 */
export const unlinkGoogle = spacetimedb.reducer(ctx => {
  const playerRow = requirePlayer(ctx);
  if (!ctx.db.linkedAccount.identity.find(ctx.sender)) fail('not_linked');
  ctx.db.linkedAccount.identity.delete(ctx.sender);
  if (playerRow.verifiedVia !== VIA_GOOGLE) return;
  ctx.db.player.identity.update({
    ...playerRow,
    companyId: NO_COMPANY,
    verifiedDomain: '',
    verifiedVia: '',
  });
});

// ─── Coding-agent memory ─────────────────────────────────────────────────────
//
// The loop: the player generates a token in the app, a nightly cron on their own
// machine distils that day's Claude Code / Codex transcripts into a few lines
// with their own local agent, and POSTs them here. The Echoe then carries those
// lines into its next conversation. The persona is never rewritten; memory only
// appends, and only the newest AGENT_MEMORY_KEEP lines survive.

const AGENT_TOKEN_MIN = 16;
const AGENT_TOKEN_MAX = 128;
const AGENT_NOTE_MIN = 3;
const AGENT_NOTE_MAX = 300;
const AGENT_NOTES_PER_SYNC = 12;
const AGENT_MEMORY_KEEP = 40;
const AGENT_MEMORY_IN_PROMPT = 8;
const AGENT_SOURCES = new Set(['claude-code', 'codex', 'mixed']);

/** The link token as it may be stored: opaque, URL-safe, long enough to not be guessed. */
function cleanAgentToken(raw: string): string {
  const token = raw.trim();
  if (token.length < AGENT_TOKEN_MIN || token.length > AGENT_TOKEN_MAX) fail('bad_token_length');
  for (const ch of token) {
    const ok =
      (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') ||
      ch === '_' || ch === '-';
    if (!ok) fail('bad_token_charset');
  }
  return token;
}

/**
 * Connect (or rotate) the caller's coding agent. The client generates the token
 * — the module never does, because a reducer has no randomness a client can be
 * told about ahead of the call. Rotating resets the sync counter; re-sending the
 * same token is idempotent and keeps it.
 */
export const setAgentLink = spacetimedb.reducer(
  { token: t.string() },
  (ctx, { token }) => {
    const echoRow = requireEcho(ctx);
    const clean = cleanAgentToken(token);

    const holder = ctx.db.agentLink.token.find(clean);
    if (holder && !holder.owner.isEqual(ctx.sender)) fail('token_taken');

    const existing = ctx.db.agentLink.owner.find(ctx.sender);
    const rotating = !existing || existing.token !== clean;
    const row = {
      owner: ctx.sender,
      echoId: echoRow.id,
      token: clean,
      connectedAt: rotating ? ctx.timestamp : existing.connectedAt,
      lastSyncAt: rotating ? ctx.timestamp : existing.lastSyncAt,
      syncs: rotating ? 0 : existing.syncs,
    };
    if (existing) ctx.db.agentLink.owner.update(row);
    else ctx.db.agentLink.insert(row);
  }
);

/**
 * Called by the player's own machine over plain HTTP with a throwaway identity,
 * so `ctx.sender` means nothing here: the token is the whole authentication.
 * Lines already remembered are skipped, which makes a re-run of the same night
 * a no-op rather than a duplicate.
 */
export const ingestAgentMemory = spacetimedb.reducer(
  { token: t.string(), day: t.string(), source: t.string(), notes: t.string() },
  (ctx, { token, day, source, notes }) => {
    const link = ctx.db.agentLink.token.find(token.trim());
    if (!link) fail('bad_token');

    const cleanDay = trimmed(day, 10, 'day');
    const cleanSource = source.trim().toLowerCase();
    const src = AGENT_SOURCES.has(cleanSource) ? cleanSource : 'mixed';

    // Everything this Echoe already remembers, folded once, so N incoming lines
    // cost one pass rather than N. ponytail: linear scan; fine at 40 rows/echo.
    const seen = new Set<string>();
    for (const row of ctx.db.agentMemory.echoId.filter(link.echoId)) {
      seen.add(row.note.toLowerCase());
    }

    let added = 0;
    for (const raw of notes.split('\n')) {
      if (added >= AGENT_NOTES_PER_SYNC) break;
      let line = raw.trim();
      if (line.startsWith('- ')) line = line.slice(2).trim();
      if (line.length < AGENT_NOTE_MIN || line.length > AGENT_NOTE_MAX) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ctx.db.agentMemory.insert({
        id: 0n,
        echoId: link.echoId,
        day: cleanDay,
        source: src,
        note: line,
        createdAt: ctx.timestamp,
      });
      added += 1;
    }

    // Oldest first: `id` is autoInc, so ascending id is ascending age.
    const mine = [...ctx.db.agentMemory.echoId.filter(link.echoId)]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (let i = 0; i < mine.length - AGENT_MEMORY_KEEP; i += 1) {
      ctx.db.agentMemory.id.delete(mine[i].id);
    }

    ctx.db.agentLink.owner.update({
      ...link,
      lastSyncAt: ctx.timestamp,
      syncs: link.syncs + 1,
    });
  }
);
