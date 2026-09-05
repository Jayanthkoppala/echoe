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
import vcsJson from '../data/vcs.json';
import osmJson from '../data/companies-osm.json';
import { agentPosition, routeFor, type LngLat, type Leg } from './interpolate';
import { avatarUri } from '../state/copy';

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
  /** Avatar seed, rendered as the map icon. Empty means dot only. */
  avatar?: string;
  /** Company slug for a verified employer, or 'domain' for an unseeded one. */
  badge?: string;
}

interface BengaluruMapProps {
  agents: AgentSpec[];
  onPlaceTap?: (placeId: string) => void;
  onCompanyTap?: (slug: string) => void;
  /** Which pin kinds to show. 'place' is the ten landmark chips. Default all. */
  pinKinds?: PinKind[];
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

/* ── Map pins: startups, VCs and spots ───────────────────────────
   A symbol layer, not DOM markers, per docs/LOGO-PINS.md. Three facts about
   the data shaped this:
   1. Every source's `logo` is a Google favicon URL. It renders in an <img> but
      serves no CORS header, so its pixels can never be read back off a canvas,
      which is what addImage needs. Checked live from this origin: google,
      duckduckgo and favicon.im all fail with crossOrigin, and the one service
      that passes (unavatar) answered 20 of 39 with HTTP 429. Logos are
      therefore vendored same-origin by scripts/fetch-logos.sh.
   2. companies.json and vcs.json round coordinates to two decimals, so dozens
      of rows share a handful of points. Each group is fanned onto a small ring.
      companies-osm.json has real precision and is left alone.
   3. companies-osm.json is 763 rows, so everything unfeatured is clustered. */

export type PinKind = 'startup' | 'vc' | 'spot' | 'place';

interface PinRow {
  name: string;
  domain?: string;
  lat: number;
  lng: number;
  category?: string;
  logo?: string;
  kind?: PinKind;
  featured?: boolean;
  stage?: string;
}

// spots.json is still being generated. import.meta.glob resolves to an empty
// object when nothing matches, which a static import cannot do without
// breaking the build.
const spotModules = import.meta.glob('../data/spots.json', { eager: true, import: 'default' });
const spotsJson = (Object.values(spotModules)[0] ?? []) as PinRow[];

const FEATURED_COUNT = 12;
const BADGE_CHECK = 'badge-check';

const RING = { startup: '#ffffff', vc: LIME, spot: '#e0a458', place: '#ffffff' };

const slugOf = (row: PinRow) =>
  (row.domain?.split('.')[0] ?? row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Fans a stack of identical coordinates onto a ~660m ring, deterministically. */
function spreadCoords(rows: PinRow[]): void {
  const groups = new Map<string, PinRow[]>();
  for (const r of rows) {
    // Only the two-decimal sources collide; anything finer is already distinct.
    const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const radius = 0.006;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.forEach((r, n) => {
      const angle = (2 * Math.PI * n) / members.length;
      r.lat += radius * Math.sin(angle);
      r.lng += (radius * Math.cos(angle)) / Math.cos((r.lat * Math.PI) / 180);
    });
  }
}

/** One flat list, de-duplicated by domain so OSM does not repeat the seed. */
const PIN_ROWS: PinRow[] = (() => {
  const seed = (companiesJson as PinRow[]).map((r, i) => ({ ...r, kind: 'startup' as const, featured: i < FEATURED_COUNT }));
  const vcs = (vcsJson as PinRow[]).map(r => ({ ...r, kind: 'vc' as const, featured: true }));
  const osm = (osmJson as PinRow[]).map(r => ({ ...r, kind: 'startup' as const }));
  const spots = spotsJson.map(r => ({ ...r, kind: 'spot' as const }));

  const out: PinRow[] = [];
  const seen = new Set<string>();
  for (const r of [...seed, ...vcs, ...spots, ...osm]) {
    const key = `${r.kind}:${r.domain || r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r });
  }
  // Coordinates are mutated in place, which is why every row was copied above.
  spreadCoords(out);
  return out;
})();

/** image id -> row, so a chip can be drawn the moment the map asks for it. */
const ROW_BY_IMAGE_ID = new Map<string, PinRow>();

const featureFor = (row: PinRow) => {
  let id = `pin-${row.kind}-${slugOf(row)}`;
  for (let n = 2; ROW_BY_IMAGE_ID.has(id); n++) id = `pin-${row.kind}-${slugOf(row)}-${n}`;
  ROW_BY_IMAGE_ID.set(id, row);
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [row.lng, row.lat] },
    properties: {
      slug: slugOf(row),
      name: row.name,
      domain: row.domain ?? '',
      category: row.category ?? '',
      kind: row.kind as string,
      stage: row.stage ?? '',
      logoId: id,
    },
  };
};

// Startups and spots are both in the hundreds, so each unfeatured set gets its
// own clustered source. A cluster carries no kind, so one source per kind is
// what lets the filter hide clusters exactly rather than approximately. VCs are
// only 44 and stay whole.
const isUnclustered = (r: PinRow) => r.kind === 'vc' || !!r.featured;

const collect = (rows: PinRow[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: rows.map(featureFor),
});

const PINS_MAIN = collect(PIN_ROWS.filter(isUnclustered));
const PINS_REST = collect(PIN_ROWS.filter(r => !isUnclustered(r) && r.kind === 'startup'));
const SPOTS_REST = collect(PIN_ROWS.filter(r => !isUnclustered(r) && r.kind === 'spot'));

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

/** A dark disc with initials, or a glyph for a spot with no logo. */
function fallbackChip(row: PinRow): ImageData {
  const ctx = chipContext();
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  ctx.fillStyle = '#182420';
  ctx.fill();
  strokeRing(ctx, RING[row.kind ?? 'startup']);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (row.kind === 'spot') {
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText(row.category === 'cafe' ? '\u2615' : '\u{1F37A}', CHIP_PX / 2, CHIP_PX / 2 + 2);
  } else {
    const initials =
      row.name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2)
        .map(w => w[0]).join('').toUpperCase() || '?';
    ctx.font = '700 34px Inter, system-ui, sans-serif';
    ctx.fillText(initials, CHIP_PX / 2, CHIP_PX / 2 + 2);
  }
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

async function logoChip(row: PinRow): Promise<ImageData> {
  const slug = slugOf(row);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(slug));
    // Same origin, so the canvas is never tainted and no CORS header is needed.
    // Vendored by scripts/fetch-logos.sh; a missing file falls back to a chip.
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
  strokeRing(ctx, RING[row.kind ?? 'startup']);
  return chipPixels(ctx);
}

/** Prefix on an agent's icon id. The rest of the id is the avatar seed. */
const AVATAR_IMAGE = 'av:';

/**
 * The same deterministic face the DOM renders, rasterised once per seed for the
 * map. Data URI in, so the canvas is never tainted and nothing hits the network.
 */
async function avatarChip(seed: string): Promise<ImageData> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(seed));
    el.src = avatarUri(seed);
  });
  const ctx = chipContext();
  ctx.save();
  ctx.beginPath();
  ctx.arc(CHIP_PX / 2, CHIP_PX / 2, CHIP_R, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, CHIP_PX, CHIP_PX);
  ctx.restore();
  return chipPixels(ctx);
}

/**
 * Demand-driven, so 800 favicons never start on load. MapLibre raises
 * styleimagemissing only for an image a currently visible feature needs, which
 * is the in-view rule for free; the browser's own six-per-origin cap is the
 * batch size. The chip is drawn at once so the pin is never empty and the
 * console never logs a missing image, then the logo replaces it if there is one.
 */
async function serveMissingImage(map: maplibregl.Map, id: string, alive: () => boolean): Promise<void> {
  if (map.hasImage(id)) return;
  if (id.startsWith(AVATAR_IMAGE)) {
    const data = await avatarChip(id.slice(AVATAR_IMAGE.length));
    if (alive() && !map.hasImage(id)) map.addImage(id, data, { pixelRatio: 2 });
    return;
  }
  const row = ROW_BY_IMAGE_ID.get(id);
  if (!row) return;
  // Awaited by MapLibre, so nothing is ever reported missing: try the vendored
  // logo first and fall back to a drawn chip.
  let data: ImageData;
  try {
    // Spots never fetch: 872 rows, and a mug reads better than a favicon.
    data = row.logo && row.kind !== 'spot' ? await logoChip(row) : fallbackChip(row);
  } catch {
    data = fallbackChip(row);
  }
  if (!alive() || map.hasImage(id)) return;
  map.addImage(id, data, { pixelRatio: 2 });
}

const ALL_KINDS: PinKind[] = ['startup', 'vc', 'spot', 'place'];

/**
 * Filters the pin layers in place, never rebuilding a source. 'place' means the
 * ten landmark chips, which are DOM markers, so they take a class instead.
 * A cluster carries no kind, so the cluster layers are toggled whole. That is
 * exact because pins-rest holds startups only.
 */
function applyPinKinds(map: maplibregl.Map, kinds: PinKind[], pins: Record<string, HTMLElement>): void {
  const symbolKinds = kinds.filter(k => k !== 'place');
  const kindFilter = symbolKinds.length
    ? ['match', ['get', 'kind'], symbolKinds, true, false]
    : ['==', ['get', 'kind'], '\u0000'];

  if (map.getLayer('pin-featured')) map.setFilter('pin-featured', ['all', ['!=', ['get', 'kind'], 'spot'], kindFilter] as never);
  if (map.getLayer('pin-spots')) map.setFilter('pin-spots', ['all', ['==', ['get', 'kind'], 'spot'], kindFilter] as never);
  if (map.getLayer('pin-rest')) map.setFilter('pin-rest', ['all', ['!', ['has', 'point_count']], kindFilter] as never);

  for (const [kind, ids] of [
    ['startup', ['pin-clusters', 'pin-cluster-count']],
    ['spot', ['spot-clusters', 'spot-cluster-count', 'spot-rest']],
  ] as [PinKind, string[]][]) {
    const on = kinds.includes(kind) ? 'visible' : 'none';
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on);
  }

  const placesOn = kinds.includes('place');
  for (const el of Object.values(pins)) el.classList.toggle('map-pin--off', !placesOn);
}

export default function BengaluruMap({ agents, onPlaceTap, onCompanyTap, activePlaceId, pinKinds = ALL_KINDS }: BengaluruMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const agentsRef = useRef<AgentSpec[]>(agents);
  const legsRef = useRef<Record<string, Leg>>({});
  const rafRef = useRef<number>(0);
  const pinsRef = useRef<Record<string, HTMLElement>>({});
  // The map is built once, so the handlers it closes over would be frozen at
  // their first-render values. This keeps the live ones reachable.
  const handlersRef = useRef({ onPlaceTap, onCompanyTap });
  const kindsRef = useRef(pinKinds);

  agentsRef.current = agents;
  handlersRef.current = { onPlaceTap, onCompanyTap };
  kindsRef.current = pinKinds;

  useEffect(() => {
    if (!containerRef.current) return;
    // Flipped by the cleanup, so in-flight logo loads stop writing to a map
    // that has already been removed.
    let alive = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Attribution must stay (ODbL), but the compact toggle keeps it out of the sheet.
      attributionControl: { compact: true },
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

      // Pins sit under the agents so a live Echoe always reads on top.
      if (!map.hasImage(BADGE_CHECK)) map.addImage(BADGE_CHECK, checkChip(), { pixelRatio: 2 });
      // The resolver is awaited before MapLibre calls an image missing, so this
      // is silent where a styleimagemissing listener logs a warning per pin.
      map.setMissingStyleImageResolver(id => serveMissingImage(map, id, () => alive));

      map.addSource('pins', { type: 'geojson', data: PINS_MAIN });
      const clustered = { cluster: true, clusterRadius: 40, clusterMaxZoom: 14 } as const;
      map.addSource('pins-rest', { type: 'geojson', data: PINS_REST, ...clustered });
      map.addSource('spots-rest', { type: 'geojson', data: SPOTS_REST, ...clustered });

      // 0.45 at 12.5 and 0.8 at 15 as asked; the low end reaches down to
      // CITY_ZOOM because the city view is 11.95, not the 12.5 the spec assumed.
      const pinIconSize = [
        'interpolate', ['linear'], ['zoom'], CITY_ZOOM, 0.4, 12.5, 0.45, 15, 0.8,
      ];
      // The VC tag hangs under the name; an empty text-field places nothing, so
      // labels simply begin at 14.
      const pinLabel = [
        'step', ['zoom'], '',
        14, ['case', ['==', ['get', 'kind'], 'vc'], ['concat', ['get', 'name'], '\nVC'], ['get', 'name']],
      ];
      const pinText = {
        'text-field': pinLabel as never,
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-offset': [0, 1.4] as [number, number],
        'text-anchor': 'top' as const,
        'text-optional': true,
      };
      const pinPaint = {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(2,6,4,0.95)',
        'text-halo-width': 1.4,
      };

      // Featured startups, every VC and featured spots. Spots hold back to 13
      // so the city view stays about companies.
      map.addLayer({
        id: 'pin-featured',
        type: 'symbol',
        source: 'pins',
        minzoom: CITY_ZOOM - 0.05,
        filter: ['!=', ['get', 'kind'], 'spot'],
        layout: { 'icon-image': ['get', 'logoId'], 'icon-size': pinIconSize as never, 'icon-allow-overlap': true, ...pinText },
        paint: pinPaint,
      });

      map.addLayer({
        id: 'pin-spots',
        type: 'symbol',
        source: 'pins',
        minzoom: 13,
        filter: ['==', ['get', 'kind'], 'spot'],
        layout: { 'icon-image': ['get', 'logoId'], 'icon-size': pinIconSize as never, ...pinText },
        paint: pinPaint,
      });

      // Everything unfeatured, clustered. Glass to match the sheet, without a
      // blur: this is a WebGL circle, so the fill and ring do the work.
      map.addLayer({
        id: 'pin-clusters',
        type: 'circle',
        source: 'pins-rest',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(16,22,18,0.82)',
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
      });

      map.addLayer({
        id: 'pin-cluster-count',
        type: 'symbol',
        source: 'pins-rest',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Spots cluster in amber so a pub cluster never reads as a company one.
      map.addLayer({
        id: 'spot-clusters',
        type: 'circle',
        source: 'spots-rest',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'rgba(56,38,20,0.82)',
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(224,164,88,0.55)',
        },
      });

      map.addLayer({
        id: 'spot-cluster-count',
        type: 'symbol',
        source: 'spots-rest',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'spot-rest',
        type: 'symbol',
        source: 'spots-rest',
        minzoom: 13.5,
        filter: ['!', ['has', 'point_count']],
        layout: { 'icon-image': ['get', 'logoId'], 'icon-size': pinIconSize as never, ...pinText },
        paint: pinPaint,
      });

      map.addLayer({
        id: 'pin-rest',
        type: 'symbol',
        source: 'pins-rest',
        minzoom: 13.5,
        filter: ['!', ['has', 'point_count']],
        layout: { 'icon-image': ['get', 'logoId'], 'icon-size': pinIconSize as never, ...pinText },
        paint: pinPaint,
      });

      const PIN_LAYERS = ['pin-featured', 'pin-spots', 'pin-rest', 'spot-rest'];

      map.on('click', PIN_LAYERS, (e) => {
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

      // Documented cluster tap: expand to the zoom that breaks it apart.
      for (const [layer, sourceId] of [['pin-clusters', 'pins-rest'], ['spot-clusters', 'spots-rest']] as const) {
        map.on('click', layer, async (e) => {
          const [feature] = map.queryRenderedFeatures(e.point, { layers: [layer] });
          if (!feature) return;
          const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(feature.properties!.cluster_id as number);
          map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom });
        });
      }

      applyPinKinds(map, kindsRef.current, pinsRef.current);

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
          // Sized to sit just behind the avatar icon, so it reads as its ring.
          'circle-radius': [
            '+',
            ['case', ['get', 'isMine'], 17, 15],
            ['*', ['get', 'pulse'], 2],
            ['*', ['get', 'arrived'], 10],
          ],
          'circle-opacity': ['-', 1, ['*', ['get', 'arrived'], ['get', 'arrived']]],
          'circle-color': ['case', ['get', 'isMine'], LIME, ['get', 'colour']],
          'circle-stroke-width': ['case', ['get', 'isMine'], 3, 1.2],
          // The face covers the fill, so the ring is the highlight: lime on the
          // player's own Echoe, a thin white rim on everyone else.
          'circle-stroke-color': [
            'case',
            ['get', 'isMine'],
            LIME,
            'rgba(255,255,255,0.85)',
          ],
        },
      });

      // The face itself. Same source as the dot, so it rides the same setData.
      map.addLayer({
        id: 'agents-avatar',
        type: 'symbol',
        source: AGENTS_SOURCE_ID,
        filter: ['has', 'icon'],
        layout: {
          'icon-image': ['get', 'icon'],
          // 96px chip at pixelRatio 2 is 48 CSS px, so this is ~30px on screen.
          'icon-size': 0.62,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
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
              // Reuses the pin sprite when that company is on the map, so the
              // badge is the real logo rather than a second copy of it.
              const id = `pin-startup-${agent.badge}`;
              badgeIcon = map.hasImage(id) ? id : BADGE_CHECK;
            }
            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [lng, lat] },
              properties: {
                colour: agent.colour,
                label: agent.label,
                // Resolved by setMissingStyleImageResolver on first sight, so
                // the dot draws immediately and the face lands a frame later.
                icon: agent.avatar ? `${AVATAR_IMAGE}${agent.avatar}` : undefined,
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
  // Re-filter when the World filter row changes. Keyed on the joined value so a
  // fresh array with the same kinds does not re-run it.
  const kindsKey = pinKinds.join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getLayer('pin-featured')) applyPinKinds(map, kindsRef.current, pinsRef.current);
  }, [kindsKey]);

  useEffect(() => {
    const here = activePlaceId ?? agents.find(a => a.isMine)?.toPlace;
    for (const [id, el] of Object.entries(pinsRef.current)) {
      el.classList.toggle('map-pin--here', id === here);
    }
  }, [activePlaceId, agents]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
