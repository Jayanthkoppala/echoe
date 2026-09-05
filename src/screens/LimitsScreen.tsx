import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import type { Run, ScreenName, ScreenProps } from '../state/types';

interface LimitsScreenProps extends ScreenProps {
  run?: Run;
  /** Limits edits a live run now, so it returns to whoever opened it. */
  backTo: ScreenName;
}

export function LimitsScreen({ actions, go, run, backTo }: LimitsScreenProps) {
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

        <div className="cost-note">
          <span aria-hidden="true">✦</span>
          <span>Only talking costs anything, and it costs exactly what OpenRouter charges.</span>
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
