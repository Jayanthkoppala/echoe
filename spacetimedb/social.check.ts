// Self-check for the claim rules in social.ts, the security boundary of the
// Google link. No framework: run it with
//   node --experimental-strip-types spacetimedb/social.check.ts
import assert from 'node:assert/strict';
import { verifyGoogleToken } from './src/social.ts';

const CLIENT = 'client.apps.googleusercontent.com';
const NOW = 1_000_000;
const GOOD = {
  aud: CLIENT, sub: '42', email: 'jay@bosshq.in', email_verified: 'true',
  hd: 'BOSSHQ.IN', iss: 'https://accounts.google.com', exp: String(NOW + 60),
  name: 'Jay', picture: 'https://cdn/pic.png',
};
const stub = (status: number, body: unknown) =>
  ({ fetch: () => ({ status, text: () => (typeof body === 'string' ? body : JSON.stringify(body)) }) }) as never;
const run = (status: number, body: unknown) => verifyGoogleToken(stub(status, body), 'tok', CLIENT, NOW);
const reason = (patch: Record<string, unknown>) => {
  const r = run(200, { ...GOOD, ...patch });
  return r.ok ? 'ok' : r.reason;
};

const good = run(200, GOOD);
assert.ok(good.ok && good.claims.sub === '42');
assert.equal(good.ok && good.claims.hostedDomain, 'bosshq.in'); // lower-cased
assert.equal(reason({ aud: 'someone.else' }), 'aud_mismatch'); // the boundary
assert.equal(reason({ email_verified: 'false' }), 'email_not_verified');
assert.equal(reason({ iss: 'evil.example' }), 'bad_issuer:evil.example');
assert.equal(reason({ exp: String(NOW - 1) }), 'token_expired');
assert.equal(reason({ sub: '' }), 'no_subject');
assert.equal(reason({ hd: undefined }), 'ok'); // consumer account still links
assert.match((run(400, '{"error":"invalid_token"}') as { reason: string }).reason, /^http 400/);
assert.match((run(200, 'not json') as { reason: string }).reason, /^parse/);
const empty = verifyGoogleToken(stub(200, GOOD), '', CLIENT, NOW);
assert.equal(empty.ok ? 'ok' : empty.reason, 'empty_token'); // rejected before any HTTP call

console.log('social.check: all claim rules hold');
