// Plain TypeScript mirrors of what the SpacetimeDB module will expose.
// Nothing here imports module_bindings yet, so the UI compiles before the
// server schema is generated. Swap these for the generated row types later.

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

export type ActionKind = 'Travel' | 'Find' | 'Talk' | 'Dance' | 'Build' | 'Bluff';

export type RunStatus = 'idle' | 'running' | 'paused' | 'done';

export interface Player {
  name: string;
  avatar: string;
  credits: number;
  currentPlace: string;
}

export interface Run {
  goal: string;
  maxPeople: number;
  repliesPerPerson: number;
  creditCap: number;
  allowedActions: string[];
  status: RunStatus;
  placesVisited: number;
  peopleMet: number;
  built: number;
}

export interface Receipt {
  kind: ActionKind;
  text: string;
  creditCost: number;
  placeName: string;
  at: string;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  isAi: boolean;
  feedback: 'none' | 'sounds-like-me' | 'not-me';
}

export interface Place {
  id: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
}

/** The subset of a Run the player chooses on the limits screen. */
export interface RunLimits {
  goal: string;
  maxPeople: number;
  repliesPerPerson: number;
  creditCap: number;
  allowedActions: string[];
}

/**
 * Every screen receives this object. Each member is the wiring point for one
 * SpacetimeDB reducer call. App.tsx currently fulfils them with local state.
 */
export interface Actions {
  onJoin(name: string): void;
  onCreateEcho(avatar: string, persona: string): void;
  onTravel(placeId: string): void;
  onAct(kind: ActionKind): void;
  onStartRun(limits: RunLimits): void;
  onPause(): void;
  onRateLine(id: string, soundsLikeMe: boolean): void;
  onCorrect(id: string, shouldHaveSaid: string): void;
}

export interface ScreenProps {
  actions: Actions;
  go: (screen: ScreenName) => void;
}
