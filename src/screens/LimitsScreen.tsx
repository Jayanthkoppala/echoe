import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { FREE_CONVERSATIONS } from '../state/copy';
import type { Run, ScreenName, ScreenProps } from '../state/types';

interface LimitsScreenProps extends ScreenProps {
  run?: Run;
  /** Limits edits a live run now, so it returns to whoever opened it. */
  backTo: ScreenName;
  freeLeft: number;
  linked: boolean;
}

export function LimitsScreen({ actions, go, run, backTo, freeLeft, linked }: LimitsScreenProps) {
  const [goal, setGoal] = useState(run?.goal ?? '');

  return (
    <div className="screen">
      <TopBar title="Adjust limits" onBack={() => go(backTo)} />
      <div className="content">
        <div className="eyebrow">You stay in control</div>
        <h2>What can it do without you?</h2>
        <p className="lede">
          Every line your Echoe says is billed in real OpenRouter credits and shows up on
          your receipts. Saving restarts the run with these settings.
        </p>

        <label className="label" htmlFor="goal">
          Goal for this run
        </label>
        <input
          className="input"
          id="goal"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          placeholder="Find one person worth a coffee"
          maxLength={120}
        />

        <div className="label">Your OpenRouter account</div>
        {linked ? (
          <button className="secondary" onClick={() => actions.onUnlinkOpenRouter()}>
            OpenRouter connected. Disconnect
          </button>
        ) : (
          <button className="secondary" onClick={() => actions.onLinkOpenRouter()}>
            Connect OpenRouter
          </button>
        )}

        <div className="cost-note">
          <span aria-hidden="true">✦</span>
          <span>
            {freeLeft} of {FREE_CONVERSATIONS} free conversations left, on us. After that your
            Echoe talks on your OpenRouter account, at exactly what OpenRouter charges. You sign
            in once; no key to paste.
          </span>
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!goal.trim()}
          onClick={() =>
            actions.onStartRun({
              goal: goal.trim(),
            })
          }
        >
          Save and restart the run <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={() => go(backTo)}>
          Leave it as it is
        </button>
      </div>
    </div>
  );
}
