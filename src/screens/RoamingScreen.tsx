import { useEffect, useState } from 'react';
import { MapPins } from '../components/MapPins';
import { MapSlot } from '../components/MapSlot';
import { ROAM_STEPS } from '../state/mock';
import type { Run, ScreenProps } from '../state/types';

/**
 * The Echo acts while the player is away. The step walk is a local preview.
 * Wiring point: replace ROAM_STEPS with the live run rows from the module.
 */
export function RoamingScreen({ actions, go, run }: ScreenProps & { run: Run }) {
  const [index, setIndex] = useState(0);
  const running = run.status === 'running';

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % ROAM_STEPS.length), 1800);
    return () => clearInterval(timer);
  }, [running]);

  const step = ROAM_STEPS[index];

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot />
        <MapPins activePlaceId="" agent={{ x: step.x, y: step.y }} />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Echo is roaming
          </div>
          <span className="timer tabular">{step.time}</span>
        </header>

        <div className="roam-overlay">
          <div className="roam-top">
            <div>
              <span className="live-dot">World running</span>
              <h2>{step.headline}</h2>
              <p>{step.detail}</p>
            </div>
            <span className="credit-pill">{run.creditCap - step.spent} left</span>
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${step.pct}%` }} />
          </div>
          <div className="roam-stats">
            <div className="roam-stat">
              <strong>{step.places}</strong>
              <span>places</span>
            </div>
            <div className="roam-stat">
              <strong>{step.people}</strong>
              <span>people</span>
            </div>
            <div className="roam-stat">
              <strong>{step.built}</strong>
              <span>built</span>
            </div>
          </div>
          <div className="roam-actions">
            <button className="pause-btn" onClick={actions.onPause}>
              {running ? 'Pause' : 'Resume'}
            </button>
            <button className="return-btn" onClick={() => go('return')}>
              Preview my return →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
