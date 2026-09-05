import { useState } from 'react';
import { ShareCard } from '../components/ShareCard';
import { ProfileButton } from '../components/ProfileButton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { VerifySheet } from '../components/VerifySheet';
import { TopBar } from '../components/TopBar';
import { AVATAR_COLOUR, AVATAR_GLYPH, RECEIPT_ICON, usd } from '../state/copy';
import { useMounted } from '../state/useMounted';
import type { Badge, Match, Player, Receipt, Run, ScreenProps } from '../state/types';

interface ReturnScreenProps extends ScreenProps {
  run?: Run;
  freeLeft: number;
  matches: Match[];
  receipts: Receipt[];
  intent: string;
  shareId: string;
  /** My own badge, so the verify prompt disappears once it exists. */
  badge?: Badge;
  player?: Player;
  onProfile: () => void;
  onReview: (conversationId: string) => void;
}

/** The recap is a ranked list of who to meet and why. */
export function ReturnScreen({
  go,
  run,
  freeLeft,
  matches,
  receipts,
  intent,
  shareId,
  badge,
  player,
  onProfile,
  onReview,
}: ReturnScreenProps) {
  const mounted = useMounted();
  const [verifying, setVerifying] = useState(false);

  return (
    <div className="screen">
      <TopBar
        title="Your return"
        onBack={() => go('world')}
        right={
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? 'circle'}
            onClick={onProfile}
          />
        }
      />
      <div className="content">
        <div className="recap-hero glass">
          <div className="eyebrow">While you were gone</div>
          <h1>
            {matches.length > 0
              ? `${matches.length} ${matches.length === 1 ? 'person' : 'people'} worth meeting.`
              : 'Your Echoe came home empty handed.'}
          </h1>
          <p>{run?.goal ?? ''}</p>
        </div>

        <div className="stat-grid">
          <div className="stat-card glass">
            <strong>{run?.placesVisited ?? 0}</strong>
            <span>places visited</span>
          </div>
          <div className="stat-card glass">
            <strong>{run?.peopleMet ?? 0}</strong>
            <span>Echoes met</span>
          </div>
          <div className="stat-card glass">
            <strong>{usd(run?.spentUsd ?? 0)}</strong>
            <span>OpenRouter spend</span>
          </div>
          <div className="stat-card glass">
            <strong>{freeLeft}</strong>
            <span>free talks left</span>
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
                <div className="match glass" key={match.conversationId}>
                  <div className="match-top">
                    <span
                      className="host-avatar"
                      style={{ background: AVATAR_COLOUR[match.avatar] ?? '#d7f06c' }}
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
                      <VerifiedBadge badge={match.badge} />
                    </div>
                    <b className="match-score tabular">
                      {match.score}
                      <small> / 100</small>
                    </b>
                  </div>
                  <div className="score-bar" aria-label={`Match score ${match.score} of 100`}>
                    <i
                      className={mounted ? 'score-fill score-fill--in' : 'score-fill'}
                      style={{ ['--score-pct' as string]: `${match.score}%` }}
                    />
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
            Nobody matched this time. Send your line to one more person and run it again.
          </p>
        )}

        {/* Decision 5: the link comes back here, where a thin list gets fixed. */}
        {badge ? null : (
          <button className="verify-btn" onClick={() => setVerifying(true)}>
            Verify my company
          </button>
        )}

        <ShareCard intent={intent} shareId={shareId} variant="inline" />

        <div className="setting-head" style={{ marginTop: 18 }}>
          <strong>Action receipts</strong>
          <span>Everything is inspectable</span>
        </div>
        <div className="timeline">
          {receipts.map(receipt => (
            <div className="event glass" key={receipt.id}>
              <div className="event-icon" aria-hidden="true">
                {RECEIPT_ICON[receipt.kind] ?? '·'}
              </div>
              <div>
                <strong>{receipt.text}</strong>
                <span>{receipt.placeName}</span>
              </div>
              <b className="event-cost">{receipt.costUsd > 0 ? usd(receipt.costUsd) : 'free'}</b>
            </div>
          ))}
        </div>
        {verifying ? <VerifySheet badge={badge} onClose={() => setVerifying(false)} /> : null}
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go('world')}>
          Back to the city <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
