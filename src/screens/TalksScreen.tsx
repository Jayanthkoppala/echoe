import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { ProfileButton } from '../components/ProfileButton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { avatarUri } from '../state/copy';
import type { JoinedEvent, Match, Player, ScreenProps } from '../state/types';

interface TalksScreenProps extends ScreenProps {
  people: Match[];
  events: JoinedEvent[];
  player?: Player;
  onProfile: () => void;
  onReview: (conversationId: string) => void;
}

/** One conversation, as a row with a Read button. Both tabs draw people this way. */
function PersonRow({ person, onReview }: { person: Match; onReview: (id: string) => void }) {
  return (
    <div className="person-row">
      <span className="host-avatar" aria-hidden="true">
        <img src={avatarUri(person.avatar)} alt="" />
      </span>
      <div className="person-name">
        <strong>{person.name}</strong>
        <VerifiedBadge badge={person.badge} />
        <p>{person.why}</p>
      </div>
      <div className="person-end">
        <b className="match-score tabular">{person.score}</b>
        <button className="link-btn" onClick={() => onReview(person.conversationId)}>
          Read
        </button>
      </div>
    </div>
  );
}

/** Two tabs: every conversation this Echoe has had, and every event this player joined. */
export function TalksScreen({ go, people, events, player, onProfile, onReview }: TalksScreenProps) {
  const [tab, setTab] = useState<'talks' | 'events'>('talks');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openEvent = openKey ? events.find(event => event.key === openKey) : undefined;

  return (
    <div className="screen">
      <TopBar
        title="Talks"
        onBack={() => go('world')}
        right={
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? ''}
            onClick={onProfile}
          />
        }
      />
      <div className="content">
        <div className="pin-filter pin-filter--tabs" role="tablist">
          <button
            role="tab"
            className={tab === 'talks' ? 'pin-pill glass on' : 'pin-pill glass'}
            aria-selected={tab === 'talks'}
            onClick={() => setTab('talks')}
          >
            Conversations
          </button>
          <button
            role="tab"
            className={tab === 'events' ? 'pin-pill glass on' : 'pin-pill glass'}
            aria-selected={tab === 'events'}
            onClick={() => { setTab('events'); setOpenKey(null); }}
          >
            Events
          </button>
        </div>
        {tab === 'events' ? (
          openEvent ? (
            <>
              <h3 className="profile-heading">
                <button
                  className="heading-back"
                  aria-label="Back to events"
                  onClick={() => setOpenKey(null)}
                >
                  ‹
                </button>
                {openEvent.name} <span>{openEvent.people.length} talked</span>
              </h3>
              <section className="profile-card glass">
                {openEvent.people.length === 0 ? (
                  <p className="profile-empty">
                    Your Echoe has not talked to anyone here yet. It starts as people join.
                  </p>
                ) : (
                  openEvent.people.map(person => (
                    <PersonRow key={person.conversationId} person={person} onReview={onReview} />
                  ))
                )}
              </section>
            </>
          ) : (
            <>
              <h3 className="profile-heading">
                Events <span>{events.length}</span>
              </h3>
              <section className="profile-card glass">
                {events.length === 0 ? (
                  <p className="profile-empty">
                    No events yet. Join one from the map and your Echoe starts talking to whoever
                    else is there.
                  </p>
                ) : (
                  events.map(event => (
                    <button
                      className="person-row person-row--tap"
                      key={event.key}
                      onClick={() => setOpenKey(event.key)}
                    >
                      <span className="host-avatar" aria-hidden="true">
                        👥
                      </span>
                      <div className="person-name">
                        <strong>{event.name}</strong>
                        <p>
                          {[event.venue, event.date].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="person-end">
                        <span className="event-counts">
                          {event.joined} joined · {event.people.length} talked
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </section>
            </>
          )
        ) : (
        <>
        <h3 className="profile-heading">
          Conversations <span>{people.length}</span>
        </h3>
        <section className="profile-card glass">
          {people.length === 0 ? (
            <p className="profile-empty">Nothing yet. Send your Echoe out and it will start talking.</p>
          ) : (
            people.map(person => (
              <div className="person-row" key={person.conversationId}>
                <span
                  className="host-avatar"
                  aria-hidden="true"
                >
                  <img src={avatarUri(person.avatar)} alt="" />
                </span>
                <div className="person-name">
                  <strong>{person.name}</strong>
                  <VerifiedBadge badge={person.badge} />
                  <p>{person.placeName ? `${person.placeName} · ` : ''}{person.why}</p>
                </div>
                <div className="person-end">
                  <b className="match-score tabular">{person.score}</b>
                  <button className="link-btn" onClick={() => onReview(person.conversationId)}>
                    Read
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
        </>
        )}
      </div>
    </div>
  );
}
