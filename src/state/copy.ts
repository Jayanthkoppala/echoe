// Static copy and option lists. No server state lives here.

import type { ActionKind } from './types';

/** Server avatar ids, in the order the module accepts them. */
export const AVATAR_OPTIONS: { id: string; colour: string; glyph: string }[] = [
  { id: 'circle', colour: '#f4b857', glyph: '●' },
  { id: 'square', colour: '#b7a8e8', glyph: '■' },
  { id: 'triangle', colour: '#ef7e66', glyph: '▲' },
  { id: 'diamond', colour: '#a9d6df', glyph: '◆' },
  { id: 'hex', colour: '#d7f06c', glyph: '⬢' },
];

export const AVATAR_COLOUR: Record<string, string> = Object.fromEntries(
  AVATAR_OPTIONS.map(option => [option.id, option.colour]),
);

export const AVATAR_GLYPH: Record<string, string> = Object.fromEntries(
  AVATAR_OPTIONS.map(option => [option.id, option.glyph]),
);

/** Action costs mirror ACTION_COST in the module. */
export const ACTIONS: { kind: ActionKind; label: string; icon: string; cost: number }[] = [
  { kind: 'travel', label: 'Travel', icon: '↗', cost: 0 },
  { kind: 'find', label: 'Find', icon: '⌕', cost: 0 },
  { kind: 'talk', label: 'Talk', icon: '☵', cost: 1 },
  { kind: 'dance', label: 'Dance', icon: '♪', cost: 0 },
  { kind: 'build', label: 'Build', icon: '▦', cost: 0 },
  { kind: 'bluff', label: 'Bluff', icon: '?', cost: 1 },
];

export const ALLOWED_ACTION_OPTIONS = ACTIONS.map(action => ({
  id: action.kind as string,
  label: `${action.icon} ${action.label}`,
}));

export const DEFAULT_ALLOWED = ['travel', 'talk', 'find'];

export const PERSONA_PROMPT =
  'Write a 120-word persona for my AI Echoe in a shared city game. Cover: how I talk, what I get excited about, how I treat strangers, what I would never say, and one quirk people notice. First person, no lists.';

export const INTENT_PLACEHOLDER = 'investing pre-seed in fintech, Bengaluru';

export const RECEIPT_ICON: Record<string, string> = {
  travel: '↗',
  find: '⌕',
  talk: '☵',
  dance: '♪',
  build: '▦',
  bluff: '?',
  run_start: '◆',
  run_end: '✓',
};

/** Turns a correction into a behaviour note when the player leaves it blank. */
export const behaviourFrom = (shouldHaveSaid: string): string => {
  const clean = shouldHaveSaid.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const short = clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  return `Say something closer to "${short}" in moments like this.`;
};

export const shareText = (intent: string, url: string): string =>
  `My Echoe is in Bengaluru carrying this: ${intent}. Send yours to meet it. ${url}`;
