// node test.js  — no framework, no fixtures on disk. Run it before publishing.
import assert from 'node:assert/strict';
import { extractClaude, extractCodex, dedupe, parseNotes, localDay } from './sync.js';
import { withCronLine, cronSchedule, CRON_TAG } from './bin.js';

const test = (name, fn) => { fn(); console.log(`ok  ${name}`); };

// ------------------------------------------------------- Claude Code extractor

const claudeFixture = [
  { type: 'user', message: { role: 'user', content: 'drop the redis dep from auth' } },
  { type: 'assistant', message: { role: 'assistant', content: [
    { type: 'thinking', thinking: 'they probably want an LRU' },
    { type: 'text', text: 'Replacing it with an in-memory LRU.' },
    { type: 'tool_use', name: 'Edit', input: { file_path: '/secret/path.ts' } },
  ] } },
  { type: 'user', message: { role: 'user', content: [
    { type: 'tool_result', content: 'File updated with 4000 lines of noise' },
    { type: 'text', text: 'good, now the tests' },
  ] } },
  { type: 'user', isMeta: true, message: { role: 'user', content: 'injected context nobody typed' } },
  { type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } },
  { type: 'assistant', message: { role: 'assistant', content: [
    { type: 'text', text: '<system-reminder>be nice</system-reminder>Tests pass.' },
  ] } },
  { type: 'summary', summary: 'auth refactor' },
  { type: 'system', content: 'hook fired' },
].map(o => JSON.stringify(o)).join('\n');

test('claude extractor keeps prose and drops tool traffic', () => {
  assert.deepEqual(extractClaude(claudeFixture), [
    { role: 'me', text: 'drop the redis dep from auth' },
    { role: 'agent', text: 'Replacing it with an in-memory LRU.' },
    { role: 'me', text: 'good, now the tests' },
    { role: 'agent', text: 'Tests pass.' },
  ]);
});

test('claude extractor survives a truncated final line', () => {
  assert.equal(extractClaude(`${claudeFixture}\n{"type":"user","mess`).length, 4);
});

// ------------------------------------------------------------ Codex extractor

const codexFixture = [
  { type: 'session_meta', payload: { id: 'abc', cwd: '/Users/x/proj' } },
  { type: 'response_item', payload: { type: 'message', role: 'user', content: [
    { type: 'input_text', text: '<environment_context>cwd=/Users/x</environment_context>' },
  ] } },
  { type: 'response_item', payload: { type: 'message', role: 'user', content: [
    { type: 'input_text', text: 'add a retry to the uploader' },
  ] } },
  { type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: '{"cmd":"ls"}' } },
  { type: 'response_item', payload: { type: 'function_call_output', output: 'a.txt b.txt' } },
  { type: 'response_item', payload: { type: 'reasoning', summary: ['thinking about backoff'] } },
  { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [
    { type: 'output_text', text: 'Added exponential backoff with three attempts.' },
  ] } },
  { type: 'event_msg', payload: { type: 'agent_message', message: 'duplicate of the above' } },
  // older rollouts wrote the item at the top level
  { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'ship it' }] },
].map(o => JSON.stringify(o)).join('\n');

test('codex extractor reads both envelope shapes and drops calls', () => {
  assert.deepEqual(extractCodex(codexFixture), [
    { role: 'me', text: 'add a retry to the uploader' },
    { role: 'agent', text: 'Added exponential backoff with three attempts.' },
    { role: 'me', text: 'ship it' },
  ]);
});

test('dedupe collapses consecutive repeats only', () => {
  assert.deepEqual(
    dedupe([
      { role: 'me', text: 'retry' }, { role: 'me', text: 'retry' },
      { role: 'agent', text: 'ok' }, { role: 'me', text: 'retry' },
    ]),
    [{ role: 'me', text: 'retry' }, { role: 'agent', text: 'ok' }, { role: 'me', text: 'retry' }],
  );
});

// ------------------------------------------------------------- notes parser

test('notes parser strips bullets and drops anything secret-shaped', () => {
  assert.deepEqual(parseNotes([
    'Here are the bullets:',
    '- Refactored the auth module to drop Redis',
    '* Prefers plain ESM over a build step',
    '1. Uses SpacetimeDB for the hackathon backend',
    '- Set OPENAI_KEY to sk-proj-abc123def456',
    '- Committed with token=ghs_abcdefghijklmnop',
    '- The github_pat_11ABCDEF token is in the env',
    '- Rotated the AKIAIOSFODNN7EXAMPLE credential',
    '- The database password is hunter2',
    '- Refactored the auth module to drop Redis',
    'ok',
  ].join('\n')), [
    'Here are the bullets:',
    'Refactored the auth module to drop Redis',
    'Prefers plain ESM over a build step',
    'Uses SpacetimeDB for the hackathon backend',
  ]);
});

test('notes parser refuses a run that produced fewer than three lines', () => {
  assert.deepEqual(parseNotes('- only one line here'), []);
  assert.equal(parseNotes(Array.from({ length: 30 }, (_, i) => `- line number ${i}`).join('\n')).length, 12);
});

test('notes parser drops a line too long for the reducer to store', () => {
  assert.deepEqual(parseNotes(`- a\n- ${'x'.repeat(301)}\n- fine one\n- fine two\n- fine three`),
    ['fine one', 'fine two', 'fine three']);
});

// ----------------------------------------------------------------- schedule

test('cron schedule parses HH:MM and rejects the rest', () => {
  assert.equal(cronSchedule('22:00'), '0 22 * * *');
  assert.equal(cronSchedule('7:05'), '5 7 * * *');
  assert.throws(() => cronSchedule('10pm'), /HH:MM/);
  assert.throws(() => cronSchedule('25:00'), /out of range/);
});

test('cron install replaces our line and never duplicates it', () => {
  const theirs = '0 9 * * * /usr/bin/backup.sh\n@reboot /usr/local/bin/tunnel\n';
  const line = `0 22 * * * /usr/bin/node /pkg/sync.js >> /home/me/.echoe/sync.log 2>&1 ${CRON_TAG}`;
  const once = withCronLine(theirs, line);
  assert.equal(once, `${theirs.trimEnd()}\n${line}\n`);

  const twice = withCronLine(once, line.replace('0 22', '30 23'));
  assert.equal(twice.split('\n').filter(r => r.includes(CRON_TAG)).length, 1);
  assert.ok(twice.includes('30 23'));
  assert.ok(twice.includes('/usr/bin/backup.sh'), 'other entries survive');

  assert.equal(withCronLine(twice, null), theirs);
  assert.equal(withCronLine('', null), '', 'removing from an empty crontab leaves it empty');
  assert.equal(withCronLine('', line), `${line}\n`);
});

test('localDay is the local calendar date, not UTC', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 1, 30)), '2026-01-05');
  assert.match(localDay(), /^\d{4}-\d{2}-\d{2}$/);
});

console.log('\nall passed');
