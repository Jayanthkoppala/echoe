import { MapSlot } from '../components/MapSlot';
import { ProfileButton } from '../components/ProfileButton';
import type { AgentSpec } from '../map/BengaluruMap';
import { usd } from '../state/copy';
import type { Player, Run, ScreenProps } from '../state/types';

interface RoamingScreenProps extends ScreenProps {
  onAdjustLimits: () => void;
  onProfile: () => void;
  onlineCount: number;
  player?: Player;
  run?: Run;
  agents: AgentSpec[];
}

/** The Echoe acts while the player is away. Every number here is a live row. */
export function RoamingScreen({
  actions,
  onAdjustLimits,
  onProfile,
  onlineCount,
  player,
  run,
  agents,
}: RoamingScreenProps) {
  const paused = run?.status === 'paused';
  const spent = usd(run?.spentUsd ?? 0);

  const met = run?.peopleMet ?? 0;
  const places = run?.placesVisited ?? 0;

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
            <span className="brand-mark">E</span> Roaming
          </div>
          <span className="step-count">{onlineCount} online</span>
          <ProfileButton
            name={player?.name ?? '?'}
            avatar={player?.avatar ?? 'circle'}
            onClick={onProfile}
          />
        </header>

        <div className="roam-overlay glass">
          <div className="roam-top">
            <div>
              <span className="live-dot">{paused ? 'Paused' : 'World running'}</span>
              <h2>{headline}</h2>
              {/* Fix 6: the goal was printed twice. Live counts go here instead. */}
              <p>
                {places} {places === 1 ? 'place' : 'places'} · {met}{' '}
                {met === 1 ? 'Echoe' : 'Echoes'} met
              </p>
            </div>
            <span className="credit-pill">{spent}</span>
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
          </div>

          <div className="roam-actions">
            <button className="pause-btn" onClick={actions.onPause}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="pause-btn" onClick={onAdjustLimits}>
              Adjust limits
            </button>
            <button className="return-btn wide" onClick={actions.onEndRun}>
              Bring my Echoe home →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
