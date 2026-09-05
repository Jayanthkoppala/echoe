import { MapSlot } from '../components/MapSlot';
import { ShareCard } from '../components/ShareCard';
import { Toast } from '../components/Toast';
import type { AgentSpec } from '../map/BengaluruMap';
import { landmarkById } from '../data/landmarks';
import { ACTIONS } from '../state/copy';
import type { ActionKind, Player, ScreenProps } from '../state/types';

interface WorldScreenProps extends ScreenProps {
  player?: Player;
  agents: AgentSpec[];
  intent: string;
  shareId: string;
  mission: string;
  placeCount: number;
  toast: string | null;
}

/** Live play. The map fills the screen, everything else floats over it. */
export function WorldScreen({
  actions,
  go,
  player,
  agents,
  intent,
  shareId,
  mission,
  placeCount,
  toast,
}: WorldScreenProps) {
  const credits = player?.credits ?? 0;
  const placeName = player ? landmarkById(player.currentPlace)?.name ?? '—' : '—';

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot
          agents={agents}
          activePlaceId={player?.currentPlace}
          onPlaceTap={actions.onTravel}
        />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Bengaluru · Live
          </div>
          <span className="timer tabular">{placeCount} places</span>
        </header>

        <ShareCard intent={intent} shareId={shareId} mission={mission} />

        <Toast message={toast} />

        <div className="map-sheet">
          <div className="sheet-inner">
            <div className="sheet-head">
              <div>
                <small>You are at</small>
                <h3 className="location-name">{placeName}</h3>
              </div>
              <span className="credit-pill">{credits} AI credits</span>
            </div>
            <div className="actions">
              {ACTIONS.map(action => (
                <button
                  key={action.kind}
                  className="action"
                  onClick={() => actions.onAct(action.kind as ActionKind)}
                  disabled={action.cost > credits}
                >
                  <span className="glyph" aria-hidden="true">
                    {action.icon}
                  </span>
                  {action.label}
                  <span className="cost">{action.cost} cr</span>
                </button>
              ))}
            </div>
            <button className="handoff-btn" onClick={() => go('limits')}>
              Let my Echoe keep going without me →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
