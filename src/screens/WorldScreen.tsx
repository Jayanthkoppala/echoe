import { MapSlot } from '../components/MapSlot';
import { ShareCard } from '../components/ShareCard';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ProfileButton } from '../components/ProfileButton';
import type { AgentSpec } from '../map/BengaluruMap';
import { landmarkById } from '../data/landmarks';
import { useMounted } from '../state/useMounted';
import type { HostCard, Player, Run, ScreenProps } from '../state/types';

interface WorldScreenProps extends ScreenProps {
  onAdjustLimits: () => void;
  hostCard?: HostCard;
  player?: Player;
  run?: Run;
  agents: AgentSpec[];
  intent: string;
  shareId: string;
  mission: string;
  onlineCount: number;
  onProfile: () => void;
}

/**
 * The map is full bleed and every control floats over it in glass.
 * A host sees the share card pinned on top; a visitor sees the walk status
 * there instead and the share card drops into the sheet (UX-ORDER decision 3).
 */
export function WorldScreen({
  actions,
  go,
  onAdjustLimits,
  hostCard,
  player,
  run,
  agents,
  intent,
  shareId,
  mission,
  onlineCount,
  onProfile,
}: WorldScreenProps) {
  const mounted = useMounted();
  const placeName = player ? landmarkById(player.currentPlace)?.name ?? '—' : '—';

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot
          agents={agents}
          activePlaceId={player?.currentPlace}
          onPlaceTap={actions.onTravel}
        />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Bengaluru
          </div>
          <span className="step-count">{onlineCount} online</span>
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? 'circle'}
            onClick={onProfile}
          />
        </header>

        {hostCard ? (
          <div className="walk-strip glass">
            <div>
              <span className="k">Right now</span>
              <div className="v">Your Echoe is walking to {hostCard.name}</div>
            </div>
          </div>
        ) : (
          <ShareCard intent={intent} shareId={shareId} mission={mission} variant="pinned" />
        )}

        <div className={mounted ? 'map-sheet glass map-sheet--in' : 'map-sheet glass'}>
          <div className="sheet-head">
            <div>
              <small>You are at</small>
              <h3 className="location-name">{placeName}</h3>
              <VerifiedBadge badge={player?.badge} />
            </div>
            <span className="credit-pill">
              {run?.peopleMet ?? 0} {(run?.peopleMet ?? 0) === 1 ? 'person' : 'people'} met
            </span>
          </div>

          {hostCard ? (
            <ShareCard intent={intent} shareId={shareId} variant="inline" />
          ) : null}

          <div className="sheet-cta">
            <button className="handoff-btn" onClick={() => go('roaming')}>
              {hostCard ? 'Watch them meet →' : 'Watch it roam →'}
            </button>
            <button className="ghost-btn" onClick={onAdjustLimits}>
              Adjust limits
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
