import { TopBar } from '../components/TopBar';
import type { Match, ScreenProps, TranscriptLine } from '../state/types';

interface ReviewScreenProps extends ScreenProps {
  transcript: TranscriptLine[];
  match?: Match;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

export function ReviewScreen({
  actions,
  go,
  transcript,
  match,
  focusedId,
  onFocus,
}: ReviewScreenProps) {
  const focused = transcript.find(line => line.id === focusedId);

  return (
    <div className="screen">
      <TopBar title="Review conversation" step="07 / 08" onBack={() => go('return')} />
      <div className="content">
        <div className="chat-person">
          <div className="mini-avatar" aria-hidden="true">
            ☻
          </div>
          <div>
            <strong>{match ? `${match.name}'s Echoe · clearly AI` : 'Echoe conversation'}</strong>
            <span>
              {match ? `${match.placeName} · match ${match.score}` : ''}
            </span>
          </div>
        </div>

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

        {focused ? (
          <div className="review-card">
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
        ) : (
          <p className="helper">Tap one of your Echoe's lines to rate it.</p>
        )}

        <p className="helper">
          Corrections change future behaviour. They never rewrite what already happened.
        </p>
      </div>
      <div className="footer">
        <button className="secondary" onClick={() => go('return')}>
          Back to the recap
        </button>
      </div>
    </div>
  );
}
