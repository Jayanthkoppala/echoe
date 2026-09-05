// One night's work, reduced to a few lines your Echoe can carry.
//
// The transcripts stay here. They are read, stripped of tool traffic, handed to
// the coding agent you already pay for, and thrown away; only the bullets that
// agent writes are sent anywhere. No API key, because the agent is the key.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ECHOE_DIR = path.join(os.homedir(), '.echoe');
export const CONFIG_PATH = path.join(ECHOE_DIR, 'config.json');
export const LOG_PATH = path.join(ECHOE_DIR, 'sync.log');
export const LAST_PATH = path.join(ECHOE_DIR, 'last.txt');

const DIGEST_CAP = 60 * 1024;
const AGENT_TIMEOUT_MS = 180_000;
const NOTE_MIN = 3;
const NOTE_MAX = 300;
const NOTES_MIN = 3;
const NOTES_MAX = 12;

export const PROMPT = [
  'The input is a rough transcript of one developer\'s coding day, already stripped of tool output.',
  'Write 3 to 8 bullets, each one line, each a durable fact worth an AI twin knowing about this person:',
  'what they built or fixed, decisions and preferences they stated, tools and stacks they use, what they avoid.',
  'Write about the person, not about the transcript.',
  'Never include a secret, credential, API key, token, password, file path, URL, or line of code;',
  'if a bullet would need one, drop that bullet.',
  'Output only the bullets, each starting with "- ". No preamble, no heading, no closing line.',
].join(' ');

export const readConfig = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

export function writeConfig(config) {
  fs.mkdirSync(ECHOE_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Local calendar day, not UTC: a 1am commit belongs to the night before it, not the morning after. */
export function localDay(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------------------------------------------------------------- extraction

/** System noise that the harness injects into the user turn and the human never typed. */
const INJECTED = [
  '<system-reminder>', '<command-name>', '<local-command-stdout>', '<local-command-stderr>',
  '<user-instructions>', '<environment_context>', '<user_instructions>', '<editor_context>',
  'Caveat: The messages below', '[Request interrupted', 'This session is being continued from',
];

function clean(text) {
  if (typeof text !== 'string') return '';
  const stripped = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  if (!stripped) return '';
  if (INJECTED.some(marker => stripped.startsWith(marker))) return '';
  return stripped;
}

/** Prose out of a content field that may be a bare string or a block list. */
function proseOf(content, keepTypes) {
  if (typeof content === 'string') return clean(content);
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block && keepTypes.has(block.type))
    .map(block => clean(block.text))
    .filter(Boolean)
    .join('\n');
}

const CLAUDE_BLOCKS = new Set(['text']);
const CODEX_BLOCKS = new Set(['input_text', 'output_text', 'text']);

/**
 * Claude Code writes one JSON object per line, one per conversation turn. Tool
 * calls and their results ride inside the same `content` arrays as the prose,
 * so the filter is on block type, not on line type.
 */
export function extractClaude(jsonl) {
  const out = [];
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.isMeta || row.isSidechain) continue;
    if (row.type !== 'user' && row.type !== 'assistant') continue;
    const role = row.message?.role ?? row.type;
    const text = proseOf(row.message?.content, CLAUDE_BLOCKS);
    if (text) out.push({ role: role === 'user' ? 'me' : 'agent', text });
  }
  return out;
}

/**
 * Codex rollouts wrap each item in an envelope. Older rollouts put the message
 * at the top level, so both shapes are read rather than assuming a version.
 */
export function extractCodex(jsonl) {
  const out = [];
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const item = row.payload ?? row;
    if (item.type !== 'message') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    const text = proseOf(item.content, CODEX_BLOCKS);
    if (text) out.push({ role: item.role === 'user' ? 'me' : 'agent', text });
  }
  return out;
}

/** Consecutive repeats are retries and resends; they say nothing new. */
export function dedupe(turns) {
  const out = [];
  for (const turn of turns) {
    const previous = out[out.length - 1];
    if (previous && previous.role === turn.role && previous.text === turn.text) continue;
    out.push(turn);
  }
  return out;
}

const listFiles = dir => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return entry.isFile() && full.endsWith('.jsonl') ? [full] : [];
  });
};

/** Today's transcripts from both agents, newest session first, capped. */
export function collectDigest(day = localDay(), cap = DIGEST_CAP) {
  const home = os.homedir();
  const sources = [
    { kind: 'claude-code', root: path.join(home, '.claude', 'projects'), extract: extractClaude },
    { kind: 'codex', root: path.join(home, '.codex', 'sessions'), extract: extractCodex },
  ];

  const sessions = [];
  const kinds = new Set();
  for (const source of sources) {
    for (const file of listFiles(source.root)) {
      let stat;
      try { stat = fs.statSync(file); } catch { continue; }
      if (localDay(stat.mtime) !== day) continue;
      let turns;
      try { turns = dedupe(source.extract(fs.readFileSync(file, 'utf8'))); } catch { continue; }
      if (!turns.length) continue;
      // The folder above the file is the project; the file itself is a random session id.
      const label = path.basename(path.dirname(file)).replace(/^-+/, '').replace(/-/g, '/');
      sessions.push({ kind: source.kind, mtime: stat.mtimeMs, label, turns });
    }
  }

  sessions.sort((a, b) => b.mtime - a.mtime);

  const parts = [];
  let size = 0;
  for (const session of sessions) {
    const body = session.turns.map(t => `${t.role}: ${t.text}`).join('\n');
    const chunk = `## ${session.label} (${session.kind})\n${body}\n`;
    if (size + chunk.length > cap) {
      const room = cap - size;
      if (room > 500) { parts.push(chunk.slice(0, room)); kinds.add(session.kind); }
      break;
    }
    parts.push(chunk);
    kinds.add(session.kind);
    size += chunk.length;
  }

  const source = kinds.size === 1 ? [...kinds][0] : kinds.size ? 'mixed' : '';
  return { digest: parts.join('\n'), source, sessions: parts.length };
}

// ------------------------------------------------------------------ distilling

const SECRET = /sk-|ghp_|gho_|github_pat_|AKIA|xox[abps]-|-----BEGIN|password|token=|secret=|api[_-]?key\s*[:=]/i;

/** Whatever the agent said, reduced to the lines that are actually safe bullets. */
export function parseNotes(raw) {
  const lines = [];
  for (const line of String(raw).split('\n')) {
    const text = line.trim().replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
    if (text.length < NOTE_MIN || text.length > NOTE_MAX) continue;
    if (SECRET.test(text)) continue;
    if (lines.includes(text)) continue;
    lines.push(text);
    if (lines.length >= NOTES_MAX) break;
  }
  return lines.length >= NOTES_MIN ? lines : [];
}

const run = (file, args, input) => new Promise((resolve, reject) => {
  const child = execFile(
    file, args,
    { timeout: AGENT_TIMEOUT_MS, maxBuffer: 4 << 20, cwd: ECHOE_DIR, env: { ...process.env, CI: '1' } },
    (error, stdout, stderr) => {
      if (error) reject(new Error(`${path.basename(file)} failed: ${(stderr || error.message).trim().slice(0, 300)}`));
      else resolve(stdout);
    },
  );
  child.stdin.end(input);
});

/**
 * The user's own agent does the summarising, which is why this needs no API key
 * and no model of ours. Both CLIs read the digest from stdin.
 */
export async function distil(agent, digest) {
  const args = agent.kind === 'codex'
    ? ['exec', PROMPT, '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never']
    : ['-p', PROMPT, '--output-format', 'text', '--strict-mcp-config', '--allowed-tools', ''];
  return parseNotes(await run(agent.path, args, digest));
}

// ----------------------------------------------------------------------- send

/** SpacetimeDB reducers are exposed under their snake_case names, not the camelCase source name. */
const REDUCER = 'ingest_agent_memory';

/** A throwaway identity. The reducers here authenticate on the link token, not the caller. */
export async function anonIdentity(host) {
  const response = await fetch(`${host}/v1/identity`, { method: 'POST' });
  if (!response.ok) throw new Error(`identity ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

/**
 * One reducer call. A rejected reducer answers 530 with the plain-text reason it
 * failed on (bad_token, no_echo_yet), which is worth more than the status code.
 */
export async function callReducer(host, db, identityToken, name, args) {
  const response = await fetch(`${host}/v1/database/${db}/call/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${identityToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`${name} ${response.status}: ${(await response.text()).trim().slice(0, 200)}`);
}

export async function send(config, day, source, notes) {
  const host = config.host.replace(/\/+$/, '');
  // A throwaway identity is enough: the reducer authenticates on the link token, not the caller.
  let identity = config.identity;
  if (!identity?.token) {
    identity = await anonIdentity(host);
    writeConfig({ ...readConfig(), identity });
  }
  await callReducer(host, config.db, identity.token, REDUCER, [config.token, day, source, notes.join('\n')]);
}

// ------------------------------------------------------------------ the night

export function log(line) {
  fs.mkdirSync(ECHOE_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`);
}

export async function sync({ dryRun = false } = {}) {
  const config = readConfig();
  const day = localDay();
  const { digest, source } = collectDigest(day);
  if (!digest) return { skipped: true, message: 'nothing to sync today' };

  const started = Date.now();
  const notes = await distil(config.agent, digest);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!notes.length) throw new Error(`${config.agent.kind} returned nothing usable after ${seconds}s`);

  if (dryRun) return { dryRun: true, digestBytes: digest.length, notes, seconds, source };

  await send(config, day, source, notes);
  fs.writeFileSync(LAST_PATH, `${notes.map(n => `- ${n}`).join('\n')}\n`);
  return { count: notes.length, notes, seconds, source, digestBytes: digest.length };
}

// Cron runs this file directly; bin.js and test.js import it for the pieces above.
const isCli = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isCli) {
  const dryRun = process.argv.includes('--dry-run');
  try {
    const result = await sync({ dryRun });
    if (result.skipped) {
      log(result.message);
      console.log(result.message);
    } else if (result.dryRun) {
      console.log(`digest ${result.digestBytes} bytes, source ${result.source}, ${result.seconds}s`);
      console.log(result.notes.map(n => `- ${n}`).join('\n'));
    } else {
      log(`synced ${result.count} lines (${result.source}, ${result.seconds}s)`);
      console.log(`Synced ${result.count} lines to your Echoe`);
    }
  } catch (error) {
    log(`failed: ${error.message}`);
    console.error(error.message);
    process.exit(1);
  }
}
