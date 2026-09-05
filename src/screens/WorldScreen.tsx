import { useState } from 'react';
import { MapSlot, type PinKind } from '../components/MapSlot';
import { ShareCard } from '../components/ShareCard';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ProfileButton } from '../components/ProfileButton';
import type { AgentSpec } from '../map/BengaluruMap';
import { landmarkById } from '../data/landmarks';
import { useMounted } from '../state/useMounted';
import type { HostCard, Player, Run, ScreenProps } from '../state/types';

interface WorldScreenProps extends ScreenProps {
  onAdjustLimits: () => void;
  onTalks: () => void;
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
const PIN_FILTERS: Record<string, PinKind[]> = {
  All: ['startup', 'vc', 'spot', 'place'],
  Startups: ['startup'],
  VCs: ['vc'],
  Places: ['place'],
  Pubs: ['spot'],
};

export function WorldScreen({
  actions,
  go,
  onAdjustLimits,
  onTalks,
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
  const [filter, setFilter] = useState<keyof typeof PIN_FILTERS>('All');
  const placeName = player ? landmarkById(player.currentPlace)?.name ?? '—' : '—';

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot
          agents={agents}
          pinKinds={PIN_FILTERS[filter]}
          activePlaceId={player?.currentPlace}
          onPlaceTap={actions.onTravel}
        />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Bengaluru
          </div>
          <span className="step-count">{onlineCount} online</span>
          <button className="pin-pill glass events-btn" onClick={() => go('events')}>
            Events
          </button>
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? ''}
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
        <button className="talks-fab glass" onClick={onTalks} aria-label="Conversations" title="Conversations">
          💬
        </button>

        <div className="map-bottom">
        <div className="pin-filter">
          {Object.keys(PIN_FILTERS).map(name => (
            <button
              key={name}
              className={name === filter ? 'pin-pill glass on' : 'pin-pill glass'}
              onClick={() => setFilter(name)}
              aria-pressed={name === filter}
            >
              {name}
            </button>
          ))}
        </div>

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
    </div>
  );
}
