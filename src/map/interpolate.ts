import routes from '../data/routes.json';

export type LngLat = [number, number];

const routeMap = routes as unknown as Record<string, LngLat[]>;

/** Haversine distance in metres between two [lng, lat] points. */
function distance(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative distance (metres) at each vertex of a polyline, starting at 0. */
export function cumulativeDistances(polyline: LngLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + distance(polyline[i - 1], polyline[i]));
  }
  return cum;
}

/** Point at fraction (0..1) of the way along a polyline, by arc length. */
export function pointAtFraction(polyline: LngLat[], fraction: number): LngLat {
  if (polyline.length === 0) return [0, 0];
  if (polyline.length === 1) return polyline[0];
  const f = Math.min(1, Math.max(0, fraction));
  const cum = cumulativeDistances(polyline);
  const total = cum[cum.length - 1];
  const target = total * f;

  for (let i = 1; i < cum.length; i++) {
    if (target <= cum[i]) {
      const segLen = cum[i] - cum[i - 1];
      const segT = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
      const [ax, ay] = polyline[i - 1];
      const [bx, by] = polyline[i];
      return [ax + (bx - ax) * segT, ay + (by - ay) * segT];
    }
  }
  return polyline[polyline.length - 1];
}

export function easeInOutQuad(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - ((-2 * c + 2) ** 2) / 2;
}

export interface Leg {
  polyline: LngLat[];
  departMs: number;
  arriveMs: number;
}

/** Position of an agent along its leg's polyline at the given wall-clock time. */
export function agentPosition(leg: Leg, nowMs: number): LngLat {
  const { polyline, departMs, arriveMs } = leg;
  if (polyline.length === 0) return [0, 0];
  if (nowMs <= departMs) return polyline[0];
  if (nowMs >= arriveMs) return polyline[polyline.length - 1];
  const duration = arriveMs - departMs;
  const rawT = duration === 0 ? 1 : (nowMs - departMs) / duration;
  return pointAtFraction(polyline, easeInOutQuad(rawT));
}

/** Straight two-point line fallback when no route exists for a pair. */
function straightLine(a: LngLat, b: LngLat): LngLat[] {
  return [a, b];
}

/**
 * Looks up the route between two landmark ids in routes.json, trying both
 * key orders and reversing the polyline as needed. Falls back to a straight
 * line between the given coordinates if no route is found.
 */
export function routeFor(
  aId: string,
  bId: string,
  aCoord: LngLat,
  bCoord: LngLat,
): LngLat[] {
  const forward = routeMap[`${aId}__${bId}`];
  if (forward) return forward;
  const reverse = routeMap[`${bId}__${aId}`];
  if (reverse) return [...reverse].reverse();
  return straightLine(aCoord, bCoord);
}
