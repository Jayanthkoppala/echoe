import { Component, type ReactNode } from 'react';
import BengaluruMap, { type AgentSpec } from '../map/BengaluruMap';
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

interface MapSlotProps {
  agents: AgentSpec[];
  activePlaceId?: string;
  onPlaceTap?: (placeId: string) => void;
}

export function MapSlot({ agents, activePlaceId, onPlaceTap }: MapSlotProps) {
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
        <BengaluruMap agents={agents} onPlaceTap={onPlaceTap} />
      </MapBoundary>
    </div>
  );
}
