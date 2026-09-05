import { TopBar } from '../components/TopBar';
import type { ScreenProps, TranscriptLine } from '../state/types';

interface ReviewScreenProps extends ScreenProps {
  transcript: TranscriptLine[];
  focusedId: string;
  onFocus: (id: string) => void;
}

export function ReviewScreen({ actions, go, transcript, focusedId, onFocus }: ReviewScreenProps) {
  const focused = transcript.find(line => line.id === focusedId) ?? transcript[transcript.length - 1];

  return (
    <div className="screen">
      <TopBar title="Review conversation" step="07 / 08" onBack={() => go('return')} />
      <div className="content">
        <div className="chat-person">
          <div className="mini-avatar" aria-hidden="true">
            ☻
          </div>
          <div>
            <strong>Maya's Echo · clearly AI</strong>
            <span>Church Street · 21:42 · 2 replies</span>
          </div>
        </div>
        <div className="chat-log">
          {transcript.map(line =>
            line.isAi ? (
              <div className="bubble" key={line.id}>
                {line.text}
              </div>
            ) : (
              <button
                key={line.id}
                className={line.id === focused.id ? 'bubble mine focused' : 'bubble mine'}
                onClick={() => onFocus(line.id)}
              >
                {line.text}
              </button>
            ),
          )}
        </div>
        <div className="review-card">
          <div className="review-line">“{focused.text}”</div>
          <div className="review-question">Does this feel like you?</div>
          <div className="review-actions">
            <button
              className={focused.feedback === 'sounds-like-me' ? 'sounds selected' : 'sounds'}
              onClick={() => actions.onRateLine(focused.id, true)}
            >
              ✓ Sounds like me
            </button>
            <button
              className={focused.feedback === 'not-me' ? 'not-me selected' : 'not-me'}
              onClick={() => {
                actions.onRateLine(focused.id, false);
                go('correct');
              }}
            >
              × Not me
            </button>
          </div>
        </div>
        <p className="helper">
          Corrections change future behaviour. They never rewrite what already happened.
        </p>
      </div>
      <div className="footer">
        <button className="secondary" onClick={() => go('done')}>
          Everything sounds right
        </button>
      </div>
    </div>
  );
}
