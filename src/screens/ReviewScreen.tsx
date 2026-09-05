import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { avatarUri } from '../state/copy';
import { TopBar } from '../components/TopBar';
import { ProfileButton } from '../components/ProfileButton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import type { DbConnection } from '../module_bindings';
import type { Match, Player, RevealState, ScreenProps, TranscriptLine, ScreenName } from '../state/types';

interface ReviewScreenProps extends ScreenProps {
  transcript: TranscriptLine[];
  match?: Match;
  focusedId: string | null;
  player?: Player;
  onProfile: () => void;
  onFocus: (id: string) => void;
  backTo?: ScreenName;
  /** The conversation being read; readReveal is asked about this id. */
  conversationId: string | null;
  /** How many reveal rows exist for this conversation. Changing it re-asks. */
  revealCount: number;
  /** True while the two Echoes are still talking: live view, no reveal yet. */
  open: boolean;
  /** True once my side of the summary exists, which is what Summary reads. */
  hasSummary: boolean;
}

export function ReviewScreen({
  actions,
  go,
  transcript,
  match,
  focusedId,
  player,
  onProfile,
  onFocus,
  backTo = 'return',
  conversationId,
  revealCount,
  open,
  hasSummary,
}: ReviewScreenProps) {
  // Rating and correction are hidden for now (Jay, 2026-09-06); props stay so App is untouched.
  void focusedId; void onFocus;
  const { getConnection } = useSpacetimeDB();
  const [reveal, setReveal] = useState<RevealState | null>(null);

  // The reveal payload never rides the subscription; only this procedure can
  // see the other side, and only once both have tapped.
  const load = useCallback(() => {
    const conn = getConnection() as DbConnection | undefined;
    if (!conn || !conversationId) return;
    conn.procedures
      .readReveal({ conversationId: BigInt(conversationId) })
      .then((json: string) => setReveal(JSON.parse(json) as RevealState))
      .catch(() => setReveal(null));
  }, [getConnection, conversationId]);

  useEffect(load, [load, revealCount]);

  // A live talk writes lines while the screen is open; follow the newest one.
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    // .content is the scroller, not the log, so move the newest line into it.
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [open, transcript.length]);

  return (
    <div className="screen">
      <TopBar
        title="Review conversation"
        onBack={() => go(backTo)}
        right={
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? ''}
            onClick={onProfile}
          />
        }
      />
      <div className="content">
        <div className="chat-person glass">
          <div className="mini-avatar" aria-hidden="true">
            <img src={avatarUri(match?.avatar)} alt="" />
          </div>
          <div>
            <strong>
              {match ? `${match.name}'s Echoe · clearly AI` : 'Echoe conversation'}
              <VerifiedBadge badge={match?.badge} compact />
            </strong>
            <span>
              {match ? `${match.placeName} · match ${match.score}` : ''}
            </span>
          </div>
          {open ? <span className="live-dot live-dot--pill">Live</span> : null}
        </div>

        {open ? null : reveal?.mine && reveal.theirs ? (
          <section className="reveal-panel reveal-panel--done glass">
            <strong>You both revealed</strong>
            {reveal.text ? <p>{reveal.text}</p> : null}
            {reveal.linkedin || reveal.twitter ? (
              <p className="reveal-links">
                {reveal.linkedin ? (
                  <a href={reveal.linkedin} target="_blank" rel="noreferrer noopener">LinkedIn</a>
                ) : null}
                {reveal.twitter ? (
                  <a href={reveal.twitter} target="_blank" rel="noreferrer noopener">X</a>
                ) : null}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="reveal-panel glass">
            <button
              className="primary reveal-btn"
              disabled={Boolean(reveal?.mine)}
              onClick={() => {
                if (!conversationId) return;
                actions.onReveal(conversationId);
                setTimeout(load, 400);
              }}
            >
              {reveal?.mine ? 'Waiting for them' : 'Reveal my details'}
            </button>
            {!reveal?.mine ? (
              <p className="helper helper--tight">
                Shares the line you wrote when you started, not your name or profile.
              </p>
            ) : null}
            <p className="helper helper--tight">
              {reveal?.theirs
                ? 'They have revealed. Tap to see each other\u2019s.'
                : reveal?.mine
                  ? 'Yours is in. It shows the moment they reveal too.'
                  : 'They only see yours when you both reveal.'}
            </p>
          </section>
        )}

        {transcript.length === 0 ? (
          <p className="lede">No lines were spoken in this conversation.</p>
        ) : (
          <div className="chat-log" ref={logRef}>
            {transcript.map(line =>
              line.mine ? (
                <div key={line.id} className="bubble mine">
                  {line.text}
                </div>
              ) : (
                <div className="bubble" key={line.id}>
                  {line.text}
                </div>
              ),
            )}
          </div>
        )}

      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={open || !hasSummary}
          onClick={() => go('summary')}
        >
          {open || hasSummary ? 'Summary' : 'Summarising\u2026'}
        </button>
        <button className="secondary" onClick={() => go('return')}>
          Back to the recap
        </button>
      </div>
    </div>
  );
}
