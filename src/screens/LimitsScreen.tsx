import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { ALLOWED_ACTION_OPTIONS, RUN_GOAL } from '../state/mock';
import type { Run, ScreenProps } from '../state/types';

const PEOPLE_CHOICES = [1, 3, 5];
const REPLY_CHOICES = [1, 2, 3];

export function LimitsScreen({ actions, go, run }: ScreenProps & { run: Run }) {
  const [maxPeople, setMaxPeople] = useState(run.maxPeople);
  const [repliesPerPerson, setRepliesPerPerson] = useState(run.repliesPerPerson);
  const [creditCap, setCreditCap] = useState(run.creditCap);
  const [allowed, setAllowed] = useState<string[]>(run.allowedActions);

  const toggle = (id: string) =>
    setAllowed(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    );

  return (
    <div className="screen">
      <TopBar title="Echo limits" step="04 / 08" onBack={() => go('world')} />
      <div className="content">
        <div className="eyebrow">You stay in control</div>
        <h2>What can it do without you?</h2>
        <p className="lede">
          The Echo wakes only for a meaningful action. Twenty-four hours does not mean
          twenty-four hours of AI usage.
        </p>
        <div className="mission-card">
          <small>Goal for this run</small>
          <strong>{RUN_GOAL}</strong>
        </div>

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
            min={3}
            max={15}
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
            Travel, finding, dancing and building cost no AI credits. Only conversation,
            replanning and the final reflection spend credits.
          </span>
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          onClick={() =>
            actions.onStartRun({ maxPeople, repliesPerPerson, creditCap, allowedActions: allowed })
          }
        >
          Start the 24-hour Echo run <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
