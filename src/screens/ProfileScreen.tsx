import { useEffect, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import type { DbConnection } from '../module_bindings';
import { GOOGLE_CLIENT_ID, loadGoogle, renderGoogleButton } from '../state/google';
import { notesFrom } from '../state/select';
import { ShareCard } from '../components/ShareCard';
import { TopBar } from '../components/TopBar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { VerifySheet } from '../components/VerifySheet';
import { avatarUri, dayChip, sourceLabel } from '../state/copy';
import type {
  AgentNote,
  Correction,
  Match,
  PlaceVisit,
  Player,
  ScreenName,
  ScreenProps,
} from '../state/types';

/** Simple hand-drawn marks, 16px, currentColor. No image fetches. */
function ClaudeMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.4 9.3 6l4.3-2.3-2.3 4.3 4.7 1.3-4.7 1.3 2.3 4.3-4.3-2.3L8 16.6l-1.3-4.7-4.3 2.3 2.3-4.3-4.7-1.3 4.7-1.3-2.3-4.3 4.3 2.3z"
        fill="currentColor"
      />
    </svg>
  );
}
function CodexMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1 14.2 4.6v6.8L8 15l-6.2-3.6V4.6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

const MAX_AGENT_NOTES = 8;

interface ProfileScreenProps extends ScreenProps {
  backTo: ScreenName;
  player?: Player;
  intent: string;
  persona: string;
  /** The Echoe's accumulated behaviour notes, one bullet per line. */
  behaviourNotes: string;
  corrections: Correction[];
  /** Rows from `agent_memory` for my Echoe, newest first. */
  agentNotes: AgentNote[];
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
  /** My live share id; the event link is this link. */
  shareId: string;
  onHostEvent: (name: string) => void;
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
  agentNotes,
  history,
  people,
  google,
  onRename,
  onUnverify,
  onUnlinkGoogle,
  onReview,
  onLogout,
  shareId,
  onHostEvent,
}: ProfileScreenProps) {
  const [hosting, setHosting] = useState(false);
  const [eventName, setEventName] = useState('');
  const { getConnection } = useSpacetimeDB();
  const googleSlot = useRef<HTMLDivElement>(null);
  const [googleError, setGoogleError] = useState('');
  const [name, setName] = useState(player?.name ?? '');
  const [verifying, setVerifying] = useState(false);

  const [openNotes, setOpenNotes] = useState<string[]>([]);
  const notes = notesFrom(behaviourNotes, corrections);

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
        <section className="section-block" style={{ marginTop: 0 }}>
          {hosting ? (
            <div className="profile-card glass">
              <div className="eyebrow">Host an event</div>
              <label className="label" htmlFor="event-name">
                What is it?
              </label>
              <input
                className="input"
                id="event-name"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="Fintech founders coffee, Saturday 4pm"
                maxLength={80}
              />
              <button
                className="primary"
                disabled={eventName.trim().length < 3}
                onClick={() => onHostEvent(eventName.trim())}
              >
                Create the event link
              </button>
              {intent.startsWith('Hosting ') && shareId ? (
                <ShareCard intent={intent} shareId={shareId} variant="inline" />
              ) : null}
              <p className="helper">
                Your Echoe's line becomes "Hosting …". Everyone who opens your link sends their
                Echoe to meet yours, and they come back ranked on your Return screen.
              </p>
              <button className="link-btn" onClick={() => setHosting(false)}>
                Close
              </button>
            </div>
          ) : (
            <button className="primary" onClick={() => setHosting(true)}>
              Host an event
            </button>
          )}
        </section>
        <section className="profile-card glass">
          <div className="profile-me">
            <span
              className="profile-avatar"
              aria-hidden="true"
            >
              <img src={avatarUri(player?.avatar)} alt="" />
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

        <button className="secondary" onClick={() => go('events')}>
          Events in Bengaluru
        </button>

        <h3 className="profile-heading">Memory</h3>
        <section className="profile-card glass">
          {notes.length === 0 && corrections.length === 0 ? (
            <p className="profile-empty">
              Your Echoe has learned nothing yet. Correct a line after a run, or connect your
              coding agent.
            </p>
          ) : (
            <>
              {notes.length > 0 ? (
                <ul className="profile-notes">
                  {notes.map(note => (
                    <li key={note}>
                      <button
                        className={openNotes.includes(note) ? 'note-line open' : 'note-line'}
                        onClick={() =>
                          setOpenNotes(open =>
                            open.includes(note) ? open.filter(n => n !== note) : [...open, note],
                          )
                        }
                      >
                        {note}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {corrections.map(correction => (
                <div className="correction-row" key={correction.id}>
                  <small>{ago(correction.at)}</small>
                  <p className="was">“{correction.originalText}”</p>
                  <p className="now">“{correction.shouldHaveSaid}”</p>
                  {correction.typedRule ? (
                    <p className="rule">{correction.behaviourChange}</p>
                  ) : null}
                </div>
              ))}
            </>
          )}

          <div className="agent-connect-row">
            <span className="agent-marks">
              <ClaudeMark />
              <CodexMark />
            </span>
            <span>Connect Claude Code · Codex</span>
            <button className="link-btn" onClick={() => go('connect')}>
              Connect
            </button>
          </div>

          {agentNotes.length > 0 ? (
            <>
              <h4 className="agent-notes-heading">From your coding sessions</h4>
              {agentNotes.slice(0, MAX_AGENT_NOTES).map(note => (
                <div className="agent-note-row" key={note.id}>
                  <span className="day-chip">{dayChip(note.day)}</span>
                  <span className="source-chip">{sourceLabel(note.source)}</span>
                  <span>{note.note}</span>
                </div>
              ))}
              {agentNotes.length > MAX_AGENT_NOTES ? (
                <p className="agent-notes-more">
                  +{agentNotes.length - MAX_AGENT_NOTES} more
                </p>
              ) : null}
            </>
          ) : null}
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
                  aria-hidden="true"
                >
                  <img src={avatarUri(person.avatar)} alt="" />
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
