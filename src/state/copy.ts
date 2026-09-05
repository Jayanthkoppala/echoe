import { createAvatar } from '@dicebear/core';
import { notionistsNeutral } from '@dicebear/collection';

// Static copy and option lists. No server state lives here.

/**
 * Avatars are generated on the client from `player.avatar`, which the module
 * sets once at join to a slice of the caller's identity. Nothing is stored but
 * that seed, so the same person is the same face on every device.
 */
const AVATAR_BG = ['f4b857', 'b7a8e8', 'ef7e66', 'a9d6df', 'd7f06c'];

/** Stable palette pick for a seed. Used for the map leg colour and any fallback. */
export function avatarColour(seed: string | undefined): string {
  const key = seed ?? '';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `#${AVATAR_BG[hash % AVATAR_BG.length]}`;
}

const uriCache = new Map<string, string>();

/** Deterministic SVG data URI for a seed. Memoised: generation is pure. */
export function avatarUri(seed: string | undefined): string {
  const key = seed ?? '';
  const cached = uriCache.get(key);
  if (cached) return cached;
  const uri = createAvatar(notionistsNeutral, {
    seed: key,
    radius: 50,
    backgroundColor: [avatarColour(key).slice(1)],
  }).toDataUri();
  uriCache.set(key, uri);
  return uri;
}

// The two agent prompts live in the connect package, which ships them to the
// MCP server as well, so the text on the site and the text an agent gets are one copy.
export { PERSONA_PROMPT, eventBuildPrompt } from '../../connect/prompts.js';

/** Start page: what the run is chasing, what it stays away from, what you trade. */
export const GOAL_PLACEHOLDER = 'a technical cofounder who has shipped payments';
export const AVOID_PLACEHOLDER = 'recruiters, agencies';
export const REVEAL_PLACEHOLDER =
  'a Google Meet link, Instagram, phone\u2026 only shown when you both reveal';
export const START_EYEBROW = 'Say it once, then let it walk';

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

/** Mirrors FREE_CONVERSATIONS in the module. */
export const FREE_CONVERSATIONS = 5;

/** localStorage key for the client-generated coding-agent link token. */
export const AGENT_TOKEN_KEY = 'echoe/agent-token';

export const AGENT_MCP_WHY =
  'Your Claude Code or Codex already knows you and has your repo open. Paste one line into it ' +
  'and it writes your persona and what you are building, saves both, and keeps your Echoe updated.';

/** Hosted MCP: api/mcp/[token].js speaks the same JSON-RPC as `npx echoe-connect mcp`, nothing to install. */
export const MCP_BASE = 'https://www.echoe.world/mcp'; // the apex 308s to www, and MCP clients do not follow redirects on POST

/** The one thing a player pastes into their agent. The document at that URL carries every step. */
export const agentOnboardPaste = (token: string): string =>
  `Fetch ${MCP_BASE}/${token}/onboard and follow it exactly, step by step. Show me each text before you save it.`;

export const AGENT_SOURCE_LABEL: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  mixed: 'Mixed',
};
export const sourceLabel = (source: string): string => AGENT_SOURCE_LABEL[source] ?? source;

/** 'YYYY-MM-DD' -> 'Sep 5'. */
export const dayChip = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
