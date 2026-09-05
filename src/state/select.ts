// The only file that knows about generated rows. Everything else uses the
// view types in ./types.

import type { Infer } from 'spacetimedb';
import type { AgentSpec } from '../map/BengaluruMap';
import { LANDMARKS } from '../data/landmarks';

import AgentTravelSchema from '../module_bindings/agent_travel_table';
import ConversationSchema from '../module_bindings/conversation_table';
import EchoSchema from '../module_bindings/echo_table';
import IntentSchema from '../module_bindings/intent_table';
import PlayerSchema from '../module_bindings/player_table';
import ReceiptSchema from '../module_bindings/receipt_table';
import RunSchema from '../module_bindings/run_table';
import TranscriptLineSchema from '../module_bindings/transcript_line_table';

import { AVATAR_COLOUR } from './copy';
import type { HostCard, Match, Player, Receipt, Run, RunStatus, TranscriptLine } from './types';

export type AgentTravelRow = Infer<typeof AgentTravelSchema>;
export type ConversationRow = Infer<typeof ConversationSchema>;
export type EchoRow = Infer<typeof EchoSchema>;
export type IntentRow = Infer<typeof IntentSchema>;
export type PlayerRow = Infer<typeof PlayerSchema>;
export type ReceiptRow = Infer<typeof ReceiptSchema>;
export type RunRow = Infer<typeof RunSchema>;
export type TranscriptLineRow = Infer<typeof TranscriptLineSchema>;

/** Timestamps arrive as microseconds since the epoch, in a bigint. */
export const msOf = (ts: { microsSinceUnixEpoch: bigint }): number =>
  Number(ts.microsSinceUnixEpoch / 1000n);

/** Server place ids are 0..9 in LANDMARKS order. */
export const landmarkOf = (placeId: number) => LANDMARKS[placeId] ?? LANDMARKS[0];

export const placeIndexOf = (landmarkId: string): number => {
  const index = LANDMARKS.findIndex(l => l.id === landmarkId);
  return index < 0 ? 0 : index;
};

export const avatarColour = (avatar: string): string => AVATAR_COLOUR[avatar] ?? '#f4b857';

export function toPlayer(row: PlayerRow): Player {
  return {
    name: row.name,
    avatar: row.avatar,
    credits: row.credits,
    currentPlace: landmarkOf(row.currentPlace).id,
  };
}

export function toRun(row: RunRow): Run {
  return {
    goal: row.goal,
    maxPeople: row.maxPeople,
    repliesPerPerson: row.repliesPerPerson,
    creditCap: row.creditCap,
    allowedActions: row.allowedActions.split(',').filter(Boolean),
    status: row.status as RunStatus,
    placesVisited: row.placesVisited,
    peopleMet: row.peopleMet,
    built: row.built,
    creditsSpent: row.creditsSpent,
    hostMet: row.hostMet,
    hasHost: row.hostEchoId !== 0n,
  };
}

export function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: String(row.id),
    kind: row.kind,
    text: row.text,
    creditCost: row.creditCost,
    placeName: landmarkOf(row.placeId).name,
    at: msOf(row.createdAt),
  };
}

export function hostCardFrom(intent: IntentRow, host: PlayerRow | undefined, nowMs: number): HostCard {
  const daysLeft = Math.max(0, Math.ceil((msOf(intent.expiresAt) - nowMs) / 86_400_000));
  return {
    name: host?.name ?? 'Someone',
    avatar: host?.avatar ?? 'circle',
    intent: intent.text,
    expiresInDays: daysLeft,
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
export function agentsFrom(
  travels: readonly AgentTravelRow[],
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
  myEchoId: bigint | undefined,
  hostEchoId: bigint | undefined,
): AgentSpec[] {
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));

  return [...latestLegs(travels).values()].map(leg => {
    const player = playerBy.get(ownerOf.get(leg.echoId) ?? '');
    const isMine = myEchoId !== undefined && leg.echoId === myEchoId;
    return {
      id: `${leg.echoId}-${leg.id}`,
      label: player?.name ?? 'Echoe',
      colour:
        leg.echoId === hostEchoId ? '#d7f06c' : avatarColour(player?.avatar ?? 'circle'),
      fromPlace: landmarkOf(leg.fromPlace).id,
      toPlace: landmarkOf(leg.toPlace).id,
      departMs: msOf(leg.departTs),
      arriveMs: msOf(leg.arriveTs),
      isMine,
    };
  });
}

/** Who my Echoe met, best match first. This is the recap. */
export function rankedMatches(
  conversations: readonly ConversationRow[],
  myEchoId: bigint | undefined,
  hostEchoId: bigint | undefined,
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
): Match[] {
  if (myEchoId === undefined) return [];
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));

  return conversations
    .filter(row => row.echoA === myEchoId || row.echoB === myEchoId)
    .map(row => {
      const otherEchoId = row.echoA === myEchoId ? row.echoB : row.echoA;
      const other = playerBy.get(ownerOf.get(otherEchoId) ?? '');
      return {
        conversationId: String(row.id),
        name: other?.name ?? 'An Echoe',
        avatar: other?.avatar ?? 'circle',
        score: row.score,
        why: row.why,
        placeName: landmarkOf(row.placeId).name,
        isHost: hostEchoId !== undefined && otherEchoId === hostEchoId,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function toTranscript(
  lines: readonly TranscriptLineRow[],
  conversationId: string,
  myEchoId: bigint | undefined,
  echoes: readonly EchoRow[],
  players: readonly PlayerRow[],
): TranscriptLine[] {
  const ownerOf = new Map(echoes.map(echo => [echo.id, echo.owner.toHexString()]));
  const playerBy = new Map(players.map(player => [player.identity.toHexString(), player]));

  return lines
    .filter(row => String(row.conversationId) === conversationId)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(row => ({
      id: String(row.id),
      speaker: playerBy.get(ownerOf.get(row.speakerEchoId) ?? '')?.name ?? 'Echoe',
      text: row.text,
      isAi: row.isAi,
      feedback: row.feedback,
      mine: myEchoId !== undefined && row.speakerEchoId === myEchoId,
    }));
}
