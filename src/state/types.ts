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
  | 'talks'
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
}

/** Each member is one reducer call. App.tsx binds them to module_bindings. */
export interface Actions {
  onJoin(name: string, email: string): void;
  /** Sends the Echoe out again with the same line (and the same host, if any). */
  onRestart(): void;
  onCreateEcho(avatar: string, persona: string, intent: string): void;
  onTravel(placeId: string): void;
  onStartRun(limits: RunLimits): void;
  onPause(): void;
  onEndRun(): void;
  onRateLine(lineId: string, soundsLikeMe: boolean): void;
  onCorrect(lineId: string, shouldHaveSaid: string, behaviourChange: string): void;
  /** Adjust limits: OpenRouter sign-in (PKCE). Leaves the page and comes back. */
  onLinkOpenRouter(): void;
  onUnlinkOpenRouter(): void;
}

export interface ScreenProps {
  actions: Actions;
  go: (screen: ScreenName) => void;
}
