import { MapSlot } from '../components/MapSlot';
import type { AgentSpec } from '../map/BengaluruMap';
import type { Run, ScreenProps } from '../state/types';

interface RoamingScreenProps extends ScreenProps {
  run?: Run;
  agents: AgentSpec[];
}

/** The Echo acts while the player is away. Every number here is a live row. */
export function RoamingScreen({ actions, run, agents }: RoamingScreenProps) {
  const paused = run?.status === 'paused';
  const creditsLeft = run ? Math.max(0, run.creditCap - run.creditsSpent) : 0;
  const spentPct = run && run.creditCap > 0 ? (run.creditsSpent / run.creditCap) * 100 : 0;

  const headline = run?.hasHost
    ? run.hostMet
      ? 'Your Echoes have met'
      : 'Walking towards your host'
    : run?.goal ?? 'Roaming Bengaluru';

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot agents={agents} />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Echo is roaming
          </div>
          <span className="timer tabular">{creditsLeft} cr left</span>
        </header>

        <div className="roam-overlay">
          <div className="roam-top">
            <div>
              <span className="live-dot">{paused ? 'Paused' : 'World running'}</span>
              <h2>{headline}</h2>
              <p>{run?.goal ?? 'Waiting for the first move'}</p>
            </div>
            <span className="credit-pill">{creditsLeft} left</span>
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${Math.min(100, spentPct)}%` }} />
          </div>
          <div className="roam-stats">
            <div className="roam-stat">
              <strong>{run?.placesVisited ?? 0}</strong>
              <span>places</span>
            </div>
            <div className="roam-stat">
              <strong>{run?.peopleMet ?? 0}</strong>
              <span>people</span>
            </div>
            <div className="roam-stat">
              <strong>{run?.built ?? 0}</strong>
              <span>built</span>
            </div>
          </div>
          <div className="roam-actions">
            <button className="pause-btn" onClick={actions.onPause}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="return-btn" onClick={actions.onEndRun}>
              Bring my Echo home →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
