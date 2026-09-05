import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import {
  AVOID_PLACEHOLDER,
  FREE_CONVERSATIONS,
  GOAL_PLACEHOLDER,
  REVEAL_PLACEHOLDER,
  START_EYEBROW,
} from '../state/copy';
import type { Run, ScreenName, ScreenProps } from '../state/types';

interface LimitsScreenProps extends ScreenProps {
  run?: Run;
  /** The Start page is a side door off World, so it returns where it came from. */
  backTo: ScreenName;
  freeLeft: number;
  linked: boolean;
  /**
   * The reveal payload lives in a private table the client cannot read back,
   * so App keeps the last one submitted this session and hands it back here.
   */
  reveal: string;
}

export function LimitsScreen({
  actions,
  go,
  run,
  backTo,
  freeLeft,
  linked,
  reveal: revealIn,
}: LimitsScreenProps) {
  const [goal, setGoal] = useState(run?.goal ?? '');
  const [avoid, setAvoid] = useState(run?.avoid ?? '');
  const [reveal, setReveal] = useState(revealIn);

  return (
    <div className="screen">
      <TopBar title="Start your Echoe" onBack={() => go(backTo)} />
      <div className="content content--close">
        <div className="eyebrow">{START_EYEBROW}</div>
        <h2>Start your Echoe</h2>
        <p className="lede">
          Your Echoe carries these three lines through the city. Nobody sees the third one until
          you both decide you want to meet.
        </p>

        <label className="label" htmlFor="goal">
          Who do you want to meet?
        </label>
        <textarea
          className="textarea textarea--line"
          id="goal"
          value={goal}
          onChange={event => setGoal(event.target.value)}
          placeholder={GOAL_PLACEHOLDER}
          maxLength={120}
        />

        <label className="label" htmlFor="avoid">
          Who do you NOT want to meet?
        </label>
        <textarea
          className="textarea textarea--line"
          id="avoid"
          value={avoid}
          onChange={event => setAvoid(event.target.value)}
          placeholder={AVOID_PLACEHOLDER}
          maxLength={120}
        />

        <label className="label label--reveal" htmlFor="reveal">
          ✦ What will you reveal if you like someone?
        </label>
        <input
          className="input"
          id="reveal"
          value={reveal}
          onChange={event => setReveal(event.target.value)}
          placeholder={REVEAL_PLACEHOLDER}
          maxLength={200}
        />
        <p className="helper helper--tight">
          Kept private. Your Echoe never reads it and never says it.
        </p>

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
              avoid: avoid.trim(),
              reveal: reveal.trim(),
            })
          }
        >
          Start <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={() => go(backTo)}>
          Not now
        </button>
      </div>
    </div>
  );
}
