# Connect X, LinkedIn or Google

Fills the slot that already exists: `ProfileScreen.tsx:30` declares
`SOON = ['Connect X', 'Connect LinkedIn', 'Connect Google']` and renders it as three
disabled buttons in the Connections card under "Verify my company". This turns the Google
one on. Every claim was checked 2026-09-05 against the source cited beside it. Reuses the
repo's own shape: `linkOpenRouter`, where the procedure does the exchange and no secret
reaches the bundle.

## 1. Decision

| Provider | Flow | Secret in module | Tonight | Hours |
| --- | --- | --- | --- | --- |
| **Google, link** | GIS button returns an `id_token` in the page, procedure verifies it at `tokeninfo` | no | **yes** | 1.0 to 1.5 |
| Google, OIDC identity | same token passed to `withToken`, identity becomes Google's | no | no | 3+, see §2 |
| LinkedIn | auth code + redirect, exchange in a procedure holding `client_secret` | **yes** | maybe | 1.5 to 2, plus product approval |
| X | auth code + PKCE, public client, then `/2/users/me` | no | **no** | blocked on a paid developer account |

Google wins on one fact: it is the only one with no redirect. The Google Identity Services
button hands the JWT to a JavaScript callback in the same page load, so there is no
callback route, no `state`, no PKCE verifier, nothing to store. The work-domain payoff
lands in the same hour (§5).

X is out. X's own docs describe the API as "No subscriptions, pay only for what you use"
with credits bought upfront (https://docs.x.com/x-api/introduction), and secondary
reporting says the free tier closed to new developers in February 2026. Either way a new
app needs a card and a wait tonight. Fallback in §6.

## 2. SpacetimeDB and OIDC: the finding

It works, and we should still not use it tonight.

An `Identity` is derived from the `sub` and `iss` claims of a JWT, hashed together
(https://spacetimedb.com/docs/intro/key-architecture). `withToken` takes "an OpenID
Connect compliant JSON Web Token", the same call on Maincloud and self-hosted
(https://spacetimedb.com/docs/clients/typescript). The server resolves the issuer at
connect time by fetching `<iss>/.well-known/openid-configuration` and reading `jwks_uri`
from it, and no per-database issuer allowlist appears anywhere in the docs
(https://spacetimedb.com/docs/core-concepts/authentication/BetterAuth). Because there is
no allowlist the module is the gate: "It is best practice to check at least the issuer
when clients connect, so you can ensure that your data can only be accessed by users of
your application" (https://spacetimedb.com/docs/core-concepts/authentication/usage).
Google is named in the supported provider list
(https://spacetimedb.com/docs/core-concepts/authentication).

So a Google `id_token` in `withToken` would make the player's identity Google-verified at
the connection layer, with `ctx.senderAuth.jwt` carrying `email` and `hd` and no HTTP call.

**The consequence that rules it out tonight.** Identity is a hash of `iss` and `sub`, so an
anonymous player who signs in arrives as a different `Identity`. Every row we own is keyed
on identity: `player.identity` is the primary key, and `echo`, `run`, `intent`, `receipt`
and `verification` hang off it. There is no documented migration primitive, so both options
are real work: a `claimIdentity` reducer rewriting the primary key of five tables in one
transaction, or forcing Google sign-in before Join, which rewrites the entry screen and
loses anonymous play. Neither is a 3-hour change at 19:00. Keep the section anyway: it is
the right answer for a v2 with accounts, and ten minutes of probing once the demo is frozen.

Verified locally, before anyone tries: **`senderAuth` is not on the procedure context.**
`ProcedureCtx` exposes `sender`, `http`, `random`, `withTx` and no claims
(`node_modules/spacetimedb/dist/server/procedures.d.ts:29-42`). It reaches `ReducerCtx`
only, and `TransactionCtx extends ReducerCtx`, so claims read as
`ctx.withTx(tx => tx.senderAuth.jwt)`, fields `subject`, `issuer`, `audience`, `identity`,
`rawPayload`, `fullPayload` (`node_modules/spacetimedb/dist/lib/reducers.d.ts:47-75`).

## 3. Storage

One public table, one procedure. `providerKey` is the uniqueness lever, the same trick
`verification.email` uses to stop one account claiming two Echoes.

```typescript
/** Public. One row per (identity, provider). Nothing secret is ever written here. */
const linkedAccount = table(
  { name: 'linked_account', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    provider: t.string(),             // 'google' | 'linkedin' | 'x'
    providerKey: t.string().unique(), // `${provider}:${providerId}`, the anti-sharing key
    handle: t.string(),               // '@jay' for X, '' for Google and LinkedIn
    displayName: t.string(),
    avatarUrl: t.string(),            // provider CDN, render with referrerPolicy="no-referrer"
    providerVerified: t.bool(),       // X blue check only, false everywhere else
    verifiedAt: t.timestamp(),
  }
);
```

## 4. Google, the one to build

Client half. No redirect, no storage, nothing to clean off the URL. One line in
`index.html` loads the library, so no code here juggles script loading:
`<script src="https://accounts.google.com/gsi/client" async defer></script>`

```tsx
// src/state/google.ts
// Source: https://developers.google.com/identity/gsi/web/reference/js-reference (read 2026-09-05)
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** Resolves with the JWT the user consents to. `credential` is Google's encoded ID token. */
export function signInWithGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    const gsi = (window as any).google?.accounts?.id;
    if (!CLIENT_ID || !gsi) return reject(new Error('google_not_configured'));
    gsi.initialize({
      client_id: CLIENT_ID,
      callback: (r: { credential?: string }) =>
        r.credential ? resolve(r.credential) : reject(new Error('google_cancelled')),
    });
    gsi.prompt(); // One Tap. gsi.renderButton(el, { theme: 'outline', size: 'large' }) for a button.
  });
}
```

Server half. `tokeninfo` checks the signature and expiry and returns the decoded payload,
but it does **not** check the token was minted for our app, so the `aud` comparison below
is the security boundary and stays.

```typescript
// spacetimedb/src/social.ts, same never-throw contract as email.ts
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
export type GoogleClaims = { sub: string; email: string; emailVerified: boolean;
  hd: string; name: string; picture: string };

export function verifyGoogleToken(http: HttpLike, idToken: string, clientId: string):
  { ok: true; claims: GoogleClaims } | { ok: false; reason: string } {
  try {
    const res = http.fetch(TOKENINFO + encodeURIComponent(idToken),
      { method: 'GET', timeout: TimeDuration.fromMillis(8_000) });
    if (res.status !== 200) return { ok: false, reason: `http ${res.status}` };
    const d = res.json() as Record<string, string>;
    if (!d.sub) return { ok: false, reason: 'no_subject' };
    if (d.aud !== clientId) return { ok: false, reason: 'aud_mismatch' };
    return { ok: true, claims: { sub: d.sub, email: d.email ?? '', hd: d.hd ?? '',
      emailVerified: String(d.email_verified) === 'true',
      name: d.name ?? '', picture: d.picture ?? '' } };
  } catch (err) {
    return { ok: false, reason: `transport: ${err instanceof Error ? err.message : String(err)}` };
  }
}
```

Fields returned are the decoded JWT payload: `aud`, `sub`, `email`, `email_verified`, `hd`,
`name`, `picture`, `exp`, `iss`, `azp`. Google's caveat is that the endpoint is "useful for
debugging but for production purposes, retrieve Google's public keys from the keys endpoint
and perform the validation locally", and "may be throttled"
(https://developers.google.com/identity/openid-connect/openid-connect). Fine for a demo,
marked in code.

```typescript
// ponytail: tokeninfo round-trip per link. Local JWKS verification if this ever gets traffic.
export const linkAccount = spacetimedb.procedure(
  { provider: t.string(), token: t.string() },
  t.unit(),
  (ctx, { provider, token }) => {
    if (provider !== 'google') throw new SenderError('provider_unsupported');
    const clientId = ctx.withTx(tx => {
      if (!tx.db.player.identity.find(tx.sender)) throw new SenderError('join_first');
      return tx.db.secret.key.find('google_client_id')?.value ?? '';
    });
    if (!clientId) throw new SenderError('google_not_configured');

    const got = verifyGoogleToken(ctx.http, token.trim(), clientId);
    if (!got.ok) throw new SenderError(`google_link_failed: ${got.reason}`);
    const c = got.claims;

    ctx.withTx(tx => {
      const key = `google:${c.sub}`;
      const held = tx.db.linked_account.providerKey.find(key);
      if (held && !held.owner.isEqual(tx.sender)) throw new SenderError('account_taken');
      const row = { id: held?.id ?? 0n, owner: tx.sender, provider: 'google', providerKey: key,
        handle: '', displayName: c.name || c.email, avatarUrl: c.picture,
        providerVerified: false, verifiedAt: tx.timestamp };
      if (held) tx.db.linked_account.id.update(row); else tx.db.linked_account.insert(row);

      // Workspace domain: Google asserts it, so it stands in for the email code.
      const me = tx.db.player.identity.find(tx.sender)!;
      const domain = (c.hd || '').toLowerCase();
      if (domain && !FREE_MAIL.has(domain) && !me.verifiedDomain) {
        const named = companyByDomain(tx.db, domain);
        tx.db.player.identity.update({ ...me, companyId: named?.id ?? '', verifiedDomain: domain });
      }
      tx.db.receipt.insert({ id: 0n, runOwner: tx.sender, kind: 'verify',
        placeId: me.currentPlace, text: `Connected Google as ${c.name || c.email}`,
        costUsd: 0, createdAt: tx.timestamp });
    });
    return {};
  }
);
```

## 5. What "verified" means per provider

- **Google with `hd`.** The Google Workspace hosted domain, asserted by Google rather than
  typed by the player, so it beats the emailed code and fills `player.verifiedDomain`
  directly. The badge, the `LOGO-PINS` map symbol and `VERIFIED_BONUS` in `matchPair` all
  light up unchanged: they read `verifiedDomain` and `companyId`, not how those got set. A
  consumer gmail account has no `hd`, gets the linked row, stays unverified. This is the
  reason to build Google.
- **X.** `verified` and `verified_type` on `/2/users/me` are the blue check. Show it as a
  badge on the linked row. It says nothing about an employer, so it never touches
  `verifiedDomain`.
- **LinkedIn.** Identity only, no company, and their own page says it "does not verify user
  identities and should not be marketed as such"
  (https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).
  A company name needs the organization APIs and partner review, not a hackathon errand.

## 6. LinkedIn and X, if there is time

**LinkedIn needs the secret in the module.** Its token exchange table lists `client_secret`
as Required: Yes, and PKCE appears nowhere in that parameter list
(https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow),
so the browser gets the code and the module exchanges it. Endpoints:
`https://www.linkedin.com/oauth/v2/authorization` (`response_type=code`, `client_id`,
`redirect_uri`, `state`, `scope=openid%20profile%20email`), then
`POST https://www.linkedin.com/oauth/v2/accessToken`, form-encoded, with `grant_type`,
`code`, `client_id`, `client_secret`, `redirect_uri`, then
`GET https://api.linkedin.com/v2/userinfo` with a bearer token returning `sub`, `name`,
`given_name`, `family_name`, `picture`, `locale`, and optionally `email` and
`email_verified`. Codes live 30 minutes. Put `linkedin_client_id` and
`linkedin_client_secret` in the private `secret` table, the way `resend_api_key` already is.

**X is a fallback, not a build.** The flow is easy: public clients are supported, "unable
to use your client secrets", and the exchange puts `client_id` in the body
(https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code).
`GET /2/users/me` with `users.read` and `tweet.read` returns `id`, `name`, `username`, plus
`profile_image_url`, `verified`, `verified_type`, `is_identity_verified` on request
(https://docs.x.com/x-api/users/user-lookup-me). The blocker is the account, not the code.
**Fallback:** a text field for an x.com profile URL, stored as a `linked_account` row with
`provider: 'x'` and `providerVerified: false`, rendered as a plain link with no check mark
and no badge. It must never read as verified.

## 7. Redirect handling, for whichever redirect provider ships

Google needs none of this. LinkedIn does. The app has no router: `App.tsx:34` reads
`location.pathname` once for `/i/<shareId>` and `vercel.json` rewrites only `/i/:id`, so
`/auth/linkedin` costs a new rewrite plus a new branch. **Cheaper and equivalent: keep the
callback at the site root and put the provider in `state`,** which the CSRF nonce already
occupies. `redirect_uri` is then the production origin itself, one entry in the LinkedIn
app rather than two.

```typescript
// src/state/social.ts. sessionStorage, single use, cleared on read. Nothing in localStorage.
const STATE_KEY = 'echoe.social.state';

export function startLink(provider: 'linkedin', clientId: string) {
  const state = `${provider}:${crypto.randomUUID()}`;
  sessionStorage.setItem(STATE_KEY, state);
  location.assign('https://www.linkedin.com/oauth/v2/authorization?' + new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: location.origin + '/',
    state, scope: 'openid profile email',
  }));
}

/** On load: the code and its provider, once, with the URL cleaned. Mirrors takeOpenRouterCode. */
export function takeSocialCode(): { provider: string; code: string } | null {
  const q = new URLSearchParams(location.search);
  const code = q.get('code'), state = q.get('state');
  if (!code || !state) return null;
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY); } catch { /* none */ }
  if (saved !== state) return null; // CSRF, or an OpenRouter code: leave the URL alone
  history.replaceState(null, '', location.pathname);
  return { provider: state.split(':')[0], code };
}
```

Order matters in `App.tsx`. `takeOpenRouterCode` at line 103 also matches a bare `?code=`,
so call `takeSocialCode()` first; it consumes only codes whose `state` it wrote and leaves
the URL untouched otherwise. Guard it with the same `useRef` pattern already there.

## 8. Console setup, Jay does these

**Google, about 5 minutes, do this first.**
1. https://console.cloud.google.com, pick or create a project.
2. APIs and Services, OAuth consent screen, External. Leave it in Testing and add your own
   address plus any judge who will sign in under Test users. No publishing needed.
3. Credentials, Create credentials, OAuth client ID, type **Web application**.
4. Authorized JavaScript origins: `http://localhost:5173` and the production origin such as
   `https://echoe.bosshq.in`. Origins only, no path, no trailing slash. GIS runs in the
   page, so **Authorized redirect URIs stay empty.**
5. The client ID is public, so it goes in `.env` as `VITE_GOOGLE_CLIENT_ID`, and into the
   module so the procedure can check `aud`:
   ```bash
   ~/.local/bin/spacetime call -s maincloud echo set_secret '"google_client_id"' '"NNN-xxx.apps.googleusercontent.com"'
   ```

**LinkedIn, 15 minutes plus review.** https://www.linkedin.com/developers/apps, Create app,
attach a LinkedIn Page you control and verify as that Page's admin. Products tab, request
**Sign In with LinkedIn using OpenID Connect**; `openid`, `profile` and `email` do not
appear on the Auth tab until granted. Auth tab, add the redirect URL, https and absolute,
no fragment, no query. Then `set_secret linkedin_client_id` and `linkedin_client_secret`.

**X, only if Jay wants to spend.** https://console.x.com, create a Project then an App in
it, then User authentication settings: permissions Read, type **Public client** (Single
page App), callback and website URL. Prepaid credits, so expect a card and a wait. Do not
start this before the freeze.

## 9. Build order tonight

1. **19:15, 10 min.** Google Cloud console, client ID, `set_secret google_client_id`.
2. **19:25, 40 min.** `spacetimedb/src/social.ts` with `verifyGoogleToken`.
3. **20:05, 30 min.** `linkAccount` and the `linked_account` table, then `generate --lang
   typescript`. The new table means the publish needs `--delete-data`, so land it early.
4. **20:35, 40 min.** `src/state/google.ts`, then swap the disabled `Connect Google` button
   in `ProfileScreen`'s `SOON` grid for a live one, reading
   `useTable(tables.linkedAccount)` for connected state. Leave the other two disabled.
5. **21:15, 20 min.** Prove it end to end: sign in with a `bosshq.in` Google account, watch
   `verifiedDomain` fill with no code typed, watch the badge reach the map pin, read the
   receipt on the Return screen.

Stop there. LinkedIn only if that clock reads 21:35 and the rest of the demo is frozen. X
gets the paste field or nothing.
