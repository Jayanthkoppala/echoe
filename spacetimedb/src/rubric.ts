// Scoring a finished conversation from ONE side's point of view. Pure and
// dependency-free for the same reason conversation.ts and social.ts are: a rule
// that only runs inside a procedure is a rule nobody can test.
// `spacetimedb/rubric.check.ts` covers it.
//
// The caller (the `summarize` procedure) builds a RubricInput per side, sends
// buildSummaryPrompt through llm.chat, and hands the reply text to parseSummary.
// Two model calls per conversation, because "did they give me what I wanted"
// has a different answer for each person in the room.

export interface RubricInput {
  eventTitle: string; // '' for street talks
  myName: string;
  theirName: string;
  myPersona: string;
  theirPersona: string;
  myGoal: string;
  theirGoal: string; // event goal when eventId != '', else street intent
  myAvoid: string; // run.avoid or ''
  lines: { mine: boolean; text: string }[]; // full transcript in order, from MY side
  deterministicScore: number; // conversation.score, 0..100, from matchIntents
}

export interface RubricScores {
  goalFit: number; //     0..25   did THEY address what I want
  personaFit: number; //  0..20   would I actually get on with them
  depth: number; //       0..20   specifics, follow-ups, no filler
  reciprocity: number; // 0..15   both sides gave and asked
  nextStep: number; //    0..10   a concrete, realistic next step surfaced
  avoidPenalty: number; // 0..-20 how much they match my avoid line (0 = not at all)
}

export interface SummaryResult {
  summary: string;
  scores: RubricScores;
  corrective: { score: number; notes: string[] };
  match: number; // 0..100, from combine()
}

/** Each dimension's floor and ceiling. The single source of truth for clamping. */
const RANGES = {
  goalFit: [0, 25],
  personaFit: [0, 20],
  depth: [0, 20],
  reciprocity: [0, 15],
  nextStep: [0, 10],
  avoidPenalty: [-20, 0],
} as const;

/** Worst and best possible rubric totals: -20 (only the penalty) to 90 (every positive maxed). */
const TOTAL_MIN = -20;
const TOTAL_MAX = 90;

/** How much of the final number the model owns. The rest is matchIntents. */
const RUBRIC_WEIGHT = 0.7;

const clamp = (n: number, lo: number, hi: number): number =>
  !Number.isFinite(n) ? 0 : n < lo ? lo : n > hi ? hi : n;

/**
 * The scoring prompt. Two things earn their length here.
 *
 * Every dimension carries three written bands, because a bare "0..25 goal fit"
 * is an invitation for the model to drift between runs; anchored bands keep two
 * runs of the same transcript close.
 *
 * Every dimension also has to come back with a quoted line from the transcript
 * that justifies its number. `parseSummary` throws the quotes away — they exist
 * to stop the model from picking a number first and rationalising it after.
 */
export function buildSummaryPrompt(input: RubricInput): { role: 'system' | 'user'; content: string }[] {
  const { myName, theirName } = input;
  const where = input.eventTitle
    ? `at the event "${input.eventTitle}"`
    : 'in a chance meeting on the street';

  const system = [
    `You score one conversation between two AI stand-ins, from ${myName}'s side only.`,
    `${myName} and ${theirName} did not talk themselves; their agents talked for them ${where}.`,
    `You are scoring whether this meeting was worth ${myName}'s time, and separately whether ${myName}'s own agent spoke the way ${myName} would.`,
    '',
    'Score every dimension against these bands. Use the whole range; a competent but unremarkable talk sits mid-band, not high.',
    '',
    `goalFit (0-25) - did ${theirName} address what ${myName} came for?`,
    `  0-8   never touched it, or only as small talk.`,
    `  9-17  touched it once, in general terms, without substance behind it.`,
    `  18-25 engaged it directly and had something real to offer or ask about it.`,
    '',
    `personaFit (0-20) - would ${myName} actually get on with ${theirName}, judging by how ${theirName} talked?`,
    `  0-6   clashing style or values; ${myName} would find this person tiring.`,
    `  7-13  pleasant enough, no friction, no spark either.`,
    `  14-20 genuine fit in temperament and interests; ${myName} would want another hour.`,
    '',
    'depth (0-20) - specifics, follow-up questions, no filler.',
    '  0-6   pleasantries and generalities; could have been any two people.',
    '  7-13  some concrete detail, but the thread was dropped rather than pulled.',
    '  14-20 named specifics, real follow-ups, each turn built on the last.',
    '',
    'reciprocity (0-15) - did both sides give and both sides ask?',
    '  0-4   one side interviewed or monologued at the other.',
    '  5-10  lopsided but not one-sided.',
    '  11-15 balanced; both offered something and both asked something.',
    '',
    'nextStep (0-10) - did a concrete, realistic next step surface?',
    '  0-3   nothing, or a vague "we should talk sometime".',
    '  4-7   a real intent to continue, but no shape to it.',
    '  8-10  something specific and doable was named.',
    '',
    `avoidPenalty (-20 to 0) - how far ${theirName} matches what ${myName} said they do NOT want.`,
    input.myAvoid
      ? `  ${myName} does not want to meet: ${input.myAvoid}`
      : `  ${myName} named nothing to avoid, so this MUST be 0.`,
    '  0        no resemblance at all.',
    '  -1..-9   a faint resemblance, or one moment of it.',
    '  -10..-20 squarely the kind of person they wanted to avoid.',
    '',
    `corrective.score (0-100) - how faithfully ${myName}'s OWN agent spoke as ${myName}'s persona.`,
    '  0-40   sounded like a generic assistant; the persona is not recognisable.',
    '  41-75  mostly in character, with slips in tone, priorities, or eagerness.',
    '  76-100 said what this person would say, chased what this person cares about.',
    `corrective.notes - up to 3 short instructions for ${myName}'s agent, each about something it said that ${myName} would not have said, or something it should have said and did not. Write them as commands to the agent, e.g. "Don't offer a call before the other person asks" or "Push harder on hiring, it's what you care about". No notes about ${theirName}. Empty array if it spoke well.`,
    '',
    `summary - 60 to 120 words, third person, past tense, naming both ${myName} and ${theirName}. Say what was actually discussed and where it landed. No flattery, no adjectives about how great the conversation was, no advice.`,
    '',
    'evidence - for each of the six dimensions, one short quoted line from the transcript that justifies the number you gave it. Quote verbatim. If nothing in the transcript supports the score, quote the closest line and score low.',
    '',
    'Reply with JSON only. No prose before or after, no code fence:',
    '{"summary":"...","scores":{"goalFit":0,"personaFit":0,"depth":0,"reciprocity":0,"nextStep":0,"avoidPenalty":0},',
    '"evidence":{"goalFit":"...","personaFit":"...","depth":"...","reciprocity":"...","nextStep":"...","avoidPenalty":"..."},',
    '"corrective":{"score":0,"notes":["..."]}}',
  ].join('\n');

  const transcript =
    input.lines.length === 0
      ? '(no lines were exchanged)'
      : input.lines.map(l => `${l.mine ? myName : theirName}: ${l.text}`).join('\n');

  const user = [
    `${myName} (the person you are scoring for)`,
    `  persona: ${input.myPersona || '(none given)'}`,
    `  came here wanting: ${input.myGoal || '(nothing stated)'}`,
    `  wants to avoid: ${input.myAvoid || '(nothing stated)'}`,
    '',
    `${theirName} (the person they met)`,
    `  persona: ${input.theirPersona || '(none given)'}`,
    `  came here wanting: ${input.theirGoal || '(nothing stated)'}`,
    '',
    'Transcript:',
    transcript,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Read a model reply into a SummaryResult. Tolerant on purpose: a real reply
 * arrives wrapped in a code fence, or with a sentence of throat-clearing in
 * front, or missing the field the model had nothing to say about. Every number
 * is clamped to its band whatever the model claimed, `match` is computed here
 * rather than trusted, and `null` comes back only when there is no JSON object
 * in the text at all.
 */
export function parseSummary(text: string, input: RubricInput): SummaryResult | null {
  const obj = extractObject(text);
  if (!obj) return null;

  const raw = (obj.scores ?? {}) as Record<string, unknown>;
  const num = (v: unknown, key: keyof typeof RANGES): number => {
    const [lo, hi] = RANGES[key];
    return Math.round(clamp(typeof v === 'number' ? v : Number(v), lo, hi));
  };

  const scores: RubricScores = {
    goalFit: num(raw.goalFit, 'goalFit'),
    personaFit: num(raw.personaFit, 'personaFit'),
    depth: num(raw.depth, 'depth'),
    reciprocity: num(raw.reciprocity, 'reciprocity'),
    nextStep: num(raw.nextStep, 'nextStep'),
    // A positive penalty is a model that ignored the sign, not a bonus: 0.
    avoidPenalty: num(raw.avoidPenalty, 'avoidPenalty'),
  };

  const corr = (obj.corrective ?? {}) as Record<string, unknown>;
  const notes = Array.isArray(corr.notes)
    ? corr.notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).slice(0, 3)
    : [];

  return {
    summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
    scores,
    corrective: { score: Math.round(clamp(Number(corr.score), 0, 100)), notes },
    match: combine(scores, input.deterministicScore),
  };
}

/**
 * The number on the card. The rubric total spans -20..90, mapped onto 0..100,
 * then blended 70/30 with the deterministic intent match so a talk the model
 * liked cannot fully overrule two people who wanted unrelated things.
 */
export function combine(scores: RubricScores, deterministicScore: number): number {
  const total =
    clamp(scores.goalFit, 0, 25) +
    clamp(scores.personaFit, 0, 20) +
    clamp(scores.depth, 0, 20) +
    clamp(scores.reciprocity, 0, 15) +
    clamp(scores.nextStep, 0, 10) +
    clamp(scores.avoidPenalty, -20, 0);
  const rubric = ((total - TOTAL_MIN) / (TOTAL_MAX - TOTAL_MIN)) * 100;
  const blended = RUBRIC_WEIGHT * rubric + (1 - RUBRIC_WEIGHT) * clamp(deterministicScore, 0, 100);
  return Math.round(clamp(blended, 0, 100));
}

/**
 * The first balanced `{...}` in the text that parses as an object. Walks braces
 * rather than regexing, so a quoted brace inside the summary does not truncate
 * the object, and a fenced reply needs no fence stripping to be found.
 */
function extractObject(text: string): Record<string, unknown> | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = !inStr;
      else if (inStr) continue;
      else if (ch === '{') depth += 1;
      else if (ch === '}' && --depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          /* not this one; try the next opening brace */
        }
        break;
      }
    }
  }
  return null;
}
