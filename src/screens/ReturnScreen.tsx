import { TopBar } from '../components/TopBar';
import { AVATAR_COLOUR, AVATAR_GLYPH, RECEIPT_ICON } from '../state/copy';
import type { Match, Receipt, Run, ScreenProps } from '../state/types';

interface ReturnScreenProps extends ScreenProps {
  run?: Run;
  matches: Match[];
  receipts: Receipt[];
  onReview: (conversationId: string) => void;
}

/** The recap is a ranked list of who to meet and why. */
export function ReturnScreen({ go, run, matches, receipts, onReview }: ReturnScreenProps) {
  return (
    <div className="screen">
      <TopBar title="Your return" step="06 / 08" onBack={() => go('roaming')} />
      <div className="content">
        <div className="recap-hero">
          <div className="eyebrow">While you were gone</div>
          <h1>
            {matches.length > 0
              ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} worth meeting.`
              : 'Your Echo came home empty handed.'}
          </h1>
          <p>{run?.goal ?? ''}</p>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <strong>{run?.placesVisited ?? 0}</strong>
            <span>places visited</span>
          </div>
          <div className="stat-card">
            <strong>{run?.peopleMet ?? 0}</strong>
            <span>Echoes met</span>
          </div>
          <div className="stat-card">
            <strong>{run?.creditsSpent ?? 0}</strong>
            <span>AI credits</span>
          </div>
        </div>

        {matches.length > 0 ? (
          <>
            <div className="setting-head">
              <strong>Who to meet</strong>
              <span>Best match first</span>
            </div>
            <div className="match-list">
              {matches.map(match => (
                <div className="match" key={match.conversationId}>
                  <div className="match-top">
                    <span
                      className="host-avatar"
                      style={{ background: AVATAR_COLOUR[match.avatar] ?? '#f4b857' }}
                      aria-hidden="true"
                    >
                      {AVATAR_GLYPH[match.avatar] ?? '●'}
                    </span>
                    <div className="match-name">
                      <strong>
                        {match.name}
                        {match.isHost ? <span className="host-tag">your host</span> : null}
                      </strong>
                      <small>{match.placeName}</small>
                    </div>
                    <b className="match-score tabular">{match.score}</b>
                  </div>
                  <div className="score-bar" aria-label={`Match score ${match.score} of 100`}>
                    <i style={{ width: `${match.score}%` }} />
                  </div>
                  <p className="match-why">{match.why}</p>
                  <button className="match-review" onClick={() => onReview(match.conversationId)}>
                    Review the conversation →
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="lede">
            Nobody matched this time. Change the intent, or send the link to one more person.
          </p>
        )}

        <div className="setting-head">
          <strong>Action receipts</strong>
          <span>Everything is inspectable</span>
        </div>
        <div className="timeline">
          {receipts.map(receipt => (
            <div className="event" key={receipt.id}>
              <div className="event-icon" aria-hidden="true">
                {RECEIPT_ICON[receipt.kind] ?? '·'}
              </div>
              <div>
                <strong>{receipt.text}</strong>
                <span>{receipt.placeName}</span>
              </div>
              <b className="event-cost">{receipt.creditCost} cr</b>
            </div>
          ))}
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go('world')}>
          Back to the city <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
