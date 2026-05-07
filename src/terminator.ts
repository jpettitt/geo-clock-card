// Terminator polygon for an equirectangular map with a configurable
// center longitude. Vertices are returned in **eastward pixel-space
// longitude** lonE ∈ [0, 360], where lonE = 0 is the canvas's left
// edge and lonE = 360 is its right edge. With this parameterization
// x walks monotonically 0 → W and the polygon never crosses the seam
// mid-walk — the seam (centerLon ± 180) sits at lonE ∈ {0, 360}, i.e.
// the polygon's start and end.
//
// At each vertex the terminator latitude solves sun-elevation = 0:
//
//     0 = sin(lat)·sin(δ) + cos(lat)·cos(δ)·cos(H)
//   ⇒ tan(lat) = −cos(H) / tan(δ)        (H = realLon − λ_subsolar)
//
// δ is floored at a small epsilon to avoid 0/0 at exact equinox.

import type { SubsolarPoint } from './sun.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const MIN_ABS_DECL_DEG = 1e-4;

export type LonLat = readonly [number, number];

export interface TerminatorOptions {
  /** longitude step in degrees; smaller = smoother polygon. Default 1°. */
  stepDeg?: number;
  /** longitude that should appear at the center of the map.
   *  Default 180 (antimeridian-centered). */
  centerLon?: number;
}

/**
 * Just the great-circle curve (open polyline) of the terminator at
 * the given subsolar point. Use this when you want to stroke the
 * terminator boundary alone — without the closing path that wraps
 * around the dark pole.
 */
export function terminatorCurve(
  sub: SubsolarPoint,
  opts: TerminatorOptions = {},
): LonLat[] {
  const step = opts.stepDeg ?? 1;
  const centerLon = opts.centerLon ?? 180;
  const leftEdgeLon = centerLon - 180;

  let decl = sub.lat;
  if (Math.abs(decl) < MIN_ABS_DECL_DEG) {
    decl = decl >= 0 ? MIN_ABS_DECL_DEG : -MIN_ABS_DECL_DEG;
  }
  const tanDecl = Math.tan(decl * DEG);

  const points: LonLat[] = [];
  for (let lonE = 0; lonE <= 360; lonE += step) {
    const realLon = leftEdgeLon + lonE;
    const H = (realLon - sub.lon) * DEG;
    const lat = Math.atan(-Math.cos(H) / tanDecl) * RAD;
    points.push([lonE, lat]);
  }
  return points;
}

/**
 * Closed polygon covering the night hemisphere. Same as `terminatorCurve`
 * but with two extra vertices added at the dark pole's edge so the
 * polygon, when filled, occupies the dark side of the planet.
 */
export function terminatorPolygon(
  sub: SubsolarPoint,
  opts: TerminatorOptions = {},
): LonLat[] {
  const curve = terminatorCurve(sub, opts);

  let decl = sub.lat;
  if (Math.abs(decl) < MIN_ABS_DECL_DEG) {
    decl = decl >= 0 ? MIN_ABS_DECL_DEG : -MIN_ABS_DECL_DEG;
  }
  const darkPoleLat = decl > 0 ? -90 : 90;

  return [...curve, [360, darkPoleLat], [0, darkPoleLat]];
}
