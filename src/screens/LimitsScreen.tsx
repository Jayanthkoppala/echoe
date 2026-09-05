import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import type { Run, ScreenProps } from '../state/types';

export function LimitsScreen({ actions, go, run }: ScreenProps & { run: Run }) {
  const [goal, setGoal] = useState('');

  const start = (event: React.FormEvent) => {
    event.preventDefault();
    if (!goal.trim()) return;
    actions.onStartRun({
      goal: goal.trim(),
      maxPeople: run.maxPeople,
      repliesPerPerson: run.repliesPerPerson,
      creditCap: run.creditCap,
      allowedActions: run.allowedActions,
    });
  };

  return (
    <form className="screen" onSubmit={start}>
      <TopBar title="Echo run" step="04 / 08" onBack={() => go('world')} />
      <div className="content content--fit">
        <h2>Who do you want to connect with?</h2>
        <input
          className="input"
          id="runGoal"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          placeholder="People who ship side projects on weekends"
          autoFocus
          maxLength={120}
        />
      </div>
      <div className="footer">
        <button className="primary" type="submit" disabled={!goal.trim()}>
          Start the 24-hour Echo run <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
