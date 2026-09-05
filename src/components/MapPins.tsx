import { OTHER_AGENTS, PLACES } from '../state/mock';

interface MapPinsProps {
  activePlaceId: string;
  /** Agent position as map percentages. Falls back to the active place. */
  agent?: { x: number; y: number };
  onPick?: (placeId: string) => void;
}

/** Place pins and agents drawn over whatever map is in the slot. */
export function MapPins({ activePlaceId, agent, onPick }: MapPinsProps) {
  const active = PLACES.find(p => p.id === activePlaceId) ?? PLACES[0];
  const me = agent ?? { x: active.x, y: active.y };

  return (
    <div className="map-pins">
      {PLACES.map(place => (
        <button
          key={place.id}
          className={place.id === activePlaceId ? 'place active' : 'place'}
          style={{ left: `${place.x}%`, top: `${place.y}%`, ['--place-color' as string]: place.color }}
          onClick={onPick ? () => onPick(place.id) : undefined}
          disabled={!onPick}
          aria-label={`Travel to ${place.name}`}
        >
          {place.icon}
          <span className="place-label">{place.name}</span>
        </button>
      ))}
      <i className="map-agent" style={{ left: `${me.x}%`, top: `${me.y}%` }} />
      {OTHER_AGENTS.map(other => (
        <i
          key={other.id}
          className="map-agent other-agent"
          style={{ left: `${other.x}%`, top: `${other.y}%`, ['--agent-color' as string]: other.color }}
        />
      ))}
    </div>
  );
}
