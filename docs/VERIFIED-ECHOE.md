# Verified company Echoe

Add a work email, get a code, and the Echoe carries a company badge everyone can see.
Also the hackathon email qualifier: a signup makes a real email land.

Builds on the uncommitted work in `spacetimedb/src/index.ts`: the private `secret` table
(`resend_api_key`, `public_origin`), the private `contact` table, and `requireAdmin`.
Network I/O stays out of `index.ts`, so Resend gets `spacetimedb/src/email.ts`, the rule
`llm.ts` follows. Company ids are the slug strings `docs/LOGO-PINS.md` already uses.

## 1. Tables

`spacetimedb/src/companies.ts` holds the seed rows, the way `LANDMARKS` lives in
`index.ts`. Generate it from `src/data/companies.json` alongside the client's
`src/data/companies.ts`, so one file is edited and the client reads the table, not a
second copy.

```typescript
/** Public. Seeded in `init`, read-only afterwards, exactly like `place`. */
const company = table(
  { name: 'company', public: true },
  {
    id: t.string().primaryKey(), // slug, matches LOGO-PINS: 'razorpay'
    name: t.string(), domain: t.string().unique(),
    aliases: t.string(), // comma separated extra domains, '' when there are none
    lng: t.f64(), lat: t.f64(),
    category: t.string(), logo: t.string(), featured: t.bool(),
  }
);

/**
 * PRIVATE. The row survives a successful verification, `used` set and `code`
 * blanked, because `email` is unique and that is the only thing stopping one
 * inbox from verifying two identities.
 */
const verification = table(
  { name: 'verification' },
  {
    identity: t.identity().primaryKey(), email: t.string().unique(),
    domain: t.string(), code: t.string(), expiresAt: t.timestamp(),
    attempts: t.u8(), sends: t.u8(),
    windowStartedAt: t.timestamp(), sentAt: t.timestamp(), used: t.bool(),
  }
);

// two new public columns on `player`, and never the email
    companyId: t.string(),      // '' when the domain is not in the seed list
    verifiedDomain: t.string(), // '' when unverified
```

The code is plain text. Hashing six digits is theatre: a million values, in a table no
client can read. Expiry and the send cap are the real protection.

```typescript
const CODE_TTL_MICROS = 600_000_000n;      // 10 minutes
const SEND_WINDOW_MICROS = 3_600_000_000n; // 1 hour
const MAX_SENDS_PER_WINDOW = 3;
const MAX_CODE_ATTEMPTS = 5;
const VERIFIED_BONUS = 12;
const COMPLEMENT_FLOOR = 50; // matchIntents adds 50 the moment a complement fires
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'outlook.com',
  'hotmail.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
  'protonmail.com', 'yandex.com', 'zoho.com', 'rediffmail.com',
]);

for (const c of COMPANIES) ctx.db.company.insert(c); // in init, after the places loop

type Db = Ctx['db']; // reducers and withTx bodies both hand you one of these

function companyByDomain(db: Db, domain: string) {
  const exact = db.company.domain.find(domain);
  if (exact) return exact;
  for (const row of db.company.iter()) {
    if (row.aliases.split(',').some(a => a.trim() === domain)) return row;
  }
  return null; // ponytail: linear alias scan, index aliases if the list passes ~200
}

function workDomain(email: string): string {
  const clean = email.trim().toLowerCase();
  if (clean.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) fail('email_invalid');
  const domain = clean.slice(clean.indexOf('@') + 1);
  if (FREE_MAIL.has(domain)) fail(`free_mail:${domain}`);
  return domain;
}
```

## 2. Flow

`requestVerification` is a procedure because it needs `ctx.http`. Everything the send
depends on is read and written in one transaction, the network call runs with no
transaction open, and `sentAt` is already committed by then.

```typescript
export const requestVerification = spacetimedb.procedure(
  { email: t.string() },
  t.unit(),
  (ctx, { email }) => {
    const clean = email.trim().toLowerCase();
    const domain = workDomain(clean);
    // ctx.random before withTx. A withTx body may be replayed, and a code that
    // changes on replay is a code nobody can type.
    let code = '';
    for (let i = 0; i < 6; i++) code += String(ctx.random.integerInRange(0, 9));

    const ready = ctx.withTx(tx => {
      const now = tx.timestamp;
      const me = tx.db.player.identity.find(tx.sender);
      if (!me) fail('not_joined');
      const holder = tx.db.verification.email.find(clean);
      if (holder && !holder.identity.isEqual(tx.sender)) {
        if (holder.used) fail('email_taken');
        tx.db.verification.identity.delete(holder.identity); // unverified, take it over
      }
      const prior = tx.db.verification.identity.find(tx.sender);
      const fresh = !prior || micros(now) - micros(prior.windowStartedAt) >= SEND_WINDOW_MICROS;
      const sends = fresh ? 1 : prior.sends + 1;
      if (sends > MAX_SENDS_PER_WINDOW) fail('too_many_sends');
      const row = {
        identity: tx.sender, email: clean, domain, code,
        expiresAt: plus(now, CODE_TTL_MICROS), attempts: 0, sends,
        windowStartedAt: fresh ? now : prior!.windowStartedAt, sentAt: now, used: false,
      };
      if (prior) tx.db.verification.identity.update(row);
      else tx.db.verification.insert(row);
      return {
        apiKey: tx.db.secret.key.find('resend_api_key')?.value ?? '',
        from: tx.db.secret.key.find('resend_from')?.value ?? 'Echoe <onboarding@resend.dev>',
        origin: tx.db.secret.key.find('public_origin')?.value ?? '',
        name: me.name,
        company: companyByDomain(tx.db, domain)?.name ?? domain,
        shareId: tx.db.intent.owner.find(tx.sender)?.shareId ?? '',
      };
    });

    if (!ready.apiKey) {
      // DEV ONLY. No key configured, so the demo still completes: the code goes to
      // the module log and nowhere else. Unreachable once the key is set.
      console.warn(`requestVerification: no resend_api_key. DEV code for ${clean} is ${code}`);
      return {};
    }
    const link = ready.shareId && ready.origin ? `${ready.origin}/i/${ready.shareId}` : '';
    const sent = sendEmail(ctx.http, ready.apiKey, ready.from, clean,
      `${code} is your Echoe code`, verifyEmailText(ready.name, ready.company, code, link));
    if (!sent.ok) {
      console.warn(`requestVerification: ${sent.reason}`);
      throw new SenderError('email_send_failed'); // the row stays, the retry counts
    }
    return {};
  }
);
```

`verifyCode` is a procedure too, and that is not cosmetic. A reducer that throws rolls
its own transaction back, so a reducer can never count a failed attempt. A procedure
commits the increment inside `withTx` and reports the outcome as a return value.

```typescript
export const verifyCode = spacetimedb.procedure(
  { code: t.string() },
  t.string(), // ok | code_wrong | code_expired | locked | no_verification
  (ctx, { code }) =>
    ctx.withTx(tx => {
      const row = tx.db.verification.identity.find(tx.sender);
      const me = tx.db.player.identity.find(tx.sender);
      if (!row || row.used || !me) return 'no_verification';
      if (micros(tx.timestamp) > micros(row.expiresAt)) return 'code_expired';
      if (row.attempts >= MAX_CODE_ATTEMPTS) return 'locked';
      if (code.trim() !== row.code) {
        tx.db.verification.identity.update({ ...row, attempts: row.attempts + 1 });
        return 'code_wrong';
      }
      const named = companyByDomain(tx.db, row.domain);
      tx.db.player.identity.update({ ...me, companyId: named?.id ?? '', verifiedDomain: row.domain });
      tx.db.verification.identity.update({ ...row, used: true, code: '', attempts: 0 });
      tx.db.receipt.insert({
        id: 0n, runOwner: tx.sender, kind: 'verify', placeId: me.currentPlace,
        text: `Verified as ${named?.name ?? row.domain}`, costUsd: 0, createdAt: tx.timestamp,
      });
      return 'ok';
    })
);

export const unverify = spacetimedb.reducer(ctx => {
  const me = requirePlayer(ctx);
  ctx.db.player.identity.update({ ...me, companyId: '', verifiedDomain: '' });
});

export const setSecret = spacetimedb.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    requireAdmin(ctx); // call set_llm_config first: that is what makes you admin
    const row = { key: trimmed(key, 60, 'key'), value: value.trim() };
    if (ctx.db.secret.key.find(row.key)) ctx.db.secret.key.update(row);
    else ctx.db.secret.insert(row);
  }
);
```

`spacetimedb/src/email.ts` is `llm.ts` with one endpoint swapped. Same `HttpLike`, same
never-throw contract, same try/catch around `http.fetch` returning
`{ ok: false, reason }` on transport failure or a non-2xx.

```typescript
import { TimeDuration } from 'spacetimedb';
import type { HttpLike } from './llm';
export type SendResult = { ok: true } | { ok: false; reason: string };

export function sendEmail(
  http: HttpLike, apiKey: string, from: string, to: string, subject: string, text: string
): SendResult {
  try {
    const res = http.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
      timeout: TimeDuration.fromMillis(8_000),
    });
    return res.status >= 200 && res.status < 300
      ? { ok: true }
      : { ok: false, reason: `http ${res.status}: ${res.text().slice(0, 200)}` };
  } catch (err) {
    return { ok: false, reason: `transport: ${err instanceof Error ? err.message : String(err)}` };
  }
}
```

## 3. What the email says

Plain text, 47 words. The share link appears only when the player already has one.
Subject `123456 is your Echoe code`, so the code reads from a phone notification, which
is the whole interaction.

```typescript
function verifyEmailText(name: string, company: string, code: string, link: string): string {
  return [
    `${name},`, '',
    `Your code is ${code}. It works for the next ten minutes.`,
    `Type it in and your Echoe walks Bengaluru wearing ${company}.`,
    link ? `Your line is still live at ${link}. Send it to one more person.` : '',
    '', 'Echoe',
  ].filter(l => l.length > 0).join('\n');
}
```

## 4. Badge rendering

One join everywhere: `player.companyId` to `company.id`, with `player.verifiedDomain` as
the fallback label. `App.tsx` adds `const [companies] = useTable(tables.company)`. Add
`badge?: Badge` to `Player`, `Match`, `HostCard` and `TranscriptLine`, and
`company?: string` plus `companyLogoId?: string` to `AgentSpec`. Then `agentsFrom`,
`rankedMatches`, `hostCardFrom` and `toTranscript` each take `companies` and call
`badgeOf` on the player row they already look up.

```tsx
// src/state/types.ts
export interface Badge { companyName: string; logo: string } // logo '' means draw initials

// src/state/select.ts
export function badgeOf(
  row: { companyId: string; verifiedDomain: string }, companies: readonly CompanyRow[]
): Badge | undefined {
  if (!row.verifiedDomain) return undefined;
  const named = companies.find(c => c.id === row.companyId);
  return { companyName: named?.name ?? row.verifiedDomain, logo: named?.logo ?? '' };
}

// src/components/VerifiedBadge.tsx
export function VerifiedBadge({ badge, compact = false }: { badge?: Badge; compact?: boolean }) {
  if (!badge) return null;
  return (
    <span className="verified" title={`Verified ${badge.companyName}`}>
      {badge.logo ? <img className="verified-logo" src={badge.logo} alt="" />
        : <i className="verified-initials">{badge.companyName.slice(0, 2).toUpperCase()}</i>}
      {compact ? null : <b>Verified · {badge.companyName}</b>}
    </span>
  );
}
```

- **Map agent.** `LOGO-PINS.md` section 4 already specifies the `agents-badge` symbol
  layer keyed on `company` and `companyLogoId`. Feed it: set both properties in the
  `tick()` feature builder for every verified agent, not only the player's own, falling
  back to the lime `verified-check` sprite when the domain has no seeded logo.
- **Return match card.** `<VerifiedBadge badge={match.badge} />` under `match-name`,
  reading "Verified · Razorpay".
- **Host card.** `<VerifiedBadge badge={host.badge} />` beside `host.name` in
  `HostIntentCard`, so a link visitor sees who invited them before typing anything.
- **Transcript speaker line.** `<VerifiedBadge badge={line.badge} compact />` after the
  speaker name in `ReviewScreen`, logo only.
- `RECEIPT_ICON` in `src/state/copy.ts` gains `verify: '✔'` for the new receipt.

## 5. Matching bonus

The bonus goes in `matchPair`, not `matchIntents`. `matchIntents` is a pure function over
two strings with no `ctx` and stays that way. `matchPair` already holds `ctx` and both
identities, so it is the seam that can see a badge.

```typescript
function matchPair(ctx: Ctx, me: Identity, them: Identity): { score: number; why: string } {
  const base = matchIntents(profileOf(ctx, me), profileOf(ctx, them));
  const a = ctx.db.player.identity.find(me);
  const b = ctx.db.player.identity.find(them);
  const both = !!a?.verifiedDomain && !!b?.verifiedDomain;
  // The bonus rides on the complement, never on the badge alone. Two verified
  // people with nothing in common still score nothing.
  if (!both || a!.verifiedDomain === b!.verifiedDomain || base.score < COMPLEMENT_FLOOR) return base;
  return { score: Math.min(100, base.score + VERIFIED_BONUS),
    why: `${base.why}; both verified at their companies` };
}
```

`VERIFIED_BONUS` is 12. It lifts a bare complement from 50 to 62 and a complement with
word overlap from 70 to 82, enough to reorder the Return list without letting a badge
outrank a genuine complement. Matching domains score nothing extra: two people from one
company already know each other.

## 6. Abuse and edge cases

- **Same email, two identities.** `verification.email` is unique and the row is kept
  after success with `used: true`, so the second identity gets `email_taken`. An
  unverified row is fair game: the new identity takes it over and the old code dies.
- **Domain not in the seed list.** Verification still succeeds. `companyId` stays empty,
  `verifiedDomain` holds the domain, the badge reads "Verified · razorpay.com" with a
  two-letter initials square instead of a logo.
- **Wrong codes.** Five attempts, then `locked` until the next `requestVerification`,
  itself capped at three sends per identity per hour.
- **Send fails after the row is written.** The row stays with `sentAt` set and the send
  counted. The player retries, which is right: a send Resend refused still cost a slot.
- **No Resend key.** The code goes to the module log prefixed `DEV code` and nothing is
  sent, so the demo completes with no network and no key, the way the LLM fallback
  already does. The path disappears the moment the key is set.
- **Resend sandbox, the actual blocker.** `onboarding@resend.dev` delivers only to the
  address the Resend account was created with, so a judge typing their own work email
  gets nothing until `bosshq.in` is verified. In the Resend dashboard: Domains, Add
  Domain, `bosshq.in`, region `ap-northeast-1`. Resend then lists these records for the
  DNS host.

  | Type | Name | Value |
  | --- | --- | --- |
  | MX, priority 10 | `send.bosshq.in` | `feedback-smtp.ap-northeast-1.amazonses.com` |
  | TXT | `send.bosshq.in` | `"v=spf1 include:amazonses.com ~all"` |
  | TXT | `resend._domainkey.bosshq.in` | the `p=MIG...` value the dashboard shows |

  Newer domains get three DKIM CNAME records instead of that single TXT. Add whichever
  set the dashboard lists and leave the optional `links.` tracking CNAME out. On
  Cloudflare, proxying must be off, grey cloud, on any CNAME. Verification is usually
  under 15 minutes. Then set `resend_from` to `Echoe <hello@bosshq.in>`. Free plan
  ceilings: 100 emails a day, 3,000 a month, one verified domain.

## 7. Setting the secrets

Run `set_llm_config` from this identity first: it is what makes you the admin
`set_secret` checks. Adding columns to `player` is not an automatic migration, so the
local database needs `--delete-data` on the next publish.

```bash
cd /Users/jay/Documents/echo
~/.local/bin/spacetime publish echo --module-path spacetimedb --server local3001 --delete-data -y
~/.local/bin/spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb -y

# Local
~/.local/bin/spacetime call --no-config -s local3001 echo set_secret '"resend_api_key"' '"re_YOUR_KEY"'
~/.local/bin/spacetime call --no-config -s local3001 echo set_secret '"resend_from"' '"Echoe <onboarding@resend.dev>"'
~/.local/bin/spacetime call --no-config -s local3001 echo set_secret '"public_origin"' '"http://localhost:5173"'

# Maincloud
~/.local/bin/spacetime call -s maincloud echo set_secret '"resend_api_key"' '"re_YOUR_KEY"'
~/.local/bin/spacetime call -s maincloud echo set_secret '"resend_from"' '"Echoe <hello@bosshq.in>"'
~/.local/bin/spacetime call -s maincloud echo set_secret '"public_origin"' '"https://echoe.bosshq.in"'
```

Proof without the key coming back out. As module owner,
`spacetime sql --no-config -s local3001 echo "SELECT key FROM secret"` lists names only.
If the CLI refuses a private table, `spacetime logs` after one `request_verification`
call is the proof: a good send logs nothing, a failure logs its status line.
