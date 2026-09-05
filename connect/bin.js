#!/usr/bin/env node
// npx echoe-connect <token>  — link this machine's coding agent to your Echoe.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CONFIG_PATH, LOG_PATH, LAST_PATH,
  readConfig, writeConfig, sync, log,
} from './sync.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SYNC_PATH = path.join(HERE, 'sync.js');
export const CRON_TAG = '# echoe-connect';

const DEFAULTS = { host: 'https://maincloud.spacetimedb.com', db: 'echoe', at: '22:00' };

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { rest.push(arg); continue; }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (inline !== undefined) flags[name] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[name] = argv[++i];
    else flags[name] = 'true';
  }
  return { flags, rest };
}

/** "22:00" -> "0 22 * * *". Anything else is a typo worth stopping for. */
export function cronSchedule(at) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(at.trim());
  if (!match) throw new Error(`--at wants HH:MM, got "${at}"`);
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  if (hour > 23 || minute > 59) throw new Error(`--at is out of range: "${at}"`);
  return `${minute} ${hour} * * *`;
}

export const cronLine = (at, node = process.execPath, script = SYNC_PATH) =>
  `${cronSchedule(at)} ${node} ${script} >> ${LOG_PATH} 2>&1 ${CRON_TAG}`;

/**
 * One tagged line, replaced in place. A schedule file is edited by rewriting the
 * whole thing, so a naive append leaves a duplicate behind on every re-run.
 * Passing null for the line drops ours and leaves every other entry alone.
 */
export function withCronLine(existing, line) {
  const kept = existing.split('\n').filter(row => !row.includes(CRON_TAG) && row.trim() !== '');
  return line === null
    ? (kept.length ? `${kept.join('\n')}\n` : '')
    : `${[...kept, line].join('\n')}\n`;
}

/** Overridable so the install path can be exercised without editing a real crontab. */
const CRONTAB = process.env.ECHOE_CRONTAB_BIN || 'crontab';

const readSchedule = () => {
  try { return execFileSync(CRONTAB, ['-l'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; } // none yet: `crontab -l` exits non-zero rather than printing nothing
};

const writeSchedule = text => execFileSync(CRONTAB, ['-'], { input: text, stdio: ['pipe', 'ignore', 'inherit'] });

function detectAgent() {
  for (const kind of ['claude', 'codex']) {
    try {
      const found = execFileSync('which', [kind], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found) return { kind, path: found };
    } catch { /* not on PATH */ }
  }
  return null;
}

function install(token, flags) {
  const agent = detectAgent();
  if (!agent) {
    console.error('No coding agent found. Install Claude Code or Codex, make sure `claude` or `codex` is on your PATH, then run this again.');
    process.exit(1);
  }

  const at = flags.at ?? DEFAULTS.at;
  cronSchedule(at); // fail before writing anything if the time is malformed

  writeConfig({
    token,
    host: flags.host ?? DEFAULTS.host,
    db: flags.db ?? DEFAULTS.db,
    at,
    agent,
    node: process.execPath,
    installedAt: new Date().toISOString(),
  });
  console.log(`Linked with ${agent.kind} (${agent.path}). Config: ${CONFIG_PATH}`);

  if (process.platform === 'win32') {
    console.log('\nWindows has no cron. Run this once to schedule the nightly sync:');
    console.log(`  schtasks /Create /TN echoe-connect /SC DAILY /ST ${at} /TR "\\"${process.execPath}\\" \\"${SYNC_PATH}\\""`);
  } else {
    writeSchedule(withCronLine(readSchedule(), cronLine(at)));
    console.log(`Nightly sync at ${at}. Check it with: crontab -l | grep echoe-connect`);
  }

  if (SYNC_PATH.includes('_npx')) {
    console.log('\nHeads up: this ran from the npx cache, which npm may clear. For a nightly job that keeps working, run `npm i -g echoe-connect` and this command again.');
  }
}

async function runSync() {
  try {
    const result = await sync();
    if (result.skipped) { console.log(result.message); log(result.message); return; }
    log(`synced ${result.count} lines (${result.source}, ${result.seconds}s)`);
    console.log(`Synced ${result.count} lines to your Echoe`);
    console.log(result.notes.map(n => `  - ${n}`).join('\n'));
  } catch (error) {
    log(`failed: ${error.message}`);
    console.error(`Sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function remove() {
  if (process.platform === 'win32') console.log('Windows: remove the task with  schtasks /Delete /TN echoe-connect /F');
  else writeSchedule(withCronLine(readSchedule(), null));
  // Named files only. Anything else the user put in ~/.echoe is theirs.
  for (const file of [CONFIG_PATH, LAST_PATH, LOG_PATH]) fs.rmSync(file, { force: true });
  console.log('Removed the nightly sync, the config, and the local log.');
}

function status() {
  if (!fs.existsSync(CONFIG_PATH)) { console.log('Not linked. Run: npx echoe-connect <token>'); return; }
  const config = readConfig();
  console.log(`agent   ${config.agent.kind} (${config.agent.path})`);
  console.log(`echo    ${config.db} at ${config.host}`);
  console.log(`nightly ${config.at}   since ${config.installedAt}`);
  const entry = readSchedule().split('\n').find(row => row.includes(CRON_TAG));
  console.log(`cron    ${entry ?? 'not installed'}`);
  for (const [label, file] of [['last', LAST_PATH], ['log', LOG_PATH]]) {
    if (!fs.existsSync(file)) continue;
    const tail = fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-5);
    console.log(`\n${label}:\n${tail.map(l => `  ${l}`).join('\n')}`);
  }
}

// test.js imports the schedule helpers from here, so the CLI only runs when it is the CLI.
const isCli = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
const { flags, rest } = parseArgs(isCli ? process.argv.slice(2) : ['--noop']);

if (!isCli) { /* imported for its exports */ }
else if (flags.remove) remove();
else if (flags.status) status();
else if (flags.sync) await runSync();
// Long-lived and speaks JSON-RPC on stdout, so it never returns and prints nothing here.
else if (rest[0] === 'mcp') {
  try { (await import('./mcp.js')).main(flags); }
  catch (error) { console.error(error.message); process.exit(1); } // a missing flag, not a stack trace
}
else if (!rest[0]) {
  console.log('Usage: npx echoe-connect <token> [--host URL] [--db NAME] [--at HH:MM] [--now false]');
  console.log('       npx echoe-connect --status | --remove | --sync');
  console.log('       npx echoe-connect mcp --token <T> --owner <0xhex>');
  process.exit(1);
} else {
  try {
    install(rest[0], flags);
  } catch (error) {
    console.error(error.message); // a bad --at or an unwritable crontab, not a stack trace
    process.exit(1);
  }
  if (flags.now !== 'false') { console.log('\nRunning the first sync now...'); await runSync(); }
}
