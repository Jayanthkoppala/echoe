// Google ID token verification for the linkGoogle procedure. Out of index.ts
// for the same reason llm.ts is: this file does network I/O and may only ever
// be called from a procedure.

import { TimeDuration } from 'spacetimedb';
import type { HttpLike } from './llm';

const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
const TIMEOUT = TimeDuration.fromMillis(8_000);
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export type GoogleClaims = {
  sub: string;
  email: string;
  hostedDomain: string; // Google Workspace `hd`, '' on a consumer account
  name: string;
  picture: string;
};

export type GoogleResult = { ok: true; claims: GoogleClaims } | { ok: false; reason: string };

/**
 * Check a Google ID token and hand back the claims worth keeping. Never throws:
 * every failure comes back as `{ ok: false }` so the caller decides what the
 * player is told.
 *
 * `tokeninfo` validates the signature and the expiry but NOT that the token was
 * minted for us, so the `aud` comparison here is the security boundary. `hd` is
 * only trustworthy because of it.
 *
 * ponytail: one tokeninfo round trip per link, and Google calls the endpoint
 * debug-grade and throttleable. Verify against their JWKS locally if this ever
 * carries traffic.
 */
export function verifyGoogleToken(
  http: HttpLike,
  idToken: string,
  clientId: string,
  nowSecs: number
): GoogleResult {
  if (idToken.length === 0) return { ok: false, reason: 'empty_token' };

  let res: { status: number; text(): string };
  try {
    res = http.fetch(TOKENINFO + encodeURIComponent(idToken), {
      method: 'GET',
      headers: {},
      timeout: TIMEOUT,
    });
  } catch (err) {
    return { ok: false, reason: `transport: ${err instanceof Error ? err.message : String(err)}` };
  }

  let body: string;
  try {
    body = res.text();
  } catch (err) {
    return { ok: false, reason: `body: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (res.status !== 200) return { ok: false, reason: `http ${res.status}: ${body.slice(0, 200)}` };

  let d: Record<string, unknown>;
  try {
    d = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: `parse: ${body.slice(0, 200)}` };
  }

  const sub = typeof d.sub === 'string' ? d.sub : '';
  if (!sub) return { ok: false, reason: 'no_subject' };
  if (d.aud !== clientId) return { ok: false, reason: 'aud_mismatch' };
  if (String(d.email_verified) !== 'true') return { ok: false, reason: 'email_not_verified' };
  if (!ISSUERS.has(String(d.iss))) return { ok: false, reason: `bad_issuer:${String(d.iss)}` };
  const exp = Number(d.exp);
  if (!Number.isFinite(exp) || exp <= nowSecs) return { ok: false, reason: 'token_expired' };

  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    ok: true,
    claims: {
      sub,
      email: str(d.email),
      hostedDomain: str(d.hd).toLowerCase(),
      name: str(d.name),
      picture: str(d.picture),
    },
  };
}
