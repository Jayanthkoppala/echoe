import { TopBar } from '../components/TopBar';
import { ProfileButton } from '../components/ProfileButton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import type { Match, Player, ScreenProps, TranscriptLine } from '../state/types';

interface ReviewScreenProps extends ScreenProps {
  transcript: TranscriptLine[];
  match?: Match;
  focusedId: string | null;
  player?: Player;
  onProfile: () => void;
  onFocus: (id: string) => void;
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
}: ReviewScreenProps) {
  const focused = transcript.find(line => line.id === focusedId);

  return (
    <div className="screen">
      <TopBar
        title="Review conversation"
        onBack={() => go('return')}
        right={
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? 'circle'}
            onClick={onProfile}
          />
        }
      />
      <div className="content">
        <div className="chat-person glass">
          <div className="mini-avatar" aria-hidden="true">
            ☻
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
        </div>

        <p className="review-hint">Tap any line your Echoe said</p>

        {transcript.length === 0 ? (
          <p className="lede">No lines were spoken in this conversation.</p>
        ) : (
          <div className="chat-log">
            {transcript.map(line =>
              line.mine ? (
                <button
                  key={line.id}
                  className={line.id === focusedId ? 'bubble mine focused' : 'bubble mine'}
                  onClick={() => onFocus(line.id)}
                >
                  {line.text}
                </button>
              ) : (
                <div className="bubble" key={line.id}>
                  {line.text}
                </div>
              ),
            )}
          </div>
        )}

        <p className="helper">
          Corrections change future behaviour. They never rewrite what already happened.
        </p>
      </div>
      <div className="footer">
        {focused ? (
          <div className="review-card glass">
              <div className="review-line">“{focused.text}”</div>
              <div className="review-question">Does this feel like you?</div>
              <div className="review-actions">
                <button
                  className={focused.feedback === 'like' ? 'sounds selected' : 'sounds'}
                  onClick={() => actions.onRateLine(focused.id, true)}
                >
                  ✓ Sounds like me
                </button>
                <button
                  className={focused.feedback === 'not_me' ? 'not-me selected' : 'not-me'}
                  onClick={() => {
                    actions.onRateLine(focused.id, false);
                    go('correct');
                  }}
                >
                  × Not me
                </button>
              </div>
          </div>
        ) : null}
        <button className="secondary" onClick={() => go('return')}>
          Back to the recap
        </button>
      </div>
    </div>
  );
}
