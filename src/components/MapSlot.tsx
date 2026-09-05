import type { ReactNode } from 'react';

/**
 * Fills the map area. The map agent will render BengaluruMap from src/map as
 * children. Until then a stylised Bengaluru stands in.
 */
export function MapSlot({ children }: { children?: ReactNode }) {
  return <div id="map-slot">{children ?? <div className="map-fallback" aria-hidden="true" />}</div>;
}
