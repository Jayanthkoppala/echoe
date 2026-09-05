// Self-check for rubric.ts: the parser has to survive whatever a model actually
// replies, and the arithmetic has to land on the same number twice. No
// framework: run it with
//   node --experimental-strip-types spacetimedb/rubric.check.ts
// (node is shell-blocked here; use the absolute Node 22 binary,
//  /Users/jay/.nvm/versions/node/v22.23.2/bin/node)
import assert from 'node:assert/strict';
import { buildSummaryPrompt, combine, parseSummary } from './src/rubric.ts';
import type { RubricInput, RubricScores } from './src/rubric.ts';

const INPUT: RubricInput = {
  eventTitle: 'Midnight Moonshot',
  myName: 'Jay',
  theirName: 'Rudra',
  myPersona: 'Solo founder, ships fast, allergic to meetings.',
  theirPersona: 'GTM lead, sells to recruiters.',
  myGoal: 'someone who has sold hiring software in India',
  theirGoal: 'a technical co-founder',
  myAvoid: 'agency owners looking for outsourcing work',
  lines: [
    { mine: true, text: 'What are you building?' },
    { mine: false, text: 'Outbound for recruiters. Sold ₹40L of it last year.' },
  ],
  deterministicScore: 60,
};

// ─── the prompt ──────────────────────────────────────────────────────────────
const prompt = buildSummaryPrompt(INPUT);
assert.equal(prompt.length, 2);
assert.equal(prompt[0].role, 'system');
assert.equal(prompt[1].role, 'user');
// Three bands per dimension, or two runs of the same transcript drift apart.
for (const band of ['0-8', '9-17', '18-25', '0-6', '7-13', '14-20', '-10..-20']) {
  assert.ok(prompt[0].content.includes(band), `system prompt must anchor band ${band}`);
}
assert.ok(prompt[0].content.includes('evidence'), 'the model must be asked to quote its evidence');
assert.ok(prompt[0].content.includes('JSON only'), 'the reply format must be JSON only');
assert.ok(prompt[1].content.includes('Rudra: Outbound for recruiters'), 'transcript must carry their lines');
assert.ok(prompt[1].content.includes('Jay: What are you building?'), 'transcript must carry my lines');
assert.ok(prompt[0].content.includes('agency owners'), 'the avoid line must reach the prompt');
// No avoid line means the penalty is not up for debate.
assert.ok(
  buildSummaryPrompt({ ...INPUT, myAvoid: '' })[0].content.includes('MUST be 0'),
  'an empty avoid line must pin avoidPenalty to 0'
);
// The one thing that must never be in here.
assert.ok(!JSON.stringify(prompt).includes('reveal'), 'the rubric prompt must not mention reveals');

// ─── a real-shaped reply: prose, a code fence, a trailing note ───────────────
const FENCED = `Sure, here is the scoring for that conversation.

\`\`\`json
{
  "summary": "Jay and Rudra compared notes on selling hiring software in India. Rudra described an outbound product for recruiters and the revenue behind it; Jay pressed on which channel actually closed. They landed on Rudra sending over the pipeline numbers.",
  "scores": { "goalFit": 21, "personaFit": 15, "depth": 14, "reciprocity": 11, "nextStep": 7, "avoidPenalty": -2 },
  "evidence": { "goalFit": "Sold \\u20b940L of it last year." },
  "corrective": { "score": 72, "notes": ["Don't offer a call before the other person asks", "Push harder on distribution, it's what you care about"] }
}
\`\`\`

Let me know if you want it re-scored.`;

const fenced = parseSummary(FENCED, INPUT);
assert.ok(fenced, 'a fenced reply with prose either side must parse');
assert.deepEqual(fenced.scores, {
  goalFit: 21, personaFit: 15, depth: 14, reciprocity: 11, nextStep: 7, avoidPenalty: -2,
} satisfies RubricScores);
assert.ok(fenced.summary.startsWith('Jay and Rudra'));
assert.equal(fenced.corrective.score, 72);
assert.equal(fenced.corrective.notes.length, 2);
// match is computed, never taken from the model: 68 + 60 blended.
assert.equal(fenced.match, combine(fenced.scores, 60));

// ─── clamping ────────────────────────────────────────────────────────────────
const wild = parseSummary(
  '{"scores":{"goalFit":40,"personaFit":-3,"depth":19.6,"reciprocity":15,"nextStep":10,"avoidPenalty":5},"corrective":{"score":400,"notes":["a","b","c","d",7]}}',
  INPUT
);
assert.ok(wild);
assert.equal(wild.scores.goalFit, 25, 'goalFit 40 clamps to 25');
assert.equal(wild.scores.personaFit, 0, 'a negative positive clamps to 0');
assert.equal(wild.scores.depth, 20, '19.6 rounds to 20');
assert.equal(wild.scores.avoidPenalty, 0, 'a positive penalty is not a bonus');
assert.equal(wild.corrective.score, 100, 'corrective 400 clamps to 100');
assert.deepEqual(wild.corrective.notes, ['a', 'b', 'c'], 'at most three notes, strings only');
assert.equal(
  parseSummary('{"scores":{"avoidPenalty":-50}}', INPUT)!.scores.avoidPenalty,
  -20,
  'avoidPenalty -50 clamps to -20'
);

// ─── missing and junk fields default rather than throw ───────────────────────
const bare = parseSummary('{}', INPUT);
assert.ok(bare, 'an empty object is still an object');
assert.equal(bare.summary, '');
assert.deepEqual(bare.scores, {
  goalFit: 0, personaFit: 0, depth: 0, reciprocity: 0, nextStep: 0, avoidPenalty: 0,
} satisfies RubricScores);
assert.deepEqual(bare.corrective, { score: 0, notes: [] });
assert.equal(bare.match, combine(bare.scores, 60), 'a scoreless reply still gets the deterministic 30%');
const junk = parseSummary('{"summary":42,"scores":{"goalFit":"lots"},"corrective":{"notes":"nope"}}', INPUT);
assert.ok(junk);
assert.equal(junk.summary, '', 'a non-string summary defaults to empty');
assert.equal(junk.scores.goalFit, 0, 'a non-numeric score defaults to 0');
assert.deepEqual(junk.corrective.notes, [], 'non-array notes default to empty');

// ─── nothing parseable at all ───────────────────────────────────────────────
assert.equal(parseSummary('', INPUT), null);
assert.equal(parseSummary('I could not score this conversation, sorry.', INPUT), null);
assert.equal(parseSummary('{"summary": "unterminated', INPUT), null, 'a truncated object is null');
assert.equal(parseSummary('[1,2,3]', INPUT), null, 'a bare array is not a result');
// A brace inside the summary text must not truncate the object.
const braced = parseSummary('{"summary":"they discussed {braces} and JSON","scores":{"depth":11}}', INPUT);
assert.ok(braced);
assert.equal(braced.summary, 'they discussed {braces} and JSON');
assert.equal(braced.scores.depth, 11);

// ─── combine() ───────────────────────────────────────────────────────────────
const S = (p: Partial<RubricScores>): RubricScores => ({
  goalFit: 0, personaFit: 0, depth: 0, reciprocity: 0, nextStep: 0, avoidPenalty: 0, ...p,
});
// Floor: every positive at 0, the full penalty, and no deterministic agreement.
assert.equal(combine(S({ avoidPenalty: -20 }), 0), 0, 'the worst possible talk scores 0');
// Ceiling: every positive maxed, no penalty, a perfect deterministic match.
assert.equal(
  combine(S({ goalFit: 25, personaFit: 20, depth: 20, reciprocity: 15, nextStep: 10 }), 100),
  100,
  'the best possible talk scores 100'
);
// Nothing said at all still floors at the deterministic share only.
assert.equal(combine(S({ avoidPenalty: -20 }), 100), 30, 'a disastrous talk keeps 30% of the intent match');
assert.equal(combine(S({ goalFit: 25, personaFit: 20, depth: 20, reciprocity: 15, nextStep: 10 }), 0), 70);
// The worked mid case: sum 55 -> (55+20)/110*100 = 68.18; 0.7*68.18 + 0.3*60 = 65.73 -> 66.
assert.equal(
  combine(S({ goalFit: 18, personaFit: 14, depth: 12, reciprocity: 9, nextStep: 6, avoidPenalty: -4 }), 60),
  66,
  'the worked mid example must land on 66'
);
// combine() defends itself; it does not assume parseSummary ran first.
assert.equal(combine(S({ goalFit: 999 }), 999), combine(S({ goalFit: 25 }), 100));

console.log('rubric.check.ts: all assertions passed');
