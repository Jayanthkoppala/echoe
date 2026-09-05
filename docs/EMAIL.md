# Email qualifier — "we sign up, an email lands"

Cheapest path: send a transactional email from a SpacetimeDB procedure using `ctx.http.fetch` against the Resend REST API. No email SDK needed inside the module — a plain HTTP POST is enough and keeps the module dependency-free.

Sources (Context7, 2026-09-05): Resend `/websites/resend` (send-email endpoint, attachments doc, sandbox/testing doc), SpacetimeDB `/websites/spacetimedb` (procedures HTTP requests doc, tables access-permissions doc).

## Free-tier limits (Resend)

- `onboarding@resend.dev` sender works with **no domain verification**, but only delivers to the account owner's own verified email address (the account you signed up with). It cannot send to arbitrary hackathon judges/testers.
- Test addresses that always succeed without counting against real delivery: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, `suppressed@resend.dev` — useful for demoing failure states, not for real signups.
- To send to real strangers (any judge, any signup), a **verified domain** is required as the `from` address. If Echo doesn't own a domain, either verify a subdomain fast (DNS record, minutes not hours) or scope the demo so email lands in your own inbox using `onboarding@resend.dev` — this still satisfies the qualifier literally ("we sign up, an email lands") since the rubric doesn't require the recipient to be a stranger.
- Free plan: 100 emails/day, 3,000/month, 1 verified domain — plenty for one hackathon night.

## Secret handling

**Never** put the Resend API key in a public table, a client bundle, or committed source. Store it in a **private table** (private is the SpacetimeDB default — `public: true` is what you'd have to opt into, so just don't). Only the module's own procedures can read a private table; clients can't query or subscribe to it.

```typescript
import { schema, t, table } from 'spacetimedb/server';

// Private by default — no `public: true` — only server-side code can read this
const secret = table(
  { name: 'secret' },
  {
    key: t.string().primaryKey(),
    value: t.string(),
  }
);

const player = table(
  { name: 'player', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    email: t.string(),
    createdAt: t.timestamp(),
  }
);

const spacetimedb = schema({ secret, player });
export default spacetimedb;
```

Seed the Resend key into the `secret` table once via an init reducer or a one-off CLI call after deploy — never hardcode it in the module source file that goes into the public repo.

## The procedure that sends the email

Procedures (not reducers) can make outbound HTTP calls in SpacetimeDB 2.9 — `ctx.http.fetch` is only available there. Have the join reducer write the player row, then have a procedure read the row and send the mail (or call the procedure directly from the client right after join, passing the same email/name).

```typescript
import { SenderError } from 'spacetimedb/server';

export const send_welcome_email = spacetimedb.procedure(
  { toEmail: t.string(), name: t.string() },
  t.unit(),
  (ctx, { toEmail, name }) => {
    const apiKey = ctx.db.secret.key.find('resend_api_key')?.value;
    if (!apiKey) throw new SenderError('Resend API key not configured');

    const response = ctx.http.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Echo <onboarding@resend.dev>', // swap for a verified domain once you have one
        to: [toEmail],
        subject: `Welcome to Echo, ${name}`,
        html: `<p>Hi ${name}, your Echo is now wandering Bengaluru. Come back soon to see what it did.</p>`,
      }),
    });

    if (response.status !== 200) {
      throw new SenderError(`Resend returned status ${response.status}`);
    }

    return {};
  }
);
```

## The reducer that captures the email at join

```typescript
export const join = spacetimedb.reducer(
  { name: t.string(), email: t.string() },
  (ctx, { name, email }) => {
    ctx.db.player.insert({
      id: 0, // autoInc
      name,
      email,
      createdAt: ctx.timestamp,
    });
    // Trigger send_welcome_email from the client right after this reducer
    // succeeds, or from a scheduled/init procedure that scans new rows —
    // reducers themselves cannot make HTTP calls, only procedures can.
  }
);
```

## curl test (run this before trusting the client wiring)

```bash
/usr/bin/curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_xxxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Echo <onboarding@resend.dev>",
    "to": ["your-account-email@example.com"],
    "subject": "Echo test",
    "html": "<p>it works</p>"
  }'
```

A 200 response returns `{"id": "<uuid>"}`. Check the inbox, not just the status code — a 200 with a bounced/suppressed test address will never actually arrive.

## Reminder

- API key lives only in the private `secret` table, set once outside the public repo.
- `from` address starts as `onboarding@resend.dev` for the demo; swap to a verified domain if sending to real strangers beyond your own inbox.
- This satisfies the qualifier: "Email comms live: we sign up, an email lands."
