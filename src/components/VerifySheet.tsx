import { useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import type { DbConnection } from '../module_bindings';
import { VerifiedBadge } from './VerifiedBadge';
import type { Badge } from '../state/types';

/** Server error and result strings, in words a person can act on. */
const MESSAGES: Record<string, string> = {
  free_mail_domain: 'That looks like personal mail. Use your work address.',
  invalid_email: 'That is not an email address.',
  too_many_sends: 'Too many codes sent. Try again in an hour.',
  email_taken: 'That address is already verified on another Echoe.',
  wrong_code: 'That code is not right.',
  expired: 'That code has expired. Send a new one.',
  too_many_attempts: 'Too many tries. Send a new code.',
  no_request: 'Send a code first.',
};

const say = (raw: unknown): string => {
  const text = raw instanceof Error ? raw.message : String(raw);
  const key = Object.keys(MESSAGES).find(k => text.includes(k));
  return key ? MESSAGES[key] : 'Something went wrong. Try again.';
};

interface VerifySheetProps {
  onClose: () => void;
  /** Set once the player row comes back verified, so step 3 can name them. */
  badge?: Badge;
}

export function VerifySheet({ onClose, badge }: VerifySheetProps) {
  const { getConnection } = useSpacetimeDB();
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const conn = getConnection() as DbConnection | undefined;
    if (!conn || busy) return;
    setBusy(true);
    setError('');
    try {
      // 'logged' is the no-key demo path. It reads as a sent code on purpose.
      await conn.procedures.requestVerification({ email: email.trim() });
      setEmail('');
      setStep('code');
    } catch (err) {
      setError(say(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const conn = getConnection() as DbConnection | undefined;
    if (!conn || busy) return;
    setBusy(true);
    setError('');
    try {
      const result: string = await conn.procedures.verifyCode({ code: code.trim() });
      if (result === 'ok') setStep('done');
      else setError(MESSAGES[result] ?? 'That code is not right.');
    } catch (err) {
      setError(say(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verify-backdrop" role="dialog" aria-label="Verify your company">
      <div className="verify-sheet glass">
        {step === 'done' ? (
          <>
            <h3>Verified</h3>
            <div className="verify-done">
              <VerifiedBadge badge={badge} />
            </div>
            <button className="primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : step === 'email' ? (
          <>
            <h3>Verify your company</h3>
            <label className="label" htmlFor="workEmail">
              Work email
            </label>
            <input
              className="input"
              id="workEmail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
            <p className="helper helper--tight">
              Free mail like Gmail will not work. We send a 6-digit code.
            </p>
            {error ? <p className="verify-error">{error}</p> : null}
            <button className="primary" onClick={send} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <button className="secondary" onClick={onClose}>
              Not now
            </button>
          </>
        ) : (
          <>
            <h3>Enter the code</h3>
            <label className="label" htmlFor="verifyCode">
              6-digit code
            </label>
            <input
              className="input verify-code"
              id="verifyCode"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
            <p className="helper helper--tight">Code sent. It expires shortly.</p>
            {error ? <p className="verify-error">{error}</p> : null}
            <button className="primary" onClick={verify} disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Verify'}
            </button>
            <button className="secondary" onClick={() => setStep('email')}>
              Use a different address
            </button>
          </>
        )}
      </div>
    </div>
  );
}
