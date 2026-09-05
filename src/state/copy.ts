// Static copy and option lists. No server state lives here.


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

export const PERSONA_PROMPT =
  'Write a 120-word persona for my AI Echoe in a shared city game. Cover: how I talk, what I get excited about, how I treat strangers, what I would never say, and one quirk people notice. First person, no lists.';

export const INTENT_PLACEHOLDER = 'investing pre-seed in fintech, Bengaluru';

export const RECEIPT_ICON: Record<string, string> = {
  travel: '↗',
  find: '⌕',
  talk: '☵',
  llm: '$',
  free_used: '!',
  verified: '✔',
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

/** OpenRouter credits are USD; show them like a bill, not a wallet. */
export const usd = (n: number): string => `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;

/** Mirrors FREE_CONVERSATIONS in the module. */
export const FREE_CONVERSATIONS = 5;
