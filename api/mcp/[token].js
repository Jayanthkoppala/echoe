// Hosted MCP endpoint: POST https://echoe.world/mcp/<link token>
// Same JSON-RPC handler as `npx echoe-connect mcp`, so a player adds it with
//   claude mcp add --transport http echoe https://echoe.world/mcp/<token>
// and nothing is installed. Stateless streamable HTTP: one request, one answer.
import { context, handle } from '../../connect/mcp.js';

const HOST = (process.env.SPACETIMEDB_HTTP_HOST || 'https://maincloud.spacetimedb.com').replace(/\/+$/, '');
const DB = process.env.SPACETIMEDB_DB_NAME || process.env.VITE_SPACETIMEDB_DB_NAME || 'echoe';
// The database owner's login token (`spacetime login show --token`). It is the
// only identity allowed to read the private agent_link table, which is how a
// link token turns into the player it belongs to. Never sent to the client.
const OWNER_TOKEN = process.env.SPACETIMEDB_TOKEN;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** Identities come back from the SQL endpoint as ["0x…"]; unwrap one row. */
export const ownerFromRows = rows => rows[0]?.[0]?.[0] ?? null;

async function ownerOf(token) {
  const response = await fetch(`${HOST}/v1/database/${DB}/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OWNER_TOKEN}`, 'Content-Type': 'text/plain' },
    body: `SELECT owner FROM agent_link WHERE token = '${token}'`, // token already matched TOKEN_RE
  });
  if (!response.ok) throw new Error(`link lookup failed: ${response.status}`);
  return ownerFromRows((await response.json()).flatMap(part => part.rows));
}

/** Runs one JSON-RPC message or a batch through the shared handler. */
export async function dispatch(body, ctx) {
  const messages = Array.isArray(body) ? body : [body];
  const answers = [];
  for (const message of messages) {
    const hasId = message?.id !== undefined && message?.id !== null;
    try {
      const result = await handle(message, ctx);
      if (hasId) answers.push({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      answers.push({ jsonrpc: '2.0', id: hasId ? message.id : null, error: { code: error.code ?? -32603, message: error.message } });
    }
  }
  return Array.isArray(body) ? answers : answers[0] ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST JSON-RPC to this URL' });
  }
  const token = String(req.query?.token ?? '');
  if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'bad_token' });
  if (!OWNER_TOKEN) return res.status(503).json({ error: 'SPACETIMEDB_TOKEN is not configured' });

  let owner;
  try {
    owner = await ownerOf(token);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
  if (!owner) return res.status(404).json({ error: 'bad_token' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  }
  const answer = await dispatch(body, context({ host: HOST, db: DB, token, owner }));
  if (answer === null) return res.status(202).end(); // a notification: nothing to say
  return res.status(200).json(answer);
}
