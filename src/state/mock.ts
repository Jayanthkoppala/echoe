// Demo data so `npm run dev` walks the whole flow with local state only.
// Delete once the reducers and subscriptions are live.

import type {
  ActionKind,
  Place,
  Player,
  Receipt,
  Run,
  TranscriptLine,
} from './types';

export const AVATARS = ['#f4b857', '#b7a8e8', '#ef7e66', '#a9d6df'];

export const PERSONA_PROMPT =
  'Write a 120-word persona for my AI Echo in a shared city game. Cover: how I talk, what I get excited about, how I treat strangers, what I would never say, and one quirk people notice. First person, no lists.';

export const PLACES: Place[] = [
  { id: 'palace', name: 'Palace', icon: '♜', color: '#e6b584', x: 12, y: 24 },
  { id: 'vidhana', name: 'Vidhana Soudha', icon: '⌂', color: '#f4dfb4', x: 40, y: 19 },
  { id: 'ulsoor', name: 'Ulsoor Lake', icon: '≈', color: '#a9d6df', x: 80, y: 28 },
  { id: 'church', name: 'Church Street', icon: '✦', color: '#ef7e66', x: 22, y: 44 },
  { id: 'cubbon', name: 'Cubbon Park', icon: '♣', color: '#d7f06c', x: 61, y: 44 },
  { id: 'indiranagar', name: 'Indiranagar', icon: '♫', color: '#b7a8e8', x: 84, y: 55 },
  { id: 'lalbagh', name: 'Lalbagh', icon: '♧', color: '#d7f06c', x: 11, y: 66 },
  { id: 'mgroad', name: 'MG Road', icon: '◆', color: '#f4b857', x: 44, y: 63 },
  { id: 'koramangala', name: 'Koramangala', icon: '▦', color: '#ef7e66', x: 71, y: 75 },
  { id: 'commercial', name: 'Commercial St.', icon: '★', color: '#a9d6df', x: 21, y: 84 },
];

export const OTHER_AGENTS = [
  { id: 'oa1', color: '#b7a8e8', x: 62, y: 31 },
  { id: 'oa2', color: '#ef7e66', x: 16, y: 48 },
  { id: 'oa3', color: '#a9d6df', x: 73, y: 62 },
];

export const ACTIONS: { kind: ActionKind; icon: string; cost: number; toast: string }[] = [
  { kind: 'Travel', icon: '↗', cost: 0, toast: 'Tap any place on the map to travel' },
  { kind: 'Find', icon: '⌕', cost: 0, toast: 'Three Echoes are nearby · 0 AI credits' },
  { kind: 'Talk', icon: '☵', cost: 1, toast: 'Started a two-reply conversation · 1 AI credit' },
  { kind: 'Dance', icon: '♪', cost: 0, toast: 'Joined the park jam · world state changed' },
  { kind: 'Build', icon: '▦', cost: 0, toast: 'Placed one signal-beacon piece · 0 AI credits' },
  { kind: 'Bluff', icon: '?', cost: 1, toast: 'Offered a fictional clue · 1 AI credit' },
];

export const ALLOWED_ACTION_OPTIONS = [
  { id: 'Travel', label: '↗ Travel' },
  { id: 'Talk', label: '☵ Talk' },
  { id: 'Dance', label: '♪ Dance' },
  { id: 'Build', label: '▦ Build' },
  { id: 'Bluff', label: '? Bluff' },
  { id: 'Leave', label: '← Leave' },
];

export const MISSION = 'Find the hidden rooftop before dawn';
export const RUN_GOAL = 'Find the hidden rooftop and bring back one genuine connection.';

export const mockPlayer: Player = {
  name: '',
  avatar: AVATARS[0],
  credits: 8,
  currentPlace: 'cubbon',
};

export const mockRun: Run = {
  goal: RUN_GOAL,
  maxPeople: 3,
  repliesPerPerson: 2,
  creditCap: 8,
  allowedActions: ALLOWED_ACTION_OPTIONS.map(a => a.id),
  status: 'idle',
  placesVisited: 1,
  peopleMet: 0,
  built: 0,
};

export interface RoamStep {
  pct: number;
  time: string;
  headline: string;
  detail: string;
  places: number;
  people: number;
  built: number;
  spent: number;
  x: number;
  y: number;
}

export const ROAM_STEPS: RoamStep[] = [
  { pct: 12, time: '02:18', headline: 'Walking to Church Street', detail: 'No AI credit used · scheduled world action', places: 1, people: 0, built: 0, spent: 0, x: 22, y: 44 },
  { pct: 30, time: '06:34', headline: "Talking with Maya's Echo", detail: 'Bounded to two replies · 2 AI credits used', places: 2, people: 1, built: 0, spent: 2, x: 41, y: 38 },
  { pct: 52, time: '12:21', headline: 'Dancing at Indiranagar', detail: 'Public activity · no AI credit used', places: 4, people: 2, built: 0, spent: 2, x: 76, y: 54 },
  { pct: 74, time: '18:09', headline: 'Building a signal beacon', detail: 'Co-building changed the shared world', places: 5, people: 3, built: 1, spent: 2, x: 68, y: 67 },
  { pct: 96, time: '23:41', headline: 'The rooftop was found', detail: 'Preparing your inspectable return summary', places: 6, people: 3, built: 1, spent: 7, x: 46, y: 28 },
];

export const mockReceipts: Receipt[] = [
  { kind: 'Travel', text: 'Found a clue painted under the metro stairs.', creditCost: 0, placeName: 'Church Street', at: '21:12' },
  { kind: 'Talk', text: 'Two replies · one clue exchanged.', creditCost: 2, placeName: "Maya's Echo", at: '21:42' },
  { kind: 'Build', text: 'Co-built at Indiranagar · still in the world.', creditCost: 0, placeName: 'Indiranagar', at: '23:05' },
];

export const RECEIPT_ICON: Record<ActionKind, string> = {
  Travel: '↗',
  Find: '⌕',
  Talk: '☵',
  Dance: '♪',
  Build: '▦',
  Bluff: '?',
};

export const RECEIPT_TITLE: Record<string, string> = {
  Travel: 'Travelled to Church Street',
  Talk: "Talked with Maya's Echo",
  Build: 'Built a signal beacon',
};

export const mockTranscript: TranscriptLine[] = [
  { id: 'l1', speaker: "Maya's Echo", text: 'I found half a clue near MG Road. What are you looking for?', isAi: true, feedback: 'none' },
  { id: 'l2', speaker: 'Your Echo', text: 'Somewhere loud enough to dance, quiet enough to actually talk.', isAi: false, feedback: 'none' },
  { id: 'l3', speaker: "Maya's Echo", text: 'That sounds like the hidden rooftop. Trade clues?', isAi: true, feedback: 'none' },
  { id: 'l4', speaker: 'Your Echo', text: 'Absolutely. I trust people quickly, probably too quickly.', isAi: false, feedback: 'none' },
];

export const SUGGESTED_CORRECTION =
  "I'm open to trading clues, but I'd like to verify yours first.";

export const PROPOSED_BEHAVIOUR = 'Be warm, but verify claims before showing trust.';

export const placeById = (id: string) => PLACES.find(p => p.id === id) ?? PLACES[0];
