import { useState } from 'react';
import { MapPins } from '../components/MapPins';
import { MapSlot } from '../components/MapSlot';
import { Toast } from '../components/Toast';
import { ACTIONS, MISSION, placeById } from '../state/mock';
import type { ActionKind, Player, ScreenProps } from '../state/types';

interface WorldScreenProps extends ScreenProps {
  player: Player;
  toast: string | null;
}

/**
 * Live play. The map fills the screen and everything else floats on top, so
 * there is no page scroll at any viewport height.
 */
export function WorldScreen({ actions, go, player, toast }: WorldScreenProps) {
  const [used, setUsed] = useState<ActionKind[]>([]);

  const act = (kind: ActionKind) => {
    setUsed(current => (current.includes(kind) ? current : [...current, kind]));
    actions.onAct(kind);
  };

  return (
    <div className="screen screen--map">
      <div className="world-wrap">
        <MapSlot />
        <MapPins activePlaceId={player.currentPlace} onPick={actions.onTravel} />

        <header className="topbar topbar--map">
          <div className="brand">
            <span className="brand-mark">E</span> Bengaluru · Live
          </div>
          <button className="icon-btn" aria-label="Open profile">
            ☺
          </button>
        </header>

        <div className="map-hud">
          <div>
            <small>Tonight's mission</small>
            <strong>{MISSION}</strong>
          </div>
          <div className="timer">23:48</div>
        </div>

        <Toast message={toast} />

        <div className="map-sheet">
          <div className="sheet-inner">
            <div className="sheet-head">
              <div>
                <small>You are at</small>
                <h3 className="location-name">{placeById(player.currentPlace).name}</h3>
              </div>
              <span className="credit-pill">{player.credits} AI credits</span>
            </div>
            <div className="actions">
              {ACTIONS.map(action => (
                <button
                  key={action.kind}
                  className={used.includes(action.kind) ? 'action used' : 'action'}
                  onClick={() => act(action.kind)}
                  disabled={action.cost > player.credits}
                >
                  <span className="glyph" aria-hidden="true">
                    {action.icon}
                  </span>
                  {action.kind}
                  <span className="cost">{action.cost} cr</span>
                </button>
              ))}
            </div>
            <button className="handoff-btn" onClick={() => go('limits')}>
              Let my Echo continue for 24 hours →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
