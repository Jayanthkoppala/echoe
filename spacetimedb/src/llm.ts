// OpenRouter chat-completions client for the echoTalk procedure.
// Kept out of index.ts because none of it may run inside a reducer:
// this file does network I/O and is only ever called from a procedure.

import { TimeDuration } from 'spacetimedb';

/** Give up on OpenRouter well inside the demo's 5s tick budget times two. */
const TIMEOUT = TimeDuration.fromMillis(12_000);

/** Shape of `ctx.http` that we actually use. Narrowed so this file is testable. */
export interface HttpLike {
  fetch(
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeout?: TimeDuration;
    }
  ): { status: number; text(): string };
}

export type ChatMessage = { role: 'system' | 'user'; content: string };

export type ChatResult =
  | { ok: true; text: string; costUsd: number }
  | { ok: false; reason: string };

/** Default chat-completions endpoint; player keys always go here. */
export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Google hosts get the Gemini wire format; see `chat`. */
export const isGoogleEndpoint = (url: string): boolean => /\.googleapis\.com\//.test(url);
const AUTH_KEYS_ENDPOINT = 'https://openrouter.ai/api/v1/auth/keys';

/**
 * One blocking model call. Never throws: every failure comes back as
 * `{ ok: false }` so the caller can fall through to deterministic lines.
 *
 * Two wire formats behind one signature. OpenRouter speaks OpenAI chat
 * completions with a Bearer key and returns a dollar cost per call. Google's
 * Vertex AI only accepts API keys on its native generateContent route (its
 * OpenAI-compatible route insists on OAuth too), so a googleapis endpoint gets the
 * Gemini request shape, a Bearer OAuth token, and token counts only.
 * For Google, `endpoint` is the publisher models base, e.g.
 * https://aiplatform.googleapis.com/v1/projects/<p>/locations/global/publishers/google/models
 */
export function chat(
  http: HttpLike,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  endpoint: string = OPENROUTER_ENDPOINT,
  maxTokens: number = 220
): ChatResult {
  // For Google, `apiKey` is an OAuth access token (see refreshGoogleToken);
  // Vertex refuses API keys outside express mode.
  const google = isGoogleEndpoint(endpoint);
  const url = google
    ? `${endpoint.replace(/\/$/, '')}/${model.replace(/^google\//, '')}:generateContent`
    : endpoint;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const payload = google
    ? geminiBody(messages, maxTokens)
    : { model, messages, max_tokens: maxTokens, usage: { include: true } };

  let res: { status: number; text(): string };
  try {
    res = http.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeout: TIMEOUT,
    });
  } catch (err) {
    return { ok: false, reason: `transport: ${errText(err)}` };
  }

  let body: string;
  try {
    body = res.text();
  } catch (err) {
    return { ok: false, reason: `body: ${errText(err)}` };
  }

  if (res.status < 200 || res.status >= 300) {
    return { ok: false, reason: `http ${res.status}: ${clip(body, 200)}` };
  }

  try {
    const parsed = JSON.parse(body);
    if (google) {
      const parts = parsed?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : '';
      if (text.trim().length === 0) return { ok: false, reason: 'parse: no candidates[0].content.parts' };
      return { ok: true, text: text.trim(), costUsd: 0 }; // Vertex reports tokens, not dollars
    }
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, reason: `parse: no choices[0].message.content` };
    }
    const cost = parsed?.usage?.cost;
    return { ok: true, text: content.trim(), costUsd: typeof cost === 'number' ? cost : 0 };
  } catch (err) {
    return { ok: false, reason: `parse: ${errText(err)}` };
  }
}

/** OpenAI-style messages to Gemini's request shape: system text apart, the rest as user turns. */
function geminiBody(messages: ChatMessage[], maxTokens: number) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const turns = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: 'user', parts: [{ text: m.content }] }));
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: turns.length > 0 ? turns : [{ role: 'user', parts: [{ text: 'Begin.' }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  };
}

export type TokenResult =
  | { ok: true; accessToken: string; expiresInSec: number }
  | { ok: false; reason: string };

/**
 * Google OAuth refresh-token grant: the one OAuth flow that needs no signing,
 * so it fits a module with no crypto. The client id, secret and refresh token
 * come from `gcloud auth application-default login`. Never throws.
 * Source: developers.google.com/identity/protocols/oauth2 (read 2026-09-05).
 */
export function refreshGoogleToken(
  http: HttpLike,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): TokenResult {
  const enc = encodeURIComponent;
  const form =
    `grant_type=refresh_token&client_id=${enc(clientId)}` +
    `&client_secret=${enc(clientSecret)}&refresh_token=${enc(refreshToken)}`;
  let res: { status: number; text(): string };
  try {
    res = http.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      timeout: TIMEOUT,
    });
  } catch (err) {
    return { ok: false, reason: `transport: ${errText(err)}` };
  }
  let body: string;
  try {
    body = res.text();
  } catch (err) {
    return { ok: false, reason: `body: ${errText(err)}` };
  }
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, reason: `http ${res.status}: ${clip(body, 200)}` };
  }
  try {
    const parsed = JSON.parse(body);
    const token = parsed?.access_token;
    if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'parse: no access_token' };
    const ttl = typeof parsed?.expires_in === 'number' ? parsed.expires_in : 3000;
    return { ok: true, accessToken: token, expiresInSec: ttl };
  } catch (err) {
    return { ok: false, reason: `parse: ${errText(err)}` };
  }
}

export type ExchangeResult = { ok: true; key: string } | { ok: false; reason: string };

/**
 * PKCE step two: trade the one-time code from openrouter.ai/auth for a
 * user-controlled API key. Never throws.
 * Source: openrouter.ai docs, guides/overview/auth/oauth (read 2026-09-05).
 */
export function exchangeCode(http: HttpLike, code: string, codeVerifier: string): ExchangeResult {
  let res: { status: number; text(): string };
  try {
    res = http.fetch(AUTH_KEYS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: 'S256',
      }),
      timeout: TIMEOUT,
    });
  } catch (err) {
    return { ok: false, reason: `transport: ${errText(err)}` };
  }
  let body: string;
  try {
    body = res.text();
  } catch (err) {
    return { ok: false, reason: `body: ${errText(err)}` };
  }
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, reason: `http ${res.status}: ${clip(body, 200)}` };
  }
  try {
    const key = JSON.parse(body)?.key;
    if (typeof key !== 'string' || key.length === 0) return { ok: false, reason: 'parse: no key' };
    return { ok: true, key };
  } catch (err) {
    return { ok: false, reason: `parse: ${errText(err)}` };
  }
}

/**
 * Split a model reply into at most `max` speakable lines. The model is asked for
 * one line per turn prefixed with a speaker tag; anything else degrades to a
 * single line rather than failing.
 */
export function splitLines(text: string, max: number): string[] {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*]|\d+[.)])?\s*(?:[A-Z]:|\w+:)?\s*/, '').trim())
    .filter(l => l.length > 0);
  return (lines.length > 0 ? lines : [text.trim()]).slice(0, max);
}

/** What a model appends to close a conversation. Never shown to a player. */
export const END_MARKER = '[END]';

/**
 * Strips `[END]` from a reply in place and says whether it was there. The
 * marker is how the model ends a conversation early; a line that carries it is
 * still a real line, so it is kept, minus the token.
 */
export function takeEndMarker(lines: string[]): boolean {
  let found = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(END_MARKER)) continue;
    found = true;
    lines[i] = lines[i].split(END_MARKER).join(' ').replace(/\s+/g, ' ').trim();
  }
  return found;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

// ─── Resend ──────────────────────────────────────────────────────────────────

/** A verification mail is worth less than the tick it would stall. */
const EMAIL_TIMEOUT = TimeDuration.fromMillis(8_000);

export type SendResult = { ok: true } | { ok: false; reason: string };

/**
 * One transactional email through the Resend REST API. Same contract as `chat`:
 * never throws, so `requestVerification` can decide between "sent" and "logged"
 * instead of losing the code it already committed.
 */
export function sendEmail(
  http: HttpLike,
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string
): SendResult {
  let res: { status: number; text(): string };
  try {
    res = http.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      timeout: EMAIL_TIMEOUT,
    });
  } catch (err) {
    return { ok: false, reason: `transport: ${errText(err)}` };
  }
  if (res.status < 200 || res.status >= 300) {
    let body = '';
    try {
      body = res.text();
    } catch (err) {
      body = errText(err);
    }
    return { ok: false, reason: `http ${res.status}: ${clip(body, 200)}` };
  }
  return { ok: true };
}
