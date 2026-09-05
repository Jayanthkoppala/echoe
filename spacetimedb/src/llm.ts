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
  | { ok: true; text: string }
  | { ok: false; reason: string };

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * One blocking chat-completions call. Never throws: every failure comes back as
 * `{ ok: false }` so the caller can fall through to deterministic lines.
 */
export function chat(
  http: HttpLike,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): ChatResult {
  let res: { status: number; text(): string };
  try {
    res = http.fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: 220 }),
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
    const content = JSON.parse(body)?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, reason: `parse: no choices[0].message.content` };
    }
    return { ok: true, text: content.trim() };
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

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}
