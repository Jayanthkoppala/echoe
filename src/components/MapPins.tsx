import { useEffect, useState } from 'react';
import { LANDMARKS } from '../data/landmarks';
import type { AgentSpec } from '../map/BengaluruMap';
import { avatarUri } from '../state/copy';

/** Chip centre for a landmark on the flat grid, in percent of the slot. Same layout as MapPins. */
function chipCentre(placeId: string): [number, number] {
  const index = Math.max(0, LANDMARKS.findIndex(l => l.id === placeId));
  return [12 + (index % 4) * 26, 23 + Math.floor(index / 4) * 18];
}

/** The rightmost column has no room to its right, so its stack hangs to the left. */
function hangsLeft(placeId: string): boolean {
  const index = Math.max(0, LANDMARKS.findIndex(l => l.id === placeId));
  return index % 4 === 3;
}

/**
 * Echoes on the flat fallback map. Phones without WebGL2 (Lockdown Mode, some
 * low-power states) never get MapLibre, so this draws the same agents between
 * the landmark chips with plain CSS: linear walk from the departure chip to the
 * arrival chip on the same clock the live map uses.
 */
export function FlatAgents({ agents }: { agents: AgentSpec[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Stack agents standing at the same chip so they do not hide each other, and
  // cap the stack: past three, one "+N" badge instead of a column that runs
  // into the row below. Mine is always shown.
  const MAX_STACK = 3;
  const seen = new Map<string, number>();
  const overflow = new Map<string, number>();
  const sorted = [...agents].sort((a, b) => Number(!!b.isMine) - Number(!!a.isMine));
  const placed = sorted.map(agent => {
        const [fx, fy] = chipCentre(agent.fromPlace);
        const [tx, ty] = chipCentre(agent.toPlace);
        const span = Math.max(1, agent.arriveMs - agent.departMs);
        const t = Math.min(1, Math.max(0, (now - agent.departMs) / span));
        const x = fx + (tx - fx) * t;
        const y = fy + (ty - fy) * t;
        const key = t >= 1 ? agent.toPlace : `${agent.id}-walk`;
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        if (n >= MAX_STACK) {
          overflow.set(key, (overflow.get(key) ?? 0) + 1);
          return null;
        }
        const leftSide = t >= 1 && hangsLeft(agent.toPlace);
        return (
          <div
            key={agent.id}
            className={`flat-agent${agent.isMine ? ' mine' : ''}${leftSide ? ' left' : ''}`}
            style={{
              left: `calc(${x}% ${leftSide ? '- 46px' : '+ 46px'})`,
              top: `calc(${y}% + ${8 + n * 34}px)`,
              borderColor: agent.colour,
            }}
          >
            {agent.avatar ? <img src={avatarUri(agent.avatar)} alt="" /> : null}
            <span>{agent.label}</span>
          </div>
        );
      });
  const badges = [...overflow.entries()].map(([placeId, more]) => {
    const [x, y] = chipCentre(placeId);
    return (
      <div key={`more-${placeId}`} className={`flat-agent more${hangsLeft(placeId) ? ' left' : ''}`} style={{ left: `calc(${x}% ${hangsLeft(placeId) ? '- 46px' : '+ 46px'})`, top: `calc(${y}% + ${8 + MAX_STACK * 34}px)` }}>
        <span>+{more} more</span>
      </div>
    );
  });
  return (
    <div className="flat-agents" aria-hidden="true">
      {placed}
      {badges}
    </div>
  );
}

interface MapPinsProps {
  activePlaceId: string;
  onPick?: (placeId: string) => void;
}

/** Flat fallback map pins, used only when MapLibre cannot start. */
export function MapPins({ activePlaceId, onPick }: MapPinsProps) {
  return (
    <div className="map-pins">
      {LANDMARKS.map((place, index) => (
        <button
          key={place.id}
          className={place.id === activePlaceId ? 'place active' : 'place'}
          style={{
            left: `${12 + (index % 4) * 26}%`,
            top: `${23 + Math.floor(index / 4) * 18}%`,
          }}
          onClick={onPick ? () => onPick(place.id) : undefined}
          disabled={!onPick}
          aria-label={`Travel to ${place.name}`}
        >
          {place.icon}
          <span className="place-label">{place.name}</span>
        </button>
      ))}
    </div>
  );
}
