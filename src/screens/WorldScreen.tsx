import { useState } from 'react';
import { MapSlot, type EventPin, type PinKind } from '../components/MapSlot';
import { ShareCard } from '../components/ShareCard';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ProfileButton } from '../components/ProfileButton';
import type { AgentSpec } from '../map/BengaluruMap';
import { landmarkById } from '../data/landmarks';
import { useMounted } from '../state/useMounted';
import { dayLabel } from './EventsScreen';
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
// "Echoes" is the room itself: live Echoes only, no company pins. There is no "All".
const PIN_FILTERS: Record<string, PinKind[]> = {
  Echoes: [],
  Startups: ['startup'],
  VCs: ['vc'],
  Places: ['place'],
  Events: ['event'],
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
  const [filter, setFilter] = useState<keyof typeof PIN_FILTERS>('Echoes');
  // What and where, for the event pin last tapped.
  const [eventPin, setEventPin] = useState<EventPin | null>(null);
  // "Watch it roam" follows my Echoe on this map; the status page is for pausing and coming home.
  const [follow, setFollow] = useState(0);
  const placeName = player ? landmarkById(player.currentPlace)?.name ?? '—' : '—';
  // HostCard exposes no live/online field, so approximate "host is home" using
  // this run's own state: still walking only while the run is running and
  // hasn't reached the host yet. A `live` field on HostCard (set in App.tsx
  // from the host's own run) would let this reflect the host directly.
  const hostLive = run?.status === 'running' && !run?.hostMet;
  const justArrived = !run || (run.peopleMet === 0 && run.placesVisited === 0);

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot
          agents={agents}
          pinKinds={PIN_FILTERS[filter]}
          followMine={follow}
          activePlaceId={player?.currentPlace}
          onPlaceTap={actions.onTravel}
          onEventTap={setEventPin}
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
              <div className="v">
                {hostLive
                  ? `Your Echoe is walking to ${hostCard.name}`
                  : `${hostCard.name} is home right now; your Echoe will meet others and try again`}
              </div>
            </div>
          </div>
        ) : (
          <ShareCard intent={intent} shareId={shareId} mission={mission} variant="pinned" />
        )}
        <button className="talks-fab glass" onClick={onTalks} aria-label="Conversations" title="Conversations">
          💬
        </button>

        <div className="map-bottom">
        {eventPin ? (
          <div className="event-card glass">
            <div className="event-top">
              <span className="event-glyph" aria-hidden="true">📍</span>
              <div className="event-head">
                <strong>{eventPin.title}</strong>
                <small>{eventPin.host}</small>
              </div>
              <button className="price-chip" onClick={() => setEventPin(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="event-where">
              {dayLabel(eventPin.date)} · {eventPin.time}
            </p>
            <p className="event-where">
              {eventPin.venue}
              {eventPin.address ? `, ${eventPin.address}` : `, ${eventPin.area}`}
              {eventPin.approx ? ' (area only)' : ''}
            </p>
            <div className="event-actions">
              <a className="share-btn" href={eventPin.url} target="_blank" rel="noreferrer noopener">
                Open
              </a>
            </div>
          </div>
        ) : null}
        <div className="pin-filter">
          {Object.keys(PIN_FILTERS).map(name => (
            <button
              key={name}
              className={name === filter ? 'pin-pill glass on' : 'pin-pill glass'}
              onClick={() => { setFilter(name); setEventPin(null); }}
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

          {justArrived ? (
            <p className="connect-status">
              Your Echoe is out. It walks the city, talks to other Echoes, and comes back with
              names. Follow it, or come back in three minutes.
            </p>
          ) : null}

          {hostCard ? (
            <ShareCard intent={intent} shareId={shareId} variant="inline" />
          ) : null}

          <div className="sheet-cta">
            <button className="handoff-btn" onClick={() => setFollow(n => n + 1)}>
              {hostCard ? 'Watch them meet →' : 'Watch it roam →'}
            </button>
            <button className="ghost-btn" onClick={onAdjustLimits}>
              Adjust limits
            </button>
            {run && run.status !== 'ended' ? (
              <button
                className="ghost-btn"
                onClick={() => {
                  actions.onPause();
                  go('roaming');
                }}
              >
                {run.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
