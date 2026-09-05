import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { eventBuildPrompt } from '../state/copy';
import type { ScreenName, ScreenProps } from '../state/types';

interface JoinEventScreenProps extends ScreenProps {
  eventId: string;
  eventTitle: string;
  backTo: ScreenName;
}

/**
 * Joining an event asks what you are building (the Echoe leads with it), one
 * line on what you want from the event, plus one or two links it never sees.
 * At least one link is required; they go to a private table and only a mutual
 * Reveal shows them.
 */
export function JoinEventScreen({ actions, go, eventId, eventTitle, backTo }: JoinEventScreenProps) {
  const [building, setBuilding] = useState('');
  const [goal, setGoal] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const ready = Boolean(building.trim() && goal.trim() && (linkedin.trim() || twitter.trim()));
  const prompt = eventBuildPrompt(eventTitle);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard can be blocked in embedded browsers; the text stays on screen.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="screen">
      <TopBar title={eventTitle} onBack={() => go(backTo)} />
      <div className="content content--close">
        <label className="label" htmlFor="event-building">
          What are you building?
        </label>
        <textarea
          className="textarea"
          id="event-building"
          value={building}
          onChange={event => setBuilding(event.target.value)}
          placeholder="Paste the 800 to 1200 words your coding agent wrote about it, or write it yourself: what it is, who it is for, what works today, what you are stuck on."
          maxLength={9000}
          autoFocus
        />
        <p className="helper helper--tight">
          Your Echoe leads with this at the event and asks everyone what they are building back. Long is right here.{' '}
          <button className="link-btn" type="button" onClick={() => setShowPrompt(open => !open)}>
            {showPrompt ? 'Hide prompt' : 'Get a prompt'}
          </button>
        </p>
        {showPrompt ? (
          <div className="prompt-card glass">
            <p className="prompt-text">{prompt}</p>
            <button className="copy-btn" type="button" onClick={copyPrompt}>
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
        ) : null}

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
        />
        <p className="helper helper--tight">
          Your Echoe opens every conversation at this event with this.
        </p>

        <label className="label" htmlFor="event-linkedin">
          Your LinkedIn link
        </label>
        <p className="helper helper--tight">One link is enough, LinkedIn or X.</p>
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
            actions.onJoinEvent(eventId, goal.trim(), linkedin.trim(), twitter.trim(), building.trim());
            go(backTo);
          }}
        >
          Join with my Echoe
        </button>
      </div>
    </div>
  );
}
