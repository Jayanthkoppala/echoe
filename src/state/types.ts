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
  | 'done';

export type RunStatus = 'running' | 'paused' | 'ended';

export interface Player {
  name: string;
  avatar: string;
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
}

/** The host's intent card shown to anyone opening a /i/<shareId> link. */
export interface HostCard {
  name: string;
  avatar: string;
  intent: string;
  expiresInDays: number;
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
}

export interface RunLimits {
  goal: string;
}

/** Each member is one reducer call. App.tsx binds them to module_bindings. */
export interface Actions {
  onJoin(name: string): void;
  onCreateEcho(avatar: string, persona: string, intent: string): void;
  onTravel(placeId: string): void;
  onStartRun(limits: RunLimits): void;
  onPause(): void;
  onEndRun(): void;
  onRateLine(lineId: string, soundsLikeMe: boolean): void;
  onCorrect(lineId: string, shouldHaveSaid: string, behaviourChange: string): void;
}

export interface ScreenProps {
  actions: Actions;
  go: (screen: ScreenName) => void;
}
