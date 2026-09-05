import { TopBar } from '../components/TopBar';
import type { ScreenProps } from '../state/types';

const LOOP = [
  'Join and play live',
  'Set limits and hand over control',
  'Echoe acts while you are away',
  'Return, inspect and correct',
];

export function DoneScreen({ go }: ScreenProps) {
  return (
    <div className="screen">
      <TopBar title="Echoe" step="Loop complete" showMark />
      <div className="content">
        <div className="complete-mark" aria-hidden="true">
          ✓
        </div>
        <div className="eyebrow">Ready for another day</div>
        <h1>Your Echoe changed because you returned.</h1>
        <p className="lede">
          The world persisted, every action left a receipt, and one correction improved the
          next run.
        </p>
        <div className="loop-list">
          {LOOP.map((step, position) => (
            <div className="loop-row" key={step}>
              <b>{position + 1}</b> {step}
            </div>
          ))}
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go('world')}>
          Start tomorrow's run <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={() => go('join')}>
          Replay from the start
        </button>
      </div>
    </div>
  );
}
