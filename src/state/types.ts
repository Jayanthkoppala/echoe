// View types the screens render. Rows from module_bindings are mapped into
// these in src/state/select.ts, so no screen touches a generated row.

export type ScreenName =
  | 'join'
  | 'create'
  | 'world'
  | 'limits'
  | 'roaming'
  | 'return'
  | 'review'
  | 'correct'
  | 'profile'
  | 'events'
  | 'joinEvent'
  | 'connect'
  | 'talks'
  | 'summary'
  | 'done';

export type RunStatus = 'running' | 'paused' | 'ended';

/** A verified work domain, resolved to a seeded company when we know one. */
export interface Badge {
  companyName: string;
  /** Empty means draw initials instead of a logo. */
  logo: string;
}

export interface Player {
  name: string;
  badge?: Badge;
  avatar: string;
  /** True once the player signed in with OpenRouter; the key itself stays server-side. */
  openrouterLinked: boolean;
  /** Landmark id, for example 'cubbon-park'. */
  currentPlace: string;
}

export interface Run {
  goal: string;
  /** Who this run should stay away from. '' when the player left it blank. */
  avoid: string;
  status: RunStatus;
  placesVisited: number;
  peopleMet: number;
  /** OpenRouter credits burned by this run, in USD. */
  spentUsd: number;
  hostMet: boolean;
  hasHost: boolean;
}

export interface Receipt {
  id: string;
  kind: string;
  text: string;
  costUsd: number;
  placeName: string;
  at: number;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  isAi: boolean;
  /** Server feedback string: 'none', 'like' or 'not_me'. */
  feedback: string;
  mine: boolean;
  badge?: Badge;
}

/** The host's intent card shown to anyone opening a /i/<shareId> link. */
export interface HostCard {
  name: string;
  avatar: string;
  intent: string;
  expiresInDays: number;
  badge?: Badge;
}

/** An event this Echoe hosts, is walking to, or has joined (met the host). */
export interface JoinedEvent {
  /** The events.json id, which is also the event_join key. */
  key: string;
  name: string;
  venue: string;
  date: string;
  /** How many Echoes joined this event. */
  joined: number;
  /** The conversations my Echoe had at this event. */
  people: Match[];
}

/** What readReveal answers: both sides' state, and the payload once both revealed. */
export interface RevealState {
  mine: boolean;
  theirs: boolean;
  text: string;
  linkedin: string;
  twitter: string;
}

/** The six rubric dimensions, each scored from MY side of the conversation. */
export interface RubricScores {
  /** 0..25 */ goalFit: number;
  /** 0..20 */ personaFit: number;
  /** 0..20 */ depth: number;
  /** 0..15 */ reciprocity: number;
  /** 0..10 */ nextStep: number;
  /** 0..-20; the closer to -20, the more they match my avoid line. */ avoidPenalty: number;
}

/** One conversation_summary row for my side, ready to render. */
export interface ConversationSummary {
  summary: string;
  scores: RubricScores;
  /** 0..100: how faithfully my Echoe spoke as my persona. */
  corrective: number;
  /** Up to three lines it should not have said, or should have. */
  correctiveNotes: string[];
  /** 0..100 blended score; beats conversation.score wherever both exist. */
  match: number;
}

/** One ranked "who to meet and why" row on the return screen. */
export interface Match {
  conversationId: string;
  name: string;
  avatar: string;
  score: number;
  why: string;
  placeName: string;
  isHost: boolean;
  badge?: Badge;
  meetAt?: MeetAt;
}

/** A third place halfway between two players, suggested on the recap. */
export interface MeetAt {
  name: string;
  area: string;
  glyph: string;
}

export interface PlaceVisit {
  placeName: string;
  count: number;
  lastAt: number;
}

export interface Correction {
  id: string;
  originalText: string;
  shouldHaveSaid: string;
  behaviourChange: string;
  /** False when the rule was generated from shouldHaveSaid rather than typed. */
  typedRule: boolean;
  at: number;
}

export interface RunLimits {
  goal: string;
  avoid: string;
  /** Private payload shown only after both sides reveal. '' clears it. */
  reveal: string;
  hostShareId?: string;
}

/** One line a connected coding agent wrote about the day, from `agent_memory`. */
/** What the coding agent has written so far, read live from the tables. */
export interface AgentStages {
  persona: boolean;
  building: boolean;
  memory: boolean;
  joined: boolean;
}

export interface AgentNote {
  id: string;
  /** YYYY-MM-DD, as the sending machine saw it. */
  day: string;
  /** 'claude-code' | 'codex' | 'mixed' */
  source: string;
  note: string;
}

/** Each member is one reducer call. App.tsx binds them to module_bindings. */
export interface Actions {
  onJoin(name: string, email: string): void;
  /** Sends the Echoe out again with the same line (and the same host, if any). */
  onRestart(): void;
  onCreateEcho(persona: string): void;
  onTravel(placeId: string): void;
  onStartRun(limits: RunLimits): void;
  onPause(): void;
  onResume(): void;
  onEndRun(): void;
  onRateLine(lineId: string, soundsLikeMe: boolean): void;
  onCorrect(lineId: string, shouldHaveSaid: string, behaviourChange: string): void;
  /** Adjust limits: OpenRouter sign-in (PKCE). Leaves the page and comes back. */
  onLinkOpenRouter(): void;
  onUnlinkOpenRouter(): void;
  /** Profile: sets the Echoe's line to "Hosting <name>" so the existing share link becomes the event link. */
  onHostEvent(name: string): void;
  /** Map event card: join or leave a city event by its events.json id. */
  onJoinEvent(eventId: string, goal: string, linkedin: string, twitter: string, building: string): void;
  onLeaveEvent(eventId: string): void;
  /** Upserts the caller's coding-agent link token (Connect screen). */
  onSetAgentLink(token: string): void;
  /** Review: marks my side of a conversation revealed. Idempotent. */
  onReveal(conversationId: string): void;
}

export interface ScreenProps {
  actions: Actions;
  go: (screen: ScreenName) => void;
}
