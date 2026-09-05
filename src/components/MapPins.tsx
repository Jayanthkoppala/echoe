import { LANDMARKS } from '../data/landmarks';

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
            top: `${16 + Math.floor(index / 4) * 26}%`,
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
