// Night-city map for Echoe. Base style is OpenFreeMap "dark"; everything below
// is an override on that style's own layers plus four layers of our own.
//
// Verified against MapLibre GL JS docs via Context7 (/maplibre/maplibre-gl-js):
//  - setPaintProperty / setLayoutProperty / setLayerZoomRange are the documented
//    way to change a loaded style's layers without replacing the style
//  - GeoJSON source + circle/symbol layer, updated per frame with setData
//  - Marker with a custom HTML element
// Property names, types and data-driven support checked against the installed
// style spec (@maplibre/maplibre-gl-style-spec/src/reference/v8.json): every
// expression below uses a property whose "property-type" is data-driven.
// Layer ids, their paint defaults and the sprite list come from fetching the
// style JSON and ofm.json directly, so no id here is guessed.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
// MapLibre 6 spawns its tile worker from a URL relative to its own module, which
// a bundler cannot resolve (see the v5 to v6 migration guide). Under Vite the
// documented fix is to bundle the worker with ?worker&url and register it once.
// Without this the worker 404s, no tile is ever requested, and the map is black.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import 'maplibre-gl/dist/maplibre-gl.css';
import { LANDMARKS } from '../data/landmarks';
import type { FeatureCollection, Point } from 'geojson';
import companiesJson from '../data/companies.json';
import { agentPosition, routeFor, type LngLat, type Leg } from './interpolate';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

// City view. Tuned by projecting all ten landmarks to screen coordinates and
// checking none lands under the header band or the bottom sheet; see
// docs/design/MAP-DESIGN.md.
const CENTER: LngLat = [77.6153, 12.9628];
const CITY_ZOOM = 11.95;
const CITY_PITCH = 55;
const CITY_BEARING = -15;

const LIME = '#d7f06c';

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
    zoom: CITY_ZOOM,
    pitch: CITY_PITCH,
    bearing: CITY_BEARING,
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
  /** Company slug for a verified employer, or 'domain' for an unseeded one. */
  badge?: string;
}

interface BengaluruMapProps {
  agents: AgentSpec[];
  onPlaceTap?: (placeId: string) => void;
  onCompanyTap?: (slug: string) => void;
  /**
   * Landmark that gets the lime ring. Falls back to where the player's own
   * Echoe is walking, so the ring is right on Roaming even if the caller
   * never passes this.
   */
  activePlaceId?: string;
}

const AGENTS_SOURCE_ID = 'agents';

// Roads in three steps. The dark style paints primary through tertiary in one
// layer, so the step comes from the feature's own class.
const ROAD_MAJOR_COLOUR = [
  'match',
  ['get', 'class'],
  ['trunk', 'primary'], '#cfd3c2',
  ['secondary', 'tertiary'], '#6d7c70',
  '#4a564e',
];

const PAINT: [string, string, unknown][] = [
  ['background', 'background-color', '#070c09'],

  // Water: deep teal-blue. Antialias on, or the lake edges come back jagged.
  // Dark enough that a lake filling the frame on a fly-to still reads obsidian;
  // the shoreline below is what makes water findable at city zoom.
  ['water', 'fill-color', '#0b2b39'],
  ['water', 'fill-antialias', true],
  ['waterway', 'line-color', '#1a4d61'],
  ['water_name', 'text-color', 'rgba(255,255,255,0.7)'],
  ['water_name', 'text-halo-color', 'rgba(4,20,26,0.9)'],
  ['water_name', 'text-halo-width', 1.4],

  // Greenery. The two greens differ in hue and value; the park layer also gets
  // a lit edge below, which is what separates a managed park from tree cover.
  ['landcover_wood', 'fill-color', '#12301d'],
  ['landcover_wood', 'fill-opacity', 0.72],
  ['landuse_park', 'fill-color', '#1c4a2c'],
  ['landuse_park', 'fill-opacity', 0.85],
  ['landuse_residential', 'fill-color', '#0c120e'],

  // Flat buildings below the 3D layer's minzoom: lifted a step off the ground
  // with a cool edge so blocks read as blocks.
  ['building', 'fill-color', '#101a15'],
  ['building', 'fill-outline-color', '#1d2a24'],

  // Road hierarchy. Motorway and primary are the only light warm-white lines.
  ['highway_motorway_inner', 'line-color', '#d9dccb'],
  ['highway_motorway_casing', 'line-color', 'rgba(3,7,5,0.9)'],
  ['highway_motorway_subtle', 'line-color', '#6d7c70'],
  ['highway_major_inner', 'line-color', ROAD_MAJOR_COLOUR],
  [
    'highway_major_inner',
    'line-opacity',
    ['match', ['get', 'class'], ['trunk', 'primary'], 1, ['secondary'], 0.85, 0.62],
  ],
  [
    'highway_major_inner',
    'line-width',
    ['interpolate', ['exponential', 1.3], ['zoom'], 10, 0.9, 13, 2.2, 20, 18],
  ],
  ['highway_major_casing', 'line-color', 'rgba(3,7,5,0.9)'],
  [
    'highway_major_casing',
    'line-width',
    ['interpolate', ['exponential', 1.3], ['zoom'], 10, 2.2, 13, 4.2, 20, 22],
  ],
  ['highway_major_subtle', 'line-color', '#4a564e'],

  // Minor roads carry the city's texture but must not draw a white web at 12.5.
  ['highway_minor', 'line-color', '#39443d'],
  [
    'highway_minor',
    'line-opacity',
    ['interpolate', ['linear'], ['zoom'], 11, 0.2, 13, 0.5, 16, 0.9],
  ],
  ['highway_path', 'line-color', '#2a332e'],
  ['highway_path', 'line-opacity', 0.45],

  // Railways: a dim rail with the ground colour dashed over it.
  ['railway', 'line-color', '#3d4d46'],
  [
    'railway',
    'line-width',
    ['interpolate', ['exponential', 1.3], ['zoom'], 13, 1.2, 20, 5],
  ],
  ['railway_dashline', 'line-color', '#070c09'],
  ['railway_transit', 'line-color', '#33403a'],
  ['railway_minor', 'line-color', '#33403a'],

  // Labels: white on a hard dark halo, nothing grey.
  ['highway_name_other', 'text-color', 'rgba(255,255,255,0.72)'],
  ['highway_name_other', 'text-halo-color', 'rgba(2,6,4,0.95)'],
  ['highway_name_other', 'text-halo-width', 1.4],
  ['highway_name_motorway', 'text-color', 'rgba(255,255,255,0.8)'],
  ['highway_name_motorway', 'text-halo-color', 'rgba(2,6,4,0.95)'],
  ['highway_name_motorway', 'text-halo-width', 1.4],
  ['place_suburb', 'text-color', 'rgba(255,255,255,0.62)'],
  ['place_suburb', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_suburb', 'text-halo-width', 1.4],
  ['place_suburb', 'text-halo-blur', 0.3],
  ['place_other', 'text-color', 'rgba(255,255,255,0.6)'],
  ['place_other', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_village', 'text-color', 'rgba(255,255,255,0.7)'],
  ['place_village', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_town', 'text-color', 'rgba(255,255,255,0.9)'],
  ['place_town', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_town', 'text-halo-width', 1.6],
  ['place_city', 'text-color', 'rgba(255,255,255,0.9)'],
  ['place_city', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_city', 'text-halo-width', 1.6],
  ['place_city_large', 'text-color', '#ffffff'],
  ['place_city_large', 'text-halo-color', 'rgba(2,6,4,0.92)'],
  ['place_city_large', 'text-halo-width', 1.6],

  ['boundary_state', 'line-color', '#2b3b34'],
  ['boundary_state', 'line-opacity', 0.5],
];

// Small caps are already on in this style; the spacing and size are not.
const LAYOUT: [string, string, unknown][] = [
  ['place_suburb', 'text-letter-spacing', 0.16],
  [
    'place_suburb',
    'text-size',
    ['interpolate', ['linear'], ['zoom'], 11, 9.5, 14, 11.5],
  ],
  ['place_town', 'text-letter-spacing', 0.2],
  ['place_city', 'text-letter-spacing', 0.2],
  ['place_city_large', 'text-letter-spacing', 0.2],
  [
    'place_town',
    'text-size',
    ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 13],
  ],
  [
    'place_city',
    'text-size',
    ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 13],
  ],
  ['highway_name_other', 'text-letter-spacing', 0.08],
];

// At city zoom the only names are suburbs, towns and cities. Street names and
// minor places wait for 14, where there is room for them.
const ZOOM_RANGE: [string, number, number][] = [
  ['highway_name_other', 14, 24],
  ['highway_name_motorway', 14, 24],
  ['place_other', 14, 16],
  ['place_village', 14, 16],
  ['water_name', 13, 24],
  // Rail from the city view up. Below zoom 12 the tiles carry no minor roads,
  // so the lines are what keep the ground from reading as empty.
  ['railway', 11, 24],
  ['railway_dashline', 11, 24],
];

// place_city_large is Bengaluru's own name. The header already says Bengaluru,
// and at 14px it lands straight across the landmark cluster, so it goes.
const HIDE = ['place_city_large'];

/* ── Company logo pins ──────────────────────────────────────────────────
   Symbol layer, not DOM markers, per docs/LOGO-PINS.md. Two things in the
   seed data forced a decision:
   1. companies.json rounds coordinates to two decimals, so 39 rows share only
      15 points and up to six companies stack exactly. Each group is spread on
      a small ring so every pin is reachable.
   2. The seeded `logo` field is a Google favicon URL. It renders in an <img>
      but serves no CORS header, so its pixels can never be read back off a
      canvas, which is what addImage needs. Checked live from this origin:
      google, duckduckgo and favicon.im all fail with crossOrigin, and the one
      service that passes it (unavatar) answered 20 of 39 with HTTP 429. So the
      logos are vendored same-origin by scripts/fetch-logos.sh instead. */

interface CompanyRow {
  name: string; domain: string; hq_area: string;
  lat: number; lng: number; category: string; logo: string;
}

const COMPANY_ROWS = companiesJson as CompanyRow[];
const FEATURED_COUNT = 12;
const BADGE_CHECK = 'badge-check';

const companySlug = (domain: string) => domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
const logoImageId = (slug: string) => `logo-${slug}`;

/** Fans a stack of identical coordinates onto a ~390m ring, deterministically. */
function spreadCoords(rows: CompanyRow[]): [number, number][] {
  const out: [number, number][] = rows.map(r => [r.lng, r.lat]);
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = `${r.lat},${r.lng}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  // ~660m. Smaller than the 1.1km error the two-decimal rounding already
  // carries, and enough to keep six logos apart at city zoom.
  const radius = 0.006;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.forEach((i, n) => {
      const angle = (2 * Math.PI * n) / members.length;
      const lat = rows[i].lat + radius * Math.sin(angle);
      const lng = rows[i].lng + (radius * Math.cos(angle)) / Math.cos((rows[i].lat * Math.PI) / 180);
      out[i] = [lng, lat];
    });
  }
  return out;
}

const COMPANY_COORDS = spreadCoords(COMPANY_ROWS);

const COMPANIES_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: COMPANY_ROWS.map((c, i) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: COMPANY_COORDS[i] },
    properties: {
      slug: companySlug(c.domain),
      name: c.name,
      domain: c.domain,
      category: c.category,
      area: c.hq_area,
      logoId: logoImageId(companySlug(c.domain)),
      featured: i < FEATURED_COUNT,
    },
  })),
};

/** logo image id -> row, so a missing image can be filled in on demand. */
const ROW_BY_IMAGE_ID = new Map(
  COMPANY_ROWS.map(c => [logoImageId(companySlug(c.domain)), c] as const)
);

// Drawn at 2x and added with pixelRatio 2, so the 48px chip stays crisp.
const CHIP_PX = 96;
const CHIP_R = 44;

function chipContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = CHIP_PX;
  canvas.height = CHIP_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return ctx;
}

function strokeRing(ctx: CanvasRenderingContext2D, colour = '#ffffff') {
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = colour;
  ctx.stroke();
}

const chipPixels = (ctx: CanvasRenderingContext2D) => ctx.getImageData(0, 0, CHIP_PX, CHIP_PX);

/** Two letters on a dark disc. Used for a 404 and as the instant placeholder. */
function initialsChip(name: string): ImageData {
  const ctx = chipContext();
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  ctx.fillStyle = '#182420';
  ctx.fill();
  strokeRing(ctx);
  const initials =
    name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2)
      .map(w => w[0]).join('').toUpperCase() || '?';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, CHIP_PX / 2, CHIP_PX / 2 + 2);
  return chipPixels(ctx);
}

/** Lime disc with a dark tick, for an agent whose employer is not in the seed. */
function checkChip(): ImageData {
  const ctx = chipContext();
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  ctx.fillStyle = LIME;
  ctx.fill();
  ctx.strokeStyle = '#0b120e';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(30, 50);
  ctx.lineTo(43, 63);
  ctx.lineTo(68, 34);
  ctx.stroke();
  return chipPixels(ctx);
}

async function logoChip(slug: string): Promise<ImageData> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(slug));
    // Same origin, so the canvas is never tainted and no CORS header is needed.
    // Vendored by scripts/fetch-logos.sh; a missing file falls back to initials.
    el.src = `/logos/${slug}.png`;
    setTimeout(() => reject(new Error(`timeout ${slug}`)), 8000);
  });
  const ctx = chipContext();
  ctx.save();
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  // Most favicons are transparent and drawn for a light ground.
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  ctx.drawImage(img, 6, 6, CHIP_PX - 12, CHIP_PX - 12);
  ctx.restore();
  strokeRing(ctx);
  return chipPixels(ctx);
}

/**
 * Six at a time, never awaited by the caller: the map paints immediately and
 * each pin sharpens from its initials placeholder as its logo lands.
 */
async function loadCompanyImages(map: maplibregl.Map, alive: () => boolean): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < COMPANY_ROWS.length && alive()) {
      const row = COMPANY_ROWS[next++];
      const slug = companySlug(row.domain);
      const id = logoImageId(slug);
      let data: ImageData;
      try {
        data = await logoChip(slug);
      } catch {
        data = initialsChip(row.name);
      }
      if (!alive()) return;
      try {
        if (map.hasImage(id)) map.updateImage(id, data);
        else map.addImage(id, data, { pixelRatio: 2 });
      } catch {
        // The map went away between the check and the write. Nothing to do.
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

export default function BengaluruMap({ agents, onPlaceTap, onCompanyTap, activePlaceId }: BengaluruMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const agentsRef = useRef<AgentSpec[]>(agents);
  const legsRef = useRef<Record<string, Leg>>({});
  const rafRef = useRef<number>(0);
  const pinsRef = useRef<Record<string, HTMLElement>>({});
  // The map is built once, so the handlers it closes over would be frozen at
  // their first-render values. This keeps the live ones reachable.
  const handlersRef = useRef({ onPlaceTap, onCompanyTap });

  agentsRef.current = agents;
  handlersRef.current = { onPlaceTap, onCompanyTap };

  useEffect(() => {
    if (!containerRef.current) return;
    // Flipped by the cleanup, so in-flight logo loads stop writing to a map
    // that has already been removed.
    let alive = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: CITY_ZOOM,
      pitch: CITY_PITCH,
      bearing: CITY_BEARING,
    });
    mapRef.current = map;

    const pins = pinsRef.current;
    LANDMARKS.forEach((place, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin';
      el.setAttribute('aria-label', place.name);
      // A <button> with no stylesheet is a white UA box sized to its text, which
      // is what a marker looks like in the window before styles.css hot-reloads.
      // These are the same values as .map-pin, written where CSS cannot be late.
      el.style.cssText =
        'display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;background:none;cursor:pointer';
      // Staggered so ten markers do not breathe in lockstep. Read by the
      // keyframe in styles.css; the animation is transform-only.
      el.style.setProperty('--map-pin-delay', `${(i % 5) * 0.44}s`);

      const chip = document.createElement('span');
      chip.className = 'map-pin__chip';
      chip.setAttribute('aria-hidden', 'true');
      chip.textContent = place.icon;

      const name = document.createElement('span');
      name.className = 'map-pin__name';
      name.textContent = place.name;

      el.append(chip, name);
      el.addEventListener('click', () => {
        flyToLandmark(map, place);
        handlersRef.current.onPlaceTap?.(place.id);
      });
      pins[place.id] = el;

      // anchor 'center' puts the chip's middle on the coordinate; the name is
      // taken out of flow in CSS so it hangs below without shifting the anchor.
      new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
    });

    map.on('load', () => {
      for (const [id, prop, value] of PAINT) {
        if (map.getLayer(id)) map.setPaintProperty(id, prop as never, value as never);
      }
      for (const [id, prop, value] of LAYOUT) {
        if (map.getLayer(id)) map.setLayoutProperty(id, prop as never, value as never);
      }
      for (const [id, min, max] of ZOOM_RANGE) {
        if (map.getLayer(id)) map.setLayerZoomRange(id, min, max);
      }
      for (const id of HIDE) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      }
      // The wood layer paints with a sprite pattern the style never ships
      // ("wood-pattern" is absent from ofm.json); a pattern also overrides
      // fill-color, so the greens only land once it is gone.
      if (map.getLayer('landcover_wood')) {
        map.setPaintProperty('landcover_wood', 'fill-pattern', undefined as never);
      }

      // Bengaluru's parks live in OpenMapTiles' `park` source layer and its
      // grass and scrub in `landcover`; the dark style only paints `landuse`
      // class=park, which is why Cubbon Park and Lalbagh stayed black.
      const vectorSource = (map.getStyle().layers ?? []).find(
        l => (l as { 'source-layer'?: string })['source-layer'] === 'water'
      ) as { source?: string } | undefined;
      const src = vectorSource?.source ?? 'openmaptiles';
      // Each of these inserts immediately before `waterway`, so the last one
      // added sits highest: canopy, then park, then the two lit edges.
      const beforeGreen = map.getLayer('waterway') ? 'waterway' : undefined;

      if (!map.getLayer('echoe-landcover')) {
        map.addLayer(
          {
            id: 'echoe-landcover',
            type: 'fill',
            source: src,
            'source-layer': 'landcover',
            filter: ['match', ['get', 'class'], ['grass', 'wood', 'farmland', 'scrub', 'wetland'], true, false],
            paint: { 'fill-color': '#12301d', 'fill-opacity': 0.62 },
          },
          beforeGreen
        );
      }
      if (!map.getLayer('echoe-park')) {
        map.addLayer(
          {
            id: 'echoe-park',
            type: 'fill',
            source: src,
            'source-layer': 'park',
            paint: { 'fill-color': '#1c4a2c', 'fill-opacity': 0.85 },
          },
          beforeGreen
        );
      }
      // A line layer over a polygon source-layer draws that polygon's boundary.
      // This lit rim is what makes a park read as a park rather than a dark
      // patch, and it is the visible difference against flat tree cover.
      if (!map.getLayer('echoe-park-edge')) {
        map.addLayer(
          {
            id: 'echoe-park-edge',
            type: 'line',
            source: src,
            'source-layer': 'park',
            paint: {
              'line-color': '#3a8a51',
              'line-opacity': 0.45,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.2, 17, 2],
            },
          },
          beforeGreen
        );
      }
      if (!map.getLayer('echoe-water-edge')) {
        map.addLayer(
          {
            id: 'echoe-water-edge',
            type: 'line',
            source: src,
            'source-layer': 'water',
            filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
            paint: {
              'line-color': '#2e7189',
              'line-opacity': 0.7,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1.4, 17, 2.4],
            },
          },
          beforeGreen
        );
      }

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
              // Taller blocks catch more light, which is what gives the skyline
              // depth instead of one flat grey mass.
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'render_height'], 0],
                0, '#14201a',
                30, '#1d2b24',
                90, '#26352e',
              ],
              // render_height is null on some features, which MapLibre warns
              // about and then treats as 0; coalescing says so on purpose.
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                14.5, ['coalesce', ['get', 'render_height'], 0],
              ],
              // The old expression read a feature property called "zoom", which
              // does not exist, so every base came out 0.
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.92,
              'fill-extrusion-vertical-gradient': true,
            },
          },
          labelLayer?.id
        );
      }

      // Company logo pins, under the agents so a live Echoe always reads on top.
      if (!map.hasImage(BADGE_CHECK)) map.addImage(BADGE_CHECK, checkChip(), { pixelRatio: 2 });
      // A layer referencing an image that has not arrived logs "image not
      // found" per feature. Answering the event with the initials chip gives
      // the pin something to draw immediately and keeps the console clean;
      // loadCompanyImages then swaps in the real logo with updateImage.
      map.on('styleimagemissing', (e: { id: string }) => {
        const row = ROW_BY_IMAGE_ID.get(e.id);
        if (!row || map.hasImage(e.id)) return;
        map.addImage(e.id, initialsChip(row.name), { pixelRatio: 2 });
      });

      map.addSource('companies', { type: 'geojson', data: COMPANIES_GEOJSON });

      // 0.45 at 12.5 and 0.8 at 15 as specified; the low end reaches down to
      // CITY_ZOOM because the city view is 11.95, not the 12.5 the spec assumed.
      const companyIconSize = [
        'interpolate', ['linear'], ['zoom'], CITY_ZOOM, 0.4, 12.5, 0.45, 15, 0.8,
      ];

      map.addLayer({
        id: 'company-pins-featured',
        type: 'symbol',
        source: 'companies',
        minzoom: CITY_ZOOM - 0.05,
        maxzoom: 13.5,
        filter: ['==', ['get', 'featured'], true],
        layout: {
          'icon-image': ['get', 'logoId'],
          'icon-size': companyIconSize as never,
          // Only twelve, and they are the point of the city view, so they draw
          // whatever else is in the way.
          'icon-allow-overlap': true,
        },
      });

      map.addLayer({
        id: 'company-pins-all',
        type: 'symbol',
        source: 'companies',
        minzoom: 13.5,
        layout: {
          'icon-image': ['get', 'logoId'],
          'icon-size': companyIconSize as never,
          // An empty text-field places no label, so the name simply starts at 14.
          'text-field': ['step', ['zoom'], '', 14, ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(2,6,4,0.95)',
          'text-halo-width': 1.4,
        },
      });

      map.on('click', ['company-pins-featured', 'company-pins-all'], (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const [lng, lat] = (feature.geometry as Point).coordinates as [number, number];
        // At pitch 60 the map centre sits low on screen, which puts the tapped
        // pin behind the sheet. The offset lifts it into the open band.
        map.flyTo({
          center: [lng, lat], zoom: 15.5, pitch: 60,
          offset: [0, -130],
          duration: 1400, curve: 1.4, essential: true,
        });
        handlersRef.current.onCompanyTap?.(String(feature.properties?.slug ?? ''));
      });

      // Deliberately not awaited: first paint must not wait on 39 logo fetches.
      void loadCompanyImages(map, () => alive);

      map.addSource(AGENTS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Soft outer glow on the player's own Echoe. circle-blur is a GPU
      // property, so this costs no frames and no DOM.
      map.addLayer({
        id: 'agents-glow',
        type: 'circle',
        source: AGENTS_SOURCE_ID,
        filter: ['==', ['get', 'isMine'], true],
        paint: {
          'circle-radius': ['+', 15, ['*', ['get', 'pulse'], 5], ['*', ['get', 'arrived'], 18]],
          'circle-color': LIME,
          'circle-blur': 1,
          'circle-opacity': ['*', 0.32, ['-', 1, ['*', ['get', 'arrived'], ['get', 'arrived']]]],
        },
      });

      map.addLayer({
        id: 'agents-circle',
        type: 'circle',
        source: AGENTS_SOURCE_ID,
        paint: {
          'circle-radius': [
            '+',
            ['case', ['get', 'isMine'], 7, 5],
            ['*', ['get', 'pulse'], 2],
            ['*', ['get', 'arrived'], 10],
          ],
          'circle-opacity': ['-', 1, ['*', ['get', 'arrived'], ['get', 'arrived']]],
          'circle-color': ['case', ['get', 'isMine'], LIME, ['get', 'colour']],
          'circle-stroke-width': ['case', ['get', 'isMine'], 2, 1.2],
          // A dark rim keeps the lime core separate from its own glow; everyone
          // else gets the thin white ring.
          'circle-stroke-color': [
            'case',
            ['get', 'isMine'],
            'rgba(6,12,9,0.9)',
            'rgba(255,255,255,0.85)',
          ],
        },
      });

      map.addLayer({
        id: 'agents-label',
        type: 'symbol',
        source: AGENTS_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          // Agent names sit above the dot, landmark names below the chip, so
          // the two never land in the same band even at the same coordinate.
          'text-offset': [0, -2.4],
          'text-anchor': 'bottom',
          'text-size': ['case', ['get', 'isMine'], 12, 11],
          'text-letter-spacing': 0.02,
          'text-padding': 4,
          'symbol-sort-key': ['case', ['get', 'isMine'], 0, 1],
        },
        paint: {
          // Every agent name is white. Lime stays on the player's own dot only.
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(2,6,4,0.95)',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.4,
        },
      });

      // Verified employer badge, top-right of the dot. Same source as the dot,
      // so it rides the existing setData and costs no extra per-frame work.
      // icon-offset is multiplied by icon-size, so [26,-26] at 0.3 is ~8px.
      map.addLayer({
        id: 'agents-badge',
        type: 'symbol',
        source: AGENTS_SOURCE_ID,
        filter: ['has', 'badgeIcon'],
        layout: {
          'icon-image': ['get', 'badgeIcon'],
          'icon-size': 0.3,
          'icon-offset': [26, -26],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
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
            // Only name an image that exists, or the layer logs a miss every
            // frame until the logo lands. Undefined drops out of the JSON, so
            // the layer's ['has','badgeIcon'] filter simply skips the feature.
            let badgeIcon: string | undefined;
            if (agent.badge === 'domain') badgeIcon = BADGE_CHECK;
            else if (agent.badge) {
              const id = logoImageId(agent.badge);
              badgeIcon = map.hasImage(id) ? id : BADGE_CHECK;
            }
            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [lng, lat] },
              properties: {
                colour: agent.colour,
                label: agent.label,
                isMine: !!agent.isMine,
                badgeIcon,
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
      alive = false;
      cancelAnimationFrame(rafRef.current);
      pinsRef.current = {};
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lime ring on the place the player is at. classList.toggle with an explicit
  // force is a no-op when the class is already in the right state, so this is
  // free on the renders where nothing moved.
  useEffect(() => {
    const here = activePlaceId ?? agents.find(a => a.isMine)?.toPlace;
    for (const [id, el] of Object.entries(pinsRef.current)) {
      el.classList.toggle('map-pin--here', id === here);
    }
  }, [activePlaceId, agents]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
