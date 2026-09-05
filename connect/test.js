// node test.js  — no framework, no fixtures on disk. Run it before publishing.
import assert from 'node:assert/strict';
import { extractClaude, extractCodex, dedupe, parseNotes, localDay } from './sync.js';
import { withCronLine, cronSchedule, CRON_TAG } from './bin.js';
import { toObjects, ownerLiteral, negotiate, getPrompt, serve } from './mcp.js';
import { Readable, Writable } from 'node:stream';
import { once } from 'node:events';

// Tests run one after another, awaited: the MCP ones stub the global fetch.
let queue = Promise.resolve();
const test = (name, fn) => { queue = queue.then(async () => { await fn(); console.log(`ok  ${name}`); }); };

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


// ------------------------------------------------------------------------ MCP

const echoRow = {
  schema: { elements: [
    { name: { some: 'id' }, algebraic_type: { U64: [] } },
    { name: { some: 'persona' }, algebraic_type: { String: [] } },
  ] },
  rows: [[23, 'Builds Echoe.']],
};

test('sql rows map positionally onto their schema column names', () => {
  assert.deepEqual(toObjects(echoRow), [{ id: 23, persona: 'Builds Echoe.' }]);
  assert.deepEqual(toObjects({ schema: { elements: [] }, rows: [] }), [], 'an empty answer is an empty list');
  // Older answers name a column with a bare string rather than an option.
  assert.deepEqual(toObjects({ schema: { elements: [{ name: 'day' }] }, rows: [['2026-09-06']] }),
    [{ day: '2026-09-06' }]);
});

test('owner is normalised and anything not 64 hex is refused before it reaches SQL', () => {
  const hex = 'c2002d8614b6bfd9088222e54089f1ad30fa7e3864f5cb0417c4392c2f85853c';
  assert.equal(ownerLiteral(hex), `0x${hex}`);
  assert.equal(ownerLiteral(`0X${hex.toUpperCase()}`), `0x${hex}`);
  assert.throws(() => ownerLiteral('0x1234'), /64-character hex/);
  assert.throws(() => ownerLiteral("0x1' OR 1=1 --"), /64-character hex/);
});

test('protocol version is echoed back when we speak it, replaced when we do not', () => {
  assert.equal(negotiate('2024-11-05'), '2024-11-05');
  assert.equal(negotiate('2025-06-18'), '2025-06-18');
  assert.equal(negotiate('1999-01-01'), '2025-06-18');
  assert.equal(negotiate(undefined), '2025-06-18');
});

test('prompts/get answers one user message with the real prompt text', () => {
  const persona = getPrompt('write-persona');
  assert.equal(persona.messages.length, 1);
  assert.equal(persona.messages[0].role, 'user');
  assert.equal(persona.messages[0].content.type, 'text');
  assert.ok(persona.messages[0].content.text.startsWith('You are going to write the persona'));

  const building = getPrompt('write-building', { eventTitle: 'Midnight Moonshot' });
  assert.ok(building.messages[0].content.text.includes('Midnight Moonshot'));
  assert.ok(!building.messages[0].content.text.includes('${'), 'the template is interpolated, not pasted');

  assert.ok(getPrompt('onboard', { eventTitle: 'Midnight Moonshot' })
    .messages[0].content.text.includes('echoe_set_persona'));
  assert.throws(() => getPrompt('nope'), /unknown prompt/);
});

// --------------------------------------------------- JSON-RPC over the pipes

/** Feed lines in, collect the JSON that comes back out. */
async function rpc(messages, ctx = testCtx()) {
  const input = Readable.from(messages.map(m => `${JSON.stringify(m)}\n`));
  const out = [];
  const output = new Writable({ write(chunk, _enc, done) { out.push(String(chunk)); done(); } });
  const lines = serve(ctx, input, output);
  await once(lines, 'close');
  await new Promise(resolve => setImmediate(resolve)); // let the last async handler settle
  return out.join('').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

const testCtx = () => ({
  host: 'http://stub', db: 'echo', token: 'probe-token-abcdefghijkl',
  owner: `0x${'c2'.repeat(32)}`, identity: async () => 'stub-identity',
});

test('initialize answers with the client\'s own version, our capabilities and our name', async () => {
  const [reply] = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '0' } } },
  ]);
  assert.equal(reply.jsonrpc, '2.0');
  assert.equal(reply.id, 1);
  assert.equal(reply.result.protocolVersion, '2025-06-18');
  assert.deepEqual(reply.result.capabilities, { tools: {}, prompts: {} });
  assert.equal(reply.result.serverInfo.name, 'echoe');
  assert.match(reply.result.serverInfo.version, /^\d+\.\d+\.\d+$/);
});

test('a notification is never answered and an unknown method is', async () => {
  const replies = await rpc([
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'ping' },
    { jsonrpc: '2.0', id: 3, method: 'resources/list' },
  ]);
  assert.equal(replies.length, 2, 'the notification got no reply');
  assert.deepEqual(replies[0], { jsonrpc: '2.0', id: 2, result: {} });
  assert.equal(replies[1].error.code, -32601);
});

test('tools/list names all four and every one declares an object schema', async () => {
  const [reply] = await rpc([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]);
  assert.deepEqual(reply.result.tools.map(t => t.name),
    ['echoe_read', 'echoe_set_persona', 'echoe_set_building', 'echoe_add_memory']);
  for (const tool of reply.result.tools) {
    assert.equal(tool.inputSchema.type, 'object', tool.name);
    assert.ok(tool.description.length > 40, tool.name);
  }
});

test('tools/call routes a read through the SQL endpoint and returns one text block', async () => {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    asked.push({ url: String(url), body: init.body, auth: init.headers.Authorization });
    const table = String(init.body).includes('FROM echo ') ? echoRow
      : { schema: { elements: [{ name: { some: 'text' } }] }, rows: [] };
    return { ok: true, json: async () => [table] };
  };
  try {
    const [reply] = await rpc([{ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'echoe_read', arguments: {} } }]);
    assert.equal(reply.result.isError, undefined);
    assert.equal(reply.result.content.length, 1);
    assert.equal(reply.result.content[0].type, 'text');
    const read = JSON.parse(reply.result.content[0].text);
    assert.deepEqual(read.echo, { id: 23, persona: 'Builds Echoe.' });
    assert.equal(read.intent, '');
    assert.equal(asked.length, 5, 'one round trip per statement');
    assert.ok(asked.every(a => a.url === 'http://stub/v1/database/echo/sql'));
    assert.equal(asked[0].auth, 'Bearer stub-identity');
    assert.ok(asked[2].body.includes('echo_id = 23'), 'memory is looked up by the id the first query found');
  } finally { globalThis.fetch = real; }
});

test('a write posts the token and its arguments positionally to the reducer', async () => {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, text: async () => '' }; };
  try {
    const [reply] = await rpc([{ jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'echoe_set_building', arguments: { eventId: 'midnight-moonshot', text: 'A map of agents.' } } }]);
    assert.equal(reply.result.isError, undefined);
    assert.equal(sent[0].url, 'http://stub/v1/database/echo/call/set_event_build_by_token');
    assert.deepEqual(sent[0].body, ['probe-token-abcdefghijkl', 'midnight-moonshot', 'A map of agents.']);
  } finally { globalThis.fetch = real; }
});

test('a refused reducer comes back as an isError result carrying the module\'s reason', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 530, text: async () => 'bad_token' });
  try {
    const [reply] = await rpc([{ jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'echoe_set_persona', arguments: { persona: 'Blunt, ships fast.' } } }]);
    assert.equal(reply.result.isError, true, 'a tool failure is a result, so the model can read it');
    assert.match(reply.result.content[0].text, /bad_token/);
    assert.equal(reply.error, undefined);
  } finally { globalThis.fetch = real; }

  const [missing] = await rpc([{ jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'echoe_set_persona', arguments: {} } }]);
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /persona is required/);

  const [unknown] = await rpc([{ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'echoe_nope' } }]);
  assert.match(unknown.result.content[0].text, /unknown tool/);
});

test('prompts/list and prompts/get travel over the wire intact', async () => {
  const replies = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'prompts/list' },
    { jsonrpc: '2.0', id: 2, method: 'prompts/get', params: { name: 'onboard', arguments: { eventTitle: 'Midnight Moonshot' } } },
  ]);
  assert.deepEqual(replies[0].result.prompts.map(p => p.name), ['write-persona', 'write-building', 'onboard']);
  assert.equal(replies[0].result.prompts[1].arguments[0].required, true);
  assert.equal(replies[1].result.messages[0].role, 'user');
  assert.match(replies[1].result.messages[0].content.text, /Midnight Moonshot/);
});

await queue;
console.log('\nall passed');

// ---- hosted endpoint (api/mcp/[token].js) shares the handler ----------------
{
  const { dispatch, ownerFromRows } = await import('../api/mcp/[token].js');
  assert.equal(ownerFromRows([[['0xabc']]]), '0xabc');
  assert.equal(ownerFromRows([]), null);
  const ctx = { host: 'http://x', db: 'd', token: 't', owner: '0x' + '0'.repeat(64), identity: async () => 'i' };
  const one = await dispatch({ jsonrpc: '2.0', id: 7, method: 'tools/list' }, ctx);
  assert.equal(one.id, 7); assert.ok(one.result.tools.length >= 4);
  const batch = await dispatch([{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 1, method: 'ping' }], ctx);
  assert.deepEqual(batch, [{ jsonrpc: '2.0', id: 1, result: {} }]);
  const none = await dispatch({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx);
  assert.equal(none, null);
  const bad = await dispatch({ jsonrpc: '2.0', id: 2, method: 'nope' }, ctx);
  assert.equal(bad.error.code, -32601);
  console.log('ok  hosted dispatch: single, batch, notification, unknown method');
}

// ---- the one-paste onboarding document ---------------------------------------
{
  const { onboardDocument, PERSONA_PROMPT } = await import('./prompts.js');
  const doc = onboardDocument({ url: 'https://www.echoe.world/mcp/abc', eventId: 'spacetimedb-midnight-moonshot', eventTitle: 'Midnight Moonshot' });
  assert.ok(doc.includes('https://www.echoe.world/mcp/abc'));
  assert.ok(doc.includes(PERSONA_PROMPT));
  assert.ok(doc.includes('for the people my Echoe meets at Midnight Moonshot'));
  assert.ok(doc.includes('"spacetimedb-midnight-moonshot"'));
  for (const tool of ['echoe_read', 'echoe_set_persona', 'echoe_set_building', 'echoe_add_memory']) assert.ok(doc.includes(tool), tool);
  assert.ok(doc.split(/\s+/).length > 2300, 'carries both briefs in full');
  console.log('ok  onboard document carries url, both briefs, the event id and all four tools');
}
