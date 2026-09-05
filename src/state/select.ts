// The only file that knows about generated rows. Everything else uses the
// view types in ./types.

import type { Infer } from 'spacetimedb';
import type { AgentSpec } from '../map/BengaluruMap';
import { LANDMARKS } from '../data/landmarks';

import AgentMemorySchema from '../module_bindings/agent_memory_table';
import AgentTravelSchema from '../module_bindings/agent_travel_table';
import CompanySchema from '../module_bindings/company_table';
import ConversationSchema from '../module_bindings/conversation_table';
import CorrectionSchema from '../module_bindings/correction_table';
import EchoSchema from '../module_bindings/echo_table';
import EventJoinSchema from '../module_bindings/event_join_table';
import IntentSchema from '../module_bindings/intent_table';
import PlayerSchema from '../module_bindings/player_table';
import ReceiptSchema from '../module_bindings/receipt_table';
import RunSchema from '../module_bindings/run_table';
import TranscriptLineSchema from '../module_bindings/transcript_line_table';

import { avatarColour, behaviourFrom } from './copy';
import type {
  AgentNote,
  Badge,
  ConversationSummary,
  Correction,
  HostCard,
  JoinedEvent,
  Match,
  MeetAt,
  Player,
  PlaceVisit,
  Receipt,
  RubricScores,
  Run,
  RunStatus,
  TranscriptLine,
} from './types';

export type AgentMemoryRow = Infer<typeof AgentMemorySchema>;
export type AgentTravelRow = Infer<typeof AgentTravelSchema>;
export type CompanyRow = Infer<typeof CompanySchema>;
export type ConversationRow = Infer<typeof ConversationSchema>;
export type CorrectionRow = Infer<typeof CorrectionSchema>;
export type EchoRow = Infer<typeof EchoSchema>;
export type EventJoinRow = Infer<typeof EventJoinSchema>;
export type IntentRow = Infer<typeof IntentSchema>;
export type PlayerRow = Infer<typeof PlayerSchema>;
export type ReceiptRow = Infer<typeof ReceiptSchema>;
export type RunRow = Infer<typeof RunSchema>;
export type TranscriptLineRow = Infer<typeof TranscriptLineSchema>;

/** Great-circle distance in kilometres. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A landmark near the midpoint of two players' current places, nothing beyond
 * 4 km. This used to name a pub from spots.json, which the events layer
 * replaced; the ten landmarks are the only place names the app still ships.
 */
export function meetAtFor(placeA: number, placeB: number): MeetAt | undefined {
  const a = landmarkOf(placeA);
  const b = landmarkOf(placeB);
  const near = nearestLandmark((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
  return near.km > 4 ? undefined : { name: near.name, area: 'Bengaluru', glyph: near.icon };
}

/** Closest of the ten landmarks, with the distance so callers can gate on it. */
export function nearestLandmark(lat: number, lng: number) {
  let best = LANDMARKS[0];
  let bestKm = Infinity;
  for (const mark of LANDMARKS) {
    const km = haversineKm(lat, lng, mark.lat, mark.lng);
    if (km < bestKm) { bestKm = km; best = mark; }
  }
  return { ...best, km: bestKm };
}

/** Timestamps arrive as microseconds since the epoch, in a bigint. */
export const msOf = (ts: { microsSinceUnixEpoch: bigint }): number =>
  Number(ts.microsSinceUnixEpoch / 1000n);

/** Server place ids are 0..9 in LANDMARKS order. */
export const landmarkOf = (placeId: number) => LANDMARKS[placeId] ?? LANDMARKS[0];

export const placeIndexOf = (landmarkId: string): number => {
  const index = LANDMARKS.findIndex(l => l.id === landmarkId);
  return index < 0 ? 0 : index;
};

export { avatarColour };

/** The one join from a player to their company, used by every badge surface. */
export function badgeOf(
  row: { companyId: number; verifiedDomain: string } | undefined,
  companies: readonly CompanyRow[],
): Badge | undefined {
  if (!row?.verifiedDomain) return undefined;
  const named = companies.find(c => c.id === row.companyId);
  return { companyName: named?.name ?? row.verifiedDomain, logo: named?.logo ?? '' };
}

export function toPlayer(row: PlayerRow, companies: readonly CompanyRow[] = []): Player {
  return {
    name: row.name,
    badge: badgeOf(row, companies),
    avatar: row.avatar,
    openrouterLinked: row.openrouterLinked,
    currentPlace: landmarkOf(row.currentPlace).id,
  };
}

export function toRun(row: RunRow): Run {
  return {
    goal: row.goal,
    avoid: row.avoid,
    status: row.status as RunStatus,
    placesVisited: row.placesVisited,
    peopleMet: row.peopleMet,
    spentUsd: row.spentUsd,
    hostMet: row.hostMet,
    hasHost: row.hostEchoId !== 0n,
  };
}

export function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: String(row.id),
    kind: row.kind,
    text: row.text,
    costUsd: row.costUsd,
    placeName: landmarkOf(row.placeId).name,
    at: msOf(row.createdAt),
  };
}

export function hostCardFrom(
  intent: IntentRow,
  host: PlayerRow | undefined,
  nowMs: number,
  companies: readonly CompanyRow[] = [],
): HostCard {
  const daysLeft = Math.max(0, Math.ceil((msOf(intent.expiresAt) - nowMs) / 86_400_000));
  return {
    name: host?.name ?? 'Someone',
    avatar: host?.avatar ?? '',
    intent: intent.text,
    expiresInDays: daysLeft,
    badge: badgeOf(host, companies),
  };
}

/** Newest travel leg per echo, which is where that Echoe is right now. */
export function latestLegs(travels: readonly AgentTravelRow[]): Map<bigint, AgentTravelRow> {
  const legs = new Map<bigint, AgentTravelRow>();
  for (const leg of travels) {
    const current = legs.get(leg.echoId);
    if (!current || leg.id > current.id) legs.set(leg.echoId, leg);
  }
  return legs;
}

/**
 * One map agent per Echoe that has moved. The agent id carries the leg id so a
 * new leg becomes a new agent; BengaluruMap caches its route per agent id.
 */
/**
 * The Echoes that are out right now. A run that is running or paused makes an
 * Echoe live; an ended run means it is home and off the map. A live Echoe with
 * no travel leg yet stands at its landmark, so nobody is invisible for the ten
 * seconds before their first departure.
 */
export function agentsFrom(
  travels: readonly AgentTravelRow[],
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
  runs: readonly RunRow[],
  myEchoId: bigint | undefined,
  hostEchoId: bigint | undefined,
): AgentSpec[] {
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));
  const live = new Set(
    runs.filter(run => run.status === 'running' || run.status === 'paused').map(run => run.echoId),
  );
  const legs = latestLegs(travels);

  const spec = (echoId: bigint, key: string, fromPlace: number, toPlace: number, departMs: number, arriveMs: number): AgentSpec => {
    const player = playerBy.get(ownerOf.get(echoId) ?? '');
    return {
      id: key,
      label: player?.name ?? 'Echoe',
      colour: echoId === hostEchoId ? '#d7f06c' : avatarColour(player?.avatar),
      avatar: player?.avatar ?? '',
      fromPlace: landmarkOf(fromPlace).id,
      toPlace: landmarkOf(toPlace).id,
      departMs,
      arriveMs,
      isMine: myEchoId !== undefined && echoId === myEchoId,
    };
  };

  // Every Echoe with a player is on the map: walking its latest leg while its
  // run is live, otherwise standing at its place. An idle Echoe still counts as
  // presence, and "Watch it roam" needs my own dot to exist before any run.
  const out: AgentSpec[] = [];
  for (const echo of echoes) {
    const echoId = echo.id;
    const player = playerBy.get(ownerOf.get(echoId) ?? '');
    if (!player) continue;
    const leg = legs.get(echoId);
    if (live.has(echoId) && leg) {
      out.push(spec(echoId, `${echoId}-${leg.id}`, leg.fromPlace, leg.toPlace, msOf(leg.departTs), msOf(leg.arriveTs)));
      continue;
    }
    const now = Date.now();
    out.push(spec(echoId, `${echoId}-standing`, player.currentPlace, player.currentPlace, now, now));
  }
  return out;
}

/** Who my Echoe met, best match first. This is the recap. */
export function rankedMatches(
  conversations: readonly ConversationRow[],
  myEchoId: bigint | undefined,
  hostEchoId: bigint | undefined,
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
  companies: readonly CompanyRow[] = [],
  myPlace = 0,
  /** Only conversations that started at or after this moment (the current run). */
  since?: ConversationRow['createdAt'],
): Match[] {
  if (myEchoId === undefined) return [];
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));

  return conversations
    .filter(row => row.echoA === myEchoId || row.echoB === myEchoId)
    .filter(row => !since || msOf(row.createdAt) >= msOf(since))
    .map(row => {
      const otherEchoId = row.echoA === myEchoId ? row.echoB : row.echoA;
      const other = playerBy.get(ownerOf.get(otherEchoId) ?? '');
      return {
        conversationId: String(row.id),
        name: other?.name ?? 'An Echoe',
        avatar: other?.avatar ?? '',
        score: row.score,
        why: row.why,
        placeName: landmarkOf(row.placeId).name,
        isHost: hostEchoId !== undefined && otherEchoId === hostEchoId,
        badge: badgeOf(other, companies),
        meetAt: meetAtFor(myPlace, other?.currentPlace ?? 0),
      };
    })
    .sort((a, b) => (a.isHost === b.isHost ? b.score - a.score : a.isHost ? -1 : 1));
}

/** The seed file lands later; glob keeps the build green until it does. */
const EVENTS = Object.values(
  import.meta.glob("../data/events.json", { eager: true, import: "default" }),
).flat() as { id: string; title: string; venue: string; date: string }[];

/**
 * The events this player joined, newest join first, each carrying the talks my
 * Echoe had there. Joining is the event_join table; the title and venue come
 * from the same events.json the map reads.
 */
export function eventsFrom(
  eventJoins: readonly EventJoinRow[],
  conversations: readonly ConversationRow[],
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
  myEchoId: bigint | undefined,
  identityHex: string | undefined,
  companies: readonly CompanyRow[] = [],
  myPlace = 0,
): JoinedEvent[] {
  if (!identityHex || myEchoId === undefined) return [];

  const joinedCount = new Map<string, number>();
  for (const row of eventJoins) joinedCount.set(row.eventId, (joinedCount.get(row.eventId) ?? 0) + 1);

  const eventOf = new Map(conversations.map(row => [String(row.id), row.eventId]));
  const byEvent = new Map<string, Match[]>();
  for (const talk of rankedMatches(conversations, myEchoId, undefined, echoes, players, companies, myPlace)) {
    const eventId = eventOf.get(talk.conversationId);
    if (!eventId) continue;
    const list = byEvent.get(eventId);
    if (list) list.push(talk);
    else byEvent.set(eventId, [talk]);
  }

  return eventJoins
    .filter(row => row.identity.toHexString() === identityHex)
    .sort((a, b) => msOf(b.joinedAt) - msOf(a.joinedAt))
    .map(row => {
      const meta = EVENTS.find(e => e.id === row.eventId);
      return {
        key: row.eventId,
        name: meta?.title ?? row.eventId,
        venue: meta?.venue ?? "",
        date: meta?.date ?? "",
        joined: joinedCount.get(row.eventId) ?? 0,
        people: byEvent.get(row.eventId) ?? [],
      };
    });
}

export function toTranscript(
  lines: readonly TranscriptLineRow[],
  conversationId: string,
  myEchoId: bigint | undefined,
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
  companies: readonly CompanyRow[] = [],
): TranscriptLine[] {
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));

  return lines
    .filter(row => String(row.conversationId) === conversationId)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(row => {
      const speaker = playerBy.get(ownerOf.get(row.speakerEchoId) ?? '');
      return {
      id: String(row.id),
      speaker: speaker?.name ?? 'Echoe',
      badge: badgeOf(speaker, companies),
      text: row.text,
      isAi: row.isAi,
      feedback: row.feedback,
      mine: myEchoId !== undefined && row.speakerEchoId === myEchoId,
    };
    });
}

/** Places this Echoe has stood in, most recent first. Receipts are the record. */
export function historyFrom(receipts: readonly Receipt[]): PlaceVisit[] {
  const byPlace = new Map<string, PlaceVisit>();
  for (const receipt of receipts) {
    if (receipt.kind !== 'arrive' && receipt.kind !== 'travel') continue;
    const seen = byPlace.get(receipt.placeName);
    if (seen) {
      seen.count += 1;
      seen.lastAt = Math.max(seen.lastAt, receipt.at);
    } else {
      byPlace.set(receipt.placeName, { placeName: receipt.placeName, count: 1, lastAt: receipt.at });
    }
  }
  return [...byPlace.values()].sort((a, b) => b.lastAt - a.lastAt);
}

/** What the player taught their Echoe, newest first. */
export function correctionsFor(
  rows: readonly CorrectionRow[],
  identityHex: string | undefined,
): Correction[] {
  if (!identityHex) return [];
  return rows
    .filter(row => row.owner.toHexString() === identityHex)
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .map(row => ({
      id: String(row.id),
      originalText: row.originalText,
      shouldHaveSaid: row.shouldHaveSaid,
      behaviourChange: row.behaviourChange,
      typedRule: row.behaviourChange.trim() !== behaviourFrom(row.shouldHaveSaid),
      at: msOf(row.appliedAt),
    }));
}

/** What a connected coding agent has told this Echoe, newest first. */
export function agentMemoryFrom(
  rows: readonly AgentMemoryRow[],
  echoId: bigint | undefined,
): AgentNote[] {
  if (echoId === undefined) return [];
  return rows
    .filter(row => row.echoId === echoId)
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .map(row => ({ id: String(row.id), day: row.day, source: row.source, note: row.note }));
}

/**
 * Behaviour notes minus the ones that just restate a correction's rule, which
 * is what the server writes for every correction.
 */
export function notesFrom(
  behaviourNotes: string,
  corrections: readonly Correction[],
): string[] {
  const rules = new Set(corrections.map(c => c.behaviourChange.trim()));
  return behaviourNotes
    .split('\n')
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(line => line.length > 0 && !rules.has(line) && ![...rules].some(r => line.startsWith(r)));
}

/**
 * A conversation_summary row. Typed structurally, not off the generated table,
 * so the client compiles against the contract before the bindings catch up.
 */
export interface ConversationSummaryLike {
  conversationId: bigint;
  identity: { toHexString(): string };
  summary: string;
  scoresJson: string;
  corrective: number;
  correctiveNotesJson: string;
  match: number;
}

/** The module writes JSON strings; a half-written one must not blank the screen. */
function parseJson<T>(text: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(text);
    return value === null || value === undefined ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export function toSummary(row: ConversationSummaryLike): ConversationSummary {
  const scores = parseJson<Partial<RubricScores>>(row.scoresJson, {});
  return {
    summary: row.summary,
    scores: {
      goalFit: num(scores.goalFit),
      personaFit: num(scores.personaFit),
      depth: num(scores.depth),
      reciprocity: num(scores.reciprocity),
      nextStep: num(scores.nextStep),
      avoidPenalty: num(scores.avoidPenalty),
    },
    corrective: num(row.corrective),
    correctiveNotes: parseJson<unknown[]>(row.correctiveNotesJson, []).filter(
      (note): note is string => typeof note === 'string' && note.trim().length > 0,
    ),
    match: num(row.match),
  };
}

/** conversationId -> the rubric match number, for the rows that have one. */
export function matchByConversation(rows: readonly ConversationSummaryLike[]): Map<string, number> {
  return new Map(rows.map(row => [String(row.conversationId), row.match]));
}

/** The rubric match replaces the deterministic score wherever a summary exists. */
export function withMatch(list: readonly Match[], byConversation: Map<string, number>): Match[] {
  return list.map(item => {
    const match = byConversation.get(item.conversationId);
    return match === undefined ? item : { ...item, score: match };
  });
}
