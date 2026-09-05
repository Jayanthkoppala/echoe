import { Component, type ReactNode } from 'react';
import BengaluruMap, { type AgentSpec, type EventPin, type PinKind } from '../map/BengaluruMap';
import { MapPins } from './MapPins';

/**
 * MapLibre needs WebGL. Where it is missing the constructor throws, so fall
 * back to the flat CSS map rather than taking the whole screen down.
 */
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type { EventPin, PinKind } from '../map/BengaluruMap';

interface MapSlotProps {
  agents: AgentSpec[];
  activePlaceId?: string;
  pinKinds?: PinKind[];
  onPlaceTap?: (placeId: string) => void;
  onEventTap?: (event: EventPin) => void;
  followMine?: number;
}

export function MapSlot({ agents, activePlaceId, pinKinds, onPlaceTap, onEventTap, followMine }: MapSlotProps) {
  return (
    <div id="map-slot">
      <MapBoundary
        fallback={
          <>
            <div className="map-fallback" aria-hidden="true" />
            <MapPins activePlaceId={activePlaceId ?? ''} onPick={onPlaceTap} />
          </>
        }
      >
        <BengaluruMap agents={agents} onPlaceTap={onPlaceTap} onEventTap={onEventTap} activePlaceId={activePlaceId} pinKinds={pinKinds} followMine={followMine} />
      </MapBoundary>
      {/* The OpenFreeMap "liberty" basemap is light. This sinks it to obsidian
          without touching the map component. */}
      <div className="map-scrim" aria-hidden="true" />
    </div>
  );
}
