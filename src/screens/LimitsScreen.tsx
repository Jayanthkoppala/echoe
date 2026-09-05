import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { ALLOWED_ACTION_OPTIONS, DEFAULT_ALLOWED } from '../state/copy';
import type { Run, ScreenName, ScreenProps } from '../state/types';

const PEOPLE_CHOICES = [1, 3, 5];
const REPLY_CHOICES = [1, 2, 3];

interface LimitsScreenProps extends ScreenProps {
  run?: Run;
  /** Limits edits a live run now, so it returns to whoever opened it. */
  backTo: ScreenName;
}

export function LimitsScreen({ actions, go, run, backTo }: LimitsScreenProps) {
  const [goal, setGoal] = useState(run?.goal ?? '');
  const [maxPeople, setMaxPeople] = useState(run?.maxPeople ?? 3);
  const [repliesPerPerson, setRepliesPerPerson] = useState(run?.repliesPerPerson ?? 2);
  const [creditCap, setCreditCap] = useState(run?.creditCap ?? 8);
  const [allowed, setAllowed] = useState<string[]>(run?.allowedActions ?? DEFAULT_ALLOWED);

  const toggle = (id: string) =>
    setAllowed(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    );

  return (
    <div className="screen">
      <TopBar title="Adjust limits" onBack={() => go(backTo)} />
      <div className="content">
        <div className="eyebrow">You stay in control</div>
        <h2>What can it do without you?</h2>
        <p className="lede">
          The Echoe wakes only for a meaningful action, so a long run is not a long AI bill.
          Saving restarts the run with these limits.
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

        <div className="setting">
          <div className="setting-head">
            <strong>People it may meet</strong>
            <span>{maxPeople} max</span>
          </div>
          <div className="choice-row">
            {PEOPLE_CHOICES.map(value => (
              <button
                key={value}
                className={value === maxPeople ? 'choice selected' : 'choice'}
                onClick={() => setMaxPeople(value)}
                aria-pressed={value === maxPeople}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-head">
            <strong>Replies per person</strong>
            <span>
              {repliesPerPerson} {repliesPerPerson === 1 ? 'reply' : 'replies'}
            </span>
          </div>
          <div className="choice-row">
            {REPLY_CHOICES.map(value => (
              <button
                key={value}
                className={value === repliesPerPerson ? 'choice selected' : 'choice'}
                onClick={() => setRepliesPerPerson(value)}
                aria-pressed={value === repliesPerPerson}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-head">
            <strong>Hard AI spend limit</strong>
            <span>{creditCap} credits</span>
          </div>
          <input
            className="range"
            type="range"
            min={1}
            max={8}
            value={creditCap}
            onChange={event => setCreditCap(Number(event.target.value))}
            aria-label="AI credit budget"
          />
        </div>

        <div className="setting">
          <div className="setting-head">
            <strong>Allowed actions</strong>
            <span>{allowed.length} enabled</span>
          </div>
          <div className="toggle-grid">
            {ALLOWED_ACTION_OPTIONS.map(option => (
              <button
                key={option.id}
                className={allowed.includes(option.id) ? 'toggle-action on' : 'toggle-action'}
                onClick={() => toggle(option.id)}
                aria-pressed={allowed.includes(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cost-note">
          <span aria-hidden="true">✦</span>
          <span>
            Travelling, finding and building cost no AI credits. Only talking and bluffing
            spend them.
          </span>
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!goal.trim() || allowed.length === 0}
          onClick={() =>
            actions.onStartRun({
              goal: goal.trim(),
              maxPeople,
              repliesPerPerson,
              creditCap,
              allowedActions: allowed,
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
