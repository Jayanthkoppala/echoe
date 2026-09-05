import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import type { ScreenName, ScreenProps } from '../state/types';

interface JoinEventScreenProps extends ScreenProps {
  eventId: string;
  eventTitle: string;
  backTo: ScreenName;
}

/**
 * Joining an event asks for one line the Echoe opens with, plus the two links
 * it never sees. The links go to a private table; only a mutual Reveal shows them.
 */
export function JoinEventScreen({ actions, go, eventId, eventTitle, backTo }: JoinEventScreenProps) {
  const [goal, setGoal] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const ready = Boolean(goal.trim() && linkedin.trim() && twitter.trim());

  return (
    <div className="screen">
      <TopBar title={eventTitle} onBack={() => go(backTo)} />
      <div className="content content--close">
        <label className="label" htmlFor="event-goal">
          What do you want from this event?
        </label>
        <textarea
          className="textarea textarea--line"
          id="event-goal"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          placeholder="meet two people building payments infra who want a design partner"
          maxLength={160}
          autoFocus
        />
        <p className="helper helper--tight">
          Your Echoe opens every conversation at this event with this.
        </p>

        <label className="label" htmlFor="event-linkedin">
          Your LinkedIn link
        </label>
        <input
          className="input"
          id="event-linkedin"
          value={linkedin}
          onChange={event => setLinkedin(event.target.value)}
          placeholder="linkedin.com/in/you"
          inputMode="url"
          autoComplete="off"
        />

        <label className="label" htmlFor="event-twitter">
          Your Twitter (X) link
        </label>
        <input
          className="input"
          id="event-twitter"
          value={twitter}
          onChange={event => setTwitter(event.target.value)}
          placeholder="x.com/you"
          inputMode="url"
          autoComplete="off"
        />
        <p className="helper helper--tight">
          Shown to one person only when you both tap Reveal on a conversation. Your Echoe never
          sees them.
        </p>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!ready}
          onClick={() => {
            actions.onJoinEvent(eventId, goal.trim(), linkedin.trim(), twitter.trim());
            go(backTo);
          }}
        >
          Join with my Echoe
        </button>
      </div>
    </div>
  );
}
