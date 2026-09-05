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

/** Two tabs: every conversation this Echoe has had, and every event it hosts, walks to or joined. */
export function TalksScreen({ go, people, events, player, onProfile, onReview }: TalksScreenProps) {
  const [tab, setTab] = useState<'talks' | 'events'>('talks');
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
            onClick={() => setTab('events')}
          >
            Events
          </button>
        </div>
        {tab === 'events' ? (
          <>
            <h3 className="profile-heading">
              Events <span>{events.length}</span>
            </h3>
            <section className="profile-card glass">
              {events.length === 0 ? (
                <p className="profile-empty">
                  No events yet. Open someone's event link, or host one from your profile.
                </p>
              ) : (
                events.map(event => (
                  <div className="person-row" key={event.key}>
                    <span className="host-avatar" aria-hidden="true">
                      {event.hostAvatar ? <img src={avatarUri(event.hostAvatar)} alt="" /> : '👥'}
                    </span>
                    <div className="person-name">
                      <strong>{event.name}</strong>
                      <VerifiedBadge badge={event.badge} />
                      <p>
                        {event.status === 'hosting'
                          ? 'You are hosting this. Your share link is the event link.'
                          : event.status === 'walking'
                            ? `Hosted by ${event.hostName}. Your Echoe is walking there.`
                            : `Hosted by ${event.hostName}. Met at ${event.placeName || 'the event'}.`}
                      </p>
                    </div>
                    <div className="person-end">
                      {event.conversationId ? (
                        <button className="link-btn" onClick={() => onReview(event.conversationId!)}>
                          Read
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
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
