import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { nearestLandmark } from '../state/select';
import type { ScreenName, ScreenProps } from '../state/types';

interface EventRow {
  id: string;
  title: string;
  host: string;
  category: 'company' | 'trip' | 'date' | 'meetup';
  date: string;
  time: string;
  venue: string;
  area: string;
  lat: number;
  lng: number;
  approx: boolean;
  image?: string;
  brand?: { font: string; bg: string; fg: string };
  url: string;
  price: string;
  summary: string;
}

// The seed file lands later; glob keeps the build green until it does.
const EVENTS: EventRow[] = Object.values(
  import.meta.glob('../data/events.json', { eager: true, import: 'default' }),
).flat() as EventRow[];

const FILTERS: Record<string, EventRow['category'] | 'all'> = {
  All: 'all',
  'Company events': 'company',
  Trips: 'trip',
  Dates: 'date',
  Meetups: 'meetup',
};

const GLYPH: Record<EventRow['category'], string> = {
  company: '🏢',
  trip: '🚌',
  date: '🌹',
  meetup: '👥',
};

/** "Sat 6 Sep" from a YYYY-MM-DD string. */
export const dayLabel = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const isFree = (price: string) => /free/i.test(price.trim()) || price.trim() === '';

interface EventsScreenProps extends ScreenProps {
  backTo: ScreenName;
  onJoinEvent: (eventId: string, title: string, from: ScreenName) => void;
  /** Echoes joined per event id, and the ids this player joined. */
  eventCounts: Record<string, number>;
  myEvents: Set<string>;
}

export function EventsScreen({ actions, go, backTo, onJoinEvent, eventCounts, myEvents }: EventsScreenProps) {
  const [filter, setFilter] = useState('All');

  const wanted = FILTERS[filter];
  const shown = EVENTS.filter(e => wanted === 'all' || e.category === wanted).sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );

  const days = [...new Set(shown.map(e => e.date))];

  return (
    <div className="screen">
      <TopBar title="Events in Bengaluru" onBack={() => go(backTo)} />

      <div className="content">
        <div className="pin-filter events-filter">
          {Object.keys(FILTERS).map(name => (
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

        {shown.length === 0 ? (
          <p className="profile-empty">No events yet</p>
        ) : (
          days.map(day => (
            <div key={day}>
              <h3 className="profile-heading">{dayLabel(day)}</h3>
              {shown
                .filter(e => e.date === day)
                .map(event => {
                  const joined = eventCounts[event.id] ?? 0;
                  const mine = myEvents.has(event.id);
                  const near = nearestLandmark(event.lat, event.lng);
                  const reachable = near.km <= 6;
                  return (
                    <div className="event-card glass" key={event.id}>
                      {event.image ? (
                        <img className="event-hero" src={event.image} alt="" loading="lazy" />
                      ) : null}
                      <div className="event-top">
                        <span className="event-glyph" aria-hidden="true">
                          {GLYPH[event.category]}
                        </span>
                        <div className="event-head">
                          <strong style={event.brand ? { fontFamily: event.brand.font } : undefined}>
                            {event.title}
                          </strong>
                          <small>{event.host}</small>
                        </div>
                        <span className={isFree(event.price) ? 'price-chip free' : 'price-chip'}>
                          {isFree(event.price) ? 'Free' : event.price}
                        </span>
                      </div>

                      <p className="event-where">
                        {event.time} · {event.venue}, {event.area}
                      </p>
                      {event.summary ? <p className="event-summary">{event.summary}</p> : null}

                      <p className="event-where">
                        <strong>{joined}</strong> {joined === 1 ? 'Echoe has' : 'Echoes have'} joined
                      </p>
                      <div className="event-actions">
                        <a
                          className="share-btn"
                          href={event.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Open
                        </a>
                        <button
                          className="share-btn share-btn--main"
                          onClick={() =>
                            mine ? actions.onLeaveEvent(event.id) : onJoinEvent(event.id, event.title, 'events')
                          }
                          aria-pressed={mine}
                        >
                          {mine ? 'Joined ✓' : 'Join with my Echoe'}
                        </button>
                        {reachable ? (
                          <button className="share-btn" onClick={() => actions.onTravel(near.id)}>
                            Send my Echoe
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))
        )}
      </div>

      <div className="footer">
        <button className="primary" onClick={() => go('world')}>
          Enter Bengaluru <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
