import { useState } from 'react';
import { replayTour, tourAvailable } from '../tour/useTour';
import { MapSlot, type EventPin, type PinKind } from '../components/MapSlot';
import { ShareCard } from '../components/ShareCard';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ProfileButton } from '../components/ProfileButton';
import type { AgentSpec } from '../map/BengaluruMap';
import { landmarkById } from '../data/landmarks';
import { useMounted } from '../state/useMounted';
import { dayLabel } from './EventsScreen';
import { nearestLandmark } from '../state/select';
import type { HostCard, Player, Run, ScreenName, ScreenProps } from '../state/types';

interface WorldScreenProps extends ScreenProps {
  /** Opens the Start page (the old Limits screen). */
  onAdjustLimits: () => void;
  onJoinEvent: (eventId: string, title: string, from: ScreenName) => void;
  onTalks: () => void;
  hostCard?: HostCard;
  player?: Player;
  run?: Run;
  agents: AgentSpec[];
  intent: string;
  shareId: string;
  mission: string;
  onlineCount: number;
  /** Echoes joined per event id, and the ids this player joined. */
  eventCounts: Record<string, number>;
  myEvents: Set<string>;
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
  onJoinEvent,
  onTalks,
  hostCard,
  player,
  run,
  agents,
  intent,
  shareId,
  mission,
  onlineCount,
  eventCounts,
  myEvents,
  onProfile,
}: WorldScreenProps) {
  const mounted = useMounted();
  const [filter, setFilter] = useState<keyof typeof PIN_FILTERS>('Echoes');
  // What and where, for the event pin last tapped.
  const [eventPin, setEventPin] = useState<EventPin | null>(null);
  // "Watch it roam" follows my Echoe on this map; the status page is for pausing and coming home.
  const [follow, setFollow] = useState(1); // follow my Echoe from the first frame
  const placeName = player ? landmarkById(player.currentPlace)?.name ?? '—' : '—';
  // HostCard exposes no live/online field, so approximate "host is home" using
  // this run's own state: still walking only while the run is running and
  // hasn't reached the host yet. A `live` field on HostCard (set in App.tsx
  // from the host's own run) would let this reflect the host directly.
  const hostLive = run?.status === 'running' && !run?.hostMet;
  const justArrived = !run || (run.peopleMet === 0 && run.placesVisited === 0);
  // No run, or a finished one, means the sheet is a launcher, not a controller.
  const live = Boolean(run) && run?.status !== 'ended';

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
          <button
            className="pin-pill glass events-btn"
            onClick={() => go('events')}
          >
            Events
          </button>
          {tourAvailable() ? (
            <button
              className="icon-btn tour-help"
              data-tour="topbar-help"
              onClick={() => void replayTour()}
              aria-label="Replay the tour for this screen"
            >
              ?
            </button>
          ) : null}
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
            <p className="event-where">
              <strong>{eventCounts[eventPin.id] ?? 0}</strong>{' '}
              {(eventCounts[eventPin.id] ?? 0) === 1 ? 'Echoe has' : 'Echoes have'} joined
            </p>
            <div className="event-actions">
              {myEvents.has(eventPin.id) ? (
                <button className="share-btn" onClick={() => actions.onLeaveEvent(eventPin.id)}>
                  Joined ✓
                </button>
              ) : (
                <button
                  className="handoff-btn"
                  onClick={() => onJoinEvent(eventPin.id, eventPin.title, 'world')}
                >
                  Join with my Echoe
                </button>
              )}
              {nearestLandmark(eventPin.lat, eventPin.lng).km <= 6 ? (
                <button
                  className="share-btn"
                  onClick={() => { actions.onTravel(nearestLandmark(eventPin.lat, eventPin.lng).id); setEventPin(null); }}
                >
                  Send my Echoe
                </button>
              ) : null}
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
            {live ? (
              <span className="credit-pill">
                {run?.placesVisited ?? 0} places · {run?.peopleMet ?? 0} people
              </span>
            ) : null}
          </div>

          {live && justArrived ? (
            <p className="connect-status">
              Your Echoe is out. It walks the city, talks to other Echoes, and comes back with
              names. Follow it, or come back in three minutes.
            </p>
          ) : null}

          {hostCard ? (
            <ShareCard intent={intent} shareId={shareId} variant="inline" />
          ) : null}

          {live ? (
            <div className={run?.status === 'paused' ? 'sheet-cta sheet-cta--three' : 'sheet-cta'}>
              <button className="handoff-btn" onClick={() => setFollow(n => n + 1)}>
                {hostCard ? 'Watch them meet →' : 'Watch it roam →'}
              </button>
              {run?.status === 'paused' ? (
                <>
                  <button className="ghost-btn" onClick={() => actions.onResume()}>
                    Resume
                  </button>
                  <button className="ghost-btn ghost-btn--small" onClick={() => actions.onEndRun()}>
                    Stop
                  </button>
                </>
              ) : (
                <button className="ghost-btn" onClick={() => actions.onPause()}>
                  Pause
                </button>
              )}
            </div>
          ) : (
            <div className={run?.status === 'ended' ? 'sheet-cta' : 'sheet-cta sheet-cta--one'}>
              <button className="handoff-btn" onClick={onAdjustLimits}>
                Start
              </button>
              {/* A finished run has a recap, and this is the only way back to it
                  after a refresh (audit C2). */}
              {run?.status === 'ended' ? (
                <button className="ghost-btn" onClick={() => go('return')}>
                  See who it met
                </button>
              ) : null}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
