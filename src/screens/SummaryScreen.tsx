import { TopBar } from '../components/TopBar';
import { ProfileButton } from '../components/ProfileButton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { avatarUri } from '../state/copy';
import type { ConversationSummary, Match, Player, RubricScores, ScreenProps } from '../state/types';

interface SummaryScreenProps extends ScreenProps {
  /** Missing while the module is still writing my side of the summary. */
  summary?: ConversationSummary;
  match?: Match;
  player?: Player;
  onProfile: () => void;
}

/** The five earned dimensions, in the order the rubric weights them. */
const ROWS: { key: keyof RubricScores; label: string; max: number }[] = [
  { key: 'goalFit', label: 'Fits what I wanted', max: 25 },
  { key: 'personaFit', label: 'Someone I would get on with', max: 20 },
  { key: 'depth', label: 'Depth, not filler', max: 20 },
  { key: 'reciprocity', label: 'Both sides gave', max: 15 },
  { key: 'nextStep', label: 'A real next step', max: 10 },
];

/**
 * One rubric dimension. The bar is the mark: a 6px track, a fill anchored to the
 * baseline, and the number direct-labelled, so the row reads without a legend.
 */
function RubricRow({ label, value, max, tone }: { label: string; value: number; max: number; tone?: 'avoid' }) {
  const clamped = Math.max(0, Math.min(max, value));
  return (
    <div className={tone ? 'rubric-row rubric-row--avoid' : 'rubric-row'}>
      <span className="rubric-label">{label}</span>
      <b className="rubric-value tabular">
        {clamped}
        <small>/{max}</small>
      </b>
      <span
        className="rubric-track"
        role="img"
        aria-label={`${label}: ${clamped} out of ${max}`}
      >
        <span className="rubric-fill" style={{ width: `${max === 0 ? 0 : (clamped / max) * 100}%` }} />
      </span>
    </div>
  );
}

export function SummaryScreen({ go, summary, match, player, onProfile }: SummaryScreenProps) {
  const scores = summary?.scores;
  // avoidPenalty arrives as 0..-20; the row shows how much they matched the
  // avoid line, so it is drawn positive. Math.abs survives either sign.
  const avoid = Math.abs(scores?.avoidPenalty ?? 0);

  return (
    <div className="screen">
      <TopBar
        title="Summary"
        onBack={() => go('review')}
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
              {match ? `${match.name}'s Echoe` : 'Echoe conversation'}
              <VerifiedBadge badge={match?.badge} compact />
            </strong>
            <span>{match?.placeName ?? ''}</span>
          </div>
        </div>

        {!summary ? (
          <section className="profile-card glass">
            <p className="profile-empty">
              The summary is still being written. It lands a moment after the talk closes.
            </p>
          </section>
        ) : (
          <>
            <section className="summary-hero glass">
              <b className={summary.match >= 70 ? 'summary-score tabular summary-score--hot' : 'summary-score tabular'}>
                {summary.match}
              </b>
              <span>match out of 100</span>
            </section>

            {summary.summary ? (
              <section className="profile-card glass">
                <p className="summary-text">{summary.summary}</p>
              </section>
            ) : null}

            <h3 className="profile-heading">How it scored</h3>
            <section className="profile-card glass">
              {ROWS.map(row => (
                <RubricRow key={row.key} label={row.label} value={scores?.[row.key] ?? 0} max={row.max} />
              ))}
              <RubricRow label="Avoid match" value={avoid} max={20} tone="avoid" />
            </section>

            <h3 className="profile-heading">
              What your Echoe should do differently
              <span className="tabular">{summary.corrective}/100</span>
            </h3>
            <section className="profile-card glass">
              {summary.correctiveNotes.length === 0 ? (
                <p className="profile-empty">Nothing to correct. It spoke the way you would have.</p>
              ) : (
                <ul className="profile-notes">
                  {summary.correctiveNotes.map(note => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      <div className="footer">
        <button className="secondary" onClick={() => go('review')}>
          Back to the conversation
        </button>
      </div>
    </div>
  );
}
