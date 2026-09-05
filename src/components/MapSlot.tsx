import { Component, type ReactNode } from 'react';
import BengaluruMap, { type AgentSpec, type EventPin, type PinKind } from '../map/BengaluruMap';
import { FlatAgents, MapPins } from './MapPins';

/**
 * MapLibre needs WebGL. Where it is missing the constructor throws, so fall
 * back to the flat CSS map rather than taking the whole screen down.
 */
class MapBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean; reason: string }
> {
  state = { failed: false, reason: '' };

  static getDerivedStateFromError(error: unknown) {
    // Say why on screen, in our words. "The map is not working" on a phone is
    // undiagnosable from a laptop; one short line of the real cause is not.
    const raw = error instanceof Error ? error.message : String(error);
    // Chrome, Firefox and Edge on iPhone all run inside Apple's web view, which
    // does not hand out WebGL2. Safari on the same phone does. Verified live.
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const iosOtherBrowser = /iPhone|iPad/.test(ua) && /CriOS|FxiOS|EdgiOS|OPT\//.test(ua);
    const reason = /WebGL/i.test(raw)
      ? iosOtherBrowser
        ? 'this browser cannot show the live map on iPhone. Open the link in Safari'
        : 'this browser has WebGL2 switched off'
      : raw.slice(0, 90);
    return { failed: true, reason };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <>
        {this.props.fallback}
        <p className="map-error" role="status">
          Flat map: {this.state.reason || 'the live map could not start'}.
        </p>
      </>
    );
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
            <FlatAgents agents={agents} />
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
