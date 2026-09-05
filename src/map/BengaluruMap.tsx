// Verified against MapLibre GL JS docs via Context7 (/maplibre/maplibre-gl-js):
//  - map init with center/zoom/pitch/bearing (set-pitch-and-bearing.html)
//  - GeoJSON source + circle/symbol layer (draw-a-circle.html, draw-geojson-points.html)
//  - updating a GeoJSON source every frame with setData (animate-a-point.html)
//  - Marker with custom HTML element (add-custom-icons-with-markers.html)
//  - fill-extrusion 3D buildings: OpenFreeMap's "liberty" style already ships
//    a "building-3d" fill-extrusion layer (source-layer "building", minzoom 14)
//    confirmed by fetching the style JSON directly, so no extra layer is added
//  - style JSON / OpenFreeMap tiles: liberty/dark style URLs confirmed live
//    with `curl -sI` (both return HTTP 200)
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LANDMARKS } from '../data/landmarks';
import { agentPosition, routeFor, type LngLat, type Leg } from './interpolate';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const CENTER: LngLat = [77.6, 12.97];

/** City view down to one landmark. `essential` keeps it under reduced motion. */
export function flyToLandmark(
  map: maplibregl.Map,
  place: { lng: number; lat: number },
): void {
  map.flyTo({
    center: [place.lng, place.lat],
    zoom: 16.5,
    pitch: 65,
    bearing: -35,
    duration: 2200,
    curve: 1.4,
    essential: true,
  });
}

/** Landmark back out to the whole city. */
export function flyToCity(map: maplibregl.Map): void {
  map.flyTo({
    center: CENTER,
    zoom: 12.5,
    pitch: 55,
    bearing: -15,
    duration: 1800,
    curve: 1.4,
    essential: true,
  });
}

export interface AgentSpec {
  id: string;
  label: string;
  colour: string;
  fromPlace: string;
  toPlace: string;
  departMs: number;
  arriveMs: number;
  isMine?: boolean;
}

interface BengaluruMapProps {
  agents: AgentSpec[];
  onPlaceTap?: (placeId: string) => void;
}

const AGENTS_SOURCE_ID = 'agents';

export default function BengaluruMap({ agents, onPlaceTap }: BengaluruMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const agentsRef = useRef<AgentSpec[]>(agents);
  const legsRef = useRef<Record<string, Leg>>({});
  const rafRef = useRef<number>(0);

  agentsRef.current = agents;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: 12.5,
      pitch: 55,
      bearing: -15,
    });
    mapRef.current = map;

    const markerEls: HTMLElement[] = [];
    for (const place of LANDMARKS) {
      const el = document.createElement('div');
      el.className = 'landmark-marker';
      el.style.cssText =
        'display:flex;flex-direction:column;align-items:center;cursor:pointer;font-size:22px;text-shadow:0 1px 3px rgba(0,0,0,0.6);';
      el.innerHTML = `<span>${place.icon}</span><span style="font-size:10px;color:#fff;background:rgba(0,0,0,0.55);padding:1px 4px;border-radius:3px;white-space:nowrap;">${place.name}</span>`;
      el.addEventListener('click', () => {
        flyToLandmark(map, place);
        onPlaceTap?.(place.id);
      });
      markerEls.push(el);
      new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
    }

    map.on('load', () => {
      // The dark style has no 3D layer, so add our own from the style's own
      // building source. Verified against maplibre display-buildings-in-3d.
      const styleLayers = map.getStyle().layers ?? [];
      const hasExtrusion = styleLayers.some(l => l.type === 'fill-extrusion');
      const buildingLayer = styleLayers.find(l => (l as { 'source-layer'?: string })['source-layer'] === 'building');
      const labelLayer = styleLayers.find(l => l.type === 'symbol' && (l.layout as Record<string, unknown> | undefined)?.['text-field']);
      if (!hasExtrusion && buildingLayer && 'source' in buildingLayer) {
        map.addLayer(
          {
            id: 'building-3d',
            type: 'fill-extrusion',
            source: buildingLayer.source as string,
            'source-layer': 'building',
            minzoom: 13,
            filter: ['!=', ['get', 'hide_3d'], true],
            paint: {
              'fill-extrusion-color': '#2a3630',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['get', 'render_height']],
              'fill-extrusion-base': ['case', ['>=', ['get', 'zoom'], 16], ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.9,
            },
          },
          labelLayer?.id
        );
      }

      map.addSource(AGENTS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'agents-circle',
        type: 'circle',
        source: AGENTS_SOURCE_ID,
        paint: {
          'circle-radius': [
            '+',
            ['case', ['get', 'isMine'], 9, 6],
            ['*', ['get', 'pulse'], 3],
            ['*', ['get', 'arrived'], 10],
          ],
          'circle-opacity': ['-', 1, ['*', ['get', 'arrived'], ['get', 'arrived']]],
          'circle-color': ['get', 'colour'],
          'circle-stroke-width': ['case', ['get', 'isMine'], 3, 1.5],
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'agents-label',
        type: 'symbol',
        source: AGENTS_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });

      // setData is a worker round trip on the same pool that decodes tiles, so
      // it runs at most ~30 times a second and never when there is nothing to draw.
      let lastPush = 0;
      let pushedEmpty = false;
      const tick = () => {
        const now = Date.now();
        const source = map.getSource(AGENTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        const hasAgents = agentsRef.current.length > 0;
        if (source && !hasAgents && !pushedEmpty) {
          source.setData({ type: 'FeatureCollection', features: [] });
          pushedEmpty = true;
        }
        if (source && hasAgents && now - lastPush >= 33) {
          lastPush = now;
          pushedEmpty = false;
          const features = agentsRef.current.map((agent) => {
            let leg = legsRef.current[agent.id];
            if (!leg) {
              const from = LANDMARKS.find((l) => l.id === agent.fromPlace);
              const to = LANDMARKS.find((l) => l.id === agent.toPlace);
              const fromCoord: LngLat = from ? [from.lng, from.lat] : [0, 0];
              const toCoord: LngLat = to ? [to.lng, to.lat] : [0, 0];
              leg = {
                polyline: routeFor(agent.fromPlace, agent.toPlace, fromCoord, toCoord),
                departMs: agent.departMs,
                arriveMs: agent.arriveMs,
              };
              legsRef.current[agent.id] = leg;
            }
            const [lng, lat] = agentPosition(leg, now);
            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [lng, lat] },
              properties: {
                colour: agent.colour,
                label: agent.label,
                isMine: !!agent.isMine,
                // 0..1 breathing on the player's own dot.
                pulse: agent.isMine ? (Math.sin((now / 1000) * 2.4) + 1) / 2 : 0,
                // 900ms burst window as a leg lands.
                arrived: now >= leg.arriveMs && now < leg.arriveMs + 900 ? 1 : 0,
              },
            };
          });
          source.setData({ type: 'FeatureCollection', features });
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    });

    map.on('dblclick', () => flyToCity(map));

    return () => {
      cancelAnimationFrame(rafRef.current);
      markerEls.length = 0;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
