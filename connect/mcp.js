#!/usr/bin/env node
// npx echoe-connect mcp --token <T> --owner <0xhex>
//
// The other half of the link. `echoe-connect <token>` pushes a nightly summary
// up; this hands the same token to the coding agent as a tool, so the agent that
// already knows you can read your Echoe and write your persona, what you are
// building, and what you did today.
//
// A stdio MCP server: newline-delimited JSON-RPC 2.0 on stdin and stdout, and
// nothing but diagnostics on stderr, because anything else on stdout is a
// protocol error to the client reading it.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { anonIdentity, callReducer, localDay } from './sync.js';
import { PERSONA_PROMPT, eventBuildPrompt } from './prompts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version; }
  catch { return '0.0.0'; } // a serverless bundle may not carry package.json
})();

/**
 * Versions whose message shapes this server actually speaks. The client's own
 * version is echoed back when it is one of these, per the initialize contract;
 * anything else gets the one below and the client decides whether to stay.
 */
const SPOKEN = new Set(['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']);
const FALLBACK_VERSION = '2025-06-18';

const MEMORY_SHOWN = 20;

export const negotiate = asked => (SPOKEN.has(asked) ? asked : FALLBACK_VERSION);

/** 64 hex, with or without the prefix. Validated because it is interpolated into SQL. */
export function ownerLiteral(raw) {
  const hex = String(raw ?? '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`--owner wants a 64-character hex identity, got "${raw}"`);
  return `0x${hex.toLowerCase()}`;
}

// ------------------------------------------------------------------ the database

/**
 * SpacetimeDB answers a SQL query positionally: one result per statement, with
 * the column names in `schema.elements` and the values in `rows` in that order.
 * Zipping them back together is the whole difference between this and JSON.
 */
export function toObjects(result) {
  const names = (result?.schema?.elements ?? []).map((el, i) => el?.name?.some ?? el?.name ?? `column${i}`);
  return (result?.rows ?? []).map(row => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

/** One statement, one round trip. Private tables answer 400 rather than an empty set. */
async function sql(ctx, statement) {
  const response = await fetch(`${ctx.host}/v1/database/${ctx.db}/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await ctx.identity()}`, 'Content-Type': 'text/plain' },
    body: statement,
  });
  if (!response.ok) throw new Error(`sql ${response.status}: ${(await response.text()).trim().slice(0, 200)}`);
  return (await response.json()).flatMap(toObjects);
}

/** Everything the caller's flags amount to, with the identity fetched at most once. */
export function context({ host, db, token, owner }) {
  let pending;
  return {
    host: host.replace(/\/+$/, ''),
    db,
    token,
    owner: ownerLiteral(owner),
    identity() {
      pending ??= anonIdentity(this.host).then(id => id.token);
      return pending;
    },
  };
}

// ----------------------------------------------------------------------- tools

export const TOOLS = [
  {
    name: 'echoe_read',
    description:
      'Read everything this player\'s Echoe currently knows: its persona, the behaviour notes it has '
      + 'accrued from corrections, the one-line intent they are carrying, the last 20 memory lines their '
      + 'coding agent has sent, what they told each event they are building, and the events they joined. '
      + 'Call this first. If "echo" is null they have no Echoe yet and echoe_set_persona will create one.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'echoe_set_persona',
    description:
      'Write the persona this player\'s Echoe speaks from. It is an operating manual for another model '
      + 'that will talk to strangers as this person, not a bio: how they talk, what they care about, what '
      + 'they will not say. Use the write-persona prompt to write it, show the text to the person, and '
      + 'only then save. Replaces the whole persona. Creates the Echoe if there is not one yet.',
    inputSchema: {
      type: 'object',
      properties: { persona: { type: 'string', description: 'The full persona text. Replaces what is there.' } },
      required: ['persona'],
      additionalProperties: false,
    },
  },
  {
    name: 'echoe_set_building',
    description:
      'Write what this player is building, for the people their Echoe meets at one event. 800 to 1200 '
      + 'words of plain prose in their voice, drawn from the repository you have open: what it is, what '
      + 'runs today, the decisions behind it, what they are stuck on, who they want to meet. Use the '
      + 'write-building prompt. Show the text to the person before you save it.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'The event slug, e.g. "midnight-moonshot".' },
        text: { type: 'string', description: 'The building text, 800 to 1200 words.' },
      },
      required: ['eventId', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'echoe_add_memory',
    description:
      'Add memory lines about what this person did and decided today. 3 to 12 lines, newline separated, '
      + 'one durable fact each, written about the person rather than about the session. Never include a '
      + 'secret, credential, path, URL, or line of code. Lines already remembered are skipped.',
    inputSchema: {
      type: 'object',
      properties: { notes: { type: 'string', description: 'Newline-separated lines, 3 to 12 of them.' } },
      required: ['notes'],
      additionalProperties: false,
    },
  },
];

async function readEchoe(ctx) {
  const [echo] = await sql(ctx, `SELECT id, persona, behaviour_notes FROM echo WHERE owner = ${ctx.owner}`);
  const intents = await sql(ctx, `SELECT text FROM intent WHERE owner = ${ctx.owner}`);
  // ponytail: last N of the whole set, which is capped at 40 rows per echo module-side.
  const memory = echo
    ? (await sql(ctx, `SELECT day, source, note FROM agent_memory WHERE echo_id = ${Number(echo.id)}`)).slice(-MEMORY_SHOWN)
    : [];
  return {
    echo: echo ?? null,
    intent: intents[0]?.text ?? '',
    memory,
    building: await sql(ctx, `SELECT event_id, text FROM event_build WHERE identity = ${ctx.owner}`),
    events: await sql(ctx, `SELECT event_id, goal FROM event_join WHERE identity = ${ctx.owner}`),
  };
}

const need = (args, key) => {
  const value = args?.[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value;
};

export async function callTool(ctx, name, args = {}) {
  switch (name) {
    case 'echoe_read':
      return JSON.stringify(await readEchoe(ctx), null, 2);
    case 'echoe_set_persona':
      await callReducer(ctx.host, ctx.db, await ctx.identity(), 'set_persona_by_token',
        [ctx.token, need(args, 'persona')]);
      return 'Persona saved.';
    case 'echoe_set_building':
      await callReducer(ctx.host, ctx.db, await ctx.identity(), 'set_event_build_by_token',
        [ctx.token, need(args, 'eventId'), need(args, 'text')]);
      return `Saved what you are building at ${args.eventId}.`;
    case 'echoe_add_memory':
      await callReducer(ctx.host, ctx.db, await ctx.identity(), 'ingest_agent_memory',
        [ctx.token, localDay(), 'agent', need(args, 'notes')]);
      return 'Memory lines sent.';
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// --------------------------------------------------------------------- prompts

const ONBOARD = title => [
  `Set up my Echoe for ${title}. Work through this in order and do not skip the showing steps.`,
  '',
  '1. Call the echoe_read tool and tell me in two lines what is already there.',
  '2. Write my persona following the write-persona prompt from this same server, using what you know',
  '   about me from our work together. Do not ask me to describe myself first.',
  '3. Show me the persona in full and wait. Change it if I ask.',
  '4. Save it with echoe_set_persona.',
  `5. Write what I am building following the write-building prompt for ${title}, from the repository`,
  '   you have open right now. Use the code and the commits, not my ambitions.',
  '6. Show me that text in full and wait. Change it if I ask.',
  `7. Save it with echoe_set_building for the ${title} event.`,
  '8. Finish by calling echoe_add_memory with three lines about what I actually did and decided today.',
].join('\n');

export const PROMPTS = [
  {
    name: 'write-persona',
    title: 'Write my Echoe persona',
    description: 'Instructions for writing the persona your Echoe speaks from.',
    arguments: [],
  },
  {
    name: 'write-building',
    title: 'Write what I am building',
    description: 'Instructions for writing the 800 to 1200 word account of what you are building, for one event.',
    arguments: [{ name: 'eventTitle', description: 'The event, e.g. "Midnight Moonshot".', required: true }],
  },
  {
    name: 'onboard',
    title: 'Set up my Echoe end to end',
    description: 'Read, write the persona, write what you are building, save both, then send today\'s memory.',
    arguments: [{ name: 'eventTitle', description: 'The event, e.g. "Midnight Moonshot".', required: false }],
  },
];

export function getPrompt(name, args = {}) {
  const title = args.eventTitle || 'the event';
  const text = { 'write-persona': PERSONA_PROMPT, 'write-building': eventBuildPrompt(title), onboard: ONBOARD(title) }[name];
  if (text === undefined) throw new Error(`unknown prompt: ${name}`);
  return {
    description: PROMPTS.find(p => p.name === name).description,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

// ------------------------------------------------------------------- transport

const INSTRUCTIONS =
  'This person has an Echoe: one AI agent on a live map that meets other people\'s agents and talks '
  + 'as them. Call echoe_read before writing anything. Show every text to the person before you save it.';

/** Returns the `result` for a request, or throws. A thrown `code` becomes the JSON-RPC error code. */
export async function handle(message, ctx) {
  switch (message.method) {
    case 'initialize':
      return {
        protocolVersion: negotiate(message.params?.protocolVersion),
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: 'echoe', version: VERSION },
        instructions: INSTRUCTIONS,
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      // A tool that fails comes back as a result, not an error: the model has to
      // see the reason to fix it. Only a missing tool is a protocol-level error.
      try {
        return { content: [{ type: 'text', text: await callTool(ctx, message.params?.name, message.params?.arguments) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: error.message }], isError: true };
      }
    case 'prompts/list':
      return { prompts: PROMPTS };
    case 'prompts/get':
      return getPrompt(message.params?.name, message.params?.arguments);
    default:
      // notifications/initialized, /cancelled, /progress: acknowledged by having
      // nothing to say. They carry no id, so this result is dropped anyway.
      if (String(message.method).startsWith('notifications/')) return {};
      throw Object.assign(new Error(`method not found: ${message.method}`), { code: -32601 });
  }
}

export function serve(ctx, input = process.stdin, output = process.stdout) {
  const write = message => output.write(`${JSON.stringify(message)}\n`);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  lines.on('line', async line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      return;
    }
    try {
      const result = await handle(message, ctx);
      if (message.id !== undefined && message.id !== null) write({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      // Notifications get no answer, not even a failure: nobody is waiting on one.
      if (message.id === undefined || message.id === null) { process.stderr.write(`${error.message}\n`); return; }
      write({ jsonrpc: '2.0', id: message.id, error: { code: error.code ?? -32603, message: error.message } });
    }
  });

  return lines;
}

export function main(flags) {
  if (!flags.token) throw new Error('echoe-connect mcp needs --token <T> from your Echoe agent page');
  if (!flags.owner) throw new Error('echoe-connect mcp needs --owner <0xhex>, your identity on the map');
  const ctx = context({
    host: flags.host ?? 'https://maincloud.spacetimedb.com',
    db: flags.db ?? 'echoe',
    token: flags.token,
    owner: flags.owner,
  });
  process.stderr.write(`echoe mcp ${VERSION} on ${ctx.db} at ${ctx.host}\n`);
  serve(ctx);
}

// Claude Code and Codex spawn this file directly, so it parses its own flags too.
const isCli = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isCli) {
  const flags = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) continue;
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    flags[name] = inline ?? (process.argv[i + 1]?.startsWith('--') === false ? process.argv[++i] : 'true');
  }
  try { main(flags); } catch (error) { process.stderr.write(`${error.message}\n`); process.exit(1); }
}
