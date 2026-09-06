import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { eventBuildPrompt } from '../state/copy';
import type { ScreenName, ScreenProps } from '../state/types';

interface JoinEventScreenProps extends ScreenProps {
  eventId: string;
  eventTitle: string;
  backTo: ScreenName;
  /** My `event_build` text for this event, when a coding agent already wrote one. */
  initialBuilding?: string;
  /** Echoes already in the room, for the state after joining. */
  joinedCount: number;
}

/**
 * Says where a field's text came from. Only what you are building has an agent
 * source (`event_build`), so nothing else can ever be lime here: the goal and
 * the links are the player's part.
 */
function FieldChip({ written, empty }: { written: boolean; empty: boolean }) {
  if (written) return <span className="field-chip written">Written by your agent</span>;
  if (empty) return <span className="field-chip needed">Still needed</span>;
  return null;
}

/**
 * Joining an event asks what you are building (the Echoe leads with it), one
 * line on what you want from the event, plus one or two links it never sees.
 * At least one link is required; they go to a private table and only a mutual
 * Reveal shows them.
 */
export function JoinEventScreen({
  actions,
  go,
  eventId,
  eventTitle,
  backTo,
  initialBuilding,
  joinedCount,
}: JoinEventScreenProps) {
  // An agent-written event_build row, when one already exists, shows up ready to submit.
  const [building, setBuilding] = useState(initialBuilding ?? '');
  const [goal, setGoal] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const agentWrote = Boolean(initialBuilding?.trim());

  // The room is where the point is, so do not leave anyone parked on a receipt.
  // Pressing back unmounts this screen, which clears the timer.
  useEffect(() => {
    if (!joined) return;
    const timer = setTimeout(() => go('talks'), 3000);
    return () => clearTimeout(timer);
  }, [joined, go]);
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

  if (joined) {
    return (
      <div className="screen">
        <TopBar title={eventTitle} onBack={() => go(backTo)} />
        <div className="content joined-state">
          <h2 className="joined-title">You’re in.</h2>
          <p className="joined-count">
            <strong>{joinedCount}</strong> {joinedCount === 1 ? 'Echoe' : 'Echoes'} at {eventTitle}
          </p>
        </div>
        <div className="footer">
          <button className="primary" onClick={() => go('talks')}>
            Go to messages <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title={eventTitle} onBack={() => go(backTo)} />
      <div className="content content--close">
        {agentWrote ? (
          <p className="lede">
            Your agent wrote what you are building. Add what you want from tonight and your links,
            then join.
          </p>
        ) : null}
        <label className="label" htmlFor="event-building">
          What are you building? <FieldChip written={agentWrote && Boolean(building.trim())} empty={!building.trim()} />
        </label>
        <textarea
          className="textarea"
          id="event-building"
          data-tour="joinevent-building"
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
          What do you want from this event? <FieldChip written={false} empty={!goal.trim()} />
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
          Your LinkedIn link <FieldChip written={false} empty={!linkedin.trim()} />
        </label>
        <input
          className="input"
          id="event-linkedin"
          data-tour="joinevent-links"
          value={linkedin}
          onChange={event => setLinkedin(event.target.value)}
          placeholder="linkedin.com/in/you"
          inputMode="url"
          autoComplete="off"
        />

        <label className="label" htmlFor="event-twitter">
          Your Twitter (X) link <FieldChip written={false} empty={!twitter.trim()} />
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
          One link is enough, LinkedIn or X. Shown to one person only when you both tap Reveal on
          a conversation. Your Echoe never sees them.
        </p>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!ready}
          onClick={() => {
            actions.onJoinEvent(
              eventId,
              goal.trim(),
              linkedin.trim(),
              twitter.trim(),
              building.trim(),
              () => setJoined(true),
            );
          }}
        >
          Join with my Echoe
        </button>
      </div>
    </div>
  );
}
