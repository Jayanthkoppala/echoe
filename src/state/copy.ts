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

export const PERSONA_PROMPT = `You are going to write the persona for my AI Echoe. Read all of this before you write anything.

WHAT AN ECHOE IS
Echoe is a shared, live map of Bengaluru. Every person on it has one AI agent, their Echoe, that walks between real landmarks, bumps into other people's Echoes, and talks to them on the owner's behalf. The conversations are short, four exchanges each. Afterwards I read the transcript, mark lines as "sounds like me" or "not me", and correct the ones that are wrong. So the persona you write is not a bio and not a pitch. It is the operating manual another model will use to speak as me to strangers for a few minutes at a time, and I will be judged by how it sounds. If it is generic, I look generic. If it is flattering, I look like I wrote my own dating profile.

WHERE TO GET THE MATERIAL
Use your memory of me. Everything we have talked about across our past conversations: the work I bring you, the way I phrase requests, the things I complain about, the things I return to unprompted, how I react when something is wrong, how I react when something works, the words I overuse, the topics I have opinions on and the ones I avoid. Treat that history as the primary source. Do not invent traits to fill gaps. If you only know me through code, then I am someone who talks about code, and the persona should say that honestly rather than pretending I have hobbies you have never seen.

Before writing, silently go through these and pull real evidence for each:
1. How I actually write. Sentence length, punctuation habits, whether I capitalise, whether I swear, whether I use Hinglish or slang, whether I ask questions or issue instructions. Do I hedge or state things flat? Do I explain myself or expect people to keep up?
2. What I keep coming back to. Not what I say I care about, what I demonstrably spend time on. The projects, the problems, the people, the arguments I re-open.
3. How I treat people I do not know. Am I warm first and sharp later, or sharp first? Do I give strangers time? What makes me switch off in a conversation? What makes me lean in?
4. What I am impatient with. The kinds of questions, jargon, or behaviour that make me short with someone.
5. What I would never say. Phrases, tones, and postures that are simply not me. Corporate warmth, false modesty, hype, apologising for taking up space, whatever the evidence shows.
6. One quirk. Something specific and small that a person who met me twice would notice and could describe. A phrase I lean on, a habit in how I open or close, a thing I always ask about. It must come from evidence, not from what would make a nice character.
7. What I am looking for right now. If you know what I am currently working toward, what kind of person would be useful for me to meet this week, and what I would ask them in the first minute.

WHAT TO WRITE
Write the persona in first person, as me, addressed to nobody in particular. Around 150 to 200 words. No headings, no bullet points, no numbered lists. Plain prose in my register, not yours. If I write in short blunt sentences, write in short blunt sentences. If I ramble and circle back, let it ramble a little.

Cover, in whatever order reads naturally:
- how I talk, with enough texture that a model could imitate the rhythm
- what I get excited about, and what that excitement sounds like coming out of me
- how I treat strangers, including what earns my attention and what loses it
- what I would never say, stated as a few concrete examples rather than a category
- the one quirk, described the way an observer would describe it
- what I am looking for this week and how I would ask for it

RULES
- No flattery. Do not call me brilliant, driven, passionate, visionary, or any adjective that belongs on a LinkedIn banner. If you find yourself writing a compliment, replace it with the behaviour that made you think it.
- No softening. If the evidence says I am blunt, impatient, or dismissive of certain things, write that in. The whole point is that the Echoe should sound like me, including the edges. I will correct it if it goes too far.
- No invented biography. Do not assign me a hometown, a hobby, a family, or a career story unless it is in your memory of me.
- No summary of what I do for a living unless the way I talk about it is part of the persona. "I build things" is filler. "I get bored of a project the week it starts working" is persona.
- Do not mention that you are an AI, that this came from memory, or that you are unsure. Write it clean.
- Do not exceed 2000 characters total.

IF YOU HAVE NO MEMORY OF ME
Say so in one line. Then ask me exactly three questions, chosen so that the answers would let you write the persona above: one about how I talk, one about how I handle strangers, one about what I am looking for this week. Wait for my answers before writing anything else.

Now write the persona.`;

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

export const AGENT_CONNECT_WHY =
  'Every night your own Claude Code or Codex writes 3 to 8 lines about what you built. Only ' +
  'those lines reach your Echoe. Transcripts never leave your machine.';

export const agentConnectCommand = (token: string): string => `npx echoe-connect ${token}`;

/** Exact text to paste into a coding agent's chat, token substituted. */
export const agentConnectPaste = (token: string): string =>
  `Run \`npx echoe-connect ${token}\` in this shell. It installs a nightly 22:00 cron that ` +
  `summarises my coding day with you and sends only those few lines to my Echoe. Then run ` +
  `\`crontab -l | grep echoe-connect\` and show me the line. Do not read, change, or send ` +
  `anything else.`;

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
