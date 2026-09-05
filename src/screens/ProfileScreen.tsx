import { useEffect, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import type { DbConnection } from '../module_bindings';
import { GOOGLE_CLIENT_ID, loadGoogle, renderGoogleButton } from '../state/google';
import { TopBar } from '../components/TopBar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { VerifySheet } from '../components/VerifySheet';
import { AVATAR_COLOUR, AVATAR_GLYPH } from '../state/copy';
import type {
  Correction,
  Match,
  PlaceVisit,
  Player,
  ScreenName,
  ScreenProps,
} from '../state/types';

interface ProfileScreenProps extends ScreenProps {
  backTo: ScreenName;
  player?: Player;
  intent: string;
  persona: string;
  /** The Echoe's accumulated behaviour notes, one bullet per line. */
  behaviourNotes: string;
  corrections: Correction[];
  history: PlaceVisit[];
  people: Match[];
  /** The linked_account row for this identity, when there is one. */
  google?: { displayName: string; avatarUrl: string };
  onRename: (name: string) => void;
  onUnverify: () => void;
  onUnlinkGoogle: () => void;
  onReview: (conversationId: string) => void;
  /** Forgets this browser's identity and returns to Join. Nothing is deleted. */
  onLogout: () => void;
}

const SOON = ['Connect X', 'Connect LinkedIn'];

const GOOGLE_ERRORS: Record<string, string> = {
  google_client_id_not_set: 'Google sign-in is not configured yet.',
  join_first: 'Join the world first.',
  aud_mismatch: 'That sign-in was for a different app.',
  provider_unsupported: 'That provider is not supported yet.',
};

const sayGoogle = (raw: unknown): string => {
  const text = raw instanceof Error ? raw.message : String(raw);
  const key = Object.keys(GOOGLE_ERRORS).find(k => text.includes(k));
  return key ? GOOGLE_ERRORS[key] : 'Google sign-in failed. Try again.';
};

const ago = (ms: number): string => {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

export function ProfileScreen({
  go,
  backTo,
  player,
  intent,
  persona,
  behaviourNotes,
  corrections,
  history,
  people,
  google,
  onRename,
  onUnverify,
  onUnlinkGoogle,
  onReview,
  onLogout,
}: ProfileScreenProps) {
  const { getConnection } = useSpacetimeDB();
  const googleSlot = useRef<HTMLDivElement>(null);
  const [googleError, setGoogleError] = useState('');
  const [name, setName] = useState(player?.name ?? '');
  const [verifying, setVerifying] = useState(false);

  const notes = behaviourNotes
    .split('\n')
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(Boolean);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || google) return;
    let live = true;
    loadGoogle()
      .then(() => {
        if (!live || !googleSlot.current) return;
        renderGoogleButton(googleSlot.current, async idToken => {
          const conn = getConnection() as DbConnection | undefined;
          if (!conn) return;
          try {
            // 'linked_verified' also refreshes the verified chip, which rides
            // the player row the subscription already updates.
            await conn.procedures.linkGoogle({ idToken });
            setGoogleError('');
          } catch (err) {
            setGoogleError(sayGoogle(err));
          }
        });
      })
      .catch(() => setGoogleError('Google sign-in could not load.'));
    return () => {
      live = false;
    };
  }, [google, getConnection]);

  const saveName = () => {
    const clean = name.trim();
    if (clean && clean !== player?.name) onRename(clean);
  };

  return (
    <div className="screen">
      <TopBar title="Your profile" onBack={() => go(backTo)} />
      <div className="content">
        <section className="profile-card glass">
          <div className="profile-me">
            <span
              className="profile-avatar"
              style={{ background: AVATAR_COLOUR[player?.avatar ?? 'circle'] }}
              aria-hidden="true"
            >
              {AVATAR_GLYPH[player?.avatar ?? 'circle'] ?? '●'}
            </span>
            <div className="profile-me-name">
              <input
                className="input profile-name"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={saveName}
                maxLength={40}
                aria-label="Your name"
              />
              <VerifiedBadge badge={player?.badge} />
            </div>
          </div>

          {player?.badge ? (
            <button className="link-btn" onClick={onUnverify}>
              Remove verification
            </button>
          ) : null}

          <dl className="profile-rows">
            <div>
              <dt>Intent</dt>
              <dd>{intent || 'Not set yet'}</dd>
              <button className="link-btn" onClick={() => go('create')}>
                Change
              </button>
            </div>
            <div>
              <dt>Persona</dt>
              <dd>{persona || 'Not written yet'}</dd>
              <button className="link-btn" onClick={() => go('create')}>
                Edit
              </button>
            </div>
          </dl>
        </section>

        <h3 className="profile-heading">Memory</h3>
        <section className="profile-card glass">
          {notes.length === 0 && corrections.length === 0 ? (
            <p className="profile-empty">
              Your Echoe has learned nothing yet. Correct a line after a run.
            </p>
          ) : (
            <>
              {notes.length > 0 ? (
                <ul className="profile-notes">
                  {notes.map(note => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {corrections.map(correction => (
                <div className="correction-row" key={correction.id}>
                  <small>{ago(correction.at)}</small>
                  <p className="was">“{correction.originalText}”</p>
                  <p className="now">“{correction.shouldHaveSaid}”</p>
                  <p className="rule">{correction.behaviourChange}</p>
                </div>
              ))}
            </>
          )}
        </section>

        <h3 className="profile-heading">History</h3>
        <section className="profile-card glass">
          {history.length === 0 ? (
            <p className="profile-empty">Nowhere yet. Send your Echoe out.</p>
          ) : (
            <>
              <div className="place-chips">
                {history.slice(0, 6).map(visit => (
                  <span className="place-chip" key={visit.placeName}>
                    {visit.placeName}
                  </span>
                ))}
              </div>
              <ul className="profile-list">
                {history.map(visit => (
                  <li key={visit.placeName}>
                    <strong>{visit.placeName}</strong>
                    <span>
                      {visit.count}× · {ago(visit.lastAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <h3 className="profile-heading">
          People <span>{people.length} met</span>
        </h3>
        <section className="profile-card glass">
          {people.length === 0 ? (
            <p className="profile-empty">Nobody yet. Your Echoe has not talked to anyone.</p>
          ) : (
            people.map(person => (
              <div className="person-row" key={person.conversationId}>
                <span
                  className="host-avatar"
                  style={{ background: AVATAR_COLOUR[person.avatar] ?? '#d7f06c' }}
                  aria-hidden="true"
                >
                  {AVATAR_GLYPH[person.avatar] ?? '●'}
                </span>
                <div className="person-name">
                  <strong>{person.name}</strong>
                  <VerifiedBadge badge={person.badge} />
                  <p>{person.why}</p>
                </div>
                <div className="person-end">
                  <b className="match-score tabular">{person.score}</b>
                  <button className="link-btn" onClick={() => onReview(person.conversationId)}>
                    Review
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <h3 className="profile-heading">Connections</h3>
        <section className="profile-card glass">
          {player?.badge ? (
            <VerifiedBadge badge={player.badge} />
          ) : (
            <button className="verify-btn" onClick={() => setVerifying(true)}>
              Verify my company
            </button>
          )}
          <div className="soon-grid">
            {google ? (
              <div className="linked-row">
                {google.avatarUrl ? (
                  <img
                    className="linked-avatar"
                    src={google.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <strong>Google · {google.displayName}</strong>
                <button className="link-btn" onClick={onUnlinkGoogle}>
                  Unlink
                </button>
              </div>
            ) : GOOGLE_CLIENT_ID ? (
              <div className="google-slot" ref={googleSlot} />
            ) : (
              <button className="soon-btn" disabled>
                Connect Google <i>soon</i>
              </button>
            )}
            {googleError ? <p className="verify-error">{googleError}</p> : null}
            {SOON.map(label => (
              <button className="soon-btn" key={label} disabled>
                {label} <i>soon</i>
              </button>
            ))}
          </div>
        </section>

        {verifying ? (
          <VerifySheet badge={player?.badge} onClose={() => setVerifying(false)} />
        ) : null}
      </div>
      <div className="footer">
        <button className="secondary" onClick={() => go(backTo)}>
          Back
        </button>
        <button className="link-btn" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
